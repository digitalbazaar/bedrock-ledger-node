/*
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const database = require('bedrock-mongodb');
const expect = global.chai.expect;
const helpers = require('./helpers');
const mockData = require('./mock.data');
const {util: {uuid}} = require('bedrock');

let signedConfig;

describe('Ledger API', () => {
  before(async function() {
    await helpers.prepareDatabase(mockData);
    signedConfig = await helpers.signDocument({
      doc: mockData.ledgerConfiguration,
      creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
      privateKeyPem: mockData.groups.authorized.privateKey,
    });
  });
  describe('create API', () => {
    beforeEach(async function() {
      await helpers.removeCollections(['ledger', 'ledgerNode']);
    });
    describe('regularUser as actor', () => {
      let actor;
      before(async function() {
        const {id} = mockData.identities.regularUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('should create a ledger with no owner', async () => {
        const ledgerConfiguration = signedConfig;
        const ledgerNode = await brLedgerNode.add(actor, {ledgerConfiguration});
        expect(ledgerNode).to.be.ok;
        const record = await database.collections.ledgerNode.findOne(
          {id: database.hash(ledgerNode.id)});
        record.id.should.equal(database.hash(ledgerNode.id));
        record.ledger.should.equal(database.hash(ledgerConfiguration.ledger));
        record.ledgerNode.id.should.equal(ledgerNode.id);
        record.ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
        record.ledgerNode.storage.should.be.an('object');
        record.ledgerNode.storage.id.should.be.a('string');
        record.ledgerNode.storage.plugin.should.equal('mongodb');
        const {meta} = record;
        meta.created.should.be.a('number');
        // there should be no owner
        expect(record.ledgerNode.owner).to.be.null;
      });
      // FIXME: determine proper behavior, this test creates a new ledger
      it.skip('returns existing ledger on attempt to create a duplicate',
        async function() {
          const ledgerConfiguration = signedConfig;
          const ledgerNode = await brLedgerNode.add(
            actor, {ledgerConfiguration});
          expect(ledgerNode).to.be.ok;
          const result = await brLedgerNode.add(
            actor, {ledgerConfiguration});
          expect(result).to.be.ok;
          expect(result.meta).to.exist;
          expect(result.blocks).to.exist;
          expect(result.events).to.exist;
        });
      it('should create a ledger with an owner', async function() {
        const ledgerConfiguration = signedConfig;
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        expect(created).to.be.ok;
        const result = await database.collections.ledgerNode.findOne({
          id: database.hash(created.id)
        });
        result.id.should.equal(database.hash(created.id));
        result.ledger.should.equal(
          database.hash(ledgerConfiguration.ledger));
        const ledgerNode = result.ledgerNode;
        ledgerNode.id.should.equal(created.id);
        ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
        ledgerNode.owner.should.equal(actor.id);
        ledgerNode.storage.should.be.an('object');
        ledgerNode.storage.id.should.be.a('string');
        ledgerNode.storage.plugin.should.equal('mongodb');
        const meta = result.meta;
        meta.created.should.be.a('number');
      });
      it('returns PermissionDenied if actor is not owner', async () => {
        const ledgerConfiguration = signedConfig;
        let err;
        let ledgerNode;
        try {
          ledgerNode = await brLedgerNode.add(
            actor, {owner: uuid(), ledgerConfiguration});
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(ledgerNode).not.to.be.ok;
        err.name.should.equal('PermissionDenied');
      });
      it('returns error if invalid storage plugin is specified', async () => {
        const ledgerConfiguration = signedConfig;
        let err;
        let ledgerNode;
        try {
          ledgerNode = await brLedgerNode.add(
            actor, {storage: uuid(), ledgerConfiguration});
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(ledgerNode).not.to.be.ok;
        err.name.should.equal('NotFoundError');
      });
    }); // end regularUser as actor
    describe('admin as actor', () => {
      let actor;
      before(async () => {
        const {id} = mockData.identities.adminUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('should create a ledger with no owner', async () => {
        const ledgerConfiguration = signedConfig;
        const created = await brLedgerNode.add(
          actor, {ledgerConfiguration});
        expect(created).to.be.ok;
        const result = await database.collections.ledgerNode.findOne({
          id: database.hash(created.id)
        });
        result.id.should.equal(database.hash(created.id));
        result.ledger.should.equal(
          database.hash(ledgerConfiguration.ledger));
        const ledgerNode = result.ledgerNode;
        ledgerNode.id.should.equal(created.id);
        ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
        ledgerNode.storage.should.be.an('object');
        ledgerNode.storage.id.should.be.a('string');
        ledgerNode.storage.plugin.should.equal('mongodb');
        const meta = result.meta;
        meta.created.should.be.a('number');
        // there should be no owner
        expect(ledgerNode.owner).to.be.null;
      });
      // FIXME: determine proper behavior, this test creates a new ledger
      it.skip('returns existing ledger on attempt to create a duplicate',
        async () => {
          const ledgerConfiguration = signedConfig;
          const created = await brLedgerNode.add(actor, {ledgerConfiguration});
          expect(created).to.be.ok;
          const result = await brLedgerNode.add(
            actor, {ledgerConfiguration});
          expect(result).to.be.ok;
          expect(result.meta).to.exist;
          expect(result.blocks).to.exist;
          expect(result.events).to.exist;
        });
      it('should create a ledger with an owner', async () => {
        const ledgerConfiguration = signedConfig;
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        expect(created).to.be.ok;
        const result = await database.collections.ledgerNode.findOne({
          id: database.hash(created.id)
        });
        result.id.should.equal(database.hash(created.id));
        result.ledger.should.equal(
          database.hash(ledgerConfiguration.ledger));
        const ledgerNode = result.ledgerNode;
        ledgerNode.id.should.equal(created.id);
        ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
        ledgerNode.owner.should.equal(actor.id);
        ledgerNode.storage.should.be.an('object');
        ledgerNode.storage.id.should.be.a('string');
        ledgerNode.storage.plugin.should.equal('mongodb');
        const meta = result.meta;
        meta.created.should.be.a('number');
      });
      it('should create a ledger with a different owner', async () => {
        const ledgerConfiguration = signedConfig;
        const created = await brLedgerNode.add(
          actor, {
            ledgerConfiguration,
            owner: mockData.identities.regularUser.identity.id
          });
        expect(created).to.be.ok;
        const result = await database.collections.ledgerNode.findOne({
          id: database.hash(created.id)
        });
        result.id.should.equal(database.hash(created.id));
        result.ledger.should.equal(
          database.hash(ledgerConfiguration.ledger));
        const ledgerNode = result.ledgerNode;
        ledgerNode.id.should.equal(created.id);
        ledgerNode.ledger.should.equal(ledgerConfiguration.ledger);
        ledgerNode.owner.should.equal(
          mockData.identities.regularUser.identity.id);
        ledgerNode.storage.should.be.an('object');
        ledgerNode.storage.id.should.be.a('string');
        ledgerNode.storage.plugin.should.equal('mongodb');
        const meta = result.meta;
        meta.created.should.be.a('number');
      });
      it('returns error if invalid storage plugin is specified', async () => {
        const ledgerConfiguration = signedConfig;
        let ledgerNode;
        let err;
        try {
          ledgerNode = await brLedgerNode.add(
            actor, {storage: uuid(), ledgerConfiguration});
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(ledgerNode).not.to.be.ok;
        err.name.should.equal('NotFoundError');
      });
    }); // end admin as actor
  }); // end create API
  describe('get API', () => {
    beforeEach(async () => {
      helpers.removeCollections(['ledger', 'ledgerNode']);
    });
    describe('regularUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(async () => {
        ledgerConfiguration = signedConfig;
        const {id} = mockData.identities.regularUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('gets a ledger with no owner', async () => {
        const created = await brLedgerNode.add(
          actor, {ledgerConfiguration});
        const result = await brLedgerNode.get(actor, created.id);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;
      });
      it('gets a ledger with actor as owner', async () => {
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        const result = await brLedgerNode.get(actor, created.id);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;
      });
      it('returns PermissionDenied if actor not ledger owner', async () => {
        const someOwner = uuid();
        const created = await brLedgerNode.add(
          null, {owner: someOwner, ledgerConfiguration});
        let result;
        let err;
        try {
          result = await brLedgerNode.get(
            actor, created.id, {owner: someOwner});
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(result).not.to.be.ok;
        err.name.should.equal('PermissionDenied');
      });
      it('returns NotFound on a non-exsistent ledger', async () => {
        const unknownLedger = 'did:v1:' + uuid();
        let result;
        let err;
        try {
          result = await brLedgerNode.get(actor, unknownLedger);
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(result).not.to.be.ok;
        err.name.should.equal('NotFound');
        err.details.ledger.should.equal(unknownLedger);
      });
      it('returns NotFound on a deleted ledger', async () => {
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        await brLedgerNode.remove(actor, created.id);
        let result;
        let err;
        try {
          result = await brLedgerNode.get(actor, ledgerConfiguration.ledger, {
            owner: actor.id
          });
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(result).not.to.be.ok;
        err.name.should.equal('NotFound');
        err.details.ledger.should.equal(ledgerConfiguration.ledger);
      });
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(async () => {
        ledgerConfiguration = signedConfig;
        const {id} = mockData.identities.adminUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('gets a ledger with no owner', async () => {
        const created = await brLedgerNode.add(actor, {ledgerConfiguration});
        const result = await brLedgerNode.get(actor, created.id);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;
      });
      it('gets a ledger with actor as owner', async () => {
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        const result = await brLedgerNode.get(actor, created.id);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;
      });
      it('gets a ledger with a different owner', async () => {
        const created = await brLedgerNode.add(actor, {
          ledgerConfiguration,
          owner: mockData.identities.regularUser.identity.id
        });
        const result = await brLedgerNode.get(actor, created.id);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;
      });
      it('returns NotFound on a non-exsistent ledger', async () => {
        const unknownLedger = 'did:v1:' + uuid();
        let result;
        let err;
        try {
          result = await brLedgerNode.get(actor, unknownLedger);
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(result).not.to.be.ok;
        err.name.should.equal('NotFound');
        err.details.ledger.should.equal(unknownLedger);
      });
      it('returns NotFound on a deleted ledger', async () => {
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        await brLedgerNode.remove(actor, created.id);
        let result;
        let err;
        try {
          result = await brLedgerNode.get(
            actor, ledgerConfiguration.ledger, {owner: actor.id});
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(result).not.to.be.ok;
        err.name.should.equal('NotFound');
        err.details.ledger.should.equal(ledgerConfiguration.ledger);
      });
    }); // end adminUser as actor
    describe('null as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(async () => {
        ledgerConfiguration = signedConfig;
        const {id} = mockData.identities.adminUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('gets a ledger with no owner', async () => {
        const ledgerNode = await brLedgerNode.add(actor, {ledgerConfiguration});
        let err;
        let result;
        try {
          result = await brLedgerNode.get(null, ledgerNode.id);
        } catch(error) {
          err = error;
        }
        assertNoError(err);
        assertNoError(err);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;
      });
      it('gets a ledger with no owner from the cache', async () => {
        const ledgerNode = await brLedgerNode.add(actor, {ledgerConfiguration});
        let err;
        let result;
        try {
          result = await brLedgerNode.get(null, ledgerNode.id);
        } catch(error) {
          err = error;
        }
        assertNoError(err);
        assertNoError(err);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;

        err = undefined;
        result = undefined;
        try {
          result = await brLedgerNode.get(null, ledgerNode.id);
        } catch(error) {
          err = error;
        }
        assertNoError(err);
        assertNoError(err);
        expect(result).to.be.ok;
        expect(result.meta).to.exist;
        expect(result.blocks).to.exist;
        expect(result.events).to.exist;
      });
    });
  }); // end get API
  describe('delete API', () => {
    beforeEach(async () => {
      helpers.removeCollections(['ledger', 'ledgerNode']);
    });
    describe('regularUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(async () => {
        ledgerConfiguration = signedConfig;
        const {id} = mockData.identities.regularUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('should delete a ledger if actor is owner', async () => {
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        await brLedgerNode.remove(actor, created.id);
        const result = await database.collections.ledgerNode.findOne({
          id: database.hash(created.id)
        });
        expect(result).to.be.ok;
        result.meta.deleted.should.be.a('number');
      });
      it('returns NotFound on a non-exsistent ledger', async () => {
        const unknownLedger = 'urn:uuid:' + uuid();
        let result;
        let err;
        try {
          result = await brLedgerNode.remove(actor, unknownLedger);
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(result).not.to.be.ok;
        err.name.should.equal('NotFound');
        err.details.ledger.should.equal(unknownLedger);
      });
      it('returns PermissionDenied if actor is not owner', async () => {
        const someOwner = uuid();
        const created = await brLedgerNode.add(
          null, {owner: someOwner, ledgerConfiguration});
        let err;
        try {
          await brLedgerNode.remove(actor, created.id);
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        err.name.should.equal('PermissionDenied');
      });
      it('returns PermissionDenied if there is no owner', async () => {
        const created = await brLedgerNode.add(null, {ledgerConfiguration});
        let err;
        try {
          await brLedgerNode.remove(actor, created.id);
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        err.name.should.equal('PermissionDenied');
      });
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(async () => {
        ledgerConfiguration = signedConfig;
        const {id} = mockData.identities.adminUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('should delete a ledger if actor is owner', async () => {
        const created = await brLedgerNode.add(
          actor, {owner: actor.id, ledgerConfiguration});
        await brLedgerNode.remove(actor, created.id);
        const result = await database.collections.ledgerNode.findOne({
          id: database.hash(created.id)
        });
        expect(result).to.be.ok;
        result.meta.deleted.should.be.a('number');
      });
      it('should delete a ledger with a different owner', async () => {
        const created = await brLedgerNode.add(actor, {
          ledgerConfiguration,
          owner: mockData.identities.regularUser.identity.id
        });
        await brLedgerNode.remove(actor, created.id);
        const result = await database.collections.ledgerNode.findOne({
          id: database.hash(created.id)
        });
        expect(result).to.be.ok;
        result.meta.deleted.should.be.a('number');
      });
      it('returns NotFound on a non-exsistent ledger', async () => {
        const unknownLedger = 'urn:uuid:' + uuid();
        let result;
        let err;
        try {
          result = await brLedgerNode.remove(actor, unknownLedger);
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        expect(result).not.to.be.ok;
        err.name.should.equal('NotFound');
        err.details.ledger.should.equal(unknownLedger);
      });
      it('returns PermissionDenied if there is no owner', async () => {
        const created = await brLedgerNode.add(null, {ledgerConfiguration});
        let err;
        try {
          await brLedgerNode.remove(actor, created.id);
        } catch(e) {
          err = e;
        }
        expect(err).to.be.ok;
        err.name.should.equal('PermissionDenied');
      });
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
      before(async () => {
        ledgerConfiguration = signedConfig;
        const {id} = mockData.identities.regularUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('iterates over public ledgers', async function() {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        for(let i = 0; i < 10; ++i) {
          const created = await brLedgerNode.add(
            actor, {ledgerConfiguration});
          expect(created).to.be.ok;
          testLedgers.push(created.id);
        }
        const iterator = await brLedgerNode.getNodeIterator(actor);
        expect(iterator).to.be.ok;
        for(const promise of iterator) {
          const ledgerNode = await promise;
          iteratorLedgers.push(ledgerNode.id);
        }
        iteratorLedgers.should.have.same.members(testLedgers);
      });
      // FIXME: https://github.com/digitalbazaar/bedrock-ledger-node/issues/14
      it.skip('iterates owned public/private ledgers', async function() {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 public ledgers
        for(let i = 0; i < 5; ++i) {
          const created = await brLedgerNode.add(actor, {
            ledgerConfiguration,
            owner: actor.id
          });
          expect(created).to.be.ok;
          testLedgers.push(created.id);
        }
        for(let i = 0; i < 3; ++i) {
          const created = await brLedgerNode.add(null, {ledgerConfiguration});
          expect(created).to.be.ok;
          testLedgers.push(created.id);
        }
        const iterator = await brLedgerNode.getNodeIterator(actor);
        expect(iterator).to.be.ok;
        for(const promise of iterator) {
          const ledgerNode = await promise;
          iteratorLedgers.push(ledgerNode.id);
        }
        iteratorLedgers.should.have.same.members(testLedgers);
      });
      // FIXME: https://github.com/digitalbazaar/bedrock-ledger-node/issues/14
      it.skip('iterator only returns ledgers owned by actor', async function() {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        for(let i = 0; i < 5; ++i) {
          const created = await brLedgerNode.add(actor, {
            ledgerConfiguration,
            owner: actor.id
          });
          expect(created).to.be.ok;
          testLedgers.push(created.id);
        }
        for(let i = 0; i < 3; ++i) {
          await brLedgerNode.add(null, {
            ledgerConfiguration,
            owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
          });
        }
        const iterator = await brLedgerNode.getNodeIterator(actor);
        expect(iterator).to.be.ok;
        for(const promise of iterator) {
          const ledgerNode = await promise;
          iteratorLedgers.push(ledgerNode.id);
        }
        iteratorLedgers.should.have.same.members(testLedgers);
      });
      // FIXME: https://github.com/digitalbazaar/bedrock-ledger-node/issues/14
      it.skip('iterator returns ledgers owned by actor and public',
        async function() {
          this.timeout(60000);
          const testLedgers = [];
          const iteratorLedgers = [];
          // create 5 ledgers owned by actor and 3 owned by another identity,
          // and 2 public ledgers
          for(let i = 0; i < 5; ++i) {
            const created = await brLedgerNode.add(actor, {
              ledgerConfiguration,
              owner: actor.id
            });
            expect(created).to.be.ok;
            testLedgers.push(created.id);
          }
          for(let i = 0; i < 3; ++i) {
            await brLedgerNode.add(null, {
              ledgerConfiguration,
              owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
            });
          }
          for(let i = 0; i < 2; ++i) {
            const created = await brLedgerNode.add(null, {ledgerConfiguration});
            expect(created).to.be.ok;
            testLedgers.push(created.id);
          }
          const iterator = await brLedgerNode.getNodeIterator(actor);
          expect(iterator).to.be.ok;
          for(const promise of iterator) {
            const ledgerNode = await promise;
            iteratorLedgers.push(ledgerNode.id);
          }
          iteratorLedgers.should.have.same.members(testLedgers);
        });
    }); // end regularUser as actor
    describe('adminUser as actor', () => {
      let actor;
      let ledgerConfiguration;
      before(async () => {
        ledgerConfiguration = signedConfig;
        const {id} = mockData.identities.adminUser.identity;
        actor = await brIdentity.getCapabilities({id});
      });
      it('iterates over public ledgers', async function() {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        for(let i = 0; i < 10; ++i) {
          const created = await brLedgerNode.add(actor, {ledgerConfiguration});
          testLedgers.push(created.id);
        }
        const iterator = await brLedgerNode.getNodeIterator(actor);
        expect(iterator).to.be.ok;
        for(const promise of iterator) {
          const ledgerNode = await promise;
          iteratorLedgers.push(ledgerNode.id);
        }
        iteratorLedgers.should.have.same.members(testLedgers);
      });
      it('iterates public + private ledgers owned by actor', async function() {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor and 3 owned by another identity
        // private ledgers owned by actor
        for(let i = 0; i < 5; ++i) {
          const created = await brLedgerNode.add(actor, {
            ledgerConfiguration,
            owner: actor.id
          });
          testLedgers.push(created.id);
        }
        // public ledgers
        for(let i = 0; i < 3; ++i) {
          const created = await brLedgerNode.add(null, {ledgerConfiguration});
          testLedgers.push(created.id);
        }
        const iterator = await brLedgerNode.getNodeIterator(actor);
        expect(iterator).to.be.ok;
        for(const promise of iterator) {
          const ledgerNode = await promise;
          iteratorLedgers.push(ledgerNode.id);
        }
        iteratorLedgers.should.have.same.members(testLedgers);
      });
      it('iterates over all ledgers', async function() {
        this.timeout(60000);
        const testLedgers = [];
        const iteratorLedgers = [];
        // create 5 ledgers owned by actor, 3 owned by another identity,
        // and 3 public ledgers
        for(let i = 0; i < 5; ++i) {
          const created = await brLedgerNode.add(actor, {
            ledgerConfiguration,
            owner: actor.id
          });
          expect(created).to.be.ok;
          testLedgers.push(created.id);
        }
        for(let i = 0; i < 3; ++i) {
          const created = await brLedgerNode.add(null, {
            ledgerConfiguration,
            owner: 'did:v1:a22b5d78-f88b-4172-b19b-8389fa8dd1e3'
          });
          expect(created).to.be.ok;
          testLedgers.push(created.id);
        }
        for(let i = 0; i < 3; ++i) {
          const created = await brLedgerNode.add(null, {ledgerConfiguration});
          expect(created).to.be.ok;
          testLedgers.push(created.id);
        }
        const iterator = await brLedgerNode.getNodeIterator(actor);
        expect(iterator).to.be.ok;
        for(const promise of iterator) {
          const ledgerNode = await promise;
          iteratorLedgers.push(ledgerNode.id);
        }
        iteratorLedgers.should.have.same.members(testLedgers);
      });
    }); // end adminUser as actor
  }); // end getNodeIterator
}); // end Ledger API
