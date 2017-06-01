/*!
 * Ledger node events management class.
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

class LedgerNodeEvents {
  constructor(ledgerNode) {
    this.ledgerNode = ledgerNode;
  }

  get(actor, blockId, options, callback) {

  }

}

api.LedgerNodeEvents = LedgerNodeEvents;
