/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {Ed25519VerificationKey2020} =
  require('@digitalbazaar/ed25519-verification-key-2020');
const bedrock = require('bedrock');
const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const mockData = require('./mock.data');
const {util: {uuid}} = bedrock;

let signedConfig;

// NOTE: there is an index in the storage layer that ensures that there are
// never two consensus events with the same blockHeight and blockOrder. That
// is why `startBlockHeight` is used in the following tests.
describe('Records API', () => {
  before(async function() {
    await helpers.prepareDatabase(mockData);
    const key = await Ed25519VerificationKey2020.from(
      mockData.keys.authorized);
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
  describe('get API', () => {
    describe('regularUser as actor', () => {
      let actor;
      let ledgerNode;
      let ledgerStorage;
      let originalGetLatestSummary;
      before(async () => {
        const {id} = mockData.accounts.regularUser.account;
        actor = await brAccount.getCapabilities({id});
        ledgerNode = await brLedgerNode.add(
          actor, {ledgerConfiguration: signedConfig});
        ledgerStorage = ledgerNode.storage;
        originalGetLatestSummary = ledgerStorage.blocks.getLatestSummary;
        ledgerStorage.blocks.getLatestSummary = helpers.getLatestBlockSummary;
      });
      after(async () => {
        ledgerNode.storage.blocks.getLatestSummary = originalGetLatestSummary;
      });
      it('get an existing record', async () => {
        const opTemplate = mockData.operations.beta;
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        // the helper creates events without consensus by default
        const events = await helpers.addEvent({
          consensus: true, eventTemplate, ledgerStorage, opTemplate,
          recordId: testRecordId
        });
        await helpers.updateBlockHeight({blockHeight: 1});
        const result = await ledgerNode.records.get({recordId: testRecordId});
        should.exist(result);
        const eventHash = Object.keys(events)[0];
        const testRecord = events[eventHash].operations[0]
          .operation.record;
        const {meta, record} = result;
        should.exist(record);
        record.should.eql(testRecord);
        should.exist(meta);
        should.exist(meta.sequence);
        meta.sequence.should.equal(0);
      });
      it('get an updated record', async () => {
        const opTemplate = mockData.operations.beta;
        const updateOpTemplate = mockData.operations.gamma;
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        // the helper creates events without consensus by default
        const events = await helpers.addEvent({
          consensus: true, eventTemplate, ledgerStorage, opTemplate,
          recordId: testRecordId, startBlockHeight: 2
        });
        await helpers.addEvent({
          consensus: true, eventTemplate, ledgerStorage,
          opTemplate: updateOpTemplate, recordId: testRecordId,
          startBlockHeight: 3
        });
        await helpers.updateBlockHeight({blockHeight: 3});
        const result = await ledgerNode.records.get({
          maxBlockHeight: 3, recordId: testRecordId});
        should.exist(result);
        const eventHash = Object.keys(events)[0];
        const testRecord = bedrock.util.clone(events[eventHash]
          .operations[0].operation.record);
        // corresponds to mockData.operations.gamma;
        testRecord.endDate = '2017-07-14T23:30';
        const {meta, record} = result;
        should.exist(record);
        record.should.eql(testRecord);
        should.exist(meta);
        should.exist(meta.sequence);
        meta.sequence.should.equal(1);
      });
      // FIXME: helper functions need to be updated to support generating real
      // history. This test will take effort to get working again.
      it('get a record that was updated twice', async () => {
        const opTemplate = mockData.operations.beta;
        const opUpdates = [
          mockData.operations.gamma, mockData.operations.delta
        ];
        const eventTemplate = bedrock.util.clone(mockData.events.alpha);
        const testRecordId = `https://example.com/event/${uuid()}`;
        const startBlockHeight = 4;

        // the helper creates events without consensus by default
        const events = await helpers.addEvent({
          consensus: true, eventTemplate, ledgerStorage, opTemplate,
          recordId: testRecordId, startBlockHeight
        });
        let i = 0;
        for(const updateOpTemplate of opUpdates) {
          updateOpTemplate.recordPatch.sequence = i;
          await helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage,
            opTemplate: updateOpTemplate, recordId: testRecordId,
            startBlockHeight: i + startBlockHeight + 1
          });
          i++;
        }

        // create the latest block
        await helpers.updateBlockHeight({blockHeight: 6});
        const result = await ledgerNode.records.get({
          maxBlockHeight: 6, recordId: testRecordId});
        should.exist(result);
        const eventHash = Object.keys(events)[0];
        const testRecord = bedrock.util.clone(events[eventHash]
          .operations[0].operation.record);
        // corresponds to mockData.operations.gamma;
        testRecord.endDate = '2017-07-14T23:30';
        // corresponds to mockData.operations.delta;
        testRecord.name = 'Less Big Band Concert in New York City';
        const {meta, record} = result;
        should.exist(record);
        record.should.eql(testRecord);
        should.exist(meta);
        should.exist(meta.sequence);
        meta.sequence.should.equal(2);
      });
      // the same record property will be updated twice
      it('record updates are applied in the proper order', async () => {
        const opTemplate = mockData.operations.beta;
        const opUpdateEndDate = bedrock.util.clone(mockData.operations.gamma);
        const newEndDate = '2018-01-01T13:00';
        opUpdateEndDate.recordPatch.patch[0].op = 'replace';
        opUpdateEndDate.recordPatch.patch[0].value = newEndDate;
        const opUpdates = [
          // adds endDate property
          mockData.operations.gamma,
          // replaces endDate property
          opUpdateEndDate
        ];
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        const startBlockHeight = 7;
        // the helper creates events without consensus by default
        const events = await helpers.addEvent({
          consensus: true, eventTemplate, ledgerStorage, opTemplate,
          recordId: testRecordId, startBlockHeight
        });
        let i = 0;
        for(const updateOpTemplate of opUpdates) {
          updateOpTemplate.recordPatch.sequence = i;
          await helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage,
            opTemplate: updateOpTemplate, recordId: testRecordId,
            startBlockHeight: i + startBlockHeight + 1
          });
          i++;
        }

        // get latest record data
        await helpers.updateBlockHeight({blockHeight: 9});
        const result = await ledgerNode.records.get({
          maxBlockHeight: 9, recordId: testRecordId});
        should.exist(result);
        const eventHash = Object.keys(events)[0];
        const testRecord = bedrock.util.clone(events[eventHash]
          .operations[0].operation.record);
        testRecord.endDate = newEndDate;
        const {meta, record} = result;
        should.exist(record);
        record.should.eql(testRecord);
        should.exist(meta);
        should.exist(meta.sequence);
        meta.sequence.should.equal(2);
      });
      it('record does not reflect invalid updates', async () => {
        const opTemplate = mockData.operations.beta;
        const opUpdateFailure = bedrock.util.clone(mockData.operations.gamma);
        opUpdateFailure.recordPatch.patch = [
          // this is a valid patch
          {
            op: 'replace', path: '/name',
            value: 'Less Big Band Concert in New York City'
          },
          // `name-of-concert does not exist, so this patch will fail`
          {
            op: 'replace', path: '/name-of-concert',
            value: 'Less Big Band Concert in New York City'
          }
        ];
        const opUpdates = [
          // adds endDate property
          mockData.operations.gamma,
          opUpdateFailure
        ];
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        const startBlockHeight = 10;
        // the helper creates events without consensus by default
        const events = await helpers.addEvent({
          consensus: true, eventTemplate, ledgerStorage, opTemplate,
          recordId: testRecordId, startBlockHeight
        });
        let i = 0;
        for(const updateOpTemplate of opUpdates) {
          updateOpTemplate.recordPatch.sequence = i;
          await helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage,
            opTemplate: updateOpTemplate, recordId: testRecordId,
            startBlockHeight: i + startBlockHeight + 1
          });
          i++;
        }

        await helpers.updateBlockHeight({blockHeight: 12});
        const result = await ledgerNode.records.get({
          maxBlockHeight: 12, recordId: testRecordId});
        should.exist(result);
        const eventHash = Object.keys(events)[0];
        const testRecord = bedrock.util.clone(events[eventHash]
          .operations[0].operation.record);
        // corresponds to mockData.operations.gamma;
        testRecord.endDate = '2017-07-14T23:30';
        const {meta, record} = result;
        should.exist(record);
        // none of the updates in `opUpdateFailure` should be applied
        record.should.eql(testRecord);
        should.exist(meta);
        should.exist(meta.sequence);
        meta.sequence.should.equal(1);
      });
      it('returns proper record with the maxBlockHeight option', async () => {
        const opTemplate = mockData.operations.beta;
        const opUpdateEndDate = bedrock.util.clone(mockData.operations.gamma);
        const newEndDate = '2018-01-01T13:00';
        opUpdateEndDate.recordPatch.patch[0].op = 'replace';
        opUpdateEndDate.recordPatch.patch[0].value = newEndDate;
        const opUpdates = [
          // adds endDate property
          mockData.operations.gamma,
          // replaces endDate property
          opUpdateEndDate
        ];
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        const startBlockHeight = 13;

        // block 13
        const events = await helpers.addEvent({
          consensus: true, eventTemplate, ledgerStorage, opTemplate,
          recordId: testRecordId, startBlockHeight
        });
        // blocks 14 and 15
        let i = 0;
        for(const updateOpTemplate of opUpdates) {
          updateOpTemplate.recordPatch.sequence = i;
          await helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage,
            opTemplate: updateOpTemplate, recordId: testRecordId,
            startBlockHeight: i + startBlockHeight + 1
          });
          i++;
        }
        await helpers.updateBlockHeight({blockHeight: 15});

        // check data on block 13
        let result = await ledgerNode.records.get({
          maxBlockHeight: 13, recordId: testRecordId});
        should.exist(result);
        let eventHash = Object.keys(events)[0];
        let testRecord = bedrock.util.clone(events[eventHash]
          .operations[0].operation.record);
        let {meta, record} = result;
        should.exist(record);
        // at blockHeight 13 the original record should be returned
        record.should.eql(testRecord);
        should.exist(meta);
        should.exist(meta.sequence);
        meta.sequence.should.equal(0);

        // check data on block 14
        result = await ledgerNode.records.get(
          {maxBlockHeight: 14, recordId: testRecordId});
        should.exist(result);
        eventHash = Object.keys(events)[0];
        testRecord = bedrock.util.clone(events[eventHash]
          .operations[0].operation.record);
        // at blockHeight 14, the updated record is returned
        // corresponds to mockData.operations.gamma;
        testRecord.endDate = '2017-07-14T23:30';
        ({meta, record} = result);
        should.exist(record);
        record.should.eql(testRecord);
        should.exist(meta);
        should.exist(meta.sequence);
        meta.sequence.should.equal(1);
      });
    });
  });
});
