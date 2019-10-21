/*!
 * Ledger node work session class.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
const database = require('bedrock-mongodb');
const logger = require('./logger');
const {util: {uuid}} = bedrock;

module.exports = class LedgerNodeWorkSession {
  constructor({schedulerId, ledgerNode, onFinish}) {
    this.id = uuid();
    this.schedulerId = schedulerId;
    this.ledgerNode = ledgerNode;
    this.maxAge = 0;
    this.startTime = 0;
    this.started = false;
    this.onFinish = onFinish;
  }

  isExpired() {
    return this.timeRemaining() === 0;
  }

  timeRemaining() {
    return Math.max(0, this.startTime + this.maxAge - Date.now());
  }

  /**
   * Reserves the given ledgerNode for a work session, executes a function
   * to perform work on it, and then releases the ledgerNode from reservation
   * so that other work sessions may be used to reserve it.
   *
   * The ledgerNode will be reserved if has not been marked as deleted, and it
   * has no existing work session.
   *
   * @param maxAge the maximum time to reserve the ledgerNode for.
   * @param fn(session, callback) the work function to execute.
   *
   * @return a Promise that resolves once the operation completes.
   */
  async start(maxAge, fn) {
    this.started = true;
    this.maxAge = maxAge;

    try {
      const reserved = await this._reserve();
      if(!reserved) {
        // ledger node could not be reserved for work
        return;
      }

      // execute work session
      this.startTime = Date.now();
      try {
        await fn(this);
      } catch(e) {
        logger.error(
          `Error during consensus work session (${this.id})`, {
            error: e,
            sessionId: this.id,
            ledgerNodeId: this.ledgerNode.id
          });
      }

      await this._release();
    } finally {
      this.onFinish();
    }
  }

  async _reserve() {
    const collection = database.collections.ledgerNode;
    const singleUpdateOptions = bedrock.util.extend(
      {}, database.writeOptions, {upsert: false, multi: false});

    // work session won't fully expire until after maxAge and grace period
    const gracePeriod = config.ledger.jobs
      .scheduleConsensusWork.workSessionGracePeriod;
    const expires = Date.now() + this.maxAge + gracePeriod;

    // can only take over work sessions with a worker ID that matches the
    // scheduler's worker ID
    const query = {
      id: database.hash(this.ledgerNode.id),
      'meta.workSession.id': this.schedulerId
    };
    const update = {
      $set: {
        'meta.workSession': {id: this.id, expires},
        'meta.updated': Date.now()
      }
    };
    return (await collection.update(
      query, update, singleUpdateOptions)).result.n === 1;
  }

  async _release() {
    const collection = database.collections.ledgerNode;
    const singleUpdateOptions = bedrock.util.extend(
      {}, database.writeOptions, {upsert: false, multi: false});

    const query = {
      'meta.workSession.id': this.id
    };
    const update = {
      $set: {
        'meta.workSession': null,
        'meta.updated': Date.now()
      }
    };
    await collection.update(query, update, singleUpdateOptions);
  }
};
