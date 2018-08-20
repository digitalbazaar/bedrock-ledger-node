/*!
 * Ledger node config management class.
 *
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const validator = require('./validator');
const {callbackify} = require('bedrock').util;
const {promisify} = require('util');

/**
 * The LedgerNodeConfig class exposes the config management API.
 */
module.exports = class LedgerNodeConfig {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;
    this.consensus = ledgerNode.consensus;

    // FIXME: temporary backwards compatible callback support
    this.change = callbackify(this.change.bind(this));
    this.get = callbackify(this.get.bind(this));
    this.validate = callbackify(this.validate.bind(this));
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
    await this.validate(ledgerConfiguration);

    const {consensus, ledgerNode} = this;
    // FIXME: remove once consensus methods are updated
    await promisify(consensus.config.change)(
      {ledgerConfiguration, ledgerNode, genesis, genesisBlock});
  }

  /**
   * Gets the current ledgerConfiguration for the ledger.
   *
   * @return a Promise that resolves to the latest ledgerConfiguration or
   *   `null` if none.
   */
  async get() {
    try {
      const result = await this.storage.events.getLatestConfig();
      return result.event.ledgerConfiguration;
    } catch(e) {
      if(e.name === 'NotFoundError') {
        // no config yet
        return null;
      }
      throw e;
    }
  }

  /**
   * Validates a ledgerConfiguration.
   *
   * @param ledgerConfiguration - the ledgerConfiguration to validate.
   *
   * @return a Promise that resolves once the validation completes.
   */
  async validate(ledgerConfiguration) {
    const {ledgerNode} = this;

    // if `results.config` is null, then the config we are validating
    // must be treated as the genesis config, so validate against itself
    const config = (await ledgerNode.config.get()) || ledgerConfiguration;
    const validatorConfigs = config.ledgerConfigurationValidator || [];
    await validator.validate(
      ledgerConfiguration, validatorConfigs, {ledgerNode});
  }
};
