/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {Ed25519VerificationKey2020} =
  require('@digitalbazaar/ed25519-verification-key-2020');
const bedrock = require('bedrock');
const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const {_hasher: hasher} = brLedgerNode.consensus;
const helpers = require('./helpers');
const mockData = require('./mock.data');
const {util: {uuid}} = bedrock;

let signedConfig;

describe('Events API', () => {
  before(async function() {
    await helpers.prepareDatabase(mockData);
    const key =
      await Ed25519VerificationKey2020.from(mockData.keys.authorized);
    signedConfig = await helpers.signDocument({
      doc: mockData.ledgerConfiguration,
      verificationMethod:
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
      key
    });
  });
  beforeEach(async function() {
    await helpers.removeCollections(['ledger', 'ledgerNode']);
  });
  describe('regularUser as actor', () => {
    let actor;
    let ledgerNode;
    before(async () => {
      const {id} = mockData.accounts.regularUser.account;
      actor = await brAccount.getCapabilities({id});
      ledgerNode = await brLedgerNode.add(
        actor, {ledgerConfiguration: signedConfig});
    });
    it('should create an event', async () => {
      const testOperation = {
        '@context': 'https://w3id.org/webledger/v1',
        creator: 'https://example.com/someCreatorId',
        type: 'CreateWebLedgerRecord',
        record: {
          '@context': 'https://schema.org/',
          id: 'urn:uuid:' + uuid(),
          value: uuid()
        }
      };
      const key =
        await Ed25519VerificationKey2020.from(mockData.keys.authorized);
      const operation = await helpers.signDocument({
        doc: testOperation,
        verificationMethod:
          'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
        key
      });
      const operationHash = await hasher(operation);
      await ledgerNode.operations.add({operation});
      // unilateral consensus allows immediate retrieval of an event with
      // a single operation in it from the latest block
      let result = await ledgerNode.blocks.getLatest();
      should.exist(result);
      should.exist(result.eventBlock);
      should.exist(result.eventBlock.block);
      should.exist(result.eventBlock.block.event);
      const event = result.eventBlock.block.event[0];
      should.exist(event);
      should.exist(event.operation);
      should.exist(event.operation[0]);
      event.operation[0].should.deep.equal(operation);
      // hash event (only works because of knowledge of how unilateral
      // consensus works)
      event.operationHash = [operationHash];
      delete event.operation;
      const eventHash = await hasher(event);
      result = await ledgerNode.events.get(eventHash);
      should.exist(result);
      should.exist(result.event);
      should.exist(result.event.operation);
      should.exist(result.event.operation[0]);
      result.event.operation[0].should.deep.equal(operation);
      should.exist(result.meta);
      result.meta.eventHash.should.equal(eventHash);
    });
  });
});
