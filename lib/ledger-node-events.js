/*!
 * Ledger node events management class.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * The LedgerNodeBlocks class exposes the block management API.
 */
module.exports = class LedgerNodeEvents {
  constructor(storage, consensus) {
    this.storage = storage;
    this.consensus = consensus;
  }

  /**
   * Creates an event to associate with a ledger given an event and a set
   * of options.
   *
   * event - the event to associate with a ledger.
   * options - a set of options used when creating the event.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   event - the event that was written to the database.
   */
  add(event, options, callback) {
    if(typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.consensus.events.add(event, this.storage, options, callback);
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
    this.storage.events.get(eventId, options, callback);
  }
};
