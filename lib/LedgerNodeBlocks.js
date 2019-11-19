/*!
 * Ledger node blocks management class.
 *
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config, util: {callbackify}} = bedrock;
const LRU = require('lru-cache');

let blockHeightCache;

bedrock.events.on('bedrock.start', () => {
  blockHeightCache = new LRU({
    // the max number of items in the cache
    max: 500,
    maxAge: config.ledger.cache.latestBlockHeightTtl,
  });
});

// update the cache when a new block is created
bedrock.events.on(
  'bedrock-ledger-storage.block.add', ({blockHeight, ledgerNodeId}) => {
    blockHeightCache.set(ledgerNodeId, blockHeight);
  });

/**
 * The LedgerNodeBlocks class exposes the block management API.
 */
module.exports = class LedgerNodeBlocks {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.ledgerNodeId = ledgerNode.id;
    this.storage = ledgerNode.storage;

    // FIXME: temporary backwards compatible callback support
    this.get = callbackify(this.get.bind(this));
    this.getGenesis = callbackify(this.getGenesis.bind(this));
    this.getLatest = callbackify(this.getLatest.bind(this));
  }

  /**
   * Gets a block from the ledger given a block ID and a set of options.
   *
   * @param blockId - the URI of the block to fetch.
   * @param [consensus] `false` to retrieve a non-consensus block.
   *
   * @return {Promise} the specified block.
   */
  get({blockId, consensus = true}) {
    return this.storage.blocks.get({blockId, consensus});
  }

  /**
   * Gets the genesis block from the ledger.
   *
   * @return {Promise} the genesis block.
   */
  getGenesis() {
    return this.storage.blocks.getGenesis();
  }

  /**
   * Gets the latest block from the ledger. Includes all events and operations.
   *
   * @return {Promise} latest block from the ledger.
   */
  getLatest() {
    return this.storage.blocks.getLatest();
  }

  /**
   * Gets the latest block height for the ledger.
   *
   * @param {object} [options] - The options to use.
   * @param {Boolean} [options.useCache=false] - Use the in memory cache.
   *
   * @return {Promise<Number>} the latest block height for the ledger.
   */
  async getLatestBlockHeight({useCache = false} = {}) {
    const {ledgerNodeId} = this;
    let basisBlockHeight;
    if(useCache) {
      basisBlockHeight = blockHeightCache.get(ledgerNodeId);
      if(basisBlockHeight !== undefined) {
        return basisBlockHeight;
      }
    }
    // cache miss, get block height from the database
    const blockHeight = await this.storage.blocks.getLatestBlockHeight();
    blockHeightCache.set(ledgerNodeId, blockHeight);
    return blockHeight;
  }

  /**
   * Gets a summary of the latest block from the ledger. Does not include
   * events and operations.
   *
   * @return {Promise} a summary of the latest block from the ledger.
   */
  getLatestSummary() {
    return this.storage.blocks.getLatestSummary();
  }
};
