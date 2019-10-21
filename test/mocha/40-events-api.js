/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const {_hasher: hasher} = brLedgerNode.consensus;
const helpers = require('./helpers');
const mockData = require('./mock.data');
const {util: {uuid}} = bedrock;

let signedConfig;

describe('Events API', () => {
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
    let actor;
    let ledgerNode;
    before(done => {
      async.auto({
        getActor: callback => {
          const {id} = mockData.identities.regularUser.identity;
          brIdentity.getCapabilities({id}, (err, result) => {
            actor = result;
            assertNoError(err);
            callback();
          });
        },
        addLedger: ['getActor', (results, callback) => brLedgerNode.add(
          actor, {ledgerConfiguration: signedConfig}, (err, result) => {
            ledgerNode = result;
            callback(err);
          })]
      }, done);
    });
    it('should create an event', done => {
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
      async.auto({
        sign: callback => helpers.signDocument({
          doc: testOperation,
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
        }, callback),
        operationHash: ['sign', (results, callback) =>
          hasher(results.sign, callback)],
        add: ['sign', (results, callback) => ledgerNode.operations.add(
          {operation: results.sign}, err => {
            assertNoError(err);
            callback();
          })],
        // unilateral consensus allows immediate retrieval of an event with
        // a single operation in it from the latest block
        event: ['add', (results, callback) => ledgerNode.blocks.getLatest(
          (err, result) => {
            assertNoError(err);
            should.exist(result);
            should.exist(result.eventBlock);
            should.exist(result.eventBlock.block);
            should.exist(result.eventBlock.block.event);
            const event = result.eventBlock.block.event[0];
            should.exist(event);
            should.exist(event.operation);
            should.exist(event.operation[0]);
            event.operation[0].should.deep.equal(results.sign);
            callback(null, event);
          })],
        // hash event (only works because of knowledge of how unilateral
        // consensus works)
        eventHash: ['event', 'operationHash', (results, callback) => {
          const {event, operationHash} = results;
          event.operationHash = [operationHash];
          delete event.operation;
          hasher(event, callback);
        }],
        getEvent: ['eventHash', (results, callback) => {
          const {eventHash} = results;
          ledgerNode.events.get(eventHash, (err, result) => {
            assertNoError(err);
            should.exist(result);
            should.exist(result.event);
            should.exist(result.event.operation);
            should.exist(result.event.operation[0]);
            result.event.operation[0].should.deep.equal(results.sign);
            should.exist(result.meta);
            result.meta.eventHash.should.equal(eventHash);
            callback();
          });
        }]
      }, done);
    });
  });
});
