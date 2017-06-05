/*!
 * Ledger storage module.
 *
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const config = require('bedrock').config;
const crypto = require('crypto');
const database = require('bedrock-mongodb');
const jsigs = require('jsonld-signatures')();
let jsonld = bedrock.jsonld;
let request = require('request');
const BedrockError = bedrock.util.BedrockError;
const LedgerNodeBlocks = require('./ledgerNodeBlocks').LedgerNodeBlocks;
const LedgerNodeEvents = require('./ledgerNodeEvents').LedgerNodeEvents;
const LedgerNodeMeta = require('./ledgerNodeMeta').LedgerNodeMeta;
require('bedrock-permission');

require('./config');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

// const logger = bedrock.loggers.get('app');

// ensure that requests always send JSON
request = request.defaults({json: true});

// FIXME: Do not use an insecure document loader in production
// jsonld = jsonld();
const nodeDocumentLoader = jsonld.documentLoaders.node({
  secure: false,
  strictSSL: false
});
jsonld.documentLoader = (url, callback) => {
  if(url in config.constants.CONTEXTS) {
    return callback(
      null, {
        contextUrl: null,
        document: config.constants.CONTEXTS[url],
        documentUrl: url
      });
  }
  nodeDocumentLoader(url, callback);
};

// use local JSON-LD processor for checking signatures
jsigs.use('jsonld', jsonld);

bedrock.events.on('bedrock-mongodb.ready', callback => async.auto({
  openCollections: callback => database.openCollections(['ledger'], callback),
  createIndexes: ['openCollections', (results, callback) =>
    database.createIndexes([{
      collection: 'ledger',
      fields: {id: 1},
      options: {unique: true, background: false}
    }, {
      collection: 'ledger',
      fields: {name: 1},
      options: {unique: true, background: false}
    }], callback)
  ],
  createKeys: ['createIndexes', (results, callback) => {
    // FIXME: open all existing ledgers
    callback();
  }]
}, err => callback(err)));

/**
 * Enables plugins to register with the ledger such that they may be used
 * to extend the capabilities of the ledger subsystem by adding new storage,
 * consensus, and authorization mechanisms.
 *
 * options - a set of options used when retrieving the ledger metadata.
 * capabilityName (required) - the name of the capability
 * capabilityValue (required) - the value of the capability
 * callback(err) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 */
api.use = (options, pluginApi) => {
  // FIXME: Implement
};

/**
 * Create a new ledger given a configuration block and a set of options.
 *
 * actor - the actor performing the action.
 * configBlock - the configuration block for the ledger.
 * options - a set of options used when creating the ledger.
 * storage - the storage subsystem for the ledger (default: 'mongodb').
 * callback(err, ledger) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 *   ledgerNode - the ledger node associated with the ledger.
 */
api.create = (actor, configBlock, options, callback) => {
  // FIXME: Implement
  callback(null, new LedgerNode(configBlock.ledger));
};

/**
 * Gets a ledger node given a ledgerId and a set of options.
 *
 * actor - the actor performing the action.
 * ledgerId - the URI of the ledger.
 * options - a set of options used when creating the ledger.
 * storage - the storage subsystem for the ledger (default 'mongodb').
 * callback(err, ledgerNode) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise
 *   ledgerNode - A ledger node that can be used to perform actions on the
 *     ledger.
 */
api.get = (actor, ledgerId, options, callback) => {
  // FIXME: Implement
  callback(null, new LedgerNode(ledgerId));
};

/**
 * Delete an existing ledger given a ledgerId and a set of options.
 *
 * actor - the actor performing the action.
 * ledgerId - the URI of the ledger.
 * options - a set of options used when deleting the ledger.
 * callback(err) - the callback to call when finished.
 *   err - An Error if an error occurred, null otherwise.
 */
api.delete = (actor, ledgerId, options, callback) => {
  // FIXME: Implement
  callback();
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
    ledger: 'did:v1:40454763-c925-459d-9b1b-8fb5869eca6b',
  }, {
    ledger: 'did:v1:b464dfe5-b0ad-407f-9d36-72e04de8572e',
  }]);
};

/**
 * Ledger Node class that exposes the blocks, events, and meta APIs.
 */
class LedgerNode {
  constructor(ledgerId) {
    this.meta = new LedgerNodeMeta(this);
    this.blocks = new LedgerNodeBlocks(this);
    this.events = new LedgerNodeEvents(this);
    this.driver = {};
  }
}
