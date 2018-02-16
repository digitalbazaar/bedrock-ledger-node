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

    // TODO: need to check to see if stateMachine is up-to-date
    // TODO: if not, need to run StateMutators based on config -- or this
    //   all needs to happen in a ledger node state machine worker that is
    //   scheduled similarly to a consensus worker

    this.storage.stateMachine.get(objectId, options, callback);
  }
};
