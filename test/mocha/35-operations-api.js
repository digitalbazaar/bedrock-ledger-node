/*
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {Ed25519VerificationKey2020} =
  require('@digitalbazaar/ed25519-verification-key-2020');
const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const mockData = require('./mock.data');
const {util: {uuid}} = require('bedrock');

let signedConfig;

describe('Operations API', () => {
  before(async function() {
    await helpers.prepareDatabase(mockData);
    const key =
      await Ed25519VerificationKey2020.from(mockData.keys.authorized);
    signedConfig = await helpers.signDocument({
      doc: mockData.ledgerConfiguration,
      verificationMethod:
        'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144',
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
    describe('add API', () => {

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
        const key =
          await Ed25519VerificationKey2020.from(mockData.keys.authorized);
        const operation = await helpers.signDocument({
          doc: testOperation,
          verificationMethod:
            'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144',
          key
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
        const key =
          await Ed25519VerificationKey2020.from(mockData.keys.authorized);
        const operation = await helpers.signDocument({
          doc: testOperation,
          verificationMethod:
            'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144',
          key
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
        const key =
          await Ed25519VerificationKey2020.from(mockData.keys.authorized);
        const operation = await helpers.signDocument({
          doc: testOperation,
          verificationMethod:
            'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144',
          key
        });
        let err;
        try {
          await ledgerNode.operations.add({operation});
        } catch(e) {
          err = e;
        }
        err.name.should.equal('SyntaxError');
        err.message.should.equal(
          'Operation context must contain "https://w3id.org/webledger/v1" ' +
          'as the first element.');
      });
      it('should fail to add operation w/ incorrect context order',
        async () => {
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
          const key =
            await Ed25519VerificationKey2020.from(mockData.keys.authorized);
          const operation = await helpers.signDocument({
            doc: testOperation,
            verificationMethod:
              'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144',
            key
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
        const key =
          await Ed25519VerificationKey2020.from(mockData.keys.authorized);
        const operation = await helpers.signDocument({
          doc: testOperation,
          verificationMethod:
            'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144',
          key
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

    describe('exists API', () => {
      let recordId;

      before(async () => {
        recordId = 'urn:uuid:' + uuid();

        const testOperation = {
          '@context': 'https://w3id.org/webledger/v1',
          type: 'CreateWebLedgerRecord',
          creator: 'https://example.com/someCreatorId',
          record: {
            '@context': 'https://schema.org/',
            id: recordId,
            value: uuid()
          }
        };
        const key =
          await Ed25519VerificationKey2020.from(mockData.keys.authorized);
        const operation = await helpers.signDocument({
          doc: testOperation,
          verificationMethod:
            'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144',
          key
        });

        await ledgerNode.operations.add({operation});
      });

      // FIXME: why would this record exist if no consensus was found yet?
      it.skip('should find record that exists', async () => {
        const exists = await ledgerNode.operations.exists({recordId});
        exists.should.equal(true);
      });

      it('should not find record that doesn\'t exist', async () => {
        const exists = await ledgerNode.operations.exists({recordId: 'foobar'});
        exists.should.equal(false);
      });
    });
  });
});
