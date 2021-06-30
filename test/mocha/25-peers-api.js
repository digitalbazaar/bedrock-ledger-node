/*
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const database = require('bedrock-mongodb');
const helpers = require('./helpers');
const mockData = require('./mock.data');
const {util: {uuid}} = bedrock;

let signedConfig;

const COLLECTION_NAME = 'ledgerNode_peer';

describe('Peers API', () => {
  before(async function() {
    await helpers.prepareDatabase(mockData);
    signedConfig = await helpers.signDocument({
      doc: mockData.ledgerConfiguration,
      creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
      privateKeyPem: mockData.groups.authorized.privateKey,
    });
  });
  beforeEach(async function() {
    await helpers.removeCollections(
      ['ledger', 'ledgerNode', 'ledgerNode_peer']);
  });
  describe('regularUser as actor', () => {
    let actor;
    let ledgerNode;
    before(async () => {
      const {id} = mockData.accounts.regularUser.account;
      actor = await brAccount.getCapabilities({id});
      ledgerNode = await brLedgerNode.add(
        actor, {ledgerConfiguration: signedConfig});
    });
    it('LedgerNode peers API exists', async () => {
      should.exist(ledgerNode.peers);
      should.exist(ledgerNode.peers.add);
      ledgerNode.peers.add.should.be.a('function');
      should.exist(ledgerNode.peers.get);
      ledgerNode.peers.get.should.be.a('function');
      should.exist(ledgerNode.peers.getRecommended);
      ledgerNode.peers.getRecommended.should.be.a('function');
      should.exist(ledgerNode.peers.remove);
      ledgerNode.peers.remove.should.be.a('function');
      should.exist(ledgerNode.peers.update);
      ledgerNode.peers.update.should.be.a('function');
    });

    describe('add API', () => {
      it('adds a peer', async () => {
        const testId = `urn:uuid:${uuid()}`;
        const peer = {
          id: testId,
        };
        let result;
        let err;
        try {
          result = await ledgerNode.peers.add({peer});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.have.keys(['_id', 'meta', 'peer']);

        const collection = database.collections[COLLECTION_NAME];
        const findResult = await collection.findOne(
          {'peer.id': testId}, {projection: {_id: 0}});
        should.exist(findResult.meta);
        findResult.meta.should.have.keys(
          ['created', 'updated', 'pulledAfterPush', 'ledgerNodeId']);
        findResult.meta.ledgerNodeId.should.equal(ledgerNode.id);
        should.exist(findResult.peer);
        findResult.peer.should.eql({
          id: testId,
          // these are all defaults that should be set
          recommended: false,
          reputation: 0,
          sequence: 0,
          status: {
            backoffUntil: 0,
            consecutiveFailures: 0,
            lastPullAt: 0,
            lastPushAt: 0,
            requiredBlockHeight: 0
          }
        });
      });
      it('adds a recommended peer', async () => {
        const testId = `urn:uuid:${uuid()}`;
        const peer = {
          id: testId,
          recommended: true,
        };
        let err;
        try {
          await ledgerNode.peers.add({peer});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        const collection = database.collections[COLLECTION_NAME];
        const findResult = await collection.findOne(
          {'peer.id': testId}, {projection: {_id: 0}});
        findResult.peer.should.eql({
          id: testId,
          recommended: true,
          // these are all defaults that should be set
          reputation: 0,
          sequence: 0,
          status: {
            backoffUntil: 0,
            consecutiveFailures: 0,
            lastPullAt: 0,
            lastPushAt: 0,
            requiredBlockHeight: 0
          }
        });
      });
      it('returns DuplicateError for a duplicate peer', async () => {
        const testId = `urn:uuid:${uuid()}`;
        const peer = {
          id: testId,
        };
        let err;
        try {
          await ledgerNode.peers.add({peer});
        } catch(e) {
          err = e;
        }
        assertNoError(err);

        try {
          await ledgerNode.peers.add({peer});
        } catch(e) {
          err = e;
        }
        should.exist(err);
        err.name.should.equal('DuplicateError');
        err.details.should.have.keys(
          ['httpStatusCode', 'public', 'peerId', 'ledgerNodeId']);
        err.details.httpStatusCode.should.equal(409);
        err.details.public.should.equal(true);
        err.details.peerId.should.equal(testId);
        err.details.ledgerNodeId.should.equal(ledgerNode.id);
      });
    }); // end add API

    describe('get API', () => {
      it('gets a peer', async () => {
        const testId = `urn:uuid:${uuid()}`;
        const peer = {id: testId};
        await ledgerNode.peers.add({peer});

        let err;
        let result;
        try {
          result = await ledgerNode.peers.get({id: testId});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.eql({
          id: testId,
          // these are all defaults that should be set
          recommended: false,
          reputation: 0,
          sequence: 0,
          status: {
            backoffUntil: 0,
            consecutiveFailures: 0,
            lastPullAt: 0,
            lastPushAt: 0,
            requiredBlockHeight: 0
          }
        });
      });
      it('returns NonFoundError on an unknown peer', async () => {
        // this ID does not exist
        const testId = `urn:uuid:${uuid()}`;

        let result;
        let err;
        try {
          result = await ledgerNode.peers.get({id: testId});
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('NotFoundError');
        err.details.should.have.keys(
          ['httpStatusCode', 'ledgerNodeId', 'peerId', 'public']);
        err.details.httpStatusCode.should.equal(404);
        err.details.ledgerNodeId.should.equal(ledgerNode.id);
        err.details.peerId.should.equal(testId);
        err.details.public.should.equal(true);
      });
    }); // end get API

    describe('getAll API', () => {
      it('returns zero peers', async () => {
        let result;
        let err;
        try {
          result = await ledgerNode.peers.getAll();
        } catch(e) {
          err = e;
        }
        assertNoError(err);

        result.should.be.an('array');
        result.should.have.length(0);
      });
      it('returns one peer', async () => {
        const testId = `urn:uuid:${uuid()}`;
        await ledgerNode.peers.add({peer: {id: testId}});

        let result;
        let err;
        try {
          result = await ledgerNode.peers.getAll();
        } catch(e) {
          err = e;
        }
        assertNoError(err);

        result.should.be.an('array');
        result.should.have.length(1);
        result[0].should.eql({
          id: testId,
          // these are all defaults that should be set
          recommended: false,
          reputation: 0,
          sequence: 0,
          status: {
            backoffUntil: 0,
            consecutiveFailures: 0,
            lastPullAt: 0,
            lastPushAt: 0,
            requiredBlockHeight: 0
          }
        });
      });
      it('returns four peers', async () => {
        // add one non-recommended peer
        const nonRecommendedId = `urn:uuid:${uuid()}`;
        await ledgerNode.peers.add({peer: {id: nonRecommendedId}});

        // add recommended peers
        const recommendedPeerIds = [];
        for(let i = 0; i < 3; ++i) {
          const id = `urn:uuid:${uuid()}`;
          recommendedPeerIds.push(id);
          await ledgerNode.peers.add({peer: {id, recommended: true}});
        }

        let result;
        let err;
        try {
          result = await ledgerNode.peers.getAll();
        } catch(e) {
          err = e;
        }
        assertNoError(err);

        result.should.be.an('array');
        result.should.have.length(4);
        result.map(r => r.id).should.have.members(
          [nonRecommendedId, ...recommendedPeerIds]);
      });
    }); // end getAll API

    describe('getRecommended API', () => {
      it('returns zero recommended peers', async () => {
        let result;
        let err;
        try {
          result = await ledgerNode.peers.getRecommended();
        } catch(e) {
          err = e;
        }
        assertNoError(err);

        result.should.be.an('array');
        result.should.have.length(0);
      });
      it('returns one recommended peer', async () => {
        // add one non-recommended peer
        const nonRecommendedId = `urn:uuid:${uuid()}`;
        await ledgerNode.peers.add({peer: {id: nonRecommendedId}});
        // add one recommended peer
        const recommendedId = `urn:uuid:${uuid()}`;
        await ledgerNode.peers.add({peer: {
          id: recommendedId, recommended: true}
        });

        let result;
        let err;
        try {
          result = await ledgerNode.peers.getRecommended();
        } catch(e) {
          err = e;
        }
        assertNoError(err);

        result.should.be.an('array');
        result.should.have.length(1);
        result[0].should.eql({
          id: recommendedId,
          recommended: true,
          // these are all defaults that should be set
          reputation: 0,
          sequence: 0,
          status: {
            backoffUntil: 0,
            consecutiveFailures: 0,
            lastPullAt: 0,
            lastPushAt: 0,
            requiredBlockHeight: 0
          }
        });
      });
      it('returns three recommended peers', async () => {
        // add one non-recommended peer
        const nonRecommendedId = `urn:uuid:${uuid()}`;
        await ledgerNode.peers.add({peer: {id: nonRecommendedId}});

        // add recommended peers
        const recommendedPeerIds = [];
        for(let i = 0; i < 3; ++i) {
          const id = `urn:uuid:${uuid()}`;
          recommendedPeerIds.push(id);
          await ledgerNode.peers.add({peer: {id, recommended: true}});
        }

        let result;
        let err;
        try {
          result = await ledgerNode.peers.getRecommended();
        } catch(e) {
          err = e;
        }
        assertNoError(err);

        result.should.be.an('array');
        result.should.have.length(3);
        result.map(r => r.id).should.have.members(recommendedPeerIds);
      });
    }); // end getRecommended API

    describe('remove API', () => {
      it('removes a peer', async () => {
        const testId = `urn:uuid:${uuid()}`;
        const peer = {id: testId};
        await ledgerNode.peers.add({peer});

        let err;
        let result;
        try {
          result = await ledgerNode.peers.remove({id: testId});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.eql({success: true});

        // confirm that the peer no longer exists in the database
        const collection = database.collections[COLLECTION_NAME];
        const findResult = await collection.findOne(
          {'peer.id': testId}, {projection: {_id: 0}});
        should.not.exist(findResult);
      });
      it('returns NotFoundError on an unknown peer', async () => {
        // this id does not exist
        const testId = `urn:uuid:${uuid()}`;

        let err;
        let result;
        try {
          result = await ledgerNode.peers.remove({id: testId});
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('NotFoundError');
        err.details.should.have.keys(
          ['httpStatusCode', 'ledgerNodeId', 'peerId', 'public']);
        err.details.httpStatusCode.should.equal(404);
        err.details.ledgerNodeId.should.equal(ledgerNode.id);
        err.details.peerId.should.equal(testId);
        err.details.public.should.equal(true);
      });
    }); // end remove API

    describe('update API', () => {
      it('updates a peer', async () => {
        const testId = `urn:uuid:${uuid()}`;
        const peer = {id: testId};
        await ledgerNode.peers.add({peer});

        // this 1ms sleep is needed on fast machines
        await bedrock.util.delay(1);

        let result;
        let err;
        try {
          result = await ledgerNode.peers.update({peer: {
            id: testId,
            recommended: true,
          }});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.have.keys(['n', 'nModified', 'ok']);
        result.nModified.should.equal(1);

        const collection = database.collections[COLLECTION_NAME];
        const findResult = await collection.findOne(
          {'peer.id': testId}, {projection: {_id: 0}});
        findResult.peer.should.eql({
          id: testId,
          recommended: true,
          // these are all defaults that should be set
          reputation: 0,
          sequence: 0,
          status: {
            backoffUntil: 0,
            consecutiveFailures: 0,
            lastPullAt: 0,
            lastPushAt: 0,
            requiredBlockHeight: 0
          }
        });
        // meta.updated should have been updated
        findResult.meta.created.should.be.lt(findResult.meta.updated);
      });
      it('returns NotFoundError on an unknown peer', async () => {
        // this id does not exist
        const testId = `urn:uuid:${uuid()}`;

        let result;
        let err;
        try {
          result = await ledgerNode.peers.update({peer: {
            id: testId,
            recommended: true,
          }});
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('NotFoundError');
        err.details.should.have.keys(
          ['httpStatusCode', 'ledgerNodeId', 'peerId', 'public']);
        err.details.httpStatusCode.should.equal(404);
        err.details.ledgerNodeId.should.equal(ledgerNode.id);
        err.details.peerId.should.equal(testId);
        err.details.public.should.equal(true);
      });
    }); // end update API
  });
});
