/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const constants = require('bedrock').config.constants;
const helpers = require('./helpers');

const mock = {};
module.exports = mock;

const accounts = mock.accounts = {};
let userName;

// has permission to access its own resources
userName = 'regularUser';
accounts[userName] = {};
accounts[userName].account = helpers.createAccount(
  userName, 'urn:uuid:28b26664-8f0f-4727-b771-864e1a241f48');
accounts[userName].meta = {
  sysResourceRole: [{
    sysRole: 'bedrock-ledger.test',
    generateResource: 'id'
  }]};

// has admin permissions
userName = 'adminUser';
accounts[userName] = {};
accounts[userName].account = helpers.createAccount(
  userName, 'urn:uuid:cbcee289-2484-48bd-a54e-55f50cfc9dfc');
accounts[userName].meta = {
  sysResourceRole: [{
    sysRole: 'bedrock-ledger.test'
  }]};

const ledgerConfiguration = mock.ledgerConfiguration = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:uuid:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  consensusMethod: 'UnilateralConsensus2017',
  /*
   * FIXME uncomment and update when Signature Validators are updated
  ledgerConfigurationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['WebLedgerConfiguration']
    }],
    approvedSigner: [
      'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144'
      // 'https://good.example/i/alpha'
    ],
    minimumSignaturesRequired: 1
  }],
  operationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['CreateWebLedgerRecord']
    }],
    approvedSigner: [
      'did:v1:uuid:53ebca61-5687-4558-b90a-03167e4c2838#keys-144'
      // 'https://good.example/i/alpha'
    ],
    minimumSignaturesRequired: 1
  }],
  */
  sequence: 0,
};

const operations = mock.operations = {};

// using verbose signature for performance tests
operations.alpha = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'CreateWebLedgerRecord',
  record: {
    '@context': constants.TEST_CONTEXT_V1_URL,
    id: `https://good.example/events/a05bebf8-c966-427f-92f2-ff9060f4bd23`,
    type: 'Concert',
    name: 'Primary Event',
    startDate: '2017-07-14T21:30',
    location: 'https://example.org/the-venue-new-york',
    offers: {
      type: 'Offer',
      price: '13.00',
      priceCurrency: 'USD',
      url: `https://example.org/purchase/a05bebf8-c966-427f-92f2-ff9060f4bd23`,
    }
  }
};
operations.beta = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'CreateWebLedgerRecord',
  record: {
    '@context': 'https://schema.org/',
    id: 'https://good.example/events/1234567',
    type: 'Concert',
    name: 'Big Band Concert in New York City',
    startDate: '2017-07-14T21:30',
    location: 'https://example.org/the-venue',
    offers: {
      type: 'Offer',
      price: '13.00',
      priceCurrency: 'USD',
      url: 'https://www.ticketfly.com/purchase/309433'
    }
  }
};
operations.gamma = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'UpdateWebLedgerRecord',
  recordPatch: {
    target: `https://good.example/events/a05bebf8-c966-427f-92f2-ff9060f4bd23`,
    sequence: 0,
    patch: [{
      op: 'add', path: '/endDate', value: '2017-07-14T23:30'
    }]
  }
};
operations.delta = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'UpdateWebLedgerRecord',
  recordPatch: {
    target: `https://good.example/events/a05bebf8-c966-427f-92f2-ff9060f4bd23`,
    sequence: 0,
    patch: [{
      op: 'replace', path: '/name',
      value: 'Less Big Band Concert in New York City'
    }]
  }
};

const events = mock.events = {};

events.alpha = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerOperationEvent',
};

events.config = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfigurationEvent',
  ledgerConfiguration
};

const eventBlocks = mock.eventBlocks = {};
eventBlocks.alpha = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  id: '',
  type: 'WebLedgerEventBlock',
  blockHeight: 1,
  event: [],
  previousBlock: '',
  previousBlockHash: ''
};

const blocks = mock.blocks = {};
blocks.config = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  id: 'did:v1:uuid:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59/blocks/',
  type: 'WebLedgerEventBlock',
  event: [events.config]
};

blocks.event = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerOperationEvent',
  operation: [{
    type: 'CreateWebLedgerRecord',
    record: {
      id: 'https://good.example/events/123456',
      description: 'Example event'
    }
  }]
};

// constants
mock.authorizedSignerUrl = 'https://good.example/keys/authorized-key-1';

// all mock keys
mock.keys = {
  authorized: {
    id: mock.authorizedSignerUrl,
    type: 'Ed25519VerificationKey2020',
    controller: 'https://good.example/i/alpha',
    publicKeyMultibase: 'z6MkpNdMFtT36D2qZLDN7MF3Fw7bbyA5xjqCekrB1qAnbzp1',
    privateKeyMultibase: 'zrv3xnTZB6cPZyuE61YxwYbC4yacW864MtbdgeLJS7rwg3Uc' +
      '7bsJ2swmYhYBfkNyrNQY5vsygRmnt2hvaf1LnBbXDbw'
  },
  unauthorized: {
    id: 'https://bad.example/keys/unauthorized-key-evil',
    type: 'Ed25519VerificationKey2020',
    controller: 'https://bad.example/i/omega',
    publicKeyMultibase: 'z6Mkew1q8W3F8i3sgj1asCHZagjsNF5Y9ZRYHtCFJmvjq1o3',
    privateKeyMultibase: 'zrv1cGnBy3PWkxii4xPSbmpR3bei1eZWTZ9qnBWW4NQE2YCS' +
      'ZFc3ov2zTE23fpvaUhmqJjcXYvVqMdRja6kFKEsmHBB'
  }
};
