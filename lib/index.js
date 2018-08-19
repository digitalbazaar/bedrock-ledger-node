/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const config = require('bedrock').config;
const crypto = require('crypto');
const database = require('bedrock-mongodb');
const jsonld = bedrock.jsonld;
const multibase = require('multibase');
const multihash = require('multihashes');
const scheduler = require('bedrock-jobs');
const uuid = require('uuid/v4');
const {callbackify, BedrockError} = bedrock.util;
const {promisify} = require('util');
const injector = new (require('bedrock-injector')).Injector();
const LedgerNode = require('./ledger-node');
const LedgerNodeWorkSession = require('./LedgerNodeWorkSession');

require('./config');

// module permissions
const PERMISSIONS = config.permission.permissions;

// jobs
const namespace = 'ledger-node';
const JOB_SCHEDULE_CONSENSUS_WORK =
  `${namespace}.jobs.scheduleConsensusWork`;

// module API
const api = {};
module.exports = api;

const logger = bedrock.loggers.get('app').child(namespace);

// in memory (per module instance) concurrent work session tracking var
let runningConsensusWorkSessions = 0;

bedrock.events.on('bedrock.init', () => {
  if(config.ledger.jobs.scheduleConsensusWork.enabled) {
    scheduler.define(
      JOB_SCHEDULE_CONSENSUS_WORK, api.consensus._scheduleConsensusWork);
  }
});

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await promisify(database.openCollections)(['ledgerNode']);
  await promisify(database.createIndexes)([{
    collection: 'ledgerNode',
    fields: {id: 1},
    options: {unique: true, background: false}
  }, {
    collection: 'ledgerNode',
    fields: {'meta.deleted': 1},
    options: {unique: false, background: false}
  }, {
    collection: 'ledgerNode',
    fields: {'meta.workSession.id': 1, 'meta.updated': 1},
    options: {unique: false, background: false}
  }, {
    collection: 'ledgerNode',
    fields: {'meta.updated': 1, 'meta.workSession.expires': 1},
    options: {unique: false, background: false}
  }]);
  await bedrock.events.emit('bedrock-ledger-node.ready');
});

/**
 * Registers or retrieves a ledger plugin.
 *
 * A plugin can be registered to extend the capabilities of the ledger
 * subsystem by adding new storage, consensus, and authorization mechanisms.
 *
 * @param capabilityName (required) the name of the capability.
 * @param [capabilityValue | undefined] either the value of the capability:
 *          type type type of plugin (e.g. 'storage', 'authorization',
 *            'consensus').
 *          api the javascript API for the plugin.
 *        or `undefined` to use this function as a synchronous getter.
 */
api.use = (capabilityName, capabilityValue) =>
  injector.use(capabilityName, capabilityValue);

/**
 * Creates a new ledger node. The given options will determine if the ledger
 * node will become the first node for a new ledger or if it will mirror
 * and existing ledger.
 *
 * If `options.configEvent` is given, then a new ledger will be created and
 * the ledger node will be its first member.
 *
 * If a `options.genesisBlock` is given, then an existing ledger will be
 * mirrored by the new ledger node.
 *
 * actor - the actor performing the action.
 * options - a set of options used when creating the ledger node.
 *   ledgerConfiguration - the configuration for a brand new ledger.
 *   genesisBlock - the genesis block for an existing ledger.
 *   peerLedgerAgents - a list of Web Ledger Agent peer URLs to associate with
 *     the ledger node; these may be optionally used by a consensus method.
 *   owner - the owner of the ledger node
 *     (default: `undefined`, anyone can access the node).
 *   storage - the storage subsystem for the ledger node (default: 'mongodb').
 *
 * @return a Promise that resolves to a LedgerNode instance.
 */
api.add = callbackify(async (actor, options) => {
  if(!(!options.ledgerConfiguration ^ !options.genesisBlock)) {
    throw new TypeError(
      'One and one only of `options.configEvent` or `options.genesisBlock` ' +
      'must be specified.');
  }

  if(options.genesisBlock) {
    // ensure WebLedgerEventBlock is specified and it has at least one
    // event in it
    const block = options.genesisBlock;
    if(!(typeof block === 'object' &&
      jsonld.hasValue(block, 'type', 'WebLedgerEventBlock') &&
      Array.isArray(block.event) && block.event.length >= 1)) {
      throw new BedrockError(
        'The provided genesis block is malformed. ' +
        'An object with `type` set to `WebLedgerEventBlock` does not exist.',
        'DataError',
        {httpStatusCode: 400, public: true, genesisBlock: block});
    }
  }

  // get initial config
  let ledgerConfiguration = null;
  if(options.ledgerConfiguration) {
    ledgerConfiguration = options.ledgerConfiguration;
  } else {
    const configEvent = options.genesisBlock.event[0];
    // ensure WebLedgerConfiguration is specified
    if(configEvent && typeof configEvent === 'object' &&
      configEvent.ledgerConfiguration &&
      typeof configEvent.ledgerConfiguration === 'object') {
      ledgerConfiguration = configEvent.ledgerConfiguration;
    }
  }

  // FIXME: generalize configuration validation and call generalized method
  if(!(ledgerConfiguration && jsonld.hasValue(
    ledgerConfiguration, 'type', 'WebLedgerConfiguration'))) {
    throw new BedrockError(
      'The provided configuration event is malformed. ' +
      'An object with `type` set to `WebLedgerConfiguration` does not exist.',
      'DataError',
      {httpStatusCode: 400, public: true, ledgerConfiguration});
  }

  // ensure consensus method is specified
  if(!ledgerConfiguration.consensusMethod) {
    throw new BedrockError(
      'The provided configuration event is malformed. ' +
      '`consensusMethod` is a required `WebLedgerConfiguration` property.',
      'DataError',
      {httpStatusCode: 400, public: true, ledgerConfiguration});
  }
  // ensure ledger ID is specified
  if(!ledgerConfiguration.ledger) {
    throw new BedrockError(
      'The provided configuration event is malformed. Ledger ID not specified.',
      'DataError',
      {httpStatusCode: 400, public: true, ledgerConfiguration});
  }

  const storage = {plugin: 'mongodb', storagePlugins: []};
  // set defaults
  if(options.storage) {
    if(typeof options.storage === 'string') {
      storage.plugin = options.storage;
    }
    if(_.isPlainObject(options.storage)) {
      _.assign(storage, options.storage);
    }
  }

  const node = {
    id: 'urn:uuid:' + uuid(),
    ledger: ledgerConfiguration.ledger,
    owner: options.owner || null,
    peerLedgerAgent: options.peerLedgerAgents || [],
    storage: {
      plugin: storage.plugin,
      id: null
    }
  };

  // TODO: it may not be necessary to hash all of these values
  const record = {
    id: database.hash(node.id),
    ledger: database.hash(node.ledger),
    storage: database.hash(node.storage.plugin),
    owner: node.owner ? database.hash(node.owner) : null,
    ledgerNode: node,
    meta: {
      created: Date.now(),
      updated: Date.now()
    }
  };

  // FIXME: it may be necessary to check for both LEDGER_CREATE and
  // LEDGER_ACCESS permissions in this API because the actor ends up with
  // a handle that can be used to access the ledger without utilizing the
  // `get` API.

  // only need to check permissions when `owner` is set, otherwise a
  // ledgerNode with no owner is a valid public ledger
  if(node.owner) {
    await brPermission.checkPermission(
      actor, PERMISSIONS.LEDGER_CREATE, {
        resource: node,
        translate: 'owner'
      });
  }

  const {api: storageApi} = injector.use(storage.plugin);
  const ledgerStorage = await storageApi.add({}, {
    ledgerId: node.ledger, ledgerNodeId: node.id,
    plugins: storage.storagePlugins
  });

  record.ledgerNode.storage.id = ledgerStorage.id;

  try {
    await database.collections.ledgerNode.insert(record, database.writeOptions);
  } catch(e) {
    if(database.isDuplicateError(e)) {
      throw new BedrockError(
        'Duplicate ledger node.', 'DuplicateError', {
          public: true,
          httpStatusCode: 409
        });
    }
    throw e;
  }

  const {api: consensusApi} = injector.use(ledgerConfiguration.consensusMethod);

  const ledgerNode = new LedgerNode({
    id: node.id,
    ledger: node.ledger,
    storage: ledgerStorage,
    consensus: consensusApi,
    injector
  });

  // write initial config
  await ledgerNode.config.change({
    ledgerConfiguration,
    genesis: true,
    genesisBlock: options.genesisBlock
  });

  return ledgerNode;
});

/**
 * Gets a ledger node given a ledgerNodeId and a set of options.
 *
 * @param actor - the actor performing the action.
 * @param ledgerNodeId - the URI of the ledger node.
 * @param [options] - a set of options used when creating the ledger.
 *
 * @return a Promise that resolves to a LedgerNode instance.
 */
api.get = callbackify(async (actor, ledgerNodeId, options = {}) => {
  const query = {
    id: database.hash(ledgerNodeId),
    'meta.deleted': {
      $exists: false
    }
  };
  const record = await database.collections.ledgerNode.findOne(query, {});
  if(!record) {
    throw new BedrockError(
      'Ledger node not found.',
      'NotFound',
      {httpStatusCode: 404, ledger: ledgerNodeId, public: true});
  }
  // only need to check permissions if the ledger is owned, otherwise it
  // is public
  if(record.ledgerNode.owner) {
    await brPermission.checkPermission(
      actor, PERMISSIONS.LEDGER_ACCESS,
      {resource: record.ledgerNode, translate: 'owner'});
  }

  const {api: storageApi} = injector.use(record.ledgerNode.storage.plugin);
  const storage = await storageApi.get(record.ledgerNode.storage.id, {});

  const config = await storage.events.getLatestConfig();
  if(_.isEmpty(config)) {
    throw new BedrockError(
      'Ledger configuration is not available.',
      'InvalidStateError',
      {httpStatusCode: 400, ledger: ledgerNodeId, public: true});
  }

  const {ledgerConfiguration} = config.event;
  const {api: consensus} = injector.use(ledgerConfiguration.consensusMethod);

  return new LedgerNode({
    id: record.ledgerNode.id,
    ledger: record.ledgerNode.ledger,
    storage,
    consensus,
    injector
  });
});

/**
 * Delete an existing ledger given a ledgerId and a set of options.
 *
 * @param actor - the actor performing the action.
 * @param ledgerNodeId - the URI of the ledger.
 * @param storage - the storage subsystem for the ledger
 * @param [options] - a set of options used when deleting the ledger.
 *
 * @return a Promise that resolves once the operation completes.
 */
api.remove = callbackify(async (actor, ledgerNodeId, options = {}) => {
  options.owner = options.owner || null;

  const record = await database.collections.ledgerNode.findOne(
    {id: database.hash(ledgerNodeId)});
  if(!record) {
    throw new BedrockError(
      'Ledger node not found.',
      'NotFound',
      {httpStatusCode: 404, ledger: ledgerNodeId, public: true});
  }
  const node = record.ledgerNode;
  if(!node.owner) {
    throw new BedrockError(
      'A public ledger can not be removed.', 'PermissionDenied', {
        public: true,
        httpStatusCode: 403
      });
  }

  await brPermission.checkPermission(
    actor, PERMISSIONS.LEDGER_REMOVE, {
      resource: node,
      translate: 'owner'
    });

  await database.collections.ledgerNode.update({
    id: database.hash(ledgerNodeId)
  }, {
    $set: {
      'meta.deleted': Date.now()
    }
  }, database.writeOptions);
});

/**
 * Gets an iterator that will iterate over all ledgers in the system. The
 * iterator will return a ledgerNodeMeta which contains an id that can be
 * passed to the api.get() call to fetch an instance of the ledgerNode
 * storage for the associated ledger.
 *
 * @param actor - the actor performing the action.
 * @param options - a set of options to use when retrieving the list.
 *
 * @return a Promise that resolves to an iterator that returns LedgerNode
 *   instances.
 */
api.getNodeIterator = callbackify(async (actor, options = {}) => {
  // find all non-deleted ledger nodes
  const query = {
    'meta.deleted': {
      $exists: false
    }
  };
  const projection = {
    'ledgerNode.id': 1
  };
  const cursor = await database.collections.ledgerNode.find(query, projection);

  // check to see if there are any results
  let hasNext = false;
  try {
    hasNext = await cursor.hasNext();
  } catch(e) {}

  // create a ledger ID iterator
  const iterator = {
    done: !hasNext
  };
  iterator.next = () => {
    if(iterator.done) {
      return {done: true};
    }
    const promise = cursor.next().then(record => {
      // ensure iterator will have something to iterate over next
      return cursor.hasNext().then(async hasNext => {
        iterator.done = !hasNext;
        try {
          return await api.get(actor, record.ledgerNode.id);
        } catch(e) {
          if(e.name === 'NotAllowedError') {
            return iterator.next().value;
          }
          throw e;
        }
      });
    }).catch(err => {
      iterator.done = true;
      throw err;
    });
    return {value: promise, done: iterator.done};
  };
  iterator[Symbol.iterator] = () => {
    return iterator;
  };

  return iterator;
});

// CONSENSUS HOOKS
api.consensus = {};

api.consensus._hasher = callbackify(async data => {
  if(!data) {
    throw new TypeError('The `data` parameter must be a JSON-LD document.');
  }
  // canonize ledger event to nquads
  const canonized = await jsonld.canonize(data, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads'
  });
  const hash = crypto.createHash('sha256').update(canonized, 'utf8').digest();
  const mh = multihash.encode(hash, 'sha2-256');
  const mb = multibase.encode('base58btc', mh).toString();
  return mb;
});

/**
 * Scans for ledger nodes that have not been inspected by their consensus
 * plugin and notifies the consensus plugin to run a worker, if desired.
 *
 * @param job the current job.
 * @param callback() called once the operation completes.
 */
api.consensus._scheduleConsensusWork = (job, callback) => {
  logger.verbose(
    `Running worker (${job.worker.id}) to schedule consensus work...`);

  const start = Date.now();
  const ttl = config.ledger.jobs.scheduleConsensusWork.ttl;
  const thisWorkerExpires = start + ttl;
  const concurrency = config.ledger.jobs.scheduleConsensusWork.
    workSessionConcurrencyPerInstance;
  const collection = database.collections.ledgerNode;
  const singleUpdateOptions = bedrock.util.extend(
    {}, database.writeOptions, {upsert: false, multi: false});

  let done = false;
  const condition = () => (
    done || concurrency === runningConsensusWorkSessions ||
    thisWorkerExpires < Date.now());
  async.until(condition, loop, err => {
    if(err) {
      logger.error(
        `Error while scheduling consensus work on worker (${job.worker.id})`,
        {error: err});
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
    collection.update(query, update, singleUpdateOptions, err => {
      if(err) {
        logger.error(
          `Error after scheduling consensus work on worker (${job.worker.id})`,
          {error: err});
      }
      logger.verbose(
        `Schedule consensus work worker (${job.worker.id}) finished.`);
      callback();
    });
  });

  function loop(loopCallback) {
    // 1. Claim a new or stalled ledgerNode with this worker's ID.
    // 2. Get any ledgerNode claimed by this worker; loop early if none found.
    // 3. Offer its API to a consensus plugin to reserve it.
    async.auto({
      claimLedgerNode: claimLedgerNode,
      getLedgerNode: ['claimLedgerNode', (results, callback) => {
        if(!results.claimLedgerNode) {
          if(results.claimLedgerNode === false) {
            done = true;
          }
          return loopCallback();
        }
        return api.get(null, results.claimLedgerNode, {}, callback);
      }],
      offer: ['getLedgerNode', (results, callback) =>
        offer(results.getLedgerNode, callback)
      ]
    }, loopCallback);
  }

  function claimLedgerNode(callback) {
    async.auto({
      // find ledger node that was least recently updated
      find: callback => {
        const query = {
          'meta.deleted': {$exists: false},
          $or: [
            {'meta.workSession.id': null},
            {'meta.workSession.expires': {$lte: Date.now()}}
          ]
        };
        collection.find(query, {'ledgerNode.id': 1})
          .sort({'meta.updated': 1})
          .limit(1).toArray((err, result) => {
            if(err) {
              return callback(err);
            }
            return callback(null, result[0]);
          });
      },
      mark: ['find', (results, callback) => {
        if(!results.find) {
          return callback(null, false);
        }
        const query = {
          id: database.hash(results.find.ledgerNode.id),
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
        collection.update(
          query, update, singleUpdateOptions,
          (err, result) => {
            if(err) {
              return callback(err);
            }
            if(result.result.n) {
              return callback(null, results.find.ledgerNode.id);
            }
            return callback(null, null);
          });
      }]
    }, (err, results) => callback(err, results.mark));
  }

  function offer(ledgerNode, callback) {
    // skip if `scheduleWork` is undefined on the consensus plugin API
    if(!ledgerNode.consensus.scheduleWork) {
      return callback();
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
    callback();
  }
};

function _use(plugin, callback) {
  let p;
  try {
    p = injector.use(plugin);
  } catch(e) {
    return callback(e);
  }
  callback(null, p);
}
