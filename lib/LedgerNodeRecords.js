/*!
 * Ledger node records class.
 *
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const jsonpatch = require('fast-json-patch');

/**
 * The LedgerNodeRecords class exposes the records API.
 */
module.exports = class LedgerNodeRecords {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;
  }

  /**
   * Gets a record from the ledger given a record ID and a set of options.
   *
   * @param [maxBlockHeight] - limit the record history to the specified block
   *   height.
   * @param recordId - the URI of the object to fetch.
   *
   * @return a Promise that resolves to an object with:
   *   meta - the meta for the record.
   *   record - the record.
   */
  async get({maxBlockHeight, recordId}) {
    // the history returned from storage will be in the proper order, however
    // that does not mean all the operations are valid
    const recordHistory = await this.storage.operations.getRecordHistory(
      {maxBlockHeight, recordId});
    return _replayHistory({recordHistory});
  }
};

function _replayHistory({recordHistory}) {
  // find the first CreateWebLedgerRecord
  const createIndex = _.findIndex(
    recordHistory, ['operation.type', 'CreateWebLedgerRecord']);
  let currentRecord = recordHistory[createIndex].operation.record;
  const meta = {sequence: 0};
  if(recordHistory.length === 1) {
    return {meta, record: currentRecord};
  }
  // look for updates after the create operation
  const updates = [];
  for(let i = createIndex + 1; i < recordHistory.length; ++i) {
    if(recordHistory[i].operation.type === 'UpdateWebLedgerRecord') {
      updates.push(recordHistory[i]);
    }
  }

  // apply valid patches
  for(const update of updates) {
    const {patch, sequence} = update.operation.recordPatch;
    if(sequence !== meta.sequence) {
      // skip the update if the sequence is not proper
      continue;
    }
    const errors = jsonpatch.validate(patch, currentRecord);
    if(errors) {
      // skip the update if the patch cannot be properly applied
      continue;
    }
    currentRecord = jsonpatch.applyPatch(currentRecord, patch).newDocument;
    meta.sequence++;
  }

  return {meta, record: currentRecord};
}
