/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedger = require('bedrock-ledger');
const expect = global.chai.expect;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

const baseUri = 'http://example.com';

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

describe('consentToBlock API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('non-forking consensus (continuity)', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    const events = [];
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it('accepts a well-formed block', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.consentToBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('rejects a block with an invalid transaction', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.consentToBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('rejects a block on an incorrect fork', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.consentToBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('retries until consensus is reached', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.consentToBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('accepts the correct block when a fork is possible', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.consentToBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('accepts the right block on a network partition', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.consentToBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
  });
});
