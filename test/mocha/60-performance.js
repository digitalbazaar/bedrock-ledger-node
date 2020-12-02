/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brLedgerNode = require('bedrock-ledger-node');
const helpers = require('./helpers');
const mockData = require('./mock.data');

// NOTE: these tests are designed to be run in sequence, not not use .only
// TODO: remove these tests, these are largely duplicated in
// bedrock-ledger-storage mongodb
describe.skip('Performance tests', () => {
  const blockNum = 1000;
  const eventNum = 10;
  const opNum = 2500;
  const passNum = 10;
  let ledgerNode;
  let storage;
  before(async function() {
    await helpers.prepareDatabase(mockData);
    const ledgerConfiguration = await helpers.signDocument({
      doc: mockData.ledgerConfiguration,
      creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
      privateKeyPem: mockData.groups.authorized.privateKey,
    });
    ledgerNode = await brLedgerNode.add(null, {ledgerConfiguration});
    storage = ledgerNode.storage;
  });
  describe('Prepare', () => {
    let blocksAndEvents;
    it(`generating ${blockNum} blocks`, async function() {
      this.timeout(120000);
      blocksAndEvents = await helpers.createBlocks({
        blockNum,
        blockTemplate: mockData.eventBlocks.alpha,
        eventNum,
        eventTemplate: mockData.events.alpha
      });
    });
    it(`events.add events`, async function() {
      this.timeout(120000);
      console.log(`Adding ${blocksAndEvents.events.length} events.`);
      await Promise.all(blocksAndEvents.events.map(
        ({event, meta}) => storage.events.add({event, meta})));
    });
    it(`blocks.add ${blockNum} blocks`, async function() {
      this.timeout(120000);
      await Promise.all(blocksAndEvents.blocks.map(
        ({block, meta}) => storage.blocks.add({block, meta})));
    });
  });
  describe('get API', () => {
    it(`does get ${opNum} times`, async function() {
      this.timeout(120000);
      await runPasses({
        func: brLedgerNode.get,
        id: ledgerNode.id,
        passNum,
        opNum,
      });
    });
  });
});

async function runPasses({func, passNum, id, opNum, concurrency = 100}) {
  const actor = null;
  const passes = [];
  for(let i = 0; i < passNum; ++i) {
    const start = Date.now();
    let remainingOps = opNum;
    while(remainingOps > 0) {
      const promises = [];
      let count = remainingOps - concurrency;
      if(count < 0) {
        count = remainingOps;
      }
      remainingOps -= count;
      for(let j = 0; j < count; ++j) {
        promises.push(func.call(null, actor, id));
      }
      await promises;
    }
    const stop = Date.now();
    passes.push(Math.round(opNum / (stop - start) * 1000));
  }
  console.log('ops/sec passes', passes);
  console.log('average ops/sec', helpers.average(passes));
}
