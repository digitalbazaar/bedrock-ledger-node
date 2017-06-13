/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */

'use strict';

const LedgerNodeBlocks = require('./ledgerNodeBlocks').LedgerNodeBlocks;
const LedgerNodeEvents = require('./ledgerNodeEvents').LedgerNodeEvents;
const LedgerNodeMeta = require('./ledgerNodeMeta').LedgerNodeMeta;

/**
 * Ledger Node class that exposes the blocks, events, and meta APIs.
 */
class LedgerNode {
  constructor(ledgerId) {
    this.meta = new LedgerNodeMeta(this);
    this.blocks = new LedgerNodeBlocks(this);
    this.events = new LedgerNodeEvents(this);
    this.driver = {};
  }
}

module.exports = LedgerNode;
