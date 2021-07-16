/*!
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const jsonpatch = require('fast-json-patch');
const {LruCache} = require('@digitalbazaar/lru-memoize');

/**
 * The LedgerNodeRecords class exposes the records API.
 */
module.exports = class LedgerNodeRecords {
  constructor({ledgerNode}) {
    this.ledgerNode = ledgerNode;
    this.storage = ledgerNode.storage;
    this._cache = new LruCache({max: 1000});
    this._latestBlockSummaryCache = new LruCache({max: 1, maxAge: 1000});
  }

  /**
   * Gets a record from the ledger given a record ID and a set of options.
   *
   * @param [maxBlockHeight] - limit the record history to the specified block
   *   height; this block height MUST NOT be beyond the maximum block height
   *   that the node is aware of -- this API will NOT check that.
   * @param recordId - the URI of the object to fetch.
   *
   * @return a Promise that resolves to an object with:
   *   meta - the meta for the record.
   *   record - the record.
   */
  async get({maxBlockHeight, recordId}) {
    // FIXME: to ensure the above caveat around `maxBlockHeight`, if it is
    // given, we could check a cache to see if we at least have that
    // block height based on the last time we called `getLatestBlockHeight`
    // ...and if not, call it again and cache its result; if we don't have
    // that block height, we should throw `NotFoundError`

    // use a cache for the latest block summary since this function may
    // be called often
    const getLastestBlockSummaryFn = () => this.ledgerNode.storage.blocks
      .getLatestSummary(this.ledgerNode);
    let latestBlockSummary = await this._latestBlockSummaryCache.memoize({
      key: 'latestBlockSummary', fn: getLastestBlockSummaryFn});
    let latestBlockHeight = latestBlockSummary.eventBlock.block.blockHeight;

    // always set maxBlockHeight since it's used as part of an LRU key
    if(maxBlockHeight === undefined) {
      maxBlockHeight = latestBlockHeight;
    } else if(maxBlockHeight > latestBlockHeight) {
      // clear the summary cache if `maxBlockHeight` is greater than
      // `latestBlockHeight` and set `maxBlockHeight` to freshest database value
      // only if `maxBlockHeight` is still less than `latestBlockHeight`
      this._latestBlockSummaryCache.delete('latestBlockSummary');
      latestBlockSummary = await this._latestBlockSummaryCache.memoize({
        key: 'latestBlockSummary', fn: getLastestBlockSummaryFn});
      latestBlockHeight = latestBlockSummary.eventBlock.block.blockHeight;
      if(maxBlockHeight > latestBlockHeight) {
        maxBlockHeight = latestBlockSummary.eventBlock.block.blockHeight;
      }
    }

    // get the record from the LRU cache if possible
    const key = `${maxBlockHeight}|${recordId}`;
    const getUncachedRecordFn = () => this._getUncachedRecord({
      maxBlockHeight, recordId});

    return this._cache.memoize({key, fn: getUncachedRecordFn});
  }

  async _getUncachedRecord({maxBlockHeight, recordId}) {
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
