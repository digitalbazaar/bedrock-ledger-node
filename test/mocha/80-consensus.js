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
    it.skip('accepts a well-formed block', done => {
      done();
    });
    it.skip('rejects a block with an invalid transaction', done => {
      done();
    });
    it.skip('rejects a block on an incorrect fork', done => {
      done();
    });
    it.skip('retries until consensus is reached', done => {
      done();
    });
    it.skip('accepts the correct block when a fork occurs', done => {
      done();
    });
    it.skip('accepts the right block on a network partition', done => {
      done();
    });
  });
});
