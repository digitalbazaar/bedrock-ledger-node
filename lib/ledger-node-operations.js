/*!
 * Ledger node operations management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const validator = require('./validator');
const bedrock = require('bedrock');
const {config: {constants}} = bedrock;
const validate = require('bedrock-validation').validate;

const validateContext = (context) => {
  if(!context) {
    throw new Error('Operation must include a context.');
  }
  if(!(typeof context === 'string' || Array.isArray(context))) {
    throw new Error('Operation context must be a string or an array.');
  }
  if(typeof context === 'string'
      && context !== constants.WEB_LEDGER_CONTEXT_V1_URL) {
    throw new Error('Operation does not contain the WebLedgerContext.' +
                    `'@context': ${context}`);
  }
  if(Array.isArray(context)
     && context !== constants.WEB_LEDGER_CONTEXT_V1_URL[0]) {
    throw new Error('Operation must contain WebLedgerContext as the' +
                    `first entry. '@context': ${context}`);
  }
};

const validateOperation = (op) => validate('webledger-validator.operation', op);

const VALIDATORS = {
  CreateWebLedgerRecord: validateOperation,
  UpdateWebLedgerRecord: validateOperation
};

/**
 * The LedgerNodeOperations class exposes the operation management API.
 */
module.exports = class LedgerNodeOperations {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.consensus = ledgerNode.consensus;
  }

  /**
   * Adds an operation to mutate the state of a ledger.
   *
   * operation - the operation to perform.
   * options - a set of options used when adding the operation.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  add({operation}, callback) {
    if(!operation) {
      throw new TypeError('`operation` is required.');
    }
    const {consensus, ledgerNode} = this;
    this.validate(operation, err => {
      if(err) {
        return callback(err);
      }
      consensus.operations.add({ledgerNode, operation}, callback);
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
    const {ledgerNode} = this;
    async.auto({
      config: callback => ledgerNode.config.get(callback),
      validate: ['config', (results, callback) => {
        const config = results.config;
        const context = operation['@context'];
        const validatorConfigs = config.operationValidator || [];

        validateContext(context);

        if(!(operation.type in VALIDATORS)) {
          throw new Error(`Operation ${operation.type} is not supported.`);
        }

        const validation = VALIDATORS[operation.type](operation);
        if(!validation.valid) {
          throw validation.error;
        }

        validator.validate(operation, validatorConfigs, {ledgerNode}, callback);
      }]
    }, err => callback(err));
  }
};
