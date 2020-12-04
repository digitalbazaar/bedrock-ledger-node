/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const mockData = require('./mock.data');
const {util: {uuid}} = require('bedrock');

let signedConfig;

describe('Operations API', () => {
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
  describe('regularUser as actor', () => {
    let actor;
    let ledgerNode;
    before(async () => {
      const {id} = mockData.accounts.regularUser.account;
      actor = await brAccount.getCapabilities({id});
      ledgerNode = await brLedgerNode.add(
        actor, {ledgerConfiguration: signedConfig});
    });
    it('should add operation with optional creator', async function() {
      const testOperation = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'CreateWebLedgerRecord',
        creator: 'https://example.com/someCreatorId',
        record: {
          '@context': 'https://schema.org/',
          id: 'urn:uuid:' + uuid(),
          value: uuid()
        }
      };
      const operation = await helpers.signDocument({
        doc: testOperation,
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      });
      await ledgerNode.operations.add({operation});
    });
    it('should add operation without optional creator', async function() {
      const testOperation = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'CreateWebLedgerRecord',
        // the optional creator is missing
        record: {
          '@context': 'https://schema.org/',
          id: 'urn:uuid:' + uuid(),
          value: uuid()
        }
      };
      const operation = await helpers.signDocument({
        doc: testOperation,
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      });
      await ledgerNode.operations.add({operation});
    });
    it('should fail add operation with an incorrect context', async () => {
      const testOperation = {
        '@context': 'https://w3id.org/test/v1',
        type: 'CreateWebLedgerRecord',
        creator: 'https://example.com/someCreatorId',
        record: {
          '@context': 'https://schema.org/',
          id: 'urn:uuid:' + uuid(),
          value: uuid()
        }
      };
      const operation = await helpers.signDocument({
        doc: testOperation,
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      });
      let err;
      try {
        await ledgerNode.operations.add({operation});
      } catch(e) {
        err = e;
      }
      err.name.should.equal('SyntaxError');
      err.message.should.equal(
        'Operation context must be "https://w3id.org/webledger/v1"');
    });
    it('should fail to add operation w/ incorrect context order', async () => {
      const testOperation = {
        '@context': ['https://w3id.org/test/v1'],
        type: 'CreateWebLedgerRecord',
        creator: 'https://example.com/someCreatorId',
        record: {
          '@context': 'https://schema.org/',
          id: 'urn:uuid:' + uuid(),
          value: uuid()
        }
      };
      const operation = await helpers.signDocument({
        doc: testOperation,
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      });
      let err;
      try {
        await ledgerNode.operations.add({operation});
      } catch(e) {
        err = e;
      }
      err.name.should.equal('SyntaxError');
      err.message.should.equal('Operation context must contain ' +
        '"https://w3id.org/webledger/v1" as the first element.');
    });
    it('should get event containing the operation', async function() {
      const testOperation = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'CreateWebLedgerRecord',
        creator: 'https://example.com/someCreatorId',
        record: {
          '@context': 'https://schema.org/',
          id: 'urn:uuid:' + uuid(),
          value: uuid()
        }
      };
      const operation = await helpers.signDocument({
        doc: testOperation,
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      });
      await ledgerNode.operations.add({operation});
      // unilateral consensus allows immediate retrieval of an event with
      // a single operation in it from the latest block
      const result = await ledgerNode.blocks.getLatest();
      should.exist(result);
      should.exist(result.eventBlock);
      should.exist(result.eventBlock.block);
      should.exist(result.eventBlock.block.event);
      const event = result.eventBlock.block.event[0];
      should.exist(event);
      should.exist(event.operation);
      should.exist(event.operation[0]);
      event.operation[0].should.deep.equal(operation);
    });
  });
});
