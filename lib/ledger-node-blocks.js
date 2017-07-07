/*!
 * Ledger node blocks management class.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * The LedgerNodeBlocks class exposes the block management API.
 */
module.exports = class LedgerNodeBlocks {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Gets a block from the ledger given a blockID and a set of options.
   *
   * blockId - the URI of the block to fetch.
   * options - a set of options used when retrieving the block.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  get(blockId, options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.storage.blocks.get(blockId, options, callback);
  }

  /**
   * Gets the latest blocks from the ledger.
   *
   * options - a set of options used when retrieving the blocks.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  getLatest(options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.storage.blocks.getLatest(options, callback);
  }
};
