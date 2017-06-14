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

describe('Ledger API', () => {
  describe('create API', () => {
    before(done => {
      helpers.prepareDatabase(mockData, done);
    });
    beforeEach(done => {
      helpers.removeCollection('ledgerNode', done);
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
      it.only('should create a ledger with no owner', done => {
        const configBlock = mockData.configBlocks.alpha;
        async.auto({
          create: callback => brLedger.create(
            actor, configBlock, (err, ledgerNode) => {
              expect(err).not.to.be.ok;
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          test: ['create', (results, callback) => {
            database.collections.ledgerNode.findOne({
              id: database.hash(results.create.id)
            }, (err, result) => {
              expect(err).not.to.be.ok;
              result.id.should.equal(database.hash(results.create.id));
              result.ledger.should.equal(database.hash(configBlock.ledger));
              result.storage.should.equal(database.hash('mongodb'));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configBlock.ledger);
              ledgerNode.storage.should.equal('mongodb');
              // there should be no owner
              expect(ledgerNode.owner).not.to.exist;
              callback();
            });
          }]
        }, done);
      });
      it.only('returns DuplicateError on same ledger and storage', done => {
        const configBlock = mockData.configBlocks.alpha;
        async.auto({
          create: callback => brLedger.create(
            actor, configBlock, (err, ledgerNode) => {
              expect(err).not.to.be.ok;
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          createDuplicate: ['create', (results, callback) => brLedger.create(
            actor, configBlock, (err, ledgerNode) => {
              expect(err).to.be.ok;
              expect(ledgerNode).not.to.be.ok;
              err.name.should.equal('DuplicateError');
              callback();
            })]
        }, done);
      });
      it.only('should create a ledger with an owner', done => {
        const configBlock = mockData.configBlocks.alpha;
        async.auto({
          create: callback => brLedger.create(
            actor, configBlock, {owner: actor.id}, (err, ledgerNode) => {
              expect(err).not.to.be.ok;
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          test: ['create', (results, callback) => {
            database.collections.ledgerNode.findOne({
              id: database.hash(results.create.id)
            }, (err, result) => {
              expect(err).not.to.be.ok;
              result.id.should.equal(database.hash(results.create.id));
              result.ledger.should.equal(database.hash(configBlock.ledger));
              result.storage.should.equal(database.hash('mongodb'));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configBlock.ledger);
              ledgerNode.owner.should.equal(actor.id);
              ledgerNode.storage.should.equal('mongodb');
              callback();
            });
          }]
        }, done);
      });
      it.only('returns PermissionDenied if actor is not owner', done => {
        const configBlock = mockData.configBlocks.alpha;
        brLedger.create(
          actor, configBlock, {owner: uuid()}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('PermissionDenied');
            done();
          });
      });
    }); // end create API

    it.skip('should get their ledger', done => {
      done();
    });
    it.skip('should iterate over their ledgers', done => {
      done();
    });
    it.skip('should delete their ledger', done => {
      done();
    });
    it.skip('should not get non-owned ledger', done => {
      done();
    });
    it.skip('should not delete non-owned ledger', done => {
      done();
    });
    it.skip('should not iterate over non-owned ledgers', done => {
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
    it.skip('should create a ledger for any actor', done => {
      done();
    });
    it.skip('should get any ledger', done => {
      done();
    });
    it.skip('should iterate over all ledgers', done => {
      done();
    });
    it.skip('should delete any ledger', done => {
      done();
    });
  });
});
