/*!
 * Ledger node operations management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const validator = require('./validator');
const {callbackify} = require('bedrock').util;

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
    const {ledgerNode} = this;
    const config = await ledgerNode.config.get();
    const validatorConfigs = config.operationValidator || [];
    return validator.validate(operation, validatorConfigs, {ledgerNode});
  }
};
