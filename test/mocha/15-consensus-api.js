/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

describe('Consensus API', () => {
  describe('hasher API', () => {
    const hasher = brLedgerNode.consensus._hasher;
    it('unique WebLedgerOperationEvents create unique hashes', done => {
      const event1 = bedrock.util.clone(mockData.events.alpha);
      const event2 = bedrock.util.clone(mockData.events.alpha);
      // NOTE: event IDs *must* be URIs
      event1.operationHash = [uuid()];
      event2.operationHash = [uuid()];
      async.auto({
        hash1: callback => hasher(event1, callback),
        hash2: callback => hasher(event2, callback),
      }, (err, results) => {
        assertNoError(err);
        const {hash1, hash2} = results;
        hash1.should.not.equal(hash2);
        done();
      });
    });
  });
});
