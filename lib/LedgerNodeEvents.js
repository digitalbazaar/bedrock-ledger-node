/*!
 * Ledger node events management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {callbackify} = require('bedrock').util;

/**
 * The LedgerNodeEvents class exposes the event management API.
 */
module.exports = class LedgerNodeEvents {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;

    // FIXME: temporary backwards compatible callback support
    this.get = callbackify(this.get.bind(this));
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
  get(eventId, options = {}) {
    return this.storage.events.get(eventId);
  }
};
