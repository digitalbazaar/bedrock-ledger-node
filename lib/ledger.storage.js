/*
 * Ledger storage module.
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var _ = require('lodash');
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
      // add the initial ledger config event to the ledger
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

/**
 * Writes an event to a given ledger.
 *
 * @param actor the Identity performing the action.
 * @param ledgerName the name of the ledger.
 * @param ledgerEvent the ledger event to write to the ledger.
 * @param options ledger write options
 * @param callback(err, record) called once the operation completes.
 */
api.writeLedgerEvent = function(
  actor, ledgerName, ledgerEvent, options, callback) {
  var ledgerCollection = ledgerName + '_ledger';
  var eventUrl = config.server.baseUri + config.ledger.basePath + '/' +
    ledgerName + '/' + ledgerEvent.id;
  async.auto({
    checkConfig: function(callback) {
      // FIXME: check ledger event
      callback();
    },
    checkPermission: ['checkConfig', function(callback) {
      // ensure actor has permission to write events to this ledger
      /*brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_WRITE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    }],
    checkSignature: ['checkConfig', 'checkPermission', function(callback) {
      // FIXME: check ledger event signature
      callback();
    }],
    checkLedger: ['checkSignature', function(callback) {
      // FIXME: Make sure the ledger exists before writing to it
      database.openCollections([ledgerCollection], callback);
    }],
    insertEvent: ['checkLedger', function(callback) {
      // insert the ledger event
      var now = Date.now();
      var record = {
        id: database.hash(ledgerEvent.id),
        meta: {
          created: now,
          updated: now
        },
        ledgerEvent: ledgerEvent
      };
      database.collections[ledgerCollection].insert(
        record, database.writeOptions, function(err, result) {
          if(err) {
            return callback(err);
          }
          callback(null, result.ops[0]);
        });
    }]}, function(err, results) {
      callback(err, eventUrl);
  });
};

/**
 * Gets metadata about a specific ledger in the system.
 *
 * @param actor the Identity performing the action.
 * @param ledgerName the name of the ledger.
 * @param options ledger metadata query options
 * @param callback(err, record) called once the operation completes.
 */
api.getLedgerMetadata = function(actor, ledgerName, options, callback) {
  var ledgerCollection = ledgerName + '_ledger';
  async.auto({
    checkPermission: function(callback) {
      // ensure actor has permission to write events to this ledger
      /*brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_WRITE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    find: ['checkPermission', function(callback) {
      var query = {};
      query.name = ledgerName;
      database.collections.ledger.findOne(query, {}, callback);
    }]}, function(err, results) {
      var record = results.find;
      if(!record) {
        return callback(new BedrockError(
          'Ledger not found.',
          'NotFound',
          {httpStatusCode: 404, ledgerName: ledgerName, public: true}
        ));
      }

      var ledger = {
        id: record.accessUrl,
        name: record.name,
        ledgerConfig: record.ledgerConfig
      };
      var meta = record.meta;
      callback(err, ledger, meta);
  });
};


/**
 * Gets metadata about all ledgers in the system.
 *
 * @param actor the Identity performing the action.
 * @param options ledger metadata query options
 * @param callback(err, record) called once the operation completes.
 */
api.getAllLedgerMetadata = function(actor, options, callback) {
  async.auto({
    checkPermission: function(callback) {
      // ensure actor has permission to write events to this ledger
      /*brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_WRITE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    getLedgers: ['checkPermission', function(callback) {
      database.collections.ledger.find({}, {name: 1}).toArray(callback);
    }],
    getMetadata: ['getLedgers', function(callback, results) {
      async.map(results.getLedgers, function(ledger, callback) {
        api.getLedgerMetadata(actor, ledger.name, {}, callback);
      }, callback);
    }]}, function(err, results) {
      var ledgers = {
        ledger: results.getMetadata
      };
      callback(err, ledgers);
  });
};
