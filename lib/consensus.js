/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
const {config} = require('bedrock');
const database = require('bedrock-mongodb');
const {jsonld} = bedrock;
const scheduler = require('bedrock-jobs');
const {callbackify} = bedrock.util;
const LedgerNodeWorkSession = require('./LedgerNodeWorkSession');

const {get: getLedgerNode} = require('./rootApi');

// jobs
const namespace = 'ledger-node';
const JOB_SCHEDULE_CONSENSUS_WORK =
  `${namespace}.jobs.scheduleConsensusWork`;

const logger = bedrock.loggers.get('app').child(namespace);

// in memory (per process instance) concurrent work session tracking var
let runningConsensusWorkSessions = 0;

// module API
const api = {};
module.exports = api;

bedrock.events.on('bedrock.init', () => {
  if(config.ledger.jobs.scheduleConsensusWork.enabled) {
    scheduler.define(JOB_SCHEDULE_CONSENSUS_WORK, api._scheduleConsensusWork);
  }
});

api._hasher = require('./hasher');

/**
 * Scans for ledger nodes that have not been inspected by their consensus
 * plugin and notifies the consensus plugin to run a worker, if desired.
 *
 * @param job the current job.
 * @param callback() called once the operation completes.
 */
api._scheduleConsensusWork = callbackify(async (job, callback) => {
  logger.verbose(
    `Running worker (${job.worker.id}) to schedule consensus work...`);

  const start = Date.now();
  const {ttl} = config.ledger.jobs.scheduleConsensusWork;
  const thisWorkerExpires = start + ttl;
  const concurrency = config.ledger.jobs.scheduleConsensusWork.
    workSessionConcurrencyPerInstance;
  const collection = database.collections.ledgerNode;
  const singleUpdateOptions = bedrock.util.extend(
    {}, database.writeOptions, {upsert: false, multi: false});

  while(
    runningConsensusWorkSessions < concurrency &&
    thisWorkerExpires >= Date.now()) {
    try {
      // claim a new or stalled ledgerNode with this worker's ID
      const ledgerNodeId = await claimLedgerNode();
      if(!ledgerNodeId) {
        if(ledgerNodeId === false) {
          // no ledger nodes to claim, stop worker
          break;
        }
        // another process happened to grabbed a ledger node we tried to
        // claim, so loop and try again
        continue;
      }

      // offer claimed ledger node to a consensus plugin to reserve it
      const ledgerNode = await getLedgerNode(null, ledgerNodeId, {});
      offer(ledgerNode);
    } catch(e) {
      logger.error(
        `Error while scheduling consensus work on worker (${job.worker.id})`,
        {error: e});
      break;
    }
  }

  // clear any node claimed by the scheduler
  const query = {
    'meta.workSession.id': job.worker.id
  };
  const update = {
    $set: {
      'meta.workSession': null,
      'meta.updated': Date.now()
    }
  };
  try {
    collection.update(query, update, singleUpdateOptions);
  } catch(e) {
    logger.error(
      `Error after scheduling consensus work on worker (${job.worker.id})`,
      {error: err});
  } finally {
    logger.verbose(
      `Schedule consensus work worker (${job.worker.id}) finished.`);
  }

  async function claimLedgerNode() {
    const ledgerNodeId = await getLruLedgerNode();
    if(!ledgerNodeId) {
      // no ledger nodes to work on
      return false;
    }

    // "claim" ledger node by marking it with scheduler worker ID
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
        'meta.workSession': {id: job.worker.id, expires: thisWorkerExpires},
        'meta.updated': Date.now()
      }
    };
    const result = await collection.update(
      query, update, singleUpdateOptions);
    if(result.result.n) {
      // ledger node record successfully marked
      return ledgerNodeId;
    }
    // another process marked the record before we could; not an error,
    // return `null` to signal an attempt can be made again to mark a
    // different ledger node
    return null;
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
    const record = await collection.find(query, {'ledgerNode.id': 1})
      .sort({'meta.updated': 1})
      .limit(1).toArray()[0];
    if(!record) {
      // no ledger nodes to work on
      return false;
    }
    return record.ledgerNode.id;
  }

  function offer(ledgerNode) {
    // skip if `scheduleWork` is undefined on the consensus plugin API
    if(!ledgerNode.consensus.scheduleWork) {
      return;
    }
    runningConsensusWorkSessions++;
    // schedule offering to reserve ledger node for a work session
    process.nextTick(() => {
      const session = new LedgerNodeWorkSession({
        schedulerId: job.worker.id,
        ledgerNode,
        onFinish() {
          runningConsensusWorkSessions--;
        }
      });
      ledgerNode.consensus.scheduleWork(session, ledgerNode);
      if(!session.started) {
        runningConsensusWorkSessions--;
      }
    });
  }
});
