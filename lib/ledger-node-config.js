/*!
 * Ledger node config management class.
 *
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const validator = require('./validator');

/**
 * The LedgerNodeConfig class exposes the config management API.
 */
module.exports = class LedgerNodeConfig {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;
    this.consensus = ledgerNode.consensus;
  }

  /**
   * Submits a new ledgerConfiguration for the ledger. The change will not occur
   * until the current consensus mechanism accepts the ledgerConfiguration
   * and the state machine processes it.
   *
   * ledgerConfiguration - the new ledgerConfiguration for the ledger.
   * [genesis] - boolean - is this genesis config
   * [genesisBlock] - a genesis block for a ledger
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  change({ledgerConfiguration, genesis = false, genesisBlock}, callback) {
    if(!ledgerConfiguration) {
      throw new TypeError('`ledgerConfiguration` is required.');
    }
    const {consensus, ledgerNode} = this;
    this.validate(ledgerConfiguration, err => {
      if(err) {
        return callback(err);
      }
      consensus.config.change(
        {ledgerConfiguration, ledgerNode, genesis, genesisBlock}, callback);
    });
  }

  /**
   * Gets the current ledgerConfiguration for the ledger.
   *
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   ledgerConfiguration - the latest ledgerConfiguration or `null` if none.
   */
  get(callback) {
    this.storage.events.getLatestConfig((err, result) => {
      if(err && err.name === 'NotFoundError') {
        // no config yet
        return callback(null, null);
      }
      if(err) {
        return callback(err);
      }
      callback(null, result.event.ledgerConfiguration);
    });
  }

  /**
   * Validates a ledgerConfiguration.
   *
   * ledgerConfiguration - the ledgerConfiguration to validate.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  validate(ledgerConfiguration, callback) {
    const {ledgerNode} = this;
    async.auto({
      config: callback => ledgerNode.config.get(callback),
      validate: ['config', (results, callback) => {
        // if `results.config` is null, then the config we are validating
        // must be treated as the genesis config, so validate against itself
        const config = results.config || ledgerConfiguration;
        const validatorConfigs = config.ledgerConfigurationValidator || [];
        validator.validate(
          ledgerConfiguration, validatorConfigs, {ledgerNode}, callback);
      }]
    }, err => callback(err));
  }
};
