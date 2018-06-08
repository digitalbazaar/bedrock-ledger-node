/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const database = require('bedrock-mongodb');
const expect = global.chai.expect;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const jsonld = require('bedrock').jsonld;
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

jsigs.use('jsonld', jsonld);

let signedConfig;

describe('Ledger API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback),
      callback => jsigs.sign(mockData.ledgerConfiguration, {
        algorithm: 'RsaSignature2018',
        privateKeyPem: mockData.groups.authorized.privateKey,
        creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      }, (err, result) => {
        signedConfig = result;
        callback(err);
      })
    ], done);
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
        const ledgerConfiguration = signedConfig;
        async.auto({
          create: callback => brLedgerNode.add(
            actor, {ledgerConfiguration}, (err, ledgerNode) => {
              assertNoError(err);
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          test: ['create', (results, callback) => {
            database.collections.ledgerNode.findOne({
              id: database.hash(results.create.id)
            }, (err, result) => {
              assertNoError(err);
              result.id.should.equal(database.hash(results.create.id));
              result.ledger.should.equal(
                database.hash(ledgerConfiguration.ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
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
      // FIXME: determine proper behavior, this test creates a new ledger
      it.skip('returns existing ledger on attempt to create a duplicate', done => {
        const ledgerConfiguration = signedConfig;
        async.auto({
          create: callback => brLedgerNode.add(
            actor, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              callback(null, result);
            }),
          createDuplicate: ['create', (results, callback) => brLedgerNode.add(
            actor, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              expect(result.meta).to.exist;
              expect(result.blocks).to.exist;
              expect(result.events).to.exist;
              callback();
            })]
        }, done);
      });
      it('should create a ledger with an owner', done => {
        const ledgerConfiguration = signedConfig;
        async.auto({
          create: callback => brLedgerNode.add(
            actor, {owner: actor.id, ledgerConfiguration},
            (err, ledgerNode) => {
              assertNoError(err);
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          test: ['create', (results, callback) => {
            database.collections.ledgerNode.findOne({
              id: database.hash(results.create.id)
            }, (err, result) => {
              assertNoError(err);
              result.id.should.equal(database.hash(results.create.id));
              result.ledger.should.equal(
                database.hash(ledgerConfiguration.ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
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
        const ledgerConfiguration = signedConfig;
        brLedgerNode.add(
          actor, {owner: uuid(), ledgerConfiguration}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('PermissionDenied');
            done();
          });
      });
      it('returns error if invalid storage plugin is specified', done => {
        const ledgerConfiguration = signedConfig;
        brLedgerNode.add(
          actor, {storage: uuid(), ledgerConfiguration}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('DataError');
            done();
          });
      });
    }); // end regularUser as actor
    describe('admin as actor', () => {
      const mockIdentity = mockData.identities.adminUser;
      let actor;
      before(done => {
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('should create a ledger with no owner', done => {
        const ledgerConfiguration = signedConfig;
        async.auto({
          create: callback => brLedgerNode.add(
            actor, {ledgerConfiguration}, (err, ledgerNode) => {
              assertNoError(err);
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          test: ['create', (results, callback) => {
            database.collections.ledgerNode.findOne({
              id: database.hash(results.create.id)
            }, (err, result) => {
              assertNoError(err);
              result.id.should.equal(database.hash(results.create.id));
              result.ledger.should.equal(
                database.hash(ledgerConfiguration.ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
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
      // FIXME: determine proper behavior, this test creates a new ledger
      it.skip('returns existing ledger on attempt to create a duplicate', done => {
        const ledgerConfiguration = signedConfig;
        async.auto({
          create: callback => brLedgerNode.add(
            actor, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              callback(null, result);
            }),
          createDuplicate: ['create', (results, callback) => brLedgerNode.add(
            actor, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              expect(result.meta).to.exist;
              expect(result.blocks).to.exist;
              expect(result.events).to.exist;
              callback();
            })]
        }, done);
      });
      it('should create a ledger with an owner', done => {
        const ledgerConfiguration = signedConfig;
        async.auto({
          create: callback => brLedgerNode.add(
            actor, {owner: actor.id, ledgerConfiguration},
            (err, ledgerNode) => {
              assertNoError(err);
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          test: ['create', (results, callback) => {
            database.collections.ledgerNode.findOne({
              id: database.hash(results.create.id)
            }, (err, result) => {
              assertNoError(err);
              result.id.should.equal(database.hash(results.create.id));
              result.ledger.should.equal(
                database.hash(ledgerConfiguration.ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
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
      it('should create a ledger with a different owner', done => {
        const ledgerConfiguration = signedConfig;
        async.auto({
          create: callback => brLedgerNode.add(
            actor, {
              ledgerConfiguration,
              owner: mockData.identities.regularUser.identity.id
            }, (err, ledgerNode) => {
              assertNoError(err);
              expect(ledgerNode).to.be.ok;
              callback(null, ledgerNode);
            }),
          test: ['create', (results, callback) => {
            database.collections.ledgerNode.findOne({
              id: database.hash(results.create.id)
            }, (err, result) => {
              assertNoError(err);
              result.id.should.equal(database.hash(results.create.id));
              result.ledger.should.equal(
                database.hash(ledgerConfiguration.ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
              ledgerNode.owner.should.equal(
                mockData.identities.regularUser.identity.id);
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
      it('returns error if invalid storage plugin is specified', done => {
        const ledgerConfiguration = signedConfig;
        brLedgerNode.add(
          actor, {storage: uuid(), ledgerConfiguration}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('DataError');
            done();
          });
      });
    }); // end admin as actor
  }); // end create API
  describe('get API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
    });
    describe('regularUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(done => {
        ledgerConfiguration = signedConfig;
        const mockIdentity = mockData.identities.regularUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('gets a ledger with no owner', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {ledgerConfiguration}, callback),
        get: ['create', (results, callback) => brLedgerNode.get(
          actor, results.create.id, (err, result) => {
            assertNoError(err);
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })
        ]
      }, done));
      it('gets a ledger with actor as owner', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration}, callback),
        get: ['create', (results, callback) => brLedgerNode.get(
          actor, results.create.id, (err, result) => {
            assertNoError(err);
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
          create: callback => brLedgerNode.add(
            null, {owner: someOwner, ledgerConfiguration}, callback),
          get: ['create', (results, callback) => brLedgerNode.get(
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
        brLedgerNode.get(actor, unknownLedger, (err, result) => {
          expect(err).to.be.ok;
          expect(result).not.to.be.ok;
          err.name.should.equal('NotFound');
          err.details.ledger.should.equal(unknownLedger);
          done();
        });
      });
      it('returns NotFound on a deleted ledger', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration}, callback),
        delete: ['create', (results, callback) => brLedgerNode.remove(
          actor, results.create.id, callback)
        ],
        get: ['delete', (results, callback) => brLedgerNode.get(
          actor, ledgerConfiguration.ledger, {
            owner: actor.id
          }, (err, result) => {
            expect(err).to.be.ok;
            expect(result).not.to.be.ok;
            err.name.should.equal('NotFound');
            err.details.ledger.should.equal(ledgerConfiguration.ledger);
            callback();
          })]
      }, done));
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(done => {
        ledgerConfiguration = signedConfig;
        const mockIdentity = mockData.identities.adminUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('gets a ledger with no owner', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {ledgerConfiguration}, callback),
        get: ['create', (results, callback) => brLedgerNode.get(
          actor, results.create.id, (err, result) => {
            assertNoError(err);
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })
        ]
      }, done));
      it('gets a ledger with actor as owner', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration}, callback),
        get: ['create', (results, callback) => brLedgerNode.get(
          actor, results.create.id, (err, result) => {
            assertNoError(err);
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })]
      }, done));
      it('gets a ledger with a different owner', done => async.auto({
        create: callback => brLedgerNode.add(actor, {
          ledgerConfiguration,
          owner: mockData.identities.regularUser.identity.id
        }, callback),
        get: ['create', (results, callback) => brLedgerNode.get(
          actor, results.create.id, (err, result) => {
            assertNoError(err);
            expect(result).to.be.ok;
            expect(result.meta).to.exist;
            expect(result.blocks).to.exist;
            expect(result.events).to.exist;
            callback();
          })]
      }, done));
      it('returns NotFound on a non-exsistent ledger', done => {
        const unknownLedger = 'did:v1:' + uuid();
        brLedgerNode.get(actor, unknownLedger, (err, result) => {
          expect(err).to.be.ok;
          expect(result).not.to.be.ok;
          err.name.should.equal('NotFound');
          err.details.ledger.should.equal(unknownLedger);
          done();
        });
      });
      it('returns NotFound on a deleted ledger', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration}, callback),
        delete: ['create', (results, callback) => brLedgerNode.remove(
          actor, results.create.id, callback)
        ],
        get: ['delete', (results, callback) => brLedgerNode.get(
          actor, ledgerConfiguration.ledger, {
            owner: actor.id
          }, (err, result) => {
            expect(err).to.be.ok;
            expect(result).not.to.be.ok;
            err.name.should.equal('NotFound');
            err.details.ledger.should.equal(ledgerConfiguration.ledger);
            callback();
          })]
      }, done));
    }); // end adminUser as actor
  }); // end get API
  describe('delete API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
    });
    describe('regularUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(done => {
        ledgerConfiguration = signedConfig;
        const mockIdentity = mockData.identities.regularUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('should delete a ledger if actor is owner', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration}, callback),
        delete: ['create', (results, callback) => brLedgerNode.remove(
          actor, results.create.id, err => {
            assertNoError(err);
            callback();
          })],
        test: ['delete', (results, callback) =>
          database.collections.ledgerNode.findOne({
            id: database.hash(results.create.id)
          }, (err, result) => {
            assertNoError(err);
            expect(result).to.be.ok;
            result.meta.deleted.should.be.a('number');
            callback();
          })]
      }, done));
      it('returns NotFound on a non-exsistent ledger', done => {
        const unknownLedger = 'urn:uuid:' + uuid();
        brLedgerNode.remove(actor, unknownLedger, (err, result) => {
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
          create: callback => brLedgerNode.add(
            null, {owner: someOwner, ledgerConfiguration}, callback),
          delete: ['create', (results, callback) => brLedgerNode.remove(
            actor, results.create.id, err => {
              expect(err).to.be.ok;
              err.name.should.equal('PermissionDenied');
              callback();
            })]
        }, done);
      });
      it('returns PermissionDenied if there is no owner', done => async.auto({
        create: callback => brLedgerNode.add(
          null, {ledgerConfiguration}, callback),
        delete: ['create', (results, callback) => brLedgerNode.remove(
          actor, results.create.id, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })]
      }, done));
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(done => {
        ledgerConfiguration = signedConfig;
        const mockIdentity = mockData.identities.adminUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('should delete a ledger if actor is owner', done => async.auto({
        create: callback => brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration}, callback),
        delete: ['create', (results, callback) => brLedgerNode.remove(
          actor, results.create.id, err => {
            assertNoError(err);
            callback();
          })],
        test: ['delete', (results, callback) =>
          database.collections.ledgerNode.findOne({
            id: database.hash(results.create.id)
          }, (err, result) => {
            assertNoError(err);
            expect(result).to.be.ok;
            result.meta.deleted.should.be.a('number');
            callback();
          })]
      }, done));
      it('should delete a ledger with a different owner', done => async.auto({
        create: callback => brLedgerNode.add(actor, {
          ledgerConfiguration,
          owner: mockData.identities.regularUser.identity.id
        }, callback),
        delete: ['create', (results, callback) => brLedgerNode.remove(
          actor, results.create.id, err => {
            assertNoError(err);
            callback();
          })],
        test: ['delete', (results, callback) =>
          database.collections.ledgerNode.findOne({
            id: database.hash(results.create.id)
          }, (err, result) => {
            assertNoError(err);
            expect(result).to.be.ok;
            result.meta.deleted.should.be.a('number');
            callback();
          })]
      }, done));
      it('returns NotFound on a non-exsistent ledger', done => {
        const unknownLedger = 'urn:uuid:' + uuid();
        brLedgerNode.remove(actor, unknownLedger, (err, result) => {
          expect(err).to.be.ok;
          expect(result).not.to.be.ok;
          err.name.should.equal('NotFound');
          err.details.ledger.should.equal(unknownLedger);
          done();
        });
      });
      it('returns PermissionDenied if there is no owner', done => async.auto({
        create: callback => brLedgerNode.add(
          null, {ledgerConfiguration}, callback),
        delete: ['create', (results, callback) => brLedgerNode.remove(
          actor, results.create.id, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })]
      }, done));
    }); // end adminUser as actor
  }); // end delete API

  // FIXME: see https://github.com/digitalbazaar/bedrock-ledger-node/issues/17
  describe.skip('getNodeIterator API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
    });
    describe('regularUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(done => {
        const mockIdentity = mockData.identities.regularUser;
        ledgerConfiguration = signedConfig;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('iterates over public ledgers', function(done) {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        async.auto({
          create: callback => async.times(10, (i, callback) =>
            brLedgerNode.add(actor, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: ['create', (results, callback) =>
            brLedgerNode.getNodeIterator(actor, (err, iterator) => {
              assertNoError(err);
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
      // FIXME: https://github.com/digitalbazaar/bedrock-ledger-node/issues/14
      it.skip('iterates public/private ledgers owned by actor', function(done) {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 public ledgers
        async.auto({
          // private ledgers owned by actor
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedgerNode.add(actor, {
              ledgerConfiguration,
              owner: actor.id
            }, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              testLedgers.push(result.id);
              callback();
            }), callback),
          // public ledgers
          createBeta: callback => async.times(3, (i, callback) =>
            brLedgerNode.add(null, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: ['createAlpha', 'createBeta', (results, callback) =>
            brLedgerNode.getNodeIterator(actor, (err, iterator) => {
              assertNoError(err);
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
      // FIXME: https://github.com/digitalbazaar/bedrock-ledger-node/issues/14
      it.skip('iterator only returns ledgers owned by actor', function(done) {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        async.auto({
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedgerNode.add(actor, {
              ledgerConfiguration,
              owner: actor.id
            }, (err, result) => {
              assertNoError(err);
              testLedgers.push(result.id);
              callback();
            }), callback),
          createBeta: callback => async.times(3, (i, callback) =>
            brLedgerNode.add(null, {
              ledgerConfiguration,
              owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
            }, callback), callback),
          getIterator: ['createAlpha', 'createBeta', (results, callback) =>
            brLedgerNode.getNodeIterator(actor, (err, iterator) => {
              assertNoError(err);
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
      // FIXME: https://github.com/digitalbazaar/bedrock-ledger-node/issues/14
      it.skip('iterator returns ledgers owned by actor and public', function(done) {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        // and 2 public ledgers
        async.auto({
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedgerNode.add(actor, {
              ledgerConfiguration,
              owner: actor.id
            }, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              testLedgers.push(result.id);
              callback();
            }), callback),
          createBeta: callback => async.times(3, (i, callback) =>
            brLedgerNode.add(null, {
              ledgerConfiguration,
              owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
            }, callback), callback),
          // public ledgers
          createGamma: callback => async.times(2, (i, callback) =>
            brLedgerNode.add(null, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: [
            'createAlpha', 'createBeta', 'createGamma', (results, callback) =>
              brLedgerNode.getNodeIterator(actor, (err, iterator) => {
                assertNoError(err);
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
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(done => {
        const mockIdentity = mockData.identities.adminUser;
        ledgerConfiguration = signedConfig;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('iterates over public ledgers', function(done) {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        async.auto({
          create: callback => async.times(10, (i, callback) =>
            brLedgerNode.add(actor, {ledgerConfiguration}, (err, result) => {
              assertNoError(err);
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: ['create', (results, callback) =>
            brLedgerNode.getNodeIterator(actor, (err, iterator) => {
              assertNoError(err);
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
      it('iterates public and private ledgers owned by actor', function(done) {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        async.auto({
          // private ledgers owned by actor
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedgerNode.add(actor, {
              ledgerConfiguration,
              owner: actor.id
            }, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          // public ledgers
          createBeta: callback => async.times(3, (i, callback) =>
            brLedgerNode.add(null, {ledgerConfiguration}, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: ['createAlpha', 'createBeta', (results, callback) =>
            brLedgerNode.getNodeIterator(actor, (err, iterator) => {
              assertNoError(err);
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
      it('iterates over all ledgers', function(done) {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor, 3 owned by another identity
        // 2 public ledgers
        async.auto({
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedgerNode.add(actor, {
              ledgerConfiguration,
              owner: actor.id
            }, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              testLedgers.push(result.id);
              callback();
            }), callback),
          createBeta: callback => async.times(3, (i, callback) =>
            brLedgerNode.add(null, {
              ledgerConfiguration,
              owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
            }, (err, result) => {
              assertNoError(err);
              expect(result).to.be.ok;
              testLedgers.push(result.id);
              callback();
            }), callback),
          createGamma: callback => async.times(3, (i, callback) =>
            brLedgerNode.add(null, {ledgerConfiguration}, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: [
            'createAlpha', 'createBeta', 'createGamma', (results, callback) =>
              brLedgerNode.getNodeIterator(actor, (err, iterator) => {
                assertNoError(err);
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
    }); // end adminUser as actor
  }); // end getNodeIterator
}); // end Ledger API
