/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const {promisify} = require('util');

require('./config');

const namespace = 'ledger-node';
const logger = bedrock.loggers.get('app').child(namespace);

// module API
const api = Object.assign({}, require('./rootApi'));
module.exports = api;

api.consensus = require('./consensus');

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
