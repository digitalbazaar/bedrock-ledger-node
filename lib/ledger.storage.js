/*
 * Ledger storage module.
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var async = require('async');
var bedrock = require('bedrock');
var brPermission = require('bedrock-permission');
var bufferEqual = require('buffer-equal');
var config = require('bedrock').config;
var crypto = require('crypto');
var database = require('bedrock-mongodb');
var util = require('util');
var BedrockError = bedrock.util.BedrockError;

// module permissions
var PERMISSIONS = bedrock.config.permission.permissions;

// module API
var api = {};
module.exports = api;

var logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-mongodb.ready', function init(callback) {
  async.auto({
    openCollections: function(callback) {
      database.openCollections(['ledger'], callback);
    },
    createIndexes: ['openCollections', function(callback) {
      database.createIndexes([{
        collection: 'ledger',
        fields: {id: 1},
        options: {unique: true, background: false}
      }, {
        collection: 'ledger',
        fields: {name: 1},
        options: {unique: true, background: false}
      }], callback);
    }],
    createKeys: ['createIndexes', function(callback) {
      // FIXME: open all existing ledgers
      callback();
    }]
  }, function(err) {
    callback(err);
  });
});

/**
 * Creates a new ledger.
 *
 * @param actor the Identity performing the action.
 * @param ledgerConfigEvent the ledger configuration.
 * @param options ledger creation options
 * @param callback(err, record) called once the operation completes.
 */
api.createLedger = function(actor, ledgerConfigEvent, options, callback) {
  var ledgerConfig = ledgerConfigEvent.ledgerConfig;
  var ledgerCollection = ledgerConfig.name + '_ledger';
  var accessUrl =
    config.server.baseUri + config.ledger.basePath + '/' + ledgerConfig.name;
  async.auto({
    checkConfig: function(callback) {
      // FIXME: check ledger configuration
      callback();
    },
    checkPermission: ['checkConfig', function(callback) {
      // ensure actor has permission to create ledgers on this system
      /*brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_CREATE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    }],
    checkSignature: ['checkConfig', 'checkPermission', function(callback) {
      // FIXME: check ledger config signature
      callback();
    }],
    createLedger: ['checkSignature', function(callback) {
      // create a separate collection per ledger
      database.openCollections([ledgerCollection], callback);
    }],
    createIndexes: ['createLedger', function(callback) {
      // create ledger-specific indexes
      // TODO: We may want to pass separate indexing options in the future
      database.createIndexes([{
        collection: ledgerCollection,
        fields: {id: 1},
        options: {unique: true, background: false}
      }, {
        collection: ledgerCollection,
        fields: {previousEvent: 1},
        options: {unique: true, background: false}
      }], callback);
    }],
    insertConfig: ['createIndexes', function(callback) {
      // insert the ledger configuration
      var now = Date.now();
      var record = {
        id: database.hash(ledgerConfig.id),
        name: ledgerConfig.name,
        accessUrl: accessUrl,
        meta: {
          created: now,
          updated: now
        },
        ledgerConfig: ledgerConfig
      };
      database.collections.ledger.insert(
        record, database.writeOptions, function(err, result) {
          if(err) {
            return callback(err);
          }
          callback(null, result.ops[0]);
        });
    }],
    insertEvent: ['createIndexes', function(callback) {
      // insert the ledger event
      var now = Date.now();
      var record = {
        id: database.hash(ledgerConfigEvent.id),
        meta: {
          created: now,
          updated: now
        },
        ledgerEvent: ledgerConfigEvent
      };
      database.collections[ledgerCollection].insert(
        record, database.writeOptions, function(err, result) {
          if(err) {
            return callback(err);
          }
          callback(null, result.ops[0]);
        });
    }]}, function(err, results) {
      callback(err, results.insertConfig.accessUrl);
  });
};
