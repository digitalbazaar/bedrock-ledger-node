/*!
 * Ledger node operations management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {BedrockError, callbackify} = require('bedrock').util;
const {constants} = require('bedrock').config;
const {validate} = require('bedrock-validation');
const validator = require('./validator');

/**
 * The LedgerNodeOperations class exposes the operation management API.
 */
module.exports = class LedgerNodeOperations {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.consensus = ledgerNode.consensus;

    // FIXME: temporary backwards compatible callback support
    this.add = callbackify(this.add.bind(this));
    this.validate = callbackify(this.validate.bind(this));
  }

  /**
   * Adds an operation to mutate the state of a ledger.
   *
   * @param operation - the operation to perform.
   * @param options - a set of options used when adding the operation.
   *
   * @return a Promise that resolves once the operation completes.
   */
  async add({operation}) {
    if(!operation) {
      throw new TypeError('`operation` is required.');
    }
    const {consensus, ledgerNode} = this;
    await this.validate(operation);
    return consensus.operations.add({ledgerNode, operation});
  }

  /**
   * Validates an operation against the current configuration.
   *
   * @param operation - the operation to validate.
   *
   * @return a Promise that resolves once the operation completes.
   */
  async validate(operation) {
    if(!(operation && typeof operation === 'object')) {
      throw new TypeError('Operation must be an object.');
    }

    _validateOperation(operation);

    const {ledgerNode} = this;
    const config = await ledgerNode.config.get();
    const validatorConfigs = config.operationValidator || [];

    return validator.validate(operation, validatorConfigs, {ledgerNode});
  }
};

function _validateOperation(operation) {
  const context = operation['@context'];
  _validateContext(context);
  const validation = validate('webledger-validator.operation', operation);
  if(!validation.valid) {
    throw validation.error;
  }
}

function _validateContext(context) {
  const wlContextUrl = constants.WEB_LEDGER_CONTEXT_V1_URL;
  if(typeof context === 'string' && context !== wlContextUrl) {
    throw new BedrockError(
      `Operation context must be "${wlContextUrl}"`,
      'SyntaxError', {context});
  }
  if(Array.isArray(context) && context[0] !== wlContextUrl) {
    throw new BedrockError(
      `Operation context must contain "${wlContextUrl}" as the first element.`,
      'SyntaxError', {context});
  }
}
