/*!
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const {config} = require('bedrock');
const database = require('bedrock-mongodb');
const {util: {hasValue, uuid, BedrockError}} = bedrock;
const injector = require('./injector');
const {validate} = require('bedrock-validation');
const validator = require('./validator');
const LedgerNode = require('./LedgerNode');
const {LruCache} = require('@digitalbazaar/lru-memoize');

const lruCache = new LruCache({
  max: 1000,
  maxAge: 1000 * 60 * 5
});

// module permissions
const PERMISSIONS = config.permission.permissions;

// module API
const api = {};
module.exports = api;

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
api.add = async (actor, options) => {
  if(!(!options.ledgerConfiguration ^ !options.genesisBlock)) {
    throw new TypeError(
      'One and one only of `options.configEvent` or `options.genesisBlock` ' +
      'must be specified.');
  }

  if(options.genesisBlock) {
    // ensure WebLedgerEventBlock is specified and it has at least one
    // event in it
    const {genesisBlock} = options;
    if(!(typeof genesisBlock === 'object' &&
      hasValue(genesisBlock, 'type', 'WebLedgerEventBlock') &&
      Array.isArray(genesisBlock.event) && genesisBlock.event.length >= 1)) {
      throw new BedrockError(
        'The provided genesis block is malformed. ' +
        'An object with `type` set to `WebLedgerEventBlock` does not exist.',
        'DataError',
        {httpStatusCode: 400, public: true, genesisBlock});
    }
    // the ledger configuration event must be the first event
    const [ledgerConfigurationEvent] = genesisBlock.event;
    const result = validate(
      'webledger-validator.genesisLedgerConfigurationEvent',
      ledgerConfigurationEvent);
    if(!result.valid) {
      throw result.error;
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

  // perform basic schema validation
  const schemaResult = await validator.validateGenesisLedgerConfiguration(
    {ledgerConfiguration});
  if(!schemaResult.valid) {
    throw schemaResult.error;
  }

  // allow the validators defined in the configuration to validate the config
  const configResult = await validator.validate({
    ledgerConfiguration,
    // provide a minimal ledgerNode object to enable this validation
    ledgerNode: {
      config: {get: () => null},
      // validators can use this flag to modify their behavior
      _genesis: true,
      injector,
    }
  });
  if(!configResult.valid) {
    throw configResult.error;
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

  // TODO: it may not be necessary to database.hash all of these values
  const now = Date.now();
  const record = {
    id: database.hash(node.id),
    ledger: database.hash(node.ledger),
    storage: database.hash(node.storage.plugin),
    owner: node.owner ? database.hash(node.owner) : null,
    ledgerNode: node,
    meta: {
      created: now,
      updated: now,
      deleted: -1,
      workSession: {id: -1, expires: -1}
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
      actor, PERMISSIONS.LEDGER_NODE_CREATE, {
        resource: node,
        translate: 'owner'
      });
  }

  const {api: consensusApi} = injector.use(ledgerConfiguration.consensusMethod);

  // consensus plugins may specify a custom storage plugin
  if(consensusApi.storagePlugin) {
    storage.storagePlugins.push(consensusApi.storagePlugin);
  }

  const {api: storageApi} = injector.use(storage.plugin);
  const ledgerStorage = await storageApi.add({}, {
    ledgerId: node.ledger, ledgerNodeId: node.id,
    plugins: _.uniq(storage.storagePlugins)
  });

  record.ledgerNode.storage.id = ledgerStorage.id;

  try {
    await database.collections.ledgerNode.insertOne(record);
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
};

/**
 * Gets a ledger node given a ledgerNodeId and a set of options.
 *
 * @param actor - the actor performing the action.
 * @param ledgerNodeId - the URI of the ledger node.
 * @param [options] - a set of options used when creating the ledger.
 *
 * @return a Promise that resolves to a LedgerNode instance.
 */
/* eslint-disable-next-line no-unused-vars */
api.get = async (actor, ledgerNodeId, options = {}) => {
  const fn = () => _findLedgerNode({actor, ledgerNodeId});

  let result;
  // only use cache if no actor because actor permissions may have changed
  if(!actor) {
    result = await lruCache.memoize({key: ledgerNodeId, fn});
  } else {
    result = await fn();
  }

  const {record, storage} = result;

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
};

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
api.remove = async (actor, ledgerNodeId, options = {}) => {
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
    actor, PERMISSIONS.LEDGER_NODE_REMOVE, {
      resource: node,
      translate: 'owner'
    });

  // delete cache entry even if the update operation fails, the cache will be
  // repopulated, this avoids cache/database sync issues and race conditions
  lruCache.delete(ledgerNodeId);

  await database.collections.ledgerNode.updateOne({
    id: database.hash(ledgerNodeId)
  }, {
    $set: {
      'meta.deleted': Date.now()
    }
  });
};

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
/* eslint-disable-next-line no-unused-vars */
api.getNodeIterator = async (actor, options = {}) => {
  // find all non-deleted ledger nodes
  const query = {
    'meta.deleted': -1
  };
  const projection = {
    'ledgerNode.id': 1
  };
  const cursor = await database.collections.ledgerNode.find(
    query, {projection});

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
};

async function _findLedgerNode({actor, ledgerNodeId}) {
  const query = {
    id: database.hash(ledgerNodeId),
    'meta.deleted': -1
  };
  const record = await database.collections.ledgerNode.findOne(query);
  if(!record) {
    throw new BedrockError(
      'Ledger node not found.',
      'NotFound',
      {httpStatusCode: 404, ledger: ledgerNodeId, public: true});
  }
  // only need to check permissions if the ledger is owned, otherwise it
  // is public

  if(actor !== null && record.ledgerNode.owner) {
    await brPermission.checkPermission(
      actor, PERMISSIONS.LEDGER_NODE_ACCESS,
      {resource: record.ledgerNode, translate: 'owner'});
  }

  const {api: storageApi} = injector.use(record.ledgerNode.storage.plugin);
  const storage = await storageApi.get(record.ledgerNode.storage.id, {});

  return {record, storage};
}
