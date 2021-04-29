/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brAccount = require('bedrock-account');
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
    const mockAccount = mockData.accounts.regularUser;
    // eslint-disable-next-line no-unused-vars
    let actor;
    before(async function() {
      // eslint-disable-next-line no-unused-vars
      actor = await brAccount.get(null, mockAccount.account.id);
    });
    it.skip('should get ledger metadata', async () => {
      // TODO: use `actor`
    });
  });
  describe('admin as actor', () => {
    const mockAccount = mockData.accounts.regularUser;
    // eslint-disable-next-line no-unused-vars
    let actor;
    before(async function() {
      // eslint-disable-next-line no-unused-vars
      actor = await brAccount.get(null, mockAccount.account.id);
    });
    it.skip('should get ledger metadata for any ledger', async () => {
      // TODO: use `actor`
    });
  });
});
