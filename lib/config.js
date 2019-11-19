/*!
 * Copyright (c) 2016-2019 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
const {config} = bedrock;
const path = require('path');
require('bedrock-ledger-context');
require('bedrock-permission');
require('bedrock-validation');

// permissions
const {permissions} = config.permission;
permissions.LEDGER_NODE_ACCESS = {
  id: 'LEDGER_NODE_ACCESS',
  label: 'Access Ledger Node',
  comment: 'Required to access a Ledger Node.'
};
permissions.LEDGER_NODE_CREATE = {
  id: 'LEDGER_NODE_CREATE',
  label: 'Create Ledger Node',
  comment: 'Required to create a Ledger Node.'
};
permissions.LEDGER_NODE_REMOVE = {
  id: 'LEDGER_NODE_REMOVE',
  label: 'Remove Ledger Node',
  comment: 'Required to remove a Ledger Node.'
};

config.ledger = {};

config.ledger.cache = {};
// TTL (ms) for the cache in the blocks.getBasisBlockHeight API
config.ledger.cache.latestBlockHeightTtl = 60 * 1000;

// jobs
config.ledger.jobs = {};
config.ledger.jobs.scheduleConsensusWork = {
  enabled: false,
  // time a scheduler will be told it has to complete its job;
  // it will optimistically try to finish in this time
  ttl: 50000,
  // consensus worker grace period; if an existing consensus work session has
  // stalled or failed to notify that it finished, then a scheduler will wait
  // up to its `maxAge` + this number before reassigning to a new work session
  // default is 5 minutes (300000 ms)
  workSessionGracePeriod: 300000,
  // this is the maximum number of work sessions that may be run concurrenly
  // per CPU core (or per bedrock-ledger-node instance)
  workSessionConcurrencyPerInstance: 5
};

// common validation schemas
config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas')
);
