/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brIdentity = require('bedrock-identity');
const helpers = require('./helpers');
const mockData = require('./mock.data');

describe.skip('Metadata API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it.skip('should get ledger metadata', done => {
      // TODO: use `actor`
      done();
    });
  });
  describe('admin as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it.skip('should get ledger metadata for any ledger', done => {
      // TODO: use `actor`
      done();
    });
  });
});
