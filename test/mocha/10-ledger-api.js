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
const jsigs = require('jsonld-signatures');
const jsonld = require('bedrock').jsonld;
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

jsigs.use('jsonld', jsonld);

let signedConfigEvent;

describe('Ledger API', () => {
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
        const configEvent = signedConfigEvent;
        async.auto({
          create: callback => brLedger.add(
            actor, configEvent, (err, ledgerNode) => {
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
              result.ledger.should.equal(
                database.hash(configEvent.input[0].ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configEvent.input[0].ledger);
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
        const configEvent = signedConfigEvent;
        async.auto({
          create: callback => brLedger.add(
            actor, configEvent, (err, result) => {
              expect(err).not.to.be.ok;
              expect(result).to.be.ok;
              callback(null, result);
            }),
          createDuplicate: ['create', (results, callback) => brLedger.add(
            actor, configEvent, (err, result) => {
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
        const configEvent = signedConfigEvent;
        async.auto({
          create: callback => brLedger.add(
            actor, configEvent, {owner: actor.id}, (err, ledgerNode) => {
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
              result.ledger.should.equal(
                database.hash(configEvent.input[0].ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configEvent.input[0].ledger);
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
        const configEvent = signedConfigEvent;
        brLedger.add(
          actor, configEvent, {owner: uuid()}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('PermissionDenied');
            done();
          });
      });
      it('returns error if invalid storage plugin is specified', done => {
        const configEvent = signedConfigEvent;
        brLedger.add(
          actor, configEvent, {storage: uuid()}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('InvalidStorage');
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
        const configEvent = signedConfigEvent;
        async.auto({
          create: callback => brLedger.add(
            actor, configEvent, (err, ledgerNode) => {
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
              result.ledger.should.equal(
                database.hash(configEvent.input[0].ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configEvent.input[0].ledger);
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
        const configEvent = signedConfigEvent;
        async.auto({
          create: callback => brLedger.add(
            actor, configEvent, (err, result) => {
              expect(err).not.to.be.ok;
              expect(result).to.be.ok;
              callback(null, result);
            }),
          createDuplicate: ['create', (results, callback) => brLedger.add(
            actor, configEvent, (err, result) => {
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
        const configEvent = signedConfigEvent;
        async.auto({
          create: callback => brLedger.add(
            actor, configEvent, {owner: actor.id}, (err, ledgerNode) => {
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
              result.ledger.should.equal(
                database.hash(configEvent.input[0].ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configEvent.input[0].ledger);
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
        const configEvent = signedConfigEvent;
        async.auto({
          create: callback => brLedger.add(
            actor, configEvent, {
              owner: mockData.identities.regularUser.identity.id
            }, (err, ledgerNode) => {
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
              result.ledger.should.equal(
                database.hash(configEvent.input[0].ledger));
              const ledgerNode = result.ledgerNode;
              ledgerNode.id.should.equal(results.create.id);
              ledgerNode.ledger.should.equal(configEvent.input[0].ledger);
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
        const configEvent = signedConfigEvent;
        brLedger.add(
          actor, configEvent, {storage: uuid()}, (err, ledgerNode) => {
            expect(err).to.be.ok;
            expect(ledgerNode).not.to.be.ok;
            err.name.should.equal('InvalidStorage');
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
      let configEvent;
      before(done => {
        configEvent = signedConfigEvent;
        const mockIdentity = mockData.identities.regularUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('gets a ledger with no owner', done => async.auto({
        create: callback => brLedger.add(actor, configEvent, callback),
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
          actor, configEvent, {owner: actor.id}, callback),
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
            null, configEvent, {owner: someOwner}, callback),
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
          actor, configEvent, {owner: actor.id}, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, results.create.id, callback)
        ],
        get: ['delete', (results, callback) => brLedger.get(
          actor, configEvent.input[0].ledger, {
            owner: actor.id
          }, (err, result) => {
            expect(err).to.be.ok;
            expect(result).not.to.be.ok;
            err.name.should.equal('NotFound');
            err.details.ledger.should.equal(configEvent.input[0].ledger);
            callback();
          })]
      }, done));
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let configEvent;
      before(done => {
        configEvent = signedConfigEvent;
        const mockIdentity = mockData.identities.adminUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('gets a ledger with no owner', done => async.auto({
        create: callback => brLedger.add(actor, configEvent, callback),
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
          actor, configEvent, {owner: actor.id}, callback),
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
      it('gets a ledger with a different owner', done => async.auto({
        create: callback => brLedger.add(actor, configEvent, {
          owner: mockData.identities.regularUser.identity.id
        }, callback),
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
          actor, configEvent, {owner: actor.id}, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, results.create.id, callback)
        ],
        get: ['delete', (results, callback) => brLedger.get(
          actor, configEvent.input[0].ledger, {
            owner: actor.id
          }, (err, result) => {
            expect(err).to.be.ok;
            expect(result).not.to.be.ok;
            err.name.should.equal('NotFound');
            err.details.ledger.should.equal(configEvent.input[0].ledger);
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
      let configEvent;
      before(done => {
        configEvent = signedConfigEvent;
        const mockIdentity = mockData.identities.regularUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('should delete a ledger if actor is owner', done => async.auto({
        create: callback => brLedger.add(
          actor, configEvent, {owner: actor.id}, callback),
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
            null, configEvent, {owner: someOwner}, callback),
          delete: ['create', (results, callback) => brLedger.remove(
            actor, results.create.id, err => {
              expect(err).to.be.ok;
              err.name.should.equal('PermissionDenied');
              callback();
            })]
        }, done);
      });
      it('returns PermissionDenied if there is no owner', done => async.auto({
        create: callback => brLedger.add(null, configEvent, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, results.create.id, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })]
      }, done));
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let configEvent;
      before(done => {
        configEvent = signedConfigEvent;
        const mockIdentity = mockData.identities.adminUser;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('should delete a ledger if actor is owner', done => async.auto({
        create: callback => brLedger.add(
          actor, configEvent, {owner: actor.id}, callback),
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
      it('should delete a ledger with a different owner', done => async.auto({
        create: callback => brLedger.add(actor, configEvent, {
          owner: mockData.identities.regularUser.identity.id
        }, callback),
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
      it('returns PermissionDenied if there is no owner', done => async.auto({
        create: callback => brLedger.add(null, configEvent, callback),
        delete: ['create', (results, callback) => brLedger.remove(
          actor, results.create.id, err => {
            expect(err).to.be.ok;
            err.name.should.equal('PermissionDenied');
            callback();
          })]
      }, done));
    }); // end adminUser as actor
  }); // end delete API

  describe('getNodeIterator API', () => {
    beforeEach(done => {
      helpers.removeCollections(['ledger', 'ledgerNode'], done);
    });
    describe('regularUser as actor', () => {
      let actor;
      let configEvent;
      before(done => {
        const mockIdentity = mockData.identities.regularUser;
        configEvent = signedConfigEvent;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('iterates over public ledgers', done => {
        const testLedgers = [];
        const iteratorLedgers = [];
        async.auto({
          create: callback => async.times(10, (i, callback) =>
            brLedger.add(actor, configEvent, (err, result) => {
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
      it('iterates over public and private ledgers owned by actor', done => {
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        async.auto({
          // private ledgers owned by actor
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedger.add(actor, configEvent, {
              owner: actor.id
            }, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          // public ledgers
          createBeta: callback => async.times(3, (i, callback) =>
            brLedger.add(null, configEvent, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: ['createAlpha', 'createBeta', (results, callback) =>
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
      // FIXME: need to finalize permission model in `getNodeIterator`
      it.skip('iterator only returns ledgers owned by actor', done => {
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        async.auto({
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedger.add(actor, configEvent, {
              owner: actor.id
            },(err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          createBeta: callback => async.times(3, (i, callback) =>
            brLedger.add(null, configEvent, {
              owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
            }, callback), callback),
          getIterator: ['createAlpha', 'createBeta', (results, callback) =>
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
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let configEvent;
      before(done => {
        const mockIdentity = mockData.identities.adminUser;
        configEvent = signedConfigEvent;
        brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
          actor = result;
          done(err);
        });
      });
      it('iterates over public ledgers', done => {
        const testLedgers = [];
        const iteratorLedgers = [];
        async.auto({
          create: callback => async.times(10, (i, callback) =>
            brLedger.add(actor, configEvent, (err, result) => {
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
      it('iterates over public and private ledgers owned by actor', done => {
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        async.auto({
          // private ledgers owned by actor
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedger.add(actor, configEvent, {
              owner: actor.id
            }, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          // public ledgers
          createBeta: callback => async.times(3, (i, callback) =>
            brLedger.add(null, configEvent, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: ['createAlpha', 'createBeta', (results, callback) =>
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
      it('iterates over all ledgers', done => {
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor, 3 owned by another identity
        // 2 public ledgers
        async.auto({
          createAlpha: callback => async.times(5, (i, callback) =>
            brLedger.add(actor, configEvent, {
              owner: actor.id
            }, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          createBeta: callback => async.times(3, (i, callback) =>
            brLedger.add(null, configEvent, {
              owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
            }, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          createGamma: callback => async.times(3, (i, callback) =>
            brLedger.add(null, configEvent, (err, result) => {
              testLedgers.push(result.id);
              callback();
            }), callback),
          getIterator: [
            'createAlpha', 'createBeta', 'createGamma', (results, callback) =>
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
    }); // end adminUser as actor
  }); // end getNodeIterator
}); // end Ledger API
