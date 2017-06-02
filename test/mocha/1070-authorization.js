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

describe.skip('OLD DISABLED authorizeBlock API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('multisignature (RSA)', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    const events = [];
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it('allows a multisignature that is exactly the threshold', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.authorizeBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('allows a multisignature above the threshold', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.authorizeBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('denies a multisignature below the threshold', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.authorizeBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
  });
  describe('proof of work (argon2d)', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    const events = [];
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it('allows a valid proof of work', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.authorizeBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
    it('denies an invalid proof of work', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        authorizeBlock: callback => {
          const ledgerId = '';
          const block = {};
          const options = {};
          brLedger.authorizeBlock(actor, ledgerId, block, options, callback);
        },
      }, done);
    });
  });
});
