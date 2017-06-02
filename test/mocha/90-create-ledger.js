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

describe.skip('OLD DISABLED createLedger API', () => {
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
    it('creates a ledger', done => {
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
            expect(err).to.not.be.ok;
            expect(result).to.be.ok;
            result.should.equal(baseUri + '/'
              + mockLedger.config.ledgerConfig.name);
            callback();
          })
        ]
      }, done);
    });
    it('PermissionDenied if signing key cannot be dereferenced', done => {
      const mockLedger = bedrock.util.clone(mockData.ledgers.alpha);
      const badKeyId = 'http://example.com/keys/unknown-key';
      mockLedger.config.ledgerConfig.consensusAlgorithm.approvedSigner = [
        badKeyId
      ];
      async.auto({
        signConfig: callback => jsigs.sign(mockLedger.config, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: badKeyId
        }, callback),
        create: ['signConfig', (results, callback) => brLedger.createLedger(
          actor, results.signConfig, {
            baseUri: baseUri
          }, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })
        ]
      }, done);
    });
    it('PermissionDenied if config not signed by an approvedSigner', done => {
      const mockLedger = bedrock.util.clone(mockData.ledgers.alpha);
      mockLedger.config.ledgerConfig.consensusAlgorithm.approvedSigner = [
        'http://example.com/keys/unknown-key'
      ];
      async.auto({
        signConfig: callback => jsigs.sign(mockLedger.config, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.authorized.privateKey,
          creator: mockData.authorizedSignerUrl
        }, callback),
        create: ['signConfig', (results, callback) => brLedger.createLedger(
          actor, results.signConfig, {
            baseUri: baseUri
          }, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })
        ]
      }, done);
    });
    // the keypair used to sign this request does not match the published
    // public key information
    it('returns PermissionDenied if signing key cannot be verified', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        signConfig: callback => jsigs.sign(mockLedger.config, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: mockData.groups.unauthorized.privateKey,
          creator: mockData.authorizedSignerUrl
        }, callback),
        create: ['signConfig', (results, callback) => brLedger.createLedger(
          actor, results.signConfig, {
            baseUri: baseUri
          }, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })
        ]
      }, done);
    });
    it('returns PermissionDenied if the config is not signed', done => {
      const mockLedger = mockData.ledgers.alpha;
      async.auto({
        create: callback => brLedger.createLedger(
          actor, mockLedger.config, {
            baseUri: baseUri
          }, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })
      }, done);
    });
    it('returns DuplicateLedger on attempt to add duplicate', done => {
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
            expect(err).to.not.be.ok;
            expect(result).to.be.ok;
            result.should.equal(baseUri + '/'
              + mockLedger.config.ledgerConfig.name);
            callback();
          })
        ],
        createDup: ['create', (results, callback) => brLedger.createLedger(
          actor, results.signConfig, {
            baseUri: baseUri
          }, err => {
            expect(err).to.be.ok;
            err.name.should.equal('DuplicateLedger');
            callback();
          })
        ]
      }, done);
    });
  });
}); // end createLedger
