/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */

module.exports = class LedgerNodeWorkSession {
  constructor(type, maxAge) {
    this.type = type;
    this.maxAge = maxAge;
    this.startTime = null;
  }

  isExpired() {
    if(!this.startTime) {
      return false;
    }
    return this.startTime + this.maxAge < Date.now();
  }

  start() {
    this.startTime = Date.now();
  }
};
