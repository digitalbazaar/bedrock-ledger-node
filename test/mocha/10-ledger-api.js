/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const brIdentity = require('bedrock-identity');
const brLedger = require('bedrock-ledger');
const database = require('bedrock-mongodb');
const expect = global.chai.expect;
const helpers = require('./helpers');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

describe('Ledger API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  describe('create API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
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
              should.not.exist(err);
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
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configBlock.ledger);
              ledgerNode.storage.should.be.an('object');
              ledgerNode.storage.id.should.be.a('string');
              ledgerNode.storage.plugin.should.equal('mongodb');
              const meta = result.meta;
              meta.created.should.be.a('number');
              // there should be no owner
              expect(ledgerNode.owner).to.be.null;
              callback();
            });
          }]
        }, done);
      });
      it('returns existing ledger on attempt to create a duplicate', done => {
        const configBlock = mockData.configBlocks.alpha;
        async.auto({
          create: callback => brLedger.add(
            actor, configBlock, (err, result) => {
              expect(err).not.to.be.ok;
              expect(result).to.be.ok;
              callback(null, result);
            }),
          createDuplicate: ['create', (results, callback) => brLedger.add(
            actor, configBlock, (err, result) => {
              expect(err).not.to.be.ok;
              expect(result).to.be.ok;
              expect(result.meta).to.exist;
              expect(result.blocks).to.exist;
              expect(result.events).to.exist;
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
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configBlock.ledger);
              ledgerNode.owner.should.equal(actor.id);
              ledgerNode.storage.should.be.an('object');
              ledgerNode.storage.id.should.be.a('string');
              ledgerNode.storage.plugin.should.equal('mongodb');
              const meta = result.meta;
              meta.created.should.be.a('number');
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
      it('returns error if invalid storage plugin is specified', done => {
        const configBlock = mockData.configBlocks.alpha;
        brLedger.add(
          actor, configBlock, {storage: uuid()}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('InvalidStorage');
            done();
          });
      });
    }); // end regularUser as actor
  }); // end create API
  describe('get API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
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
        get: ['create', (results, callback) => brLedger.get(
          actor, results.create.id, (err, result) => {
            expect(err).not.to.be.ok;
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })
        ]
      }, done));
      it('gets a ledger with actor as owner', done => async.auto({
        create: callback => brLedger.add(
          actor, configBlock, {owner: actor.id}, callback),
        get: ['create', (results, callback) => brLedger.get(
          actor, results.create.id, (err, result) => {
            expect(err).not.to.be.ok;
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })]
      }, done));
      it('returns PermissionDenied if actor does not own the ledger', done => {
        const someOwner = uuid();
        async.auto({
          create: callback => brLedger.add(
            null, configBlock, {owner: someOwner}, callback),
          get: ['create', (results, callback) => brLedger.get(
            actor, results.create.id, {owner: someOwner}, (err, result) => {
              expect(err).to.be.ok;
              expect(result).not.to.be.ok;
              err.name.should.equal('PermissionDenied');
              callback();
            })]
        }, done);
      });
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
          actor, results.create.id, callback)
        ],
        get: ['delete', (results, callback) => brLedger.get(
          actor, configBlock.ledger, {owner: actor.id}, (err, result) => {
            expect(err).to.be.ok;
            expect(result).not.to.be.ok;
            err.name.should.equal('NotFound');
            err.details.ledger.should.equal(configBlock.ledger);
            callback();
          })]
      }, done));
    }); // end regularUser as actor
  }); // end get API
  describe('delete API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
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
          actor, results.create.id, err => {
            expect(err).not.to.be.ok;
            callback();
          })],
        test: ['delete', (results, callback) =>
          database.collections.ledgerNode.findOne({
            id: database.hash(results.create.id)
          }, (err, result) => {
            expect(err).not.to.be.ok;
            expect(result).to.be.ok;
            result.meta.deleted.should.be.a('number');
            callback();
          })]
      }, done));
      it('returns NotFound on a non-exsistent ledger', done => {
        const unknownLedger = 'urn:uuid:' + uuid();
        brLedger.remove(actor, unknownLedger, (err, result) => {
          expect(err).to.be.ok;
          expect(result).not.to.be.ok;
          err.name.should.equal('NotFound');
          err.details.ledger.should.equal(unknownLedger);
          done();
        });
      });
      it('returns PermissionDenied if actor is not owner', done => {
        const someOwner = uuid();
        async.auto({
          create: callback => brLedger.add(
            null, configBlock, {owner: someOwner}, callback),
          delete: ['create', (results, callback) => brLedger.remove(
            actor, results.create.id, err => {
              expect(err).to.be.ok;
              err.name.should.equal('PermissionDenied');
              callback();
            })]
        }, done);
      });
      it('returns PermissionDenied if there is no owner', done => async.auto({
        create: callback => brLedger.add(null, configBlock, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, results.create.id, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })]
      }, done));
    });
  }); // end delete API

  describe('getNodeIterator API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
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
      it('iterates over ledgers', done => {
        const testLedgers = [];
        const iteratorLedgers = [];
        async.auto({
          create: callback => async.times(10, (i, callback) =>
            brLedger.add(actor, configBlock, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: ['create', (results, callback) =>
            brLedger.getNodeIterator(actor, (err, iterator) => {
              should.not.exist(err);
              callback(null, iterator);
            })
          ],
          iterate: ['getIterator', (results, callback) =>
            async.eachSeries(results.getIterator, (promise, callback) => {
              promise.then(ledgerNode => {
                iteratorLedgers.push(ledgerNode.id);
                callback();
              }).catch(err => callback(err));
            }, callback)
          ],
          test: ['iterate', (results, callback) => {
            iteratorLedgers.should.have.same.members(testLedgers);
            callback();
          }]
        }, done);
      });
    }); // end regularUser
  }); // end getNodeIterator
  describe.skip('test stubs', () => {
    it.skip('should not iterate over non-owned ledgers', done => {
      done();
    });
  });
  describe.skip('admin as actor', () => {
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
