/*!
 * Ledger node operations management class.
 *
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const validator = require('./validator');

/**
 * The LedgerNodeOperations class exposes the operation management API.
 */
module.exports = class LedgerNodeOperations {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.consensus = ledgerNode.consensus;
    this.validate = validator.validate;
    this.storage = ledgerNode.storage;
  }

  /**
   * Adds an operation to mutate the state of a ledger.
   *
   * @param operation - the operation to perform.
   *
   * @return {Promise} resolves once the operation completes.
   */
  async add({operation}) {
    if(!operation) {
      throw new TypeError('`operation` is required.');
    }
    const {consensus, ledgerNode} = this;
    const basisBlockHeight = await ledgerNode.blocks.getLatestBlockHeight();

    const result = await validator.validate(
      {basisBlockHeight, ledgerNode, operation});
    if(!result.valid) {
      throw result.error;
    }
    const meta = {basisBlockHeight};
    return consensus.operations.add({ledgerNode, meta, operation});
  }

  /**
   * Returns a boolean indicating whether an operation with the specified
   * `recordId` exists or not.
   *
   * @param recordId - the URI of the object to test for presence.
   *
   * @return {Promise} resolves with a boolean indicating existence.
   */
  async exists({recordId}) {
    if(!(recordId && typeof recordId === 'string')) {
      throw new TypeError('`recordId` must be a string');
    }

    return this.storage.operations.exists({recordId});
  }
};
