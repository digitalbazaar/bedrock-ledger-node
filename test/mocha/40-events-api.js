/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedger = require('bedrock-ledger');
const database = require('bedrock-mongodb');
const expect = global.chai.expect;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

const baseUri = 'http://example.com';

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

describe.only('Events API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollections('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    let ledgerNode;
    before(done => {
      async.auto({
        getActor: callback =>
          brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
            actor = result;
            callback(err);
          }),
        addLedger: ['getActor', (results, callback) => {
          const configBlock = mockData.configBlocks.alpha;
          brLedger.add(actor, configBlock, (err, result) => {
            ledgerNode = result;
            callback(err);
          });
        }]
      }, done);
    });
    it('should create event', done => ledgerNode.events.add(
      {event: 'event'}, (err, result) => {
        expect(err).not.to.be.ok;
        console.log('RRRRRRR', JSON.stringify(result, null, 2));
        done();
      }));
    it.skip('should get event', done => {
      done();
    });
  });
});
