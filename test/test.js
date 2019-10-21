/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {jsonLdDocumentLoader} = require('bedrock-jsonld-document-loader');

require('bedrock-ledger-node');
require('bedrock-ledger-context');

// load ledger plugins
require('bedrock-ledger-storage-mongodb');
require('bedrock-ledger-consensus-uni');
require('bedrock-ledger-validator-signature');

bedrock.events.on('bedrock.init', () => {
  const mockData = require('./mocha/mock.data');
  for(const url in mockData.ldDocuments) {
    jsonLdDocumentLoader.addStatic(url, mockData.ldDocuments[url]);
  }
});

require('bedrock-test');
bedrock.start();
