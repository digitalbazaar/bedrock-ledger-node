/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const config = require('bedrock').config;
const database = require('bedrock-mongodb');
const jsonld = bedrock.jsonld;
const niUri = require('ni-uri');
const scheduler = require('bedrock-jobs');
const uuid = require('uuid/v4');
const BedrockError = bedrock.util.BedrockError;
const injector = require('./injector');
const LedgerNode = require('./ledger-node');
require('bedrock-permission');

require('./config');

// module permissions
const PERMISSIONS = config.permission.permissions;

// jobs
const namespace = 'bedrock-ledger';
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

bedrock.events.on('bedrock-mongodb.ready', callback => async.auto({
  openCollections: callback => database.openCollections(
    ['ledgerNode'], callback),
  createIndexes: ['openCollections', (results, callback) =>
    database.createIndexes([{
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
    }], callback)
  ],
  emitReadyEvent: ['createIndexes', (results, callback) =>
    bedrock.events.emit('bedrock-ledger-node.ready', callback)
  ]
}, err => callback(err)));

/**
 * Registers or retrieves a ledger plugin.
 *
 * A plugin can be registered to extend the capabilities of the ledger
 * subsystem by adding new storage, consensus, and authorization mechanisms.
 *
 * @param capabilityName (required) the name of the capability.
 * @param [capabilityValue | callback] either the value of the capability:
 *          type type type of plugin (e.g. 'storage', 'authorization',
 *            'consensus').
 *          api the javascript API for the plugin.
 *        or a callback to use this function as an asynchronous getter.
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
 * callback(err, ledgerNode) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 *   ledgerNode - the created ledger node.
 */
api.add = (actor, options, callback) => {
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
      return callback(new BedrockError(
        'The provided genesis block is malformed. ' +
        'An object with `type` set to `WebLedgerEventBlock` does not exist.',
        'DataError',
        {httpStatusCode: 400, public: true, genesisBlock: block}
      ));
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
    return callback(new BedrockError(
      'The provided configuration event is malformed. ' +
      'An object with `type` set to `WebLedgerConfiguration` does not exist.',
      'DataError',
      {httpStatusCode: 400, public: true, ledgerConfiguration}
    ));
  }

  // ensure consensus method is specified
  if(!ledgerConfiguration.consensusMethod) {
    return callback(new BedrockError(
      'The provided configuration event is malformed. ' +
      '`consensusMethod` is a required `WebLedgerConfiguration` property.',
      'DataError',
      {httpStatusCode: 400, public: true, ledgerConfiguration}
    ));
  }
  // ensure ledger ID is specified
  if(!ledgerConfiguration.ledger) {
    return callback(new BedrockError(
      'The provided configuration event is malformed. Ledger ID not specified.',
      'DataError',
      {httpStatusCode: 400, public: true, ledgerConfiguration}
    ));
  }

  // set defaults
  options.storage = options.storage || 'mongodb';

  const node = {
    id: 'urn:uuid:' + uuid(),
    ledger: ledgerConfiguration.ledger,
    owner: options.owner || null,
    peerLedgerAgent: options.peerLedgerAgents || [],
    storage: {
      plugin: options.storage,
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
  async.auto({
    // FIXME: it may be necessary to check for both LEDGER_CREATE and
    // LEDGER_ACCESS permissions in this API because the actor ends up with
    // a handle that can be used to access the ledger without utilizing the
    // `get` API.
    checkPermission: callback => {
      // a ledgerNode with no owner is a valid public ledger
      if(!node.owner) {
        return callback();
      }
      brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_CREATE, {
          resource: node,
          translate: 'owner'
        }, callback);
    },
    getStorage: ['checkPermission', (results, callback) =>
      api.use(options.storage, callback)],
    initStorage: ['getStorage', (results, callback) =>
      results.getStorage.api.add({}, {ledgerId: node.ledger}, callback)],
    insert: ['initStorage', (results, callback) => {
      record.ledgerNode.storage.id = results.initStorage.id;
      database.collections.ledgerNode.insert(
        record, database.writeOptions, (err, result) => {
          if(err && database.isDuplicateError(err)) {
            return callback(new BedrockError(
              'Duplicate ledger node.', 'DuplicateError', {
                public: true,
                httpStatusCode: 409
              }));
          }
          callback(err, result);
        });
    }],
    getConsensus: ['insert', (results, callback) => {
      api.use(ledgerConfiguration.consensusMethod, callback);
    }],
    createNode: ['insert', 'getConsensus', (results, callback) => callback(
      null, new LedgerNode({
        id: node.id,
        ledger: node.ledger,
        storage: results.initStorage,
        consensus: results.getConsensus.api,
        injector: api
      })
    )],
    writeConfig: ['createNode', (results, callback) =>
      results.createNode.config.change({
        ledgerConfiguration,
        genesis: true,
        genesisBlock: options.genesisBlock
      }, callback)]
  }, (err, results) =>
    err ? callback(err) : callback(null, results.createNode)
  );
};

/**
 * Gets a ledger node given a ledgerNodeId and a set of options.
 *
 * actor - the actor performing the action.
 * ledgerNodeId - the URI of the ledger node.
 * options - a set of options used when creating the ledger.
 * callback(err, ledgerNode) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise
 *   ledgerNode - A ledger node that can be used to perform actions on the
 *     ledger.
 */
api.get = (actor, ledgerNodeId, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  const query = {
    id: database.hash(ledgerNodeId),
    'meta.deleted': {
      $exists: false
    }
  };
  async.auto({
    find: callback => database.collections.ledgerNode.findOne(
      query, {}, callback),
    checkPermission: ['find', (results, callback) => {
      const record = results.find;
      if(!record) {
        return callback(new BedrockError(
          'Ledger node not found.',
          'NotFound',
          {httpStatusCode: 404, ledger: ledgerNodeId, public: true}));
      }
      // not all ledgers have an owner, skip permission check
      if(!record.ledgerNode.owner) {
        return callback();
      }
      brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_ACCESS,
        {resource: record.ledgerNode, translate: 'owner'}, callback);
    }],
    getStorage: ['checkPermission', (results, callback) => {
      api.use(results.find.ledgerNode.storage.plugin, callback);
    }],
    initStorage: ['checkPermission', (results, callback) => {
      const ledgerNode = results.find.ledgerNode;
      const storageApi = results.getStorage.api;
      storageApi.get(ledgerNode.storage.id, {}, callback);
    }],
    getConfig: ['initStorage', (results, callback) =>
      results.initStorage.events.getLatestConfig(callback)],
    initConsensus: ['getConfig', (results, callback) => {
      // FIXME: this API might be called before the ledgerConfiguration is
      // available
      if(_.isEmpty(results.getConfig)) {
        return callback(new BedrockError(
          'Ledger configuration is not available.',
          'InvalidStateError',
          {httpStatusCode: 400, ledger: ledgerNodeId, public: true}));
      }
      const wlConfig = results.getConfig.event.ledgerConfiguration;
      api.use(wlConfig.consensusMethod, callback);
    }],
    createNode: ['initStorage', 'initConsensus', (results, callback) => {
      callback(null, new LedgerNode({
        id: results.find.ledgerNode.id,
        ledger: results.find.ledgerNode.ledger,
        storage: results.initStorage,
        consensus: results.initConsensus.api,
        injector: api
      }));
    }]
  }, (err, results) => callback(err, results.createNode));
};

/**
 * Delete an existing ledger given a ledgerId and a set of options.
 *
 * actor - the actor performing the action.
 * ledgerNodeId - the URI of the ledger.
 * storage - the storage subsystem for the ledger
 * options - a set of options used when deleting the ledger.
 * callback(err) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 */
api.remove = (actor, ledgerNodeId, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  options.owner = options.owner || null;
  async.auto({
    find: callback => database.collections.ledgerNode.findOne({
      id: database.hash(ledgerNodeId)
    }, callback),
    checkPermission: ['find', (results, callback) => {
      if(!results.find) {
        return callback(new BedrockError(
          'Ledger node not found.',
          'NotFound',
          {httpStatusCode: 404, ledger: ledgerNodeId, public: true}
        ));
      }
      const node = results.find.ledgerNode;
      if(!node.owner) {
        return callback(new BedrockError(
          'A public ledger can not be removed.', 'PermissionDenied', {
            public: true,
            httpStatusCode: 403
          }));
      }
      brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_REMOVE, {
          resource: node,
          translate: 'owner'
        }, callback);
    }],
    update: ['checkPermission', (results, callback) =>
      database.collections.ledgerNode.update({
        id: database.hash(ledgerNodeId)
      }, {
        $set: {
          'meta.deleted': Date.now()
        }
      }, database.writeOptions, callback)
    ]
  }, err => callback(err));
};

/**
 * Gets an iterator that will iterate over all ledgers in the system. The
 * iterator will return a ledgerNodeMeta which contains an id that can be
 * passed to the api.get() call to fetch an instance of the ledgerNode
 * storage for the associated ledger.
 *
 * actor - the actor performing the action.
 * options - a set of options to use when retrieving the list.
 * callback(err, iterator) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise
 *   iterator - An iterator that returns ledgerNodeMeta objects.
 */
api.getNodeIterator = function(actor, options, callback) {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  async.auto({
    find: callback => {
      // find all non-deleted ledger nodes
      const query = {
        'meta.deleted': {
          $exists: false
        }
      };
      const projection = {
        'ledgerNode.id': 1
      };
      database.collections.ledgerNode.find(query, projection, callback);
    },
    hasNext: ['find', (results, callback) => {
      // check to see if there are any results
      results.find.hasNext().then(hasNext => callback(null, hasNext), callback);
    }]
  }, (err, results) => {
    if(err) {
      return callback(err);
    }

    // create a ledger ID iterator
    const iterator = {
      done: !results.hasNext
    };
    iterator.next = () => {
      if(iterator.done) {
        return {done: true};
      }
      const cursor = results.find;
      const promise = cursor.next().then(record => {
        // ensure iterator will have something to iterate over next
        return cursor.hasNext().then(hasNext => {
          iterator.done = !hasNext;
          return new Promise((resolve, reject) => {
            api.get(actor, record.ledgerNode.id, (err, ledgerNode) => {
              if(err && err.name === 'PermissionDenied') {
                return resolve(iterator.next().value);
              }
              return err ? reject(err) : resolve(ledgerNode);
            });
          });
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

    callback(null, iterator);
  });
};

// CONSENSUS HOOKS
api.consensus = {};

class LedgerNodeWorkSession {
  constructor(schedulerId, ledgerNode) {
    this.id = uuid();
    this.schedulerId = schedulerId;
    this.ledgerNode = ledgerNode;
    this.maxAge = 0;
    this.startTime = 0;
    this.started = false;
  }

  isExpired() {
    return this.timeRemaining() === 0;
  }

  timeRemaining() {
    return Math.max(0, this.startTime + this.maxAge - Date.now());
  }

  /**
   * Reserves the given ledgerNode for a work session, executes a function
   * to perform work on it, and then releases the ledgerNode from reservation
   * so that other work sessions may be used to reserve it.
   *
   * The ledgerNode will be reserved if has not been marked as deleted, and it
   * has no existing work session.
   *
   * @param maxAge the maximum time to reserve the ledgerNode for.
   * @param fn(session, callback) the work function to execute.
   * @param callback(err) called once the operation completes.
   */
  start(maxAge, fn, callback) {
    const self = this;
    self.started = true;
    self.maxAge = maxAge;
    const collection = database.collections.ledgerNode;
    const singleUpdateOptions = bedrock.util.extend(
      {}, database.writeOptions, {upsert: false, multi: false});
    async.auto({
      reserve: callback => {
        // work session won't fully expire until after maxAge and grace period
        const gracePeriod = config.ledger.jobs
          .scheduleConsensusWork.workSessionGracePeriod;
        const expires = Date.now() + maxAge + gracePeriod;

        // can only take over work sessions with a worker ID that matches the
        // scheduler's worker ID
        const query = {
          id: database.hash(self.ledgerNode.id),
          'meta.workSession.id': this.schedulerId
        };
        const update = {
          $set: {
            'meta.workSession': {id: self.id, expires: expires},
            'meta.updated': Date.now()
          }
        };
        collection.update(
          query, update, singleUpdateOptions,
          (err, result) => callback(err, result.result.n === 1));
      },
      execute: ['reserve', (results, callback) => {
        if(!results.reserve) {
          // ledger node could not be reserved
          return callback();
        }
        self.startTime = Date.now();
        fn(self, err => {
          if(err) {
            logger.error(
              `Error during consensus work session (${self.id})`, {
                error: err,
                sessionId: self.id,
                ledgerNodeId: self.ledgerNode.id
              });
          }
          callback();
        });
      }],
      release: ['execute', (results, callback) => {
        if(!results.reserve) {
          // nothing to release
          return callback();
        }
        const query = {
          'meta.workSession.id': self.id
        };
        const update = {
          $set: {
            'meta.workSession': null,
            'meta.updated': Date.now()
          }
        };
        collection.update(query, update, singleUpdateOptions, callback);
      }]
    }, err => {
      runningConsensusWorkSessions--;
      callback(err);
    });
  }
}

api.consensus._hasher = function(data, callback) {
  async.auto({
    // canonize ledger event to nquads
    canonize: callback => jsonld.canonize(data, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads'
    }, callback),
    hash: ['canonize', (results, callback) => {
      const hash = niUri.digest('sha-256', results.canonize, true);
      callback(null, hash);
    }]
  }, (err, results) => callback(err, results.hash));
};

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
      const session = new LedgerNodeWorkSession(job.worker.id, ledgerNode);
      ledgerNode.consensus.scheduleWork(session, ledgerNode);
      if(!session.started) {
        runningConsensusWorkSessions--;
      }
    });
    callback();
  }
};
