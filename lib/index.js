/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const config = require('bedrock').config;
const database = require('bedrock-mongodb');
const uuid = require('uuid/v4');
const BedrockError = bedrock.util.BedrockError;
const LedgerNode = require('./ledger-node');
require('bedrock-permission');

require('./config');

// module permissions
const PERMISSIONS = config.permission.permissions;

// module API
const api = {};
module.exports = api;

// used to track registered plugins
const plugins = {};

// const logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-mongodb.ready', callback => async.auto({
  openCollections: callback => database.openCollections(
    ['ledgerNode'], callback),
  createIndexes: ['openCollections', (results, callback) =>
    database.createIndexes([{
      collection: 'ledgerNode',
      fields: {id: 1},
      options: {unique: true, background: false}
    }], callback)
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
 * @param callback(err) called once the operation completes.
 *
 * @return the capabilityValue when called as a synchronous getter.
 */
api.use = (capabilityName, capabilityValue, callback) => {
  if(!capabilityName) {
    throw new TypeError('`capabilityName` is a required.');
  }
  const plugin = plugins[capabilityName];

  // this function is an asynchronous getter if the second value is a function
  if(!callback && typeof capabilityValue === 'function') {
    callback = capabilityValue;
  }

  // this function is a synchronous getter if only one option is given
  if(arguments.length === 1 || callback) {
    if(!plugin) {
      const err = new BedrockError('Plugin not found.', 'NotFound');
      if(callback) {
        return callback(err);
      }
      throw err;
    }
    if(callback) {
      callback(null, plugin);
    }
    return plugin;
  }
  if(!capabilityValue) {
    throw new TypeError('`capabilityValue` is a required.');
  }
  if(plugin) {
    const err = new BedrockError(
      'Plugin already registered: ' + capabilityName, 'DuplicateError');
    if(callback) {
      return callback(err);
    }
    throw err;
  }
  plugins[capabilityName] = capabilityValue;
};

/**
 * Create a new ledger given a configuration event and a set of options.
 *
 * actor - the actor performing the action.
 * configEvent - the configuration event for the ledger.
 * options - a set of options used when creating the ledger.
 *   genesis - if true, this is a new ledger that is being created.
 *     (default: false)
 *   owner - the owner of the ledger node
 *      (default: none, anyone can access the node)
 *   storage - the storage subsystem for the ledger (default: 'mongodb').
 * callback(err, ledger) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 *   ledgerNode - the ledger node associated with the ledger.
 */
api.add = (actor, configEvent, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  // ensure WebLedgerConfiguration is specified
  if(!configEvent || !configEvent.input || !Array.isArray(configEvent.input) ||
    configEvent.input.length < 1 ||
    configEvent.input[0].type !== 'WebLedgerConfiguration') {
    return callback(new BedrockError(
      'The provided configuration event is malformed. ' +
      'An object with `type` set to `WebLedgerConfiguration` does not exist.',
      'BadRequest',
      {configEvent: configEvent}
    ));
  }
  const wlConfig = configEvent.input[0];
 // ensure consensus method is specified
  if(!wlConfig.consensusMethod) {
    return callback(new BedrockError(
      'The provided configuration event is malformed. ' +
      '`consensusMethod` is a required `WebLedgerConfiguration` property.',
      'BadRequest',
      {configEvent: configEvent}
    ));
  }
  // ensure ledger ID is specified
  if(!wlConfig.ledger) {
    return callback(new BedrockError(
      'The provided configuration event is malformed. Ledger ID not specified.',
      'BadRequest',
      {configEvent: configEvent}
    ));
  }
  // set defaults
  options.storage = options.storage || 'mongodb';
  options.genesis = options.genesis || false;

  const node = {
    id: 'urn:uuid:' + uuid(),
    ledger: configEvent.input[0].ledger,
    owner: options.owner || null,
    // FIXME: rename `plugin` property?
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
      created: Date.now()
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
      api.use(options.storage, (err, result) => {
        if(err) {
          return callback(new BedrockError(
            'Invalid storage system specified.', 'InvalidStorage', {
              storage: options.storage
            }));
        }
        callback(null, result.api);
      })],
    initStorage: ['getStorage', (results, callback) => results.getStorage.add(
      configEvent, {}, {}, callback)],
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
      api.use(wlConfig.consensusMethod, callback);
    }],
    createNode: ['initStorage', 'getConsensus', (results, callback) => callback(
      null, new LedgerNode({
        id: node.id,
        ledger: node.ledger,
        storage: results.initStorage,
        consensus: results.getConsensus.api
      })
    )],
    writeConfig: ['createNode', (results, callback) =>
      results.getConsensus.api.events.add(
        configEvent, results.initStorage, {genesis: true}, callback)
      // results.getConsensus.blocks.setConfig(
      //   results.createNode, configEvent, callback);
    ]
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
          {httpStatusCode: 404, ledger: ledgerNodeId, public: true}
        ));
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
      results.initStorage.blocks.getLatest(callback)],
    getConsensus: ['getConfig', (results, callback) =>
      results.initStorage.events.getLatestConfig({}, callback)],
    initConsensus: ['getConsensus', (results, callback) => {
      const wlConfig = results.getConsensus.event.input[0];
      api.use(wlConfig.consensusMethod, callback);
    }],
    createNode: ['initStorage', 'initConsensus', (results, callback) => {
      callback(null, new LedgerNode({
        id: results.find.ledgerNode.id,
        storage: results.initStorage,
        consensus: results.initConsensus.api
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
      // const cursor = database.collections.ledger.find(query, projection, callback);
      // callback(null, cursor);
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
            // FIXME: api.get will take care of permission check.  However
            // it seems disingenuous that the iterator has reported that there
            // was a `next` record, when infact the user may not have access
            // to that record
            api.get(actor, record.ledgerNode.id, (err, ledgerNode) =>
              err ? reject(err) : resolve(ledgerNode));
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

/////////////////////////////// CONSENSUS HOOKS ///////////////////////////////
api.consensus = {};

/**
 * Gets a work session for a consensus algorithm. This session can be used
 * to reserve a ledger for a limited time in order to execute a consensus
 * algorithm on it.
 *
 * A session type must be given. A session type is a string that is used
 * by a particular consensus algorithm to organize its work. Whenever a
 * a ledger is successfully reserved for a particular session, all sessions
 * of the same type will be prohibited from working on the same ledger. A
 * session with a different type, however, may also reserve the ledger
 * to perform some work on it.
 *
 * @param type the work session type.
 * @param maxAge the maximum time, in milliseconds, that this session may
 *          reserve a ledger before being forcefully removed.
 *
 * @return a new session.
 */
api.consensus.createSession = (type, maxAge) => {
  // TODO: implement
  return {type: type, maxAge: maxAge};
};

/**
 * Reserves the next elible ledger for a particular session, performs some
 * work on the ledger, and then releases the ledger from reservation so that
 * sessions of the same type may perform more work on it.
 *
 * A ledger will be considered eligible if it has a matching consensus
 * method (to the one passed), it has not been marked as deleted, and it has
 * no existing session or session of the same type.
 *
 * The mechanism that reserves ledger is fair; it is guaranteed to reserve
 * the next ledger that has the oldest last reserved time.
 *
 * @param method the consensus method to match ledgers on.
 * @param session the work session to reserve the ledger with.
 * @param fn(ledgerId, session, callback) the work function to execute.
 * @param callback(err) called once the operation completes.
 */
api.consensus.execute = (method, session, fn, callback) => {
  async.auto({
    reserve: callback =>
      // reserve a ledger to perform work on
      api.consensus._reserve(method, session, callback),
    execute: ['reserve', (results, callback) => {
      if(!results.reserve) {
        // no ledgers left or session expired
        return callback();
      }
      fn(results.reserve.ledgerNode, session, callback);
    }],
    release: ['execute', (results, callback) => {
      if(!results.reserve) {
        return callback();
      }
      // releasing allows other work sessions of the same type on the ledger;
      // if release is not called for any reason, then other sessions of the
      // same type will be prohibited from working on the ledger until after
      // it expires
      api.consensus._release(results.reserve, callback);
    }]
  }, err => callback(err));
};

api.consensus._reserve = (method, session, callback) => {
  // TODO: try to reserve a ledger, getting its ledger node ID

  // FIXME: bogus for testing only
  api.getNodeIterator(null, (err, iterator) => {
    if(iterator.done) {
      throw new Error('why done???');
    }
    iterator.value.then(ledgerNode => {
      // TODO: if successful, get the ledgerNode API
      const reserved = {
        ledgerNode: '',//ledgerNode,
        method: method,
        session: session
      };
      callback(null, reserved);

      // // otherwise return null
      // callback(null, null);
    }, callback);
  });
};

api.consensus._release = (reserved, callback) => {
  // TODO: remove whatever database locks are associated with ledger+session

  // TODO: implement me
  callback();
};
