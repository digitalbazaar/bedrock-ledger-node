/*!
 * Ledger storage module.
 *
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
// const brPermission = require('bedrock-permission');
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

api.use = (options, pluginApi) => {
  // FIXME: Implement
};

api.create = (actor, configBlock, options, callback) => {
  // FIXME: Implement
  callback(null, new LedgerNode(configBlock.ledger));
};

api.get = (actor, ledgerId, options, callback) => {
  // FIXME: Implement
  callback(null, new LedgerNode(ledgerId));
};

api.delete = (actor, ledgerId, options, callback) => {
  // FIXME: Implement
  callback();
};

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

class LedgerNode {
  constructor(ledgerId) {
    this.meta = new LedgerNodeMeta(this);
    this.blocks = new LedgerNodeBlocks(this);
    this.events = new LedgerNodeEvents(this);
    this.driver = {};
  }
}
