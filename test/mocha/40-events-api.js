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
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

const baseUri = 'http://example.com';

describe('Events API', () => {
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
          const configEvent = mockData.events.config;
          brLedger.add(actor, configEvent, (err, result) => {
            ledgerNode = result;
            callback(err);
          });
        }]
      }, done);
    });
    it('should create event', done => {
      const testEvent = {
        '@context': 'https://w3id.org/webledger/v1',
        'schema:value': uuid()
      };
      ledgerNode.events.add(testEvent, (err, result) => {
        should.not.exist(err);
        should.exist(result);
        result.event.should.deep.equal(testEvent);
        result.meta.eventHash.should.be.a('string');
        done();
      });
    });
    it('should get event', done => {
      const testEvent = {
        '@context': 'https://w3id.org/webledger/v1',
        'schema:value': uuid()
      };
      async.auto({
        addEvent: callback => ledgerNode.events.add(testEvent, callback),
        getEvent: ['addEvent', (results, callback) => {
          const eventHash = results.addEvent.meta.eventHash;
          ledgerNode.events.get(eventHash, (err, result) => {
            should.not.exist(err);
            should.exist(result);
            should.exist(result.event);
            result.event.should.deep.equal(testEvent);
            should.exist(result.meta);
            result.meta.eventHash.should.equal(results.addEvent.meta.eventHash);
            callback();
          });
        }]
      }, done);
    });
  });
});
