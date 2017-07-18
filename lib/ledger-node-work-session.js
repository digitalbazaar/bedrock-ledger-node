/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
module.exports = class LedgerNodeWorkSession {
  constructor(type, maxAge) {
    this.type = type;
    this.maxAge = maxAge;
    this.startTime = 0;
  }

  isExpired() {
    return (this.startTime + this.maxAge) <= Date.now();
  }

  start() {
    this.startTime = Date.now();
  }
};
