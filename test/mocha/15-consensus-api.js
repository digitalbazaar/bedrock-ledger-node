/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const mockData = require('./mock.data');
const {util: {uuid}} = bedrock;

describe('Consensus API', () => {
  describe('hasher API', () => {
    const hasher = brLedgerNode.consensus._hasher;
    it('unique WebLedgerOperationEvents create unique hashes', async () => {
      const event1 = bedrock.util.clone(mockData.events.alpha);
      const event2 = bedrock.util.clone(mockData.events.alpha);
      // NOTE: event IDs *must* be URIs
      event1.operationHash = [uuid()];
      event2.operationHash = [uuid()];
      const hash1 = await hasher(event1);
      const hash2 = await hasher(event2);
      hash1.should.not.equal(hash2);
    });
  });
});
