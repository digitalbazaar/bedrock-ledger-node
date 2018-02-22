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
  constructor(ledgerNode, storage, consensus) {
    this.ledgerNode = ledgerNode;
    this.storage = storage;
    this.consensus = consensus;
  }

  /**
   * Submits a new ledgerConfiguration for the ledger. The change will not occur
   * until the current consensus mechanism accepts the ledgerConfiguration
   * and the state machine processes it.
   *
   * ledgerConfiguration - the new ledgerConfiguration for the ledger.
   * options - a set of options used.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  change(ledgerConfiguration, options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }

    const {consensus, ledgerNode} = this;
    this.validate(ledgerConfiguration, err => {
      if(err) {
        return callback(err);
      }
      consensus.config.change(
        ledgerConfiguration, ledgerNode, options, callback);
    });
  }

  /**
   * Gets the current ledgerConfiguration for the ledger.
   *
   * options - a set of options used when retrieving the ledgerConfiguration.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   ledgerConfiguration - the latest ledgerConfiguration or `null` if none.
   */
  get(options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.storage.events.getLatestConfig((err, result) => {
      if(err) {
        return callback(err);
      }
      if(!result.event) {
        // no config yet
        return callback(null, null);
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
    const ledgerNode = this.ledgerNode;
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
