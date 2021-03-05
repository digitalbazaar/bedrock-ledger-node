/*!
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
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
    this.collection = database.collections[COLLECTION_NAME];
  }

  async add({peer} = {}) {
    // set defaults
    peer = {recommended: false, reputation: 0, sequence: 0, ...peer};
    peer.status = {
      backoffUntil: 0,
      consecutiveFailures: 0,
      lastPullAt: 0,
      lastPushAt: 0,
      requiredBlockHeight: 0,
      ...(peer.status || {})
    };

    const {collection} = this;
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

  async count({minReputation = 0, maxReputation} = {}) {
    const {collection} = this;
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
      'peer.reputation': {$gte: minReputation}
    };
    if(maxReputation !== 0) {
      query['peer.reputation'].$lte = maxReputation;
    }
    return collection.countDocuments(query);
  }

  async get({id} = {}) {
    const {collection} = this;
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

  async getAll({
    minReputation = 0, maxReputation, backoffUntil, maxRequiredBlockHeight,
    sortReputation = -1, sortLastPushAt, maxConsecutiveFailures, limit
  } = {}) {
    const {collection} = this;
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
      'peer.reputation': {$gte: minReputation}
    };
    if(maxReputation !== undefined) {
      query['peer.reputation'].$lte = maxReputation;
    }
    if(backoffUntil !== undefined) {
      query['peer.status.backoffUntil'] = {$lte: backoffUntil};
    }
    if(maxRequiredBlockHeight !== undefined) {
      query['peer.status.requiredBlockHeight'] = {$lte: maxRequiredBlockHeight};
    }
    if(maxConsecutiveFailures !== undefined) {
      query['peer.status.consecutiveFailures'] = {$lte: maxConsecutiveFailures};
    }
    const sort = {'peer.reputation': sortReputation};
    if(sortLastPushAt !== undefined) {
      sort['peer.status.lastPushAt'] = sortLastPushAt;
    }
    const cursor = await collection.find(query, {
      projection: {_id: 0, peer: 1}
    }).sort(sort);
    if(limit !== undefined) {
      cursor.limit(limit);
    }
    const records = await cursor.toArray();

    const peers = records.map(r => r.peer);
    return peers;
  }

  async getRecommended() {
    const {collection} = this;
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
      'peer.recommended': true,
    };
    const records = await collection.find(query, {
      projection: {_id: 0, peer: 1}
    }).toArray();

    const peers = records.map(r => r.peer);
    return peers;
  }

  // gets peers ordered by least recently updated
  async getLRU({
    minReputation = 0, maxReputation,
    backoffUntil = Date.now(), maxRequiredBlockHeight = 0,
    updatedAfter = 0, updatedBefore = Date.now(),
    pushedAfter = 0, pushedBefore = Date.now(),
    limit = 10
  }) {
    const {collection} = this;
    const query = {
      'meta.ledgerNodeId': this.ledgerNodeId,
      'peer.reputation': {$gte: minReputation},
      'peer.status.backoffUntil': {$lte: backoffUntil},
      'peer.status.requiredBlockHeight': {$lte: maxRequiredBlockHeight},
      'meta.updated': {$gt: updatedAfter, $lt: updatedBefore},
      'peer.status.lastPushAt': {$gt: pushedAfter, $lt: pushedBefore}
    };
    if(maxReputation !== undefined) {
      query['peer.reputation'].$lte = maxReputation;
    }
    const sort = {
      'meta.updated': 1
    };
    const records = await collection.find(query, {
      projection: {_id: 0, peer: 1}
    }).sort(sort).limit(limit).toArray();

    const peers = records.map(r => r.peer);
    return peers;
  }

  // peers are permanently deleted, not merely marked as deleted
  async remove({id} = {}) {
    const {collection} = this;
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

  async update({peer, checkSequence = false} = {}) {
    const {collection} = this;

    const query = {
      'peer.id': peer.id,
      'meta.ledgerNodeId': this.ledgerNodeId,
    };
    // if requested, ensure this is a sequential update
    if(checkSequence) {
      query['peer.sequence'] = peer.sequence - 1;
    }

    const result = await collection.updateOne(query, {
      $set: {peer, 'meta.updated': Date.now()}
    });

    if(result.matchedCount !== 1) {
      throw new BedrockError(
        'Could not update peer; peer not found.', 'NotFoundError', {
          httpStatusCode: 404,
          ledgerNodeId: this.ledgerNodeId,
          peerId: peer.id,
          public: true,
        });
    }

    return result.result;
  }

  async updateLastPushAt({
    id, lastPushAt = Date.now(), url, backoffUntil
  } = {}) {
    const {collection} = this;

    const query = {
      'peer.id': id,
      'meta.ledgerNodeId': this.ledgerNodeId,
    };

    const $set = {
      'meta.updated': Date.now(),
      'peer.status.lastPushAt': lastPushAt
    };
    if(backoffUntil !== undefined) {
      $set['peer.status.backoffUntil'] = backoffUntil;
    }
    if(url !== undefined) {
      $set['peer.url'] = url;
    }
    const $inc = {'peer.sequence': 1};

    const result = await collection.updateOne(query, {$set, $inc});

    if(result.matchedCount !== 1) {
      throw new BedrockError(
        'Could not update last push time; peer not found.',
        'NotFoundError', {
          httpStatusCode: 404,
          ledgerNodeId: this.ledgerNodeId,
          peerId: id,
          public: true,
        });
    }

    return result.result;
  }

  // used to advance peers' updated date so that they are not returned
  // in `getLRU` until other peers have are returned by that method
  async markUpdated({ids} = {}) {
    const {collection} = this;
    const query = {
      'peer.id': {$in: [ids]},
      'meta.ledgerNodeId': this.ledgerNodeId
    };
    const $set = {'meta.updated': Date.now()};
    const $inc = {'peer.sequence': 1};
    await collection.updateMany(query, {$set, $inc});
  }
};
