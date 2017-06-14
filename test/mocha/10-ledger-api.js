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
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  describe.only('create API', () => {
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
      it('should create a ledger with no owner', done => {
        const configBlock = mockData.configBlocks.alpha;
        async.auto({
          create: callback => brLedger.add(
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
              ledgerNode.sysStatus.should.equal('active');
              // there should be no owner
              expect(ledgerNode.owner).not.to.exist;
              callback();
            });
          }]
        }, done);
      });
      it('returns DuplicateError on same ledger and storage', done => {
        const configBlock = mockData.configBlocks.alpha;
        async.auto({
          create: callback => brLedger.add(
            actor, configBlock, (err, ledgerNode) => {
              expect(err).not.to.be.ok;
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          createDuplicate: ['create', (results, callback) => brLedger.add(
            actor, configBlock, (err, ledgerNode) => {
              expect(err).to.be.ok;
              expect(ledgerNode).not.to.be.ok;
              err.name.should.equal('DuplicateError');
              callback();
            })]
        }, done);
      });
      it('should create a ledger with an owner', done => {
        const configBlock = mockData.configBlocks.alpha;
        async.auto({
          create: callback => brLedger.add(
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
              ledgerNode.sysStatus.should.equal('active');
              callback();
            });
          }]
        }, done);
      });
      it('returns PermissionDenied if actor is not owner', done => {
        const configBlock = mockData.configBlocks.alpha;
        brLedger.add(
          actor, configBlock, {owner: uuid()}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('PermissionDenied');
            done();
          });
      });
      it('returns error if invalid storage plugin is specified');
    }); // end regularUser as actor
  }); // end create API
  describe.only('get API', () => {
    beforeEach(done => {
      helpers.removeCollection('ledgerNode', done);
    });
    describe('regularUser as actor', () => {
      const mockIdentity = mockData.identities.regularUser;
      const configBlock = mockData.configBlocks.alpha;
      let actor;
      before(done => {
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('gets a ledger with no owner', done => async.auto({
        create: callback => brLedger.add(actor, configBlock, callback),
        get: ['create', (results, callback) =>
          brLedger.get(actor, configBlock.ledger, (err, result) => {
            expect(err).not.to.be.ok;
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })]
      }, done));
      it('gets a ledger with actor as owner', done => async.auto({
        create: callback => brLedger.add(
          actor, configBlock, {owner: actor.id}, callback),
        get: ['create', (results, callback) =>
          brLedger.get(actor, configBlock.ledger, (err, result) => {
            expect(err).not.to.be.ok;
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })]
      }, done));
      it('returns PermissionDenied if actor does not own the ledger', done =>
        async.auto({
          create: callback => brLedger.add(
            null, configBlock, {owner: uuid()}, callback),
          get: ['create', (results, callback) =>
            brLedger.get(actor, configBlock.ledger, (err, result) => {
              expect(err).to.be.ok;
              expect(result).not.to.be.ok;
              err.name.should.equal('PermissionDenied');
              callback();
            })]
        }, done));
      it('returns NotFound on a non-exsistent ledger', done => {
        const unknownLedger = 'did:v1:' + uuid();
        brLedger.get(actor, unknownLedger, (err, result) => {
          expect(err).to.be.ok;
          expect(result).not.to.be.ok;
          err.name.should.equal('NotFound');
          err.details.ledger.should.equal(unknownLedger);
          done();
        });
      });
      it('returns NotFound on a deleted ledger', done => async.auto({
        create: callback => brLedger.add(
          actor, configBlock, {owner: actor.id}, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, configBlock.ledger, 'mongodb', callback)
        ],
        get: ['delete', (results, callback) =>
          brLedger.get(actor, configBlock.ledger, (err, result) => {
            expect(err).to.be.ok;
            expect(result).not.to.be.ok;
            err.name.should.equal('NotFound');
            err.details.ledger.should.equal(configBlock.ledger);
            callback();
          })]
      }, done));
    }); // end regularUser as actor
  }); // end get API
  describe.only('delete API', () => {
    beforeEach(done => {
      helpers.removeCollection('ledgerNode', done);
    });
    describe('regularUser as actor', () => {
      const mockIdentity = mockData.identities.regularUser;
      const configBlock = mockData.configBlocks.alpha;
      let actor;
      before(done => {
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('should delete a ledger if actor is owner', done => async.auto({
        create: callback => brLedger.add(
          actor, configBlock, {owner: actor.id}, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, configBlock.ledger, 'mongodb', err => {
            expect(err).not.to.be.ok;
            callback();
          })],
        test: ['delete', (results, callback) =>
          database.collections.ledgerNode.findOne({
            ledger: database.hash(configBlock.ledger),
            storage: database.hash('mongodb')
          }, (err, result) => {
            expect(err).not.to.be.ok;
            expect(result).to.be.ok;
            result.ledgerNode.sysStatus.should.equal('deleted');
            callback();
          })]
      }, done));
      it('returns PermissionDenied if actor is not owner', done => async.auto({
        create: callback => brLedger.add(
          null, configBlock, {owner: uuid()}, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, configBlock.ledger, 'mongodb', err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })]
      }, done));
      it('returns PermissionDenied if there is no owner', done => async.auto({
        create: callback => brLedger.add(null, configBlock, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, configBlock.ledger, 'mongodb', err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })]
      }, done));
    });
  }); // end delete API
  describe('test stubs', () => {
    it.skip('should iterate over their ledgers', done => {
      done();
    });
    it.skip('should delete their ledger', done => {
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
