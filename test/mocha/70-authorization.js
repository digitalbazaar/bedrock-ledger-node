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

describe('authorizeBlock API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('multisignature (RSA)', () => {
    it.skip('allows a multisignature that is exactly the threshold', done => {
      done();
    });
    it.skip('allows a multisignature above the threshold', done => {
      done();
    });
    it.skip('denies a multisignature below the threshold', done => {
      done();
    });
  });
  describe('proof of work (argon2d)', () => {
    it.skip('allows a valid proof of work', done => {
      done();
    });
    it.skip('denies an invalid proof of work', done => {
      done();
    });
  });
});
