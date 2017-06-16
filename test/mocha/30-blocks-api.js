/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brLedgerStorage = require('bedrock-ledger-storage-mongodb');
const brIdentity = require('bedrock-identity');
const ledger = require('bedrock-ledger');
const database = require('bedrock-mongodb');
const expect = global.chai.expect;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

const baseUri = 'http://example.com';

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

describe.skip('Blocks API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollections('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    const configBlock = mockData.configBlocks.alpha;
    let actor;
    before(done => async.auto({
      getActor: callback => brIdentity.get(
        null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          callback(err);
        }),
      addLedger: callback => brLedgerStorage.add(configBlock, {}, {
        eventHasher: helpers.hasher,
        blockHasher: helpers.hasher
      }, callback),
      addBlock: ['addLedger', (results, callback) => {
        callback();
      }]
    }, done));
    it('should get block', done => {
      done();
    });
  });
}); // end createLedger
