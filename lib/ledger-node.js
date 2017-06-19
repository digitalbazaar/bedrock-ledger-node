/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */

'use strict';

const LedgerNodeBlocks = require('./ledger-node-blocks');
const LedgerNodeEvents = require('./ledger-node-events');
const LedgerNodeMeta = require('./ledger-node-meta');

/**
 * Ledger Node class that exposes the blocks, events, and meta APIs.
 */
class LedgerNode {
  constructor(options) {
    this.id = options.id;
    this.meta = new LedgerNodeMeta(options.storage.meta, options.consensus);
    this.blocks = new LedgerNodeBlocks(
      options.storage.blocks, options.consensus);
    this.events = new LedgerNodeEvents(
      options.storage.events, options.consensus);
    this.storage = options.storage;
    this.driver = {};
  }
}

module.exports = LedgerNode;
