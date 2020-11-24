/*!
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
const bnid = require('bnid');
const {config} = bedrock;
const database = require('bedrock-mongodb');
const logger = require('./logger');
const LedgerNodeWorkSession = require('./LedgerNodeWorkSession');

const {get: getLedgerNode} = require('./rootApi');

// in memory (per process instance) concurrent work session tracking var
let runningConsensusWorkSessions = 0;
// variables for controlling scheduler wake up/exit
let resolveSchedulerExited;
let exitScheduler = false;
const schedulerExited = new Promise(r => resolveSchedulerExited = r);
let cooldownTimeoutId = null;

// module API
const api = {};
module.exports = api;

bedrock.events.on('bedrock.ready', async () => {
  if(config.ledger.jobs.scheduleConsensusWork.enabled) {
    // start consensus work scheduler
    const id = await bnid.generateId({fixedLength: true});
    process.nextTick(async () => {
      try {
        await api._scheduleConsensusWork({id});
      } catch(e) {
        logger.error(
          `Critical error in consensus work scheduler (${id}). Exiting...`,
          {error: e});
        process.exit(1);
      }
    });
  }
});

bedrock.events.on('bedrock.exit', async () => {
  // tell scheduler to exit and wake it up
  exitScheduler = true;
  clearTimeout(cooldownTimeoutId);
  cooldownTimeoutId = null;
  await schedulerExited;
});

api._hasher = require('./hasher');
api._rdfCanonizeAndHash = require('./rdfCanonizeAndHash');

/**
 * Scans for ledger nodes that have not been inspected by their consensus
 * plugin and notifies the consensus plugin to run a worker, if desired.
 *
 * @param job the current job.
 *
 * @return a Promise that resolves once the operation completes.
 */
api._scheduleConsensusWork = async job => {
  const {id: jobId} = job;
  logger.verbose(`Starting consensus work scheduler (${jobId})...`);

  const {
    cooldown,
    workSessionConcurrencyPerInstance
  } = config.ledger.jobs.scheduleConsensusWork;

  let rejectedLedgerNodeId = null;
  while(!exitScheduler) {
    try {
      if(runningConsensusWorkSessions === workSessionConcurrencyPerInstance) {
        // cooldown until woken up by configured delay or finished work session
        await _cooldown({job, cooldown});
        rejectedLedgerNodeId = null;
        continue;
      }

      // get a new or stalled ledger node to perform work on
      const ledgerNodeId = await getLruLedgerNode();
      if(!ledgerNodeId || rejectedLedgerNodeId === ledgerNodeId) {
        // no ledger nodes to claim or we've claimed the just rejected ledger
        // node, so enter cooldown
        await _cooldown({job, cooldown});
        rejectedLedgerNodeId = null;
        continue;
      }

      // claim the selected ledger node with this worker's ID
      if(!await claimLedgerNode({job})) {
        // another process happened to claim ledger node we tried to claim,
        // so loop and try again
        continue;
      }

      // offer the claimed ledger node to its consensus plugin to reserve it
      const ledgerNode = await getLedgerNode(null, ledgerNodeId, {});
      const accepted = await offer({job, ledgerNode});
      if(accepted) {
        rejectedLedgerNodeId = null;
      } else {
        // offer not accepted, release the scheduler's claim on it, it will
        // be updated so it should not be chosen again as the LRU ledger node
        // unless there are no other ledger nodes in the system, in which case
        // we need to enter cooldown, so track `rejectedLedgerNodeId`
        await releaseClaim({job, ledgerNodeId});
        rejectedLedgerNodeId = ledgerNodeId;
      }
    } catch(e) {
      logger.error(`Error in consensus work scheduler (${jobId}).`, {error: e});
      // enter cooldown
      await _cooldown({job, cooldown});
      rejectedLedgerNodeId = null;
    }
  }

  resolveSchedulerExited();
};

async function claimLedgerNode({job, ledgerNodeId}) {
  // "claim" ledger node by marking it with scheduler worker ID
  const {claimTtl} = config.ledger.jobs.scheduleConsensusWork;
  const claimExpires = Date.now() + claimTtl;
  const query = {
    id: database.hash(ledgerNodeId),
    'meta.deleted': {$exists: false},
    $or: [
      {'meta.workSession.id': null},
      {'meta.workSession.expires': {$lte: Date.now()}}
    ]
  };
  const update = {
    $set: {
      'meta.workSession': {id: job.id, expires: claimExpires},
      'meta.updated': Date.now()
    }
  };
  const collection = database.collections.ledgerNode;
  const singleUpdateOptions = bedrock.util.extend(
    {}, database.writeOptions, {upsert: false, multi: false});
  const result = await collection.update(query, update, singleUpdateOptions);
  if(result.result.n) {
    // ledger node record successfully marked
    return ledgerNodeId;
  }
  // another process marked the record before we could; not an error,
  // return `null` to signal an attempt can be made again to mark a
  // different ledger node
  return null;
}

async function releaseClaim({job, ledgerNodeId}) {
  // clear any node claimed by the scheduler (there can only be one at
  // the most)
  const query = {
    id: database.hash(ledgerNodeId),
    'meta.workSession.id': job.id
  };
  const update = {
    $set: {
      'meta.workSession': null,
      'meta.updated': Date.now()
    }
  };
  const collection = database.collections.ledgerNode;
  const singleUpdateOptions = bedrock.util.extend(
    {}, database.writeOptions, {upsert: false, multi: false});
  await collection.update(query, update, singleUpdateOptions);
}

async function getLruLedgerNode() {
  // find ledger node that was least recently updated
  const query = {
    'meta.deleted': {$exists: false},
    $or: [
      {'meta.workSession.id': null},
      {'meta.workSession.expires': {$lte: Date.now()}}
    ]
  };
  const collection = database.collections.ledgerNode;
  const [record] = await collection.find(query, {'ledgerNode.id': 1})
    .sort({'meta.updated': 1})
    .limit(1).toArray();
  if(!record) {
    // no ledger nodes to work on
    return false;
  }
  return record.ledgerNode.id;
}

async function offer({job, ledgerNode}) {
  // skip if `scheduleWork` is undefined on the consensus plugin API
  if(!ledgerNode.consensus.scheduleWork) {
    return;
  }
  runningConsensusWorkSessions++;
  const session = new LedgerNodeWorkSession({
    schedulerId: job.id,
    ledgerNode,
    onFinish() {
      runningConsensusWorkSessions--;
      // wake up scheduler
      clearTimeout(cooldownTimeoutId);
      cooldownTimeoutId = null;
    }
  });
  try {
    await ledgerNode.consensus.scheduleWork({session});
  } catch(e) {
    logger.error(
      'Error while scheduling work session in consensus work scheduler ' +
      `(${job.id})`, {error: e});
  }
  if(!session.started) {
    runningConsensusWorkSessions--;
  }
  return session.started;
}

async function _cooldown({job, cooldown}) {
  logger.verbose(`Consensus work scheduler (${job.id}) entering cooldown.`);
  return new Promise(resolve => {
    cooldownTimeoutId = setTimeout(resolve, cooldown);
  });
}
