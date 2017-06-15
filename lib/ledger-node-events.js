/*!
 * Ledger node events management class.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const config = require('bedrock').config;
const BedrockError = bedrock.util.BedrockError;

/**
 * The LedgerNodeBlocks class exposes the block management API.
 */
class LedgerNodeEvents {
  constructor(eventStorage) {
    this.storage = eventStorage;
  }

  /**
   * Creates an event to associate with a ledger given an event and a set
   * of options.
   *
   * actor - the actor performing the action.
   * event - the event to associate with a ledger.
   * options - a set of options used when creating the event.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   event - the event that was written to the database.
   */
  add(event, options, callback) {
    // FIXME: api changing to `add`
    this.storage.create();
    callback();
  }

  /**
   * Gets an event associated with the ledger given an eventID and a set
   * of options.
   *
   * actor - the actor performing the action.
   * eventId - the event to fetch from the ledger.
   * options - a set of options used when retrieving the event.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   event - the event that was retrieved from the database.
   */
  get(eventId, options, callback) {
    this.get();
    callback();
  }

}

module.exports = LedgerNodeEvents;
