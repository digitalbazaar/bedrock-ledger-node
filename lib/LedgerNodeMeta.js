/*!
 * Ledger node meta management class.
 *
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

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
   * @param actor - the actor performing the action.
   * @param options - a set of options used when retrieving the ledger metadata.
   *
   * @return a Promise that resolves to metadata about the ledger.
   */
  /* eslint-disable-next-line no-unused-vars */
  get(actor, options = {}) {
    // TODO: implement
    throw new Error('Not implemented.');
  }
};
