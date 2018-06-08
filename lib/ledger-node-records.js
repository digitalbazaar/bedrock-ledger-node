/*!
 * Ledger node records class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
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
   * Gets a record from the ledger given a recordID and a set of options.
   *
   * [maxBlockHeight] - limit the record history to the specified block height.
   * recordId - the URI of the object to fetch.
   * callback(err, {meta, record}) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   */
  get({maxBlockHeight, recordId}, callback) {
    // the history returned from storage will be in the proper order, however
    // that does not mean all the operations are valid
    this.storage.operations.getRecordHistory(
      {maxBlockHeight, recordId}, (err, recordHistory) => {
        if(err) {
          return callback(err);
        }
        callback(null, _replayHistory({recordHistory}));
      });

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
  }
};
