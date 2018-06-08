/*!
 * Ledger node state machine management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

/**
 * The LedgerNodeStateMachine class exposes the state machine API.
 */
module.exports = class LedgerNodeStateMachine {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;
  }

  /**
   * Gets an object from the ledger given a objectID and a set of options.
   *
   * objectId - the URI of the object to fetch.
   * callback(err, object) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  get({recordId}, callback) {
    this.storage.stateMachine.get({recordId}, callback);
  }
};
