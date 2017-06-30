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
 * Enables plugins to register with the ledger such that they may be used
 * to extend the capabilities of the ledger subsystem by adding new storage,
 * consensus, and authorization mechanisms.
 *
 * options - a set of options used when retrieving the ledger metadata.
 *   capabilityName (required) - the name of the capability
 *   capabilityValue (required) - the value of the capability
 *     type - type type of plugin (e.g. 'storage', 'authorization', 'consensus')
 *     api - the javascript API
 * callback(err) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 */
api.use = (options, callback) => {
  // this function is a getter if options is a string
  if(typeof options === 'string') {
    if(!plugins[options]) {
      return callback(new BedrockError('Plugin not found.', 'NotFound'));
    }
    return callback(null, plugins[options].api);
  }
  if(!options.capabilityName) {
    return new TypeError('`capabilityName` is a required property.');
  }
  if(!options.capabilityValue) {
    return new TypeError('`capabilityValue` is a required property.');
  }
  if(plugins[options.capabilityName]) {
    return new Error(
      'Unable to register a duplicate plugin:', options.capabilityName);
  }
  plugins[options.capabilityName] = options.capabilityValue;
  callback();
};

/**
 * Create a new ledger given a configuration block and a set of options.
 *
 * actor - the actor performing the action.
 * configBlock - the configuration block for the ledger.
 * options - a set of options used when creating the ledger.
 *   owner - the owner of the ledger node
*      (default: none, anyone can access the node)
 *   storage - the storage subsystem for the ledger (default: 'mongodb').
 * callback(err, ledger) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 *   ledgerNode - the ledger node associated with the ledger.
 */
api.add = (actor, configBlock, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  if(!(configBlock.consensusMethod && configBlock.consensusMethod.type)) {
    return callback(new BedrockError(
      '`consensusMethod` is a required `configBlock` property.',
      'ConfigBlockError'));
  }
  // get storage API
  options.storage = options.storage || 'mongodb';
  if(!plugins[options.storage]) {
    return callback(new BedrockError(
      'Invalid storage system specified.', 'InvalidStorage', {
        storage: options.storage
      }));
  }

  const node = {
    id: 'urn:uuid:' + uuid(),
    ledger: configBlock.ledger,
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
    initStorage: ['checkPermission', (results, callback) => {
      const storageApi = plugins[options.storage].api;
      storageApi.add(configBlock, {}, {}, callback);
    }],
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
      api.use(configBlock.consensusMethod.type, callback);
    }],
    createNode: ['getConsensus', (results, callback) => {
      // use existing ledgerNode
      const ln = results.checkExisting ? results.checkExisting :
        new LedgerNode({
          id: node.id,
          ledger: node.ledger,
          storage: results.initStorage,
          consensus: results.getConsensus
        });
      callback(null, ln);
    }],
    writeConfig: ['getConsensus', 'createNode', (results, callback) => {
      if(results.checkExisting) {
        return callback();
      }
      results.getConsensus.blocks.setConfig(
        results.createNode, configBlock, callback);
    }]
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
    getStorageApi: ['checkPermission', (results, callback) =>
      api.use(results.find.ledgerNode.storage.plugin, callback)],
    initStorage: ['checkPermission', (results, callback) => {
      const ledgerNode = results.find.ledgerNode;
      const storageApi = results.getStorageApi;
      storageApi.get(ledgerNode.storage.id, {}, callback);
    }],
    getConfig: ['initStorage', (results, callback) =>
      results.initStorage.blocks.getLatest(callback)
    ],
    getConsensus: ['getConfig', (results, callback) => api.use(
      results.getConfig.configurationBlock.block.consensusMethod.type, callback)
    ],
    createNode: ['initStorage', 'getConsensus', (results, callback) => {
      callback(null, new LedgerNode({
        id: results.find.ledgerNode.id,
        storage: results.initStorage,
        consensus: results.getConsensus
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
