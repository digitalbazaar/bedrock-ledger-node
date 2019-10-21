/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brLedgerNode = require('bedrock-ledger-node');
const async = require('async');
const helpers = require('./helpers');
const mockData = require('./mock.data');

// NOTE: these tests are designed to be run in sequence, not not use .only
// TODO: remove these tests, these are largely duplicated in
// bedrock-ledger-storage mongodb
describe.skip('Performance tests', () => {
  const blockNum = 1000;
  const eventNum = 10;
  const opNum = 2500;
  const opNumLow = 250;
  const passNum = 10;
  let ledgerNode;
  let storage;
  before(done => async.auto({
    prepare: callback => helpers.prepareDatabase(mockData, callback),
    sign: callback => helpers.signDocument({
      doc: mockData.ledgerConfiguration,
      privateKeyPem: mockData.groups.authorized.privateKey,
      creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
    }, callback),
    addLedger: ['prepare', 'sign', (results, callback) => brLedgerNode.add(
      null, {ledgerConfiguration: results.sign}, (err, result) => {
        ledgerNode = result;
        storage = ledgerNode.storage;
        callback(err, result);
      })]
  }, done));
  describe('Prepare', () => {

    let blocksAndEvents;
    it(`generating ${blockNum} blocks`, function(done) {
      this.timeout(120000);
      helpers.createBlocks({
        blockNum,
        blockTemplate: mockData.eventBlocks.alpha,
        eventNum,
        eventTemplate: mockData.events.alpha
      }, (err, result) => {
        assertNoError(err);
        blocksAndEvents = result;
        done();
      });
    });
    it(`events.add events`, function(done) {
      this.timeout(120000);
      console.log(`Adding ${blocksAndEvents.events.length} events.`);
      async.eachLimit(
        blocksAndEvents.events, 100, ({event, meta}, callback) => {
          storage.events.add({event, meta}, err => {
            assertNoError(err);
            callback();
          });
        }, err => {
          assertNoError(err);
          done();
        });
    });
    it(`blocks.add ${blockNum} blocks`, function(done) {
      this.timeout(120000);
      async.eachLimit(
        blocksAndEvents.blocks, 100, ({block, meta}, callback) => {
          storage.blocks.add({block, meta}, err => {
            assertNoError(err);
            callback();
          });
        }, done);
    });
  });
  describe('get API', () => {
    it(`does get ${opNum} times`, function(done) {
      this.timeout(120000);
      runPasses({
        func: brLedgerNode.get,
        id: ledgerNode.id,
        passNum,
        opNum,
      }, done);
    });
  });
});

function runPasses({
  func, passNum, id, opNum, concurrency = 100
}, callback) {
  const passes = [];
  async.timesSeries(passNum, (i, callback) => {
    const start = Date.now();
    const actor = null;
    async.timesLimit(
      opNum, concurrency,
      (i, callback) => func.call(null, actor, id, callback), err => {
        const stop = Date.now();
        assertNoError(err);
        passes.push(Math.round(opNum / (stop - start) * 1000));
        callback();
      });
  }, err => {
    assertNoError(err);
    console.log('ops/sec passes', passes);
    console.log('average ops/sec', helpers.average(passes));
    callback();
  });
}
