/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const {util: {BedrockError}} = bedrock;
const {COLLECTION_NAME} = require('./ledgerNodePeerCollection');

/**
 * The LedgerNodePeers class exposes peer information.
 */
module.exports = class LedgerNodePeers {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.ledgerNodeId = ledgerNode.id;
  }

  async add({peer}) {
    const collection = database.collections[COLLECTION_NAME];
    const now = Date.now();
    const peerRecord = {
      meta: {
        created: now,
        ledgerNodeId: this.ledgerNodeId,
        updated: now
      },
      peer,
    };
    let result;
    try {
      result = await collection.insertOne(peerRecord);
    } catch(e) {
      if(database.isDuplicateError(e)) {
        throw new BedrockError(
          'Duplicate peer.',
          'DuplicateError', {
            httpStatusCode: 409,
            public: true,
            ledgerNodeId: this.ledgerNodeId,
            peerId: peer.id,
          }, e);
      }
      // throw all other error types
      throw e;
    }

    return result.ops[0];
  }

  async get({id}) {
    const collection = database.collections[COLLECTION_NAME];
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
      'peer.id': id,
    };
    const result = await collection.findOne(query, {
      projection: {_id: 0, peer: 1}
    });

    if(!result) {
      throw new BedrockError('Peer not found.', 'NotFoundError', {
        httpStatusCode: 404,
        ledgerNodeId: this.ledgerNodeId,
        peerId: id,
        public: true,
      });
    }

    return result.peer;
  }

  async getAll() {
    const collection = database.collections[COLLECTION_NAME];
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
    };
    const result = await collection.find(query, {
      projection: {_id: 0, peer: 1}
    }).toArray();

    const peers = result.map(r => r.peer);

    return peers;
  }

  async getRecommended() {
    const collection = database.collections[COLLECTION_NAME];
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
      'peer.recommended': true,
    };
    const result = await collection.find(query, {
      projection: {_id: 0, peer: 1}
    }).toArray();

    const peers = result.map(r => r.peer);

    return peers;
  }

  // peers are permanently deleted, not marked as deleted
  async remove({id}) {
    const collection = database.collections[COLLECTION_NAME];
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
      'peer.id': id,
    };
    const result = await collection.deleteOne(query);

    if(result.deletedCount === 0) {
      throw new BedrockError('Peer not found.', 'NotFoundError', {
        httpStatusCode: 404,
        ledgerNodeId: this.ledgerNodeId,
        peerId: id,
        public: true,
      });
    }

    return {success: true};
  }

  async update({peer}) {
    const collection = database.collections[COLLECTION_NAME];

    const query = {
      'peer.id': peer.id,
      'meta.ledgerNodeId': this.ledgerNodeId,
    };

    const result = await collection.updateOne(query, {
      $set: {peer, 'meta.updated': Date.now()}
    });

    if(result.matchedCount !== 1) {
      throw new BedrockError('Peer not found.', 'NotFoundError', {
        httpStatusCode: 404,
        ledgerNodeId: this.ledgerNodeId,
        peerId: peer.id,
        public: true,
      });
    }

    return result.result;
  }
};
