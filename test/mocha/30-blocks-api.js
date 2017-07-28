/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const jsonld = bedrock.jsonld;
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');

jsigs.use('jsonld', jsonld);

let signedConfigEvent;

describe('Blocks API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback),
      callback => jsigs.sign(mockData.events.config, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      }, (err, result) => {
        signedConfigEvent = result;
        callback(err);
      })
    ], done);
  });
  beforeEach(done => {
    helpers.removeCollections('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let configBlockId;
    let ledgerNode;
    let actor;
    before(done => async.auto({
      getActor: callback => brIdentity.get(
        null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          callback(err);
        }),
      addLedger: callback => brLedgerNode.add(
        null, {configEvent: signedConfigEvent}, (err, result) => {
          ledgerNode = result;
          callback(err, result);
        }),
      addBlock: ['addLedger', (results, callback) => {
        results.addLedger.storage.blocks.getLatest({}, (err, result) => {
          configBlockId = result.eventBlock.block.id;
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
