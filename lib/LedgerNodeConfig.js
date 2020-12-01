/*!
 * Ledger node config management class.
 *
 * Copyright (c) 2018-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const validator = require('./validator');

/**
 * The LedgerNodeConfig class exposes the config management API.
 */
module.exports = class LedgerNodeConfig {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;
    this.consensus = ledgerNode.consensus;
    this.validate = validator.validate;
  }

  /**
   * Submits a new ledgerConfiguration for the ledger. The change will not occur
   * until the current consensus mechanism accepts the ledgerConfiguration
   * and the state machine processes it.
   *
   * @param ledgerConfiguration - the new ledgerConfiguration for the ledger.
   * @param [genesis] - boolean - is this genesis config
   * @param [genesisBlock] - a genesis block for a ledger
   *
   * @return a Promise that resolves once the operation completes.
   */
  async change({ledgerConfiguration, genesis = false, genesisBlock}) {
    if(!ledgerConfiguration) {
      throw new TypeError('`ledgerConfiguration` is required.');
    }
    if(typeof ledgerConfiguration !== 'object') {
      throw new TypeError('`ledgerConfiguration` should be an object.');
    }

    const {consensus, ledgerNode} = this;
    let basisBlockHeight;

    // the genesis configuration was validated before the ledger node was
    // created, there is no need to validate again
    if(!genesis) {
      const summary = await ledgerNode.blocks.getLatestSummary();
      basisBlockHeight = summary.eventBlock.block.blockHeight;
      const result = await validator.validate(
        {basisBlockHeight, ledgerConfiguration, ledgerNode});
      if(!result.valid) {
        throw result.error;
      }
    }
    return consensus.config.change({
      basisBlockHeight, ledgerConfiguration, ledgerNode, genesis,
      genesisBlock
    });
  }

  /**
   * Gets the current ledgerConfiguration for the ledger.
   *
   * @return {Promise} resolves to the latest ledgerConfiguration or
   *   `null` if none.
   */
  async get({blockHeight} = {}) {
    try {
      let result;
      if(blockHeight === undefined) {
        result = await this.storage.events.getLatestConfig();
      } else {
        result = await this.storage.events.getEffectiveConfig({blockHeight});
      }
      return result.event.ledgerConfiguration;
    } catch(e) {
      if(e.name === 'NotFoundError') {
        // no config yet
        return null;
      }
      throw e;
    }
  }
};
