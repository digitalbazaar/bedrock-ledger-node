/*!
 * Ledger node events management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

/**
 * The LedgerNodeEvents class exposes the event management API.
 */
module.exports = class LedgerNodeEvents {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;
  }

  /**
   * Gets an event associated with the ledger given an eventID and a set
   * of options.
   *
   * eventId - the event to fetch from the ledger.
   * options - a set of options used when retrieving the event.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   event - the event that was retrieved from the database.
   */
  get(eventId, options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.storage.events.get(eventId, callback);
  }
};
