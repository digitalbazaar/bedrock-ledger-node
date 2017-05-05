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

// FIXME: API need to be fixed
describe.skip('getAllLedgerMetaData API', () => {
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
    it('creates a ledger and gets metadata', done => {
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
        getMeta: ['create', (results, callback) => brLedger.getAllLedgerMetadata(
          actor, {}, (err, result) => {
            console.log('TTTTTTT', err, result);
            // expect(err).not.to.be.ok;
            // expect(result).to.be.ok;
            // result.should.be.an('object');
            // should.exist(result.id);
            // result.id.should.equal(baseUri + '/'
            //   + mockLedger.config.ledgerConfig.name);
            // should.exist(result.name);
            // result.name.should.equal(mockLedger.config.ledgerConfig.name);
            // should.exist(result.ledgerConfig);
            // result.ledgerConfig.should.be.an('object');
            // const lc = result.ledgerConfig;
            // should.exist(lc.id);
            // should.exist(lc.type);
            // lc.type.should.equal('LedgerConfiguration');
            // should.exist(lc.name);
            // lc.name.should.equal(mockLedger.config.ledgerConfig.name);
            // should.exist(lc.description);
            // lc.description.should.equal(
            //   mockLedger.config.ledgerConfig.description);
            // should.exist(lc.storageMechanism);
            // lc.storageMechanism.should.equal(
            //   mockLedger.config.ledgerConfig.storageMechanism);
            // should.exist(lc.consensusAlgorithm);
            // lc.consensusAlgorithm.should.be.an('object');
            // const ca = lc.consensusAlgorithm;
            // should.exist(ca.type);
            // ca.type.should.equal(
            //   mockLedger.config.ledgerConfig.consensusAlgorithm.type);
            // should.exist(ca.approvedSigner);
            // ca.approvedSigner.should.be.an('array');
            // ca.approvedSigner.should.have.length(1);
            // ca.approvedSigner.should.have.same.members(
            //   mockLedger.config.ledgerConfig.consensusAlgorithm.approvedSigner);
            // should.exist(ca.minimumSignaturesRequired);
            // ca.minimumSignaturesRequired.should.equal(
            //   mockLedger.config.ledgerConfig.consensusAlgorithm
            //   .minimumSignaturesRequired);
            // should.exist(result.latestEvent);
            // result.latestEvent.should.be.an('object');
            // const le = result.latestEvent;
            // should.exist(le.id);
            // le.id.should.equal(mockLedger.config.id);
            // const eventId = Number(le.id.substring(le.id.lastIndexOf('/') + 1));
            // should.exist(le.hash);
            // le.hash.startsWith('urn:sha256:').should.be.true;
            // should.exist(result.nextEvent);
            // result.nextEvent.should.be.an('object');
            // const ne = result.nextEvent;
            // should.exist(ne.id);
            // ne.id.should.equal(lc.id + '/events/' + (eventId + 1));
            callback();
          })
        ]
      }, done);
    });
  });
}); // end createLedger
