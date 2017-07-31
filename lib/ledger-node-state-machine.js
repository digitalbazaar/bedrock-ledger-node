/*!
 * Ledger node state machine management class.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * The LedgerNodeStateMachine class exposes the state machine API.
 */
module.exports = class LedgerNodeStateMachine {
  constructor(ledgerNode, storage, consensus) {
    this.ledgerNode = ledgerNode;
    this.storage = storage;
    this.consensus = consensus;
  }

  /**
   * Gets an object from the ledger given a objectID and a set of options.
   *
   * objectId - the URI of the object to fetch.
   * options - a set of options used when retrieving the object.
   * callback(err, object) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  get(objectId, options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.storage.stateMachine.get(objectId, options, callback);
  }
};
