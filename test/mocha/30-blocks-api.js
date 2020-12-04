/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const mockData = require('./mock.data');

let signedConfig;

describe('Blocks API', () => {
  before(async function() {
    await helpers.prepareDatabase(mockData);
    signedConfig = await helpers.signDocument({
      doc: mockData.ledgerConfiguration,
      creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
      privateKeyPem: mockData.groups.authorized.privateKey,
    });
  });
  beforeEach(async function() {
    await helpers.removeCollections(['ledger', 'ledgerNode']);
  });
  describe('regularUser as actor', async function() {
    let configBlockId;
    let ledgerNode;
    let actor;
    before(async function() {
      const {id} = mockData.accounts.regularUser.account;
      actor = await brAccount.getCapabilities({id});
      ledgerNode = await brLedgerNode.add(
        actor, {ledgerConfiguration: signedConfig});
      const result = await ledgerNode.storage.blocks.getLatest();
      configBlockId = result.eventBlock.block.id;
    });
    it('should get block', async function() {
      const result = await ledgerNode.blocks.get({blockId: configBlockId});
      should.exist(result);
      result.block.should.be.an('object');
      const block = result.block;
      block.id.should.equal(configBlockId);
      result.meta.should.be.an('object');
    });
    describe('getLatestBlockHeight', () => {
      it('gets the blockHeight', async function() {
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
    }); // end getLatestBlockHeight
  });
});
