/*!
 * Ledger node meta management class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

/**
 * LedgerNodeMeta exposes the ledger node metadata API.
 */
module.exports = class LedgerNodeMeta {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
  }

  /**
   * Gets metadata associated with the ledger, such as most recent
   * configuration block and latest consensus block, given a set of options.
   *
   * actor - the actor performing the action.
   * options - a set of options used when retrieving the ledger metadata.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   ledgerMeta - metadata about the ledger.
   */
  get(actor, options, callback) {

  }
};
