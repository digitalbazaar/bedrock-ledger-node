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

describe('writeLedgerEvent API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    const mockIdentity = mockData.identities.regularUser;
    const mockLedger = mockData.ledgers.alpha;
    let actor;
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    // create ledger
    beforeEach(done => async.auto({
      signConfig: callback => jsigs.sign(mockLedger.config, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: mockData.authorizedSignerUrl
      }, callback),
      create: ['signConfig', (results, callback) => brLedger.createLedger(
        actor, results.signConfig, {
          baseUri: baseUri
        }, callback)
      ]
    }, done));
    it('writes an event', done => {
      async.auto({
        signWrite: callback => jsigs.sign(mockLedger.events[0], {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: mockData.authorizedSignerUrl
        }, callback),
        write: ['signWrite', (results, callback) => {
          brLedger.writeLedgerEvent(
            actor, mockLedger.config.ledgerConfig.name, results.signWrite, {
              baseUri: baseUri
            }, (err, result) => {
              expect(err).not.to.be.ok;
              expect(result).to.be.ok;
              result.should.include(baseUri);
              callback();
            });
        }]
      }, done);
    });
    it('returns PermissionDenied if the write is not signed', done => {
      brLedger.writeLedgerEvent(
        actor, mockLedger.config.ledgerConfig.name, mockLedger.events[0], {
          baseUri: baseUri
        }, err => {
          expect(err).to.be.ok;
          err.name.should.equal('PermissionDenied');
          done();
        });
    });
    it('returns PermissionDenied if signing key cannot be verified', done => {
      async.auto({
        signWrite: callback => jsigs.sign(mockLedger.events[0], {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.unauthorized.privateKey,
          creator: mockData.authorizedSignerUrl
        }, callback),
        write: ['signWrite', (results, callback) => {
          brLedger.writeLedgerEvent(
            actor, mockLedger.config.ledgerConfig.name, results.signWrite, {
              baseUri: baseUri
            }, err => {
              expect(err).to.be.ok;
              err.name.should.equal('PermissionDenied');
              callback();
            });
        }]
      }, done);
    });
    it('PermissionDenied if write not signed by an approvedSigner', done => {
      const badKeyId = 'http://example.com/keys/unknown-key';
      async.auto({
        signWrite: callback => jsigs.sign(mockLedger.events[0], {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: badKeyId
        }, callback),
        write: ['signWrite', (results, callback) => {
          brLedger.writeLedgerEvent(
            actor, mockLedger.config.ledgerConfig.name, results.signWrite, {
              baseUri: baseUri
            }, err => {
              expect(err).to.be.ok;
              err.name.should.equal('PermissionDenied');
              callback();
            });
        }]
      }, done);
    });
    it('returns error on attempt to write the same event twice', done => {
      async.auto({
        signWrite: callback => jsigs.sign(mockLedger.events[0], {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: mockData.authorizedSignerUrl
        }, callback),
        write: ['signWrite', (results, callback) => {
          brLedger.writeLedgerEvent(
            actor, mockLedger.config.ledgerConfig.name, results.signWrite, {
              baseUri: baseUri
            }, callback);
        }],
        writeDup: ['write', (results, callback) => {
          brLedger.writeLedgerEvent(
            actor, mockLedger.config.ledgerConfig.name, results.signWrite, {
              baseUri: baseUri
            }, err => {
              expect(err).to.be.ok;
              err.name.should.equal('PreviousEventInformationInvalid');
              callback();
            });
        }]
      }, done);
    });
  });
});
