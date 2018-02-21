/*!
 * Ledger node blocks management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

/**
 * The LedgerNodeBlocks class exposes the block management API.
 */
module.exports = class LedgerNodeBlocks {
  constructor(ledgerNode, storage) {
    this.ledgerNode = ledgerNode;
    this.storage = storage;
  }

  /**
   * Gets a block from the ledger given a blockID and a set of options.
   *
   * @param blockId - the URI of the block to fetch.
   * @param [consensus] `false` to retrieve a non-consensus block.
   * @param callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  get({blockId, consensus = true}, callback) {
    this.storage.blocks.get({blockId, consensus}, callback);
  }

  /**
   * Gets the genesis block from the ledger.
   *
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  getGenesis(callback) {
    this.storage.blocks.getGenesis(callback);
  }

  /**
   * Gets the latest blocks from the ledger.
   *
   * @param callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  getLatest(callback) {
    this.storage.blocks.getLatest(callback);
  }
};
