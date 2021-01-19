/*!
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
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

// jobs
config.ledger.jobs = {};
config.ledger.jobs.scheduleConsensusWork = {
  enabled: false,
  // cooldown time between looping to look for more work sessions to assign;
  // this is the maximum amount of time to wait until looking for a ledger node
  // to assign a work session to that may not have been serviced recently by
  // another process -- a scheduler can still be woken up sooner by a completed
  // job that it scheduled previously
  cooldown: 1000,
  // time a scheduler's claim on a ledger node will survive before another
  // scheduler may override it; this setting is important for when a scheduler
  // process dies and another one needs to know if it can safely override a
  // claim that wasn't cleaned up; it should not take more than this amount
  // of time for the scheduler to hand off a claimed ledger node to a work
  // session worker, if it does, then the system will have trouble getting
  // work sessions running, but it should not cause corruption
  claimTtl: 5000,
  // consensus worker grace period; if an existing consensus work session has
  // stalled or failed to notify that it finished, then a scheduler will wait
  // up to its `maxAge` + this number before reassigning to a new work session
  // default is 1 minute (60000 ms)
  workSessionGracePeriod: 60000
};

// common validation schemas
config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas')
);
