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

describe('getLedgerEvent API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    const events = [];
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it('create ledger, make writes and inspect events', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        signConfig: callback => jsigs.sign(mockLedger.config, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: mockData.authorizedSignerUrl
        }, callback),
        create: ['signConfig', (results, callback) => brLedger.createLedger(
          actor, results.signConfig, {
            baseUri: baseUri
          }, (err, result) => {
            events.push(result);
            callback();
          })
        ],
        signWrite: ['create', (results, callback) =>
          jsigs.sign(mockLedger.events[0], {
            algorithm: 'LinkedDataSignature2015',
            privateKeyPem: mockData.groups.authorized.privateKey,
            creator: mockData.authorizedSignerUrl
          }, callback)
        ],
        write: ['signWrite', (results, callback) => brLedger.writeLedgerEvent(
          actor, mockLedger.config.ledgerConfig.name, results.signWrite, {
            baseUri: baseUri
          }, (err, result) => {
            events.push(result);
            callback();
          })
        ],
        signWrite2: ['write', (results, callback) =>
          jsigs.sign(mockLedger.events[1], {
            algorithm: 'LinkedDataSignature2015',
            privateKeyPem: mockData.groups.authorized.privateKey,
            creator: mockData.authorizedSignerUrl
          }, callback)
        ],
        write2: ['signWrite2', (results, callback) => brLedger.writeLedgerEvent(
          actor, mockLedger.config.ledgerConfig.name, results.signWrite2, {
            baseUri: baseUri
          }, (err, result) => {
            events.push(result);
            callback();
          })
        ],
        getEvent1: ['write2', (results, callback) => {
          const eventId = events[1].substring(events[1].indexOf('did:'));
          brLedger.getLedgerEvent(
            actor, mockLedger.config.ledgerConfig.name, eventId, {},
            (err, result) => {
              expect(err).not.to.be.ok;
              expect(result).to.be.ok;
              result.should.be.an('object');
              should.exist(result.id);
              result.id.should.equal(eventId);
              should.exist(result.type);
              result.type.should.equal(mockLedger.events[0].type);
              should.exist(result.replacesObject);
              result.replacesObject.should.be.an('array');
              result.replacesObject.should.have.length(1);
              result.replacesObject[0].should.be.an('object');
              const obj = result.replacesObject[0];
              obj.should.deep.equal(mockLedger.events[0].replacesObject[0]);
              should.exist(result.previousEvent);
              result.previousEvent.should.be.an('object');
              const pe = result.previousEvent;
              should.exist(pe.id);
              const eventNumber = helpers.getEventNumber(eventId);
              pe.id.should.equal(mockLedger.config.ledgerConfig.id +
                '/events/' + (eventNumber - 1));
              // FIXME: hash is broken in current implementation
              should.exist(pe.hash);
              should.exist(result.signature);
              result.signature.should.be.an('object');
              callback();
            });
        }],
        getEvent2: ['getEvent1', (results, callback) => {
          const eventId = events[2].substring(events[2].indexOf('did:'));
          brLedger.getLedgerEvent(
            actor, mockLedger.config.ledgerConfig.name, eventId, {},
            (err, result) => {
              expect(err).not.to.be.ok;
              expect(result).to.be.ok;
              result.should.be.an('object');
              should.exist(result.id);
              result.id.should.equal(eventId);
              should.exist(result.type);
              result.type.should.equal(mockLedger.events[0].type);
              should.exist(result.replacesObject);
              result.replacesObject.should.be.an('array');
              result.replacesObject.should.have.length(1);
              result.replacesObject[0].should.be.an('object');
              const obj = result.replacesObject[0];
              obj.should.deep.equal(mockLedger.events[1].replacesObject[0]);
              should.exist(result.previousEvent);
              result.previousEvent.should.be.an('object');
              const pe = result.previousEvent;
              should.exist(pe.id);
              const eventNumber = helpers.getEventNumber(eventId);
              pe.id.should.equal(mockLedger.config.ledgerConfig.id +
                '/events/' + (eventNumber - 1));
              // FIXME: hash is broken in current implementation
              should.exist(pe.hash);
              should.exist(result.signature);
              result.signature.should.be.an('object');
              callback();
            });
        }]
      }, done);
    });
  });
});
