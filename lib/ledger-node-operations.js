/*!
 * Ledger node operations management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const validator = require('./validator');

/**
 * The LedgerNodeOperations class exposes the operation management API.
 */
module.exports = class LedgerNodeOperations {
  constructor(ledgerNode, storage, consensus) {
    this.ledgerNode = ledgerNode;
    this.storage = storage;
    this.consensus = consensus;
  }

  /**
   * Adds an operation to mutate the state of a ledger.
   *
   * operation - the operation to perform.
   * options - a set of options used when adding the operation.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  add(operation, options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }

    const {consensus, ledgerNode} = this;
    this.validate(operation, err => {
      if(err) {
        return callback(err);
      }
      consensus.operations.add(operation, ledgerNode, options, callback);
    });
  }

  /**
   * Validates an operation against the current configuration.
   *
   * operation - the operation to validate.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  validate(operation, callback) {
    const ledgerNode = this.ledgerNode;
    async.auto({
      config: callback => ledgerNode.config.get(callback),
      validate: ['config', (results, callback) => {
        const config = results.config;
        const validatorConfigs = config.operationValidator || [];
        validator.validate(operation, validatorConfigs, callback);
      }]
    }, err => callback(err));
  }
};
