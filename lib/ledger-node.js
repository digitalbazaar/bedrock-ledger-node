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
    this.meta = new LedgerNodeMeta(this);
    this.blocks = new LedgerNodeBlocks(this);
    this.events = new LedgerNodeEvents(this);
    this.driver = {};
  }
}

module.exports = LedgerNode;
