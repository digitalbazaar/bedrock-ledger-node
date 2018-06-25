/*!
 * Ledger node operations management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const validator = require('./validator');
const bedrock = require('bedrock');
const {config: {constants}, util: {BedrockError}} = bedrock;
const {validate} = require('bedrock-validation');

const validateContext = context => {
  if(!context || !(typeof context === 'string' || Array.isArray(context))) {
    throw new BedrockError('Operation context must be a string or an array.',
      'TypeError');
  }
  if(typeof context === 'string' &&
    context !== constants.WEB_LEDGER_CONTEXT_V1_URL) {
    throw new BedrockError('Operation context must be... ' +
      constants.WEB_LEDGER_CONTEXT_V1_URL, 'SyntaxError', {context});
  }
  if(Array.isArray(context) &&
     context[0] !== constants.WEB_LEDGER_CONTEXT_V1_URL) {
    throw new BedrockError('Operation context must contain ' +
      constants.WEB_LEDGER_CONTEXT_V1_URL + ' as the first element.',
      'SyntaxError', {context});
  }
};

const validateOperation = op => validate('webledger-validator.operation', op);

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
   *   err - A BedrockError if an error occurred, null otherwise.
   */
  add({operation}, callback) {
    if(!operation) {
      throw new BedrockError('`operation` is required.');
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
   *   err - A BedrockError if an error occurred, null otherwise.
   */
  validate(operation, callback) {
    if(!(operation && typeof operation === 'object')) {
      return callback(
        new BedrockError('Operation must be an object.', 'TypeError'));
    }
    const {ledgerNode} = this;
    async.auto({
      config: callback => ledgerNode.config.get(callback),
      validate: ['config', (results, callback) => {
        let validatorConfigs;

        try {
          const config = results.config;
          const context = operation['@context'];
          validatorConfigs = config.operationValidator || [];
          validateContext(context);
          if(!(operation.type in VALIDATORS)) {
            throw new BedrockError(`Operation ${operation.type} is not ` +
              'supported', 'NotSupportedError');
          }
          const validation = VALIDATORS[operation.type](operation);
          if(!validation.valid) {
            throw validation.error;
          }
        } catch(e) {
          return callback(e);
        }

        validator.validate(operation, validatorConfigs, {ledgerNode}, callback);
      }]
    }, err => callback(err));
  }
};
