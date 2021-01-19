/*!
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
const database = require('bedrock-mongodb');
const {util: {uuid}} = bedrock;

module.exports = class LedgerNodeWorkSession {
  constructor({schedulerId, ledgerNode}) {
    this.id = uuid();
    this.schedulerId = schedulerId;
    this.ledgerNode = ledgerNode;
    this.maxAge = 0;
    this.startTime = 0;
    this.started = false;
  }

  isExpired() {
    return this.timeRemaining() === 0;
  }

  timeRemaining() {
    return Math.max(0, this.startTime + this.maxAge - Date.now());
  }

  /**
   * Reserves the given ledgerNode for a work session, schedules work to
   * perform on the next tick, and returns a promise that resolves to true
   * if the reservation was successful and false if the reservation fails
   * because the ledgerNode was reserved by another work session.
   *
   * On the next tick, the given function will be called to perform work on the
   * ledger node, and once it completes, the ledgerNode will be released from
   * this work session so that other work sessions may be used to reserve it.
   *
   * The ledgerNode will be successfully reserved if has not been marked as
   * deleted, and it has no existing work session.
   *
   * @param options The options to use.
   * @param options.fn(session) the work function to execute.
   * @param options.maxAge the maximum time to reserve the ledgerNode for.
   *
   * @return a Promise that resolves once the operation completes.
   */
  async start({fn, maxAge} = {}) {
    this.maxAge = maxAge;
    this.started = await this._reserve();
    if(!this.started) {
      // could not reserve ledger node, do not start work
      return {started: false, finished: null};
    }

    // do not await `finished` to allow `start` to return immediately
    const finished = this._runAndRelease(fn);
    return {started: this.started, finished};
  }

  async _reserve() {
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
    const collection = database.collections.ledgerNode;
    return (await collection.updateOne(query, update)).result.n === 1;
  }

  async _runAndRelease(fn) {
    // execute work session
    this.startTime = Date.now();
    try {
      await fn(this);
    } finally {
      await this._release();
    }
  }

  async _release() {
    const query = {
      'meta.workSession.id': this.id
    };
    const update = {
      $set: {
        'meta.workSession': {id: -1, expires: -1},
        'meta.updated': Date.now()
      }
    };
    const collection = database.collections.ledgerNode;
    await collection.updateOne(query, update);
  }
};
