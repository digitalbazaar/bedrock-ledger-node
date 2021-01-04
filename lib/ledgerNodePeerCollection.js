/*!
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const database = require('bedrock-mongodb');

const api = {};
module.exports = api;

const COLLLECTION_NAME = api.COLLLECTION_NAME = 'ledgerNode_peer';

module.exports.init = async () => {
  await database.openCollections([COLLLECTION_NAME]);
  await database.createIndexes([{
    collection: COLLLECTION_NAME,
    fields: {
      'meta.ledgerNodeId': 1,
      'peer.id': 1
    },
    options: {unique: true, background: false}
  }, {
    collection: COLLLECTION_NAME,
    fields: {
      'meta.ledgerNodeId': 1,
      'peer.recommended': 1
    },
    options: {sparse: true, unique: false, background: false}
  }]);
};
