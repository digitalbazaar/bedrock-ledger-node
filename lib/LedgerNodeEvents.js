/*!
 * Ledger node events management class.
 *
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
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
   * @param eventId - the event to fetch from the ledger.
   * @param options - a set of options used when retrieving the event.
   *
   * @return a Promise that resolves to the event retrieved from the database.
   */
  /* eslint-disable-next-line no-unused-vars */
  get(eventId, options = {}) {
    return this.storage.events.get(eventId);
  }
};
