/*!
 * Ledger node blocks management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {callbackify} = require('bedrock').util;

/**
 * The LedgerNodeBlocks class exposes the block management API.
 */
module.exports = class LedgerNodeBlocks {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
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
   * Gets a summary of the latest block from the ledger. Does not include
   * events and operations.
   *
   * @return {Promise} a summary of the latest block from the ledger.
   */
  getLatestSummary() {
    return this.storage.blocks.getLatestSummary();
  }
};
