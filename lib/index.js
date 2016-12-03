/*
 * Ledger storage module.
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brPermission = require('bedrock-permission');
var config = require('bedrock').config;
var crypto = require('crypto');
var database = require('bedrock-mongodb');
var jsigs = require('jsonld-signatures')();
var jsonld = bedrock.jsonld;
var request = require('request');
var BedrockError = bedrock.util.BedrockError;

// module permissions
var PERMISSIONS = bedrock.config.permission.permissions;

// module API
var api = {};
module.exports = api;

var logger = bedrock.loggers.get('app');

// ensure that requests always send JSON
request = request.defaults({json: true});

// FIXME: Do not use an insecure document loader in production
jsonld = jsonld();
var nodeDocumentLoader = jsonld.documentLoaders.node({
  secure: false,
  strictSSL: false
});
jsonld.documentLoader = function(url, callback) {
  if(url in config.constants.CONTEXTS) {
    return callback(
      null, {
        contextUrl: null,
        document: config.constants.CONTEXTS[url],
        documentUrl: url
      });
  }
  nodeDocumentLoader(url, callback);
};

// use local JSON-LD processor for checking signatures
jsigs.use('jsonld', jsonld);

// FIXME: ledger state machines should be in a collection
var ledgerStateMachines = {};

// FIXME: ledger keys should be in a collection
var ledgerAuthorizedKeys = {};

// FIXME: pending write event hash should be in a collection or Redis
var ledgerPendingWriteHash = {};

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
  var ledgerCollection = 'ledger_' + ledgerConfig.name;
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
    checkKeyAuthorization: ['checkPermission',
      function(callback) {
      // FIXME: trusted signature keys should depend on type of proof
      var signingKey = ledgerConfigEvent.signature.creator;
      var authorizedKeys =
        ledgerConfigEvent.ledgerConfig.consensusAlgorithm.approvedSigner;
      if(_.indexOf(authorizedKeys, signingKey) === -1) {
        return callback(new BedrockError(
          'Signing key is not in the list of authorized keys.',
          'PermissionDenied', {
            httpStatusCode: 403,
            signingKey: signingKey,
            authorizedKeys: authorizedKeys,
            public: true
          }
        ));
      }
      callback();
    }],
    checkSignature: ['checkKeyAuthorization', function(callback, results) {
      // check to see that the signature is valid
      jsigs.verify(ledgerConfigEvent, {}, function(err, verified) {
        if(err) {
          return callback(new BedrockError(
            'An error occurred while checking the signature.',
            'PermissionDenied', {
              httpStatusCode: 403,
              error: err,
              public: true
            }
          ));
        }
        if(!verified) {
          return callback(new BedrockError(
            'The signature provided for the ledger configuration is invalid.',
            'PermissionDenied', {
              httpStatusCode: 403,
              public: true
            }
          ));
        }
        callback();
      });
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
      // FIXME: authorized keys for the ledger should be in database collection
      ledgerAuthorizedKeys[ledgerConfig.name] =
        ledgerConfig.consensusAlgorithm.approvedSigner;

      // insert the ledger configuration
      var now = Date.now();
      var record = {
        id: ledgerConfig.id,
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
    calculateEventHash: ['insertConfig', function(callback) {
      api.calculateLedgerEventHash(ledgerConfigEvent, {}, callback);
    }],
    phaseOneCommit: ['calculateEventHash', function(callback, results) {
      ledgerPendingWriteHash[ledgerConfig.name] = {
        previousEvent: {
          id: null,
          hash: ledgerConfigEvent.previousEvent.hash
        },
        nextEvent: {
          id: ledgerConfigEvent.id,
          hash: results.calculateEventHash
        }
      };
      callback();
    }],
    phaseTwoCommit: ['phaseOneCommit', function(callback) {
      // add the initial ledger config event to the ledger
      var now = Date.now();
      var record = {
        id: ledgerConfigEvent.id,
        meta: {
          created: now,
          updated: now
        },
        ledgerEvent: ledgerConfigEvent
      };
      // FIXME: should this use writeLedgerEvent instead?
      database.collections[ledgerCollection].insert(
        record, database.writeOptions, function(err, result) {
          if(err) {
            return callback(err);
          }
          // FIXME: create a state machines database for each ledger?
          ledgerStateMachines[ledgerConfig.name] = {};

          // mark the second phase as successful
          ledgerPendingWriteHash[ledgerConfig.name].previousEvent =
            _.cloneDeep(ledgerPendingWriteHash[ledgerConfig.name].nextEvent);
          ledgerPendingWriteHash[ledgerConfig.name].nextEvent.id =
            _calculateNextEventId(ledgerConfigEvent.id);
          delete ledgerPendingWriteHash[ledgerConfig.name].nextEvent.hash;

          callback(null, result.ops[0]);
        });
    }]}, function(err, results) {
      if(err) {
        return callback(err);
      }
      callback(null, results.insertConfig.accessUrl);
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
  var ledgerCollection =  'ledger_' + ledgerName;
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
    checkLedger: ['checkPermission', function(callback) {
      // FIXME: Make sure the ledger exists before writing to it
      database.openCollections([ledgerCollection], callback);
    }],
    checkKeyAuthorization: ['checkLedger', function(callback) {
      // FIXME: trusted signature keys should depend on type of proof
      var signingKey = ledgerEvent.signature.creator;
      var authorizedKeys = ledgerAuthorizedKeys[ledgerName];
      if(_.indexOf(authorizedKeys, signingKey) === -1) {
        return callback(new BedrockError(
          'Signing key is not in the list of authorized keys.',
          'PermissionDenied', {
            httpStatusCode: 403,
            signingKey: signingKey,
            authorizedKeys: authorizedKeys,
            public: true
          }
        ));
      }
      callback();
    }],
    checkSignature: ['checkKeyAuthorization', function(callback, results) {
      // check to see that the signature is valid
      jsigs.verify(ledgerEvent, {}, function(err, verified) {
        if(err) {
          return callback(new BedrockError(
            'An error occurred while checking the signature.',
            'PermissionDenied', {
              httpStatusCode: 403,
              error: err,
              public: true
            }
          ));
        }
        if(!verified) {
          return callback(new BedrockError(
            'The signature provided for the ledger event is invalid.',
            'PermissionDenied', {
              httpStatusCode: 403,
              public: true
            }
          ));
        }
        callback();
      });
    }],
    calculateEventHash: ['checkSignature', function(callback) {
      api.calculateLedgerEventHash(ledgerEvent, {}, callback);
    }],
    phaseOneCommit: ['calculateEventHash', function(callback, results) {
      if(ledgerPendingWriteHash[ledgerName].previousEvent.id !==
        ledgerEvent.previousEvent.id &&
        ledgerPendingWriteHash[ledgerName].previousEvent.id !==
        ledgerEvent.previousEvent.hash) {
        return callback(new BedrockError(
          'The provided previous event information is invalid..',
          'PreviousEventInformationInvalid', {
            httpStatusCode: 400,
            providedPreviousEvent: ledgerEvent.previousEvent,
            expectedPreviousEvent:
              ledgerPendingWriteHash[ledgerName].previousEvent,
            public: true
          }
        ));
      }
      if(ledgerPendingWriteHash[ledgerName].nextEvent.id !== ledgerEvent.id) {
        return callback(new BedrockError(
          'The provided ledger event ID is not the next one in the sequence.',
          'DuplicateLedgerEvent', {
            httpStatusCode: 400,
            providedLedgerEventId: ledgerEvent.id,
            expectedLedgerEventId:
              ledgerPendingWriteHash[ledgerName].nextEvent.id,
            public: true
          }
        ));
      }
      if(ledgerPendingWriteHash[ledgerName].nextEvent.hash) {
        return callback(new BedrockError(
          'An event with the given ID already exists in the ledger.',
          'DuplicateLedgerEvent', {
            httpStatusCode: 409,
            ledgerEventId: ledgerEvent.id,
            public: true
          }
        ));
      }
      ledgerPendingWriteHash[ledgerName].nextEvent.hash =
        results.calculateEventHash;
      callback();
    }],
    phaseTwoCommit: ['phaseOneCommit', function(callback) {
      // insert the ledger event
      var now = Date.now();
      var record = {
        id: ledgerEvent.id,
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
          // FIXME: Write update to ledger state machines database?
          var updates = ledgerEvent.replacesObject;
          if(updates) {
            if(!Array.isArray(updates)) {
              updates = [updates];
            }
            // add each update to the ledger state machine
            _.forEach(updates, function(item) {
              ledgerStateMachines[ledgerName][item.id] = item;
            });
          }

          // mark the second phase as successful
          ledgerPendingWriteHash[ledgerName].previousEvent =
            _.cloneDeep(ledgerPendingWriteHash[ledgerName].nextEvent);
          ledgerPendingWriteHash[ledgerName].nextEvent.id =
            _calculateNextEventId(ledgerEvent.id);
          delete ledgerPendingWriteHash[ledgerName].nextEvent.hash;

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
  var ledgerCollection =  'ledger_' + ledgerName;
  if(!(ledgerCollection in database.collections)) {
    return callback(new BedrockError(
      'Ledger not found.',
      'NotFound',
      {httpStatusCode: 404, ledgerName: ledgerName, public: true}
    ));
  }

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
    }],
    getLatestEvent: ['checkPermission', function(callback) {
      database.collections[ledgerCollection].find().limit(1)
        .sort({'meta.created':-1}).toArray(callback);
    }],
    calcEventHash: ['getLatestEvent', function(callback, results) {
      api.calculateLedgerEventHash(
        results.getLatestEvent[0].ledgerEvent, {}, callback);
    }]}, function(err, results) {
      var record = results.find;
      if(!record) {
        return callback(new BedrockError(
          'Ledger not found.',
          'NotFound',
          {httpStatusCode: 404, ledgerName: ledgerName, public: true}
        ));
      }

      // build the ledger metadata object
      var nextEventId = _calculateNextEventId(results.getLatestEvent[0].id);
      var latestEvent = results.getLatestEvent[0];
      var latestEventHash = results.calcEventHash;
      var ledger = {
        id: record.accessUrl,
        name: record.name,
        ledgerConfig: record.ledgerConfig,
        latestEvent: {
          id: latestEvent.ledgerEvent.id,
          hash: latestEventHash
        },
        nextEvent: {
          id: nextEventId
        }
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

/**
 * Get ledger event metadata.
 *
 * @param actor the Identity performing the action.
 * @param ledgerName the name of the ledger.
 * @param eventId the name of the ledger.
 * @param options ledger event query options
 * @param callback(err, record) called once the operation completes.
 */
api.getLedgerEvent = function(actor, ledgerName, eventId, options, callback) {
  var ledgerCollection =  'ledger_' + ledgerName;
  async.auto({
    checkPermission: function(callback) {
      // ensure actor has permission to write events to this ledger
      /*brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_READ,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    find: ['checkPermission', function(callback) {
      var query = {
        'ledgerEvent.id': eventId
      };
      database.collections[ledgerCollection].findOne(query, {}, callback);
    }]}, function(err, results) {
      var record = results.find;
      if(!record) {
        return callback(new BedrockError(
          'Ledger event not found.',
          'NotFound', {
            httpStatusCode: 404,
            ledgerName: ledgerName,
            eventId: eventId,
            public: true
          }
        ));
      }

      // build the ledger event object
      var ledgerEvent = record.ledgerEvent;
      var meta = record.meta;
      callback(err, ledgerEvent, meta);
  });
};

/**
 * Retrieves an object from the current state machine.
 *
 * @param actor the Identity performing the action.
 * @param ledgerName the name of the ledger associated with the state machine.
 * @param objectId the id of the object to retrieve.
 * @param options ledger state machine query options
 * @param callback(err, record) called once the operation completes.
 */
api.getStateMachineObject = function(
  actor, ledgerName, objectId, options, callback) {
  var ledgerCollection =  'ledger_' + ledgerName;
  async.auto({
    checkPermission: function(callback) {
      // ensure actor has permission to write events to this ledger
      /*brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_READ,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    find: ['checkPermission', function(callback) {
      callback(null, ledgerStateMachines[ledgerName][objectId]);
    }]}, function(err, results) {
      var record = results.find;
      if(!record) {
        return callback(new BedrockError(
          'Object not found in ledger state machine.',
          'NotFound', {
            httpStatusCode: 404,
            ledgerName: ledgerName,
            objectId: objectId,
            public: true
          }
        ));
      }

      // build the state machine object
      callback(err, record);
  });
};

/**
 * Calculate a ledger event hash value.
 *
 * @param actor the Identity performing the action.
 * @param ledgerEvent the ledger event.
 * @param options hash value generation options
 *          (algorithm) the digest algorithm to use. Defaults to 'sha256'.
 * @param callback(err, record) called once the operation completes.
 */
api.calculateLedgerEventHash = function(ledgerEvent, options, callback) {
  async.auto({
    normalize: function(callback) {
      // normalize ledger event to nquads
      jsonld.normalize(ledgerEvent, {
        algorithm: 'URDNA2015',
        format: 'application/nquads'
      }, callback);
    },
    hash: ['normalize', function(callback, results) {
      // hash normalized ledger event
      var algorithm = options.algorithm || 'sha256';
      var digest = 'urn:' + algorithm + ':' + crypto.createHash(algorithm)
        .update(results.normalize).digest('hex');
      callback(null, digest);
    }]}, function(err, results) {
      callback(err, results.hash);
  });
};

/**
 * FIXME: This should use the event IDs from the database
 *
 * Calculates the next event ID for a given ledger by incrementing the number
 * at the end of the given URL.
 *
 * @return the next event ID URL.
 */
var _calculateNextEventId = function(url) {
  var re = /[0-9]+$/;
  var number = parseInt(url.match(re)[0], 10) + 1;
  var baseEventUrl = url.replace(re, '');

  return baseEventUrl + number;
};