/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

// const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const jsonld = bedrock.jsonld;
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

jsigs.use('jsonld', jsonld);

let signedConfig;

describe('Records API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback),
      callback => jsigs.sign(mockData.ledgerConfiguration, {
        algorithm: 'RsaSignature2018',
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
  describe('get API', () => {
    describe('regularUser as actor', () => {
      const mockIdentity = mockData.identities.regularUser;
      let actor;
      let ledgerNode;
      let ledgerStorage;
      before(done => {
        async.auto({
          getActor: callback =>
            brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
              actor = result;
              callback(err);
            }),
          addLedger: ['getActor', (results, callback) => {
            brLedgerNode.add(actor, {ledgerConfiguration: signedConfig},
              (err, result) => {
                ledgerNode = result;
                ledgerStorage = result.storage;
                callback(err);
              });
          }]
        }, done);
      });
      it('get an existing record', done => {
        const opTemplate = mockData.operations.beta;
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        async.auto({
          // the helper creates events without consensus by default
          events: callback => helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage, opTemplate,
            recordId: testRecordId
          }, callback),
          get: ['events', (results, callback) => {
            ledgerNode.records.get(
              {recordId: testRecordId}, (err, result) => {
                assertNoError(err);
                should.exist(result);
                const eventHash = Object.keys(results.events)[0];
                const testRecord = results.events[eventHash].operations[0]
                  .operation.record;
                const {meta, record} = result;
                should.exist(record);
                record.should.eql(testRecord);
                should.exist(meta);
                should.exist(meta.sequence);
                meta.sequence.should.equal(0);
                callback();
              });
          }]
        }, done);
      });
      it('get an updated record', done => {
        const opTemplate = mockData.operations.beta;
        const updateOpTemplate = mockData.operations.gamma;
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        async.auto({
          // the helper creates events without consensus by default
          events: callback => helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage, opTemplate,
            recordId: testRecordId
          }, callback),
          update: ['events', (results, callback) => helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage,
            opTemplate: updateOpTemplate, recordId: testRecordId
          }, callback)],
          get: ['update', (results, callback) => {
            ledgerNode.records.get(
              {recordId: testRecordId}, (err, result) => {
                assertNoError(err);
                should.exist(result);
                const eventHash = Object.keys(results.events)[0];
                const testRecord = bedrock.util.clone(results.events[eventHash]
                  .operations[0].operation.record);
                // corresponds to mockData.operations.gamma;
                testRecord.endDate = '2017-07-14T23:30';
                const {meta, record} = result;
                should.exist(record);
                record.should.eql(testRecord);
                should.exist(meta);
                should.exist(meta.sequence);
                meta.sequence.should.equal(1);
                callback();
              });
          }]
        }, done);
      });
      it('get a record that was updated twice', done => {
        const opTemplate = mockData.operations.beta;
        const opUpdates = [
          mockData.operations.gamma, mockData.operations.delta
        ];
        const eventTemplate = mockData.events.alpha;
        const testRecordId = `https://example.com/event/${uuid()}`;
        async.auto({
          // the helper creates events without consensus by default
          events: callback => helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage, opTemplate,
            recordId: testRecordId
          }, callback),
          update: ['events', (results, callback) => async.eachOfSeries(
            opUpdates, (updateOpTemplate, i, callback) => {
              updateOpTemplate.recordPatch.sequence = i;
              helpers.addEvent({
                consensus: true, eventTemplate, ledgerStorage,
                opTemplate: updateOpTemplate, recordId: testRecordId,
                startBlockHeight: i + 2
              }, callback);
            }, callback)],
          get: ['update', (results, callback) => {
            ledgerNode.records.get(
              {recordId: testRecordId}, (err, result) => {
                assertNoError(err);
                should.exist(result);
                const eventHash = Object.keys(results.events)[0];
                const testRecord = bedrock.util.clone(results.events[eventHash]
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
                callback();
              });
          }]
        }, done);
      });
      // the same record property will be updated twice
      it('record updates are applied in the proper order', done => {
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
        async.auto({
          // the helper creates events without consensus by default
          events: callback => helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage, opTemplate,
            recordId: testRecordId
          }, callback),
          update: ['events', (results, callback) => async.eachOfSeries(
            opUpdates, (updateOpTemplate, i, callback) => {
              updateOpTemplate.recordPatch.sequence = i;
              helpers.addEvent({
                consensus: true, eventTemplate, ledgerStorage,
                opTemplate: updateOpTemplate, recordId: testRecordId,
                startBlockHeight: i + 2
              }, callback);
            }, callback)],
          get: ['update', (results, callback) => {
            ledgerNode.records.get(
              {recordId: testRecordId}, (err, result) => {
                assertNoError(err);
                should.exist(result);
                const eventHash = Object.keys(results.events)[0];
                const testRecord = bedrock.util.clone(results.events[eventHash]
                  .operations[0].operation.record);
                testRecord.endDate = newEndDate;
                const {meta, record} = result;
                should.exist(record);
                record.should.eql(testRecord);
                should.exist(meta);
                should.exist(meta.sequence);
                meta.sequence.should.equal(2);
                callback();
              });
          }]
        }, done);
      });
      it('record does not reflect invalid updates', done => {
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
        async.auto({
          // the helper creates events without consensus by default
          events: callback => helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage, opTemplate,
            recordId: testRecordId
          }, callback),
          update: ['events', (results, callback) => async.eachOfSeries(
            opUpdates, (updateOpTemplate, i, callback) => {
              updateOpTemplate.recordPatch.sequence = i;
              helpers.addEvent({
                consensus: true, eventTemplate, ledgerStorage,
                opTemplate: updateOpTemplate, recordId: testRecordId,
                startBlockHeight: i + 2
              }, callback);
            }, callback)],
          get: ['update', (results, callback) => {
            ledgerNode.records.get(
              {recordId: testRecordId}, (err, result) => {
                assertNoError(err);
                should.exist(result);
                const eventHash = Object.keys(results.events)[0];
                const testRecord = bedrock.util.clone(results.events[eventHash]
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
                callback();
              });
          }]
        }, done);
      });
      it('returns proper record with the maxBlockHeight option', done => {
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
        async.auto({
          // the helper creates events without consensus by default
          // block 1
          events: callback => helpers.addEvent({
            consensus: true, eventTemplate, ledgerStorage, opTemplate,
            recordId: testRecordId
          }, callback),
          // blocks 2 and 3
          update: ['events', (results, callback) => async.eachOfSeries(
            opUpdates, (updateOpTemplate, i, callback) => {
              updateOpTemplate.recordPatch.sequence = i;
              helpers.addEvent({
                consensus: true, eventTemplate, ledgerStorage,
                opTemplate: updateOpTemplate, recordId: testRecordId,
                startBlockHeight: i + 2
              }, callback);
            }, callback)],
          get: ['update', (results, callback) => {
            ledgerNode.records.get(
              {maxBlockHeight: 2, recordId: testRecordId}, (err, result) => {
                assertNoError(err);
                should.exist(result);
                const eventHash = Object.keys(results.events)[0];
                const testRecord = bedrock.util.clone(results.events[eventHash]
                  .operations[0].operation.record);
                // corresponds to mockData.operations.gamma;
                testRecord.endDate = '2017-07-14T23:30';
                const {meta, record} = result;
                should.exist(record);
                record.should.eql(testRecord);
                should.exist(meta);
                should.exist(meta.sequence);
                meta.sequence.should.equal(1);
                callback();
              });
          }]
        }, done);
      });
    });
  });
});
