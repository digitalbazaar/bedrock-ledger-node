/*!
 * Ledger node meta management class.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const config = require('bedrock').config;
const database = require('bedrock-mongodb');
const BedrockError = bedrock.util.BedrockError;

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

/**
 * LedgerNodeMeta exposes the ledger node metadata API.
 */
class LedgerNodeMeta {
  constructor(ledgerNode) {
    this.ledgerNode = ledgerNode;
  }

  /**
   * Gets metadata associated with the ledger, such as most recent
   * configuration block and latest consensus block, given a set of options.
   *
   * actor - the actor performing the action.
   * options - a set of options used when retrieving the ledger metadata.
   * callback(err) - the callback to call when finished.
   *   err - An Error if an error occurred, null otherwise.
   *   ledgerMeta - metadata about the ledger.
   */
  get(actor, options, callback) {

  }
}

api.LedgerNodeMeta = LedgerNodeMeta;
