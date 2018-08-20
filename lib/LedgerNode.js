/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const LedgerNodeBlocks = require('./LedgerNodeBlocks');
const LedgerNodeConfig = require('./LedgerNodeConfig');
const LedgerNodeEvents = require('./LedgerNodeEvents');
const LedgerNodeOperations = require('./LedgerNodeOperations');
const LedgerNodeMeta = require('./LedgerNodeMeta');
const LedgerNodeRecords = require('./LedgerNodeRecords');

/**
 * Ledger Node class that exposes the blocks, events, and meta APIs.
 */
module.exports = class LedgerNode {
  constructor(options) {
    this.id = options.id;
    this.ledger = options.ledger;
    this.consensus = options.consensus;
    this.storage = options.storage;
    this.driver = {};
    this.injector = options.injector;
    const ledgerNode = this;
    this.meta = new LedgerNodeMeta({ledgerNode});
    // this.meta = new LedgerNodeMeta(options.storage.meta, options.consensus);
    this.blocks = new LedgerNodeBlocks({ledgerNode});
    // this.blocks = new LedgerNodeBlocks(
    //   this, options.storage, options.consensus);
    this.config = new LedgerNodeConfig({ledgerNode});
    // this.config = new LedgerNodeConfig(
    //   this, options.storage, options.consensus);
    this.events = new LedgerNodeEvents({ledgerNode});
    // this.events = new LedgerNodeEvents(
    //   this, options.storage, options.consensus);
    this.operations = new LedgerNodeOperations({ledgerNode});
    // this.operations = new LedgerNodeOperations(
    //   this, options.storage, options.consensus);
    this.records = new LedgerNodeRecords({ledgerNode});
    // this.stateMachine = new LedgerNodeStateMachine(
    //   this, options.storage, options.consensus);
  }
};
