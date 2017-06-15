/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const config = require('bedrock').config;
const crypto = require('crypto');
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
    }, {
      collection: 'ledgerNode',
      fields: {ledger: 1, storage: 1, owner: 1},
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
  // get storage API
  options.storage = options.storage || 'mongodb';
  if(!plugins[options.storage]) {
    return callback(new BedrockError(
      'Invalid storage system specified.', 'InvalidStorage', {
        storage: options.storage
      }));
  }

  const node = {
    id: uuid(),
    ledger: configBlock.ledger,
    owner: options.owner || null,
    // FIXME: rename plugin?
    storage: {
      plugin: options.storage,
      id: null
    },
    sysStatus: 'active'
  };

  // TODO: it may not be necessary to hash all of these values
  const record = {
    id: database.hash(node.id),
    ledger: database.hash(node.ledger),
    storage: database.hash(node.storage.plugin),
    owner: node.owner ? database.hash(node.owner) : null,
    ledgerNode: node
  };
  async.auto({
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
    checkExisting: ['checkPermission', (results, callback) => api.get(
      // FIXME: should this be a null actor?
      actor, node.ledger, {
        storage: node.storage.plugin,
        owner: node.owner
      }, (err, result) => {
        if(err && err.name === 'NotFound') {
          return callback();
        }
        callback(err, result);
      })],
    initStorage: ['checkExisting', (results, callback) => {
      if(results.checkExisting) {
        return callback();
      }
      const storageApi = plugins[options.storage].api;
      // FIXME: replace dummy hashers
      storageApi.add(configBlock, {}, {
        eventHasher: (data, callback) =>
          callback(null, crypto.createHash('sha256')
            .update(JSON.stringify(data)).digest()),
        blockHasher: (data, callback) =>
          callback(null, crypto.createHash('sha256')
            .update(JSON.stringify(data)).digest())
      }, callback);
    }],
    insert: ['initStorage', (results, callback) => {
      if(results.checkExisting) {
        return callback();
      }
      record.ledgerNode.storage.id = results.initStorage.storageUuid;
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
    createNode: ['insert', (results, callback) => {
      // use existing ledgerNode
      const ln = results.checkExisting ? results.checkExisting :
        new LedgerNode({
          id: node.id,
          ledger: node.ledger,
          storage: plugins[options.storage].api
        });
      callback(null, ln);
    }]
  }, (err, results) =>
    err ? callback(err) : callback(null, results.createNode)
  );
};

/**
 * Gets a ledger node given a ledgerId and a set of options.
 *
 * actor - the actor performing the action.
 * ledgerId - the URI of the ledger.
 * options - a set of options used when creating the ledger.
 *   owner - the owner of the ledger node
 * storage - the storage subsystem for the ledger (default 'mongodb').
 * callback(err, ledgerNode) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise
 *   ledgerNode - A ledger node that can be used to perform actions on the
 *     ledger.
 */
api.get = (actor, ledgerId, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  options.owner = options.owner || null;
  // get storage API
  options.storage = options.storage || 'mongodb';
  if(!plugins[options.storage]) {
    return callback(new BedrockError(
      'Invalid storage system specified.', 'InvalidStorage', {
        storage: options.storage
      }));
  }
  const query = {
    ledger: database.hash(ledgerId),
    storage: database.hash(options.storage),
    owner: options.owner ? database.hash(options.owner) : null,
    'ledgerNode.sysStatus': 'active'
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
          {httpStatusCode: 404, ledger: ledgerId, public: true}
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
    createNode: ['checkPermission', (results, callback) => {
      const node = results.find.ledgerNode;
      callback(null, new LedgerNode({
        id: node.id,
        ledger: node.ledger,
        storage: plugins[options.storage].api
      }));
    }]
  }, (err, results) => callback(err, results.createNode));
};

/**
 * Delete an existing ledger given a ledgerId and a set of options.
 *
 * actor - the actor performing the action.
 * ledgerId - the URI of the ledger.
 * storage - the storage subsystem for the ledger
 * options - a set of options used when deleting the ledger.
 *   owner - the owner of the ledger node
 * callback(err) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 */
api.remove = (actor, ledgerId, storage, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  options.owner = options.owner || null;
  async.auto({
    find: callback => database.collections.ledgerNode.findOne({
      ledger: database.hash(ledgerId),
      storage: database.hash(storage),
      owner: options.owner ? database.hash(options.owner) : null
    }, callback),
    checkPermission: ['find', (results, callback) => {
      if(!results.find) {
        return callback(new BedrockError(
          'Ledger node not found.',
          'NotFound',
          {httpStatusCode: 404, ledger: ledgerId, public: true}
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
        ledger: database.hash(ledgerId),
        'ledgerNode.storage.plugin': storage
      }, {
        $set: {
          'ledgerNode.sysStatus': 'deleted'
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
api.getNodeIterator = function*(actor, options, callback) {
  // FIXME: Implement
  callback(null, yield* [{
    ledger: 'did:v1:049f7d7a-6327-41db-b2cf-9ffa29d3433b'
  }, {
    ledger: 'did:v1:40454763-c925-459d-9b1b-8fb5869eca6b'
  }, {
    ledger: 'did:v1:b464dfe5-b0ad-407f-9d36-72e04de8572e'
  }]);
};
