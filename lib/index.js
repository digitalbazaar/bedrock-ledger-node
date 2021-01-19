/*!
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const peerCollection = require('./ledgerNodePeerCollection');

require('./config');

// module API
const api = Object.assign({}, require('./rootApi'));
module.exports = api;

api.consensus = require('./consensus');
api.validator = require('./validator');

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections(['ledgerNode']);
  await database.createIndexes([{
    // for getting ledger nodes by ID
    collection: 'ledgerNode',
    fields: {id: 1},
    options: {unique: true, background: false}
  }, {
    // for releasing ledger nodes claimed for work by session ID/ID
    collection: 'ledgerNode',
    fields: {'meta.workSession.id': 1, id: 1},
    options: {unique: false, background: false}
  }, {
    // for finding the LRU ledger node for work/getting deleted ledger nodes
    collection: 'ledgerNode',
    fields: {
      'meta.deleted': 1,
      'meta.workSession.expires': 1,
      // cover sort and query
      'meta.updated': 1,
      'ledgerNode.id': 1
    },
    options: {unique: false, background: false}
  }]);

  await peerCollection.init();

  await bedrock.events.emit('bedrock-ledger-node.ready');
});
