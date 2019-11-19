/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const mockData = require('./mock.data');

let signedConfig;

describe('Blocks API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback),
      callback => helpers.signDocument({
        doc: mockData.ledgerConfiguration,
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      }, (err, result) => {
        signedConfig = result;
        callback(err);
      })
    ], done);
  });
  beforeEach(done => {
    helpers.removeCollections('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    let configBlockId;
    let ledgerNode;
    let actor;
    before(done => async.auto({
      getActor: callback => {
        const {id} = mockData.identities.regularUser.identity;
        brIdentity.getCapabilities({id}, (err, result) => {
          actor = result;
          assertNoError(err);
          callback();
        });
      },
      addLedger: callback => brLedgerNode.add(
        actor, {ledgerConfiguration: signedConfig}, (err, result) => {
          ledgerNode = result;
          callback(err, result);
        }),
      addBlock: ['addLedger', (results, callback) => {
        results.addLedger.storage.blocks.getLatest((err, result) => {
          configBlockId = result.eventBlock.block.id;
          callback();
        });
      }]
    }, done));
    it('should get block', done => {
      ledgerNode.blocks.get({blockId: configBlockId}, (err, result) => {
        assertNoError(err);
        should.exist(result);
        result.block.should.be.an('object');
        const block = result.block;
        block.id.should.equal(configBlockId);
        result.meta.should.be.an('object');
        done();
      });
    });
    describe('getLatestBlockHeight', () => {
      it('gets the blockHeigh without useCache option', async () => {
        let error;
        let result;
        try {
          result = await ledgerNode.blocks.getLatestBlockHeight();
        } catch(e) {
          error = e;
        }
        assertNoError(error);
        should.exist(result);
        result.should.equal(0);

      });
      it('should get a blockHeight with useCache option', async () => {
        let error;
        let result;
        try {
          result = await ledgerNode.blocks.getLatestBlockHeight(
            {useCache: true});
        } catch(e) {
          error = e;
        }
        assertNoError(error);
        should.exist(result);
        result.should.equal(0);
      });

    }); // end getLatestBlockHeight
  });
});
