/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brLedgerStorage = require('bedrock-ledger-storage-mongodb');
const brIdentity = require('bedrock-identity');
const brLedger = require('bedrock-ledger');
const database = require('bedrock-mongodb');
const expect = global.chai.expect;
const helpers = require('./helpers');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

const baseUri = 'http://example.com';

describe('Blocks API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollections('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    const configBlock = mockData.configBlocks.alpha;
    let configBlockId;
    let ledgerNode;
    let actor;
    before(done => async.auto({
      getActor: callback => brIdentity.get(
        null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          callback(err);
        }),
      addLedger: callback => brLedger.add(
        null, configBlock, {}, (err, result) => {
          ledgerNode = result;
          callback(err, result);
        }),
      addBlock: ['addLedger', (results, callback) => {
        results.addLedger.storage.blocks.getLatest({}, (err, result) => {
          configBlockId = result.configurationBlock.block.id;
          callback();
        });
      }]
    }, done));
    it('should get block', done => {
      ledgerNode.blocks.get(configBlockId, (err, result) => {
        should.not.exist(err);
        should.exist(result);
        result.block.should.be.an('object');
        const block = result.block;
        block.id.should.equal(configBlockId);
        result.meta.should.be.an('object');
        done();
      });
    });
  });
}); // end createLedger
