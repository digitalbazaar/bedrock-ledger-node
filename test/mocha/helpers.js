/*
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const crypto = require('crypto');
const database = require('bedrock-mongodb');
const jsigs = require('jsonld-signatures');
const {promisify} = require('util');
const {Ed25519Signature2020} = require('@digitalbazaar/ed25519-signature-2020');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const {CapabilityInvocation} = require('@digitalbazaar/zcapld');

const {util: {uuid}, config: {constants}} = bedrock;
const api = {};
module.exports = api;

// test hashing function
api.testHasher = brLedgerNode.consensus._hasher;

api.addEvent = async ({
  consensus = false, count = 1, eventTemplate, ledgerStorage, opTemplate,
  recordId, startBlockHeight = 1, blockOrder = 0
}) => {
  const events = {};
  let operations;
  for(let i = 0; i < count; ++i) {
    const testEvent = bedrock.util.clone(eventTemplate);
    const operation = bedrock.util.clone(opTemplate);
    const testRecordId = recordId || `https://example.com/event/${uuid()}`;
    if(operation.type === 'CreateWebLedgerRecord') {
      operation.record.id = testRecordId;
    }
    if(operation.type === 'UpdateWebLedgerRecord') {
      operation.recordPatch.target = testRecordId;
    }
    const operationHash = await api.testHasher(operation);
    // NOTE: nonce is added here to avoid duplicate errors
    testEvent.nonce = uuid();
    testEvent.operationHash = [operationHash];
    const eventHash = await api.testHasher(testEvent);

    operations = [{
      meta: {eventHash, eventOrder: 0, operationHash},
      operation,
      recordId: database.hash(testRecordId),
    }];
    await ledgerStorage.operations.addMany({operations});

    const meta = {eventHash};
    if(consensus) {
      const blockHeight = i + startBlockHeight;
      meta.blockHeight = blockHeight;
      meta.blockOrder = blockOrder;
      meta.consensus = true;
      meta.consensusDate = Date.now();
    }
    const result = await ledgerStorage.events.add({event: testEvent, meta});
    // NOTE: operations are added to events object in full here so they
    // may be inspected in tests. This does not represent the event
    // in the database
    result.operations = operations;
    events[result.meta.eventHash] = result;
  }
  return events;
};

api.createAccount = function(userName, userId) {
  userId = userId || 'urn:uuid:' + uuid();
  const newAccount = {
    id: userId,
    type: 'Account',
    email: userName + '@bedrock.dev',
  };
  return newAccount;
};

// collections may be a string or array
api.removeCollections = async function(collections) {
  const collectionNames = [].concat(collections);
  await promisify(database.openCollections)(collectionNames);
  for(const collectionName of collectionNames) {
    if(!database.collections[collectionName]) {
      continue;
    }
    await database.collections[collectionName].deleteMany({});
  }
};

api.prepareDatabase = async function(mockData) {
  await api.removeCollections(
    ['account', 'eventLog', 'ledger', 'ledgerNode']);
  await insertTestData(mockData);
};

api.getEventNumber = function(eventId) {
  return Number(eventId.substring(eventId.lastIndexOf('/') + 1));
};

api.average = arr => Math.round(arr.reduce((p, c) => p + c, 0) / arr.length);

api.createBlocks = async (
  {blockTemplate, eventTemplate, blockNum = 1, eventNum = 1}) => {
  const blocks = [];
  const events = [];
  const startTime = Date.now();
  for(let i = 0; i < blockNum; ++i) {
    const block = bedrock.util.clone(blockTemplate);
    block.id = uuid();
    block.blockHeight = i + 1;
    block.previousBlock = uuid();
    block.previousBlockHash = uuid();
    const time = startTime + i;
    const meta = {
      blockHash: uuid(),
      created: time,
      updated: time,
      consensus: true,
      consensusDate: time
    };
    const result = await api.createEvent({eventTemplate, eventNum});
    // must hash with the real events
    block.event = result.map(e => e.event);
    events.push(...result);

    const blockHash = await api.testHasher(block);
    meta.blockHash = blockHash;

    // block is stored with the eventHashes
    block.event = events.map(e => e.meta.eventHash);
    blocks.push({block, meta});
  }
  return {blocks, events};
};

api.createEvent = async ({eventTemplate, eventNum, consensus = true}) => {
  const events = [];
  for(let i = 0; i < eventNum; ++i) {
    const event = bedrock.util.clone(eventTemplate);
    event.id = `https://example.com/events/${uuid()}`;
    // events.push(event);
    const result = await api.testHasher(event);
    const meta = {eventHash: result};
    if(consensus) {
      meta.consensus = true;
      meta.consensusDate = Date.now();
    }
    events.push({event, meta});
  }
  return events;
};

api.hasher = async data =>
  crypto.createHash('sha256').update(JSON.stringify(data)).digest();

// Insert accounts and public keys used for testing into database
async function insertTestData(mockData) {
  for(const key in mockData.accounts) {
    const {account, meta} = mockData.accounts[key];
    try {
      await brAccount.insert({actor: null, account, meta});
    } catch(e) {
      // duplicate error means test data is already loaded
      if(!database.isDuplicateError(e)) {
        throw e;
      }
    }
  }
}

api.signDocument = async ({doc, invocationTarget, key}) => {
  const contextArray = Array.isArray(doc['@context']);
  // if the context is an array add the ZCAP context if it's not there
  if(contextArray && !doc['@context'].includes(constants.ZCAP_CONTEXT_V1_URL)) {
    doc['@context'].push(constants.ZCAP_CONTEXT_V1_URL);
  }
  // if the context is not an array then make it one with the ZCAP context
  if(!contextArray) {
    doc['@context'] = [
      doc['@context'],
      constants.ZCAP_CONTEXT_V1_URL
    ];
  }
  return jsigs.sign(doc, {
    documentLoader,
    purpose: new CapabilityInvocation({
      capability: doc.id || doc.ledger || doc.record.id,
      invocationTarget: invocationTarget || doc.ledger || doc.record.id,
      capabilityAction: 'write'
    }),
    suite: new Ed25519Signature2020({key})
  });
};
