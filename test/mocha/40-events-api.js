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
const jsonld = bedrock.jsonld;
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

jsigs.use('jsonld', jsonld);

const baseUri = 'http://example.com';

let signedConfigEvent;

describe('Events API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback),
      callback => jsigs.sign(mockData.events.config, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      }, (err, result) => {
        signedConfigEvent = result;
        callback(err);
      })
    ], done);
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
          brLedger.add(actor, signedConfigEvent, (err, result) => {
            ledgerNode = result;
            callback(err);
          });
        }]
      }, done);
    });
    it('should create event', done => {
      const testEvent = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'WebLedgerEvent',
        operation: 'Create',
        input: [{
          '@context': 'https://schema.org/',
          value: uuid()
        }]
      };
      async.auto({
        signEvent: callback => jsigs.sign(testEvent, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
        }, callback),
        add: ['signEvent', (results, callback) => {
          ledgerNode.events.add(results.signEvent, (err, result) => {
            should.not.exist(err);
            should.exist(result);
            result.event.should.deep.equal(results.signEvent);
            result.meta.eventHash.should.be.a('string');
            callback();
          });
        }]
      }, done);
    });
    it('should get event', done => {
      const testEvent = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'WebLedgerEvent',
        operation: 'Create',
        input: [{
          '@context': 'https://schema.org/',
          value: uuid()
        }]
      };
      async.auto({
        signEvent: callback => jsigs.sign(testEvent, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
        }, callback),
        addEvent: ['signEvent', (results, callback) =>
          ledgerNode.events.add(results.signEvent, callback)],
        getEvent: ['addEvent', (results, callback) => {
          const eventHash = results.addEvent.meta.eventHash;
          ledgerNode.events.get(eventHash, (err, result) => {
            should.not.exist(err);
            should.exist(result);
            should.exist(result.event);
            result.event.should.deep.equal(results.signEvent);
            should.exist(result.meta);
            result.meta.eventHash.should.equal(results.addEvent.meta.eventHash);
            callback();
          });
        }]
      }, done);
    });
  });
});
