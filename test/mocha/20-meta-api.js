/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brIdentity = require('bedrock-identity');
const helpers = require('./helpers');
const mockData = require('./mock.data');

describe.skip('Metadata API', () => {
  before(async function() {
    await helpers.prepareDatabase(mockData);
  });
  beforeEach(async function() {
    await helpers.removeCollections(['ledger', 'ledgerNode']);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    before(async function() {
      actor = await brIdentity.get(null, mockIdentity.identity.id);
    });
    it.skip('should get ledger metadata', async () => {
      // TODO: use `actor`
    });
  });
  describe('admin as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    before(async function() {
      actor = await brIdentity.get(null, mockIdentity.identity.id);
    });
    it.skip('should get ledger metadata for any ledger', async () => {
      // TODO: use `actor`
    });
  });
});
