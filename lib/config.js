/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
const {config} = bedrock;
const path = require('path');
require('bedrock-jobs');
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

// reducing idleTime to make consensus workers more responsive
config.scheduler.idleTime = 1000;

config.ledger = {};

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
bedrock.util.config.main.pushComputed('scheduler.jobs', () => ({
  id: 'ledger-node.jobs.scheduleConsensusWork',
  type: 'ledger-node.jobs.scheduleConsensusWork',
  // repeat forever, run every second
  schedule: 'R/PT1S',
  // no special priority
  priority: 0,
  concurrency: 1,
  // use a 10000ms grace period between TTL for workers to finish up
  // before forcibly running another worker
  lockDuration: config.ledger.jobs.scheduleConsensusWork.ttl + 10000
}));

// common validation schemas
config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas')
);
