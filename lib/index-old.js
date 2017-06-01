/*!
 * Ledger storage module.
 *
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
// const brPermission = require('bedrock-permission');
const config = require('bedrock').config;
const crypto = require('crypto');
const database = require('bedrock-mongodb');
const jsigs = require('jsonld-signatures')();
let jsonld = bedrock.jsonld;
let request = require('request');
const BedrockError = bedrock.util.BedrockError;

require('./config');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

// const logger = bedrock.loggers.get('app');

// ensure that requests always send JSON
request = request.defaults({json: true});

// FIXME: Do not use an insecure document loader in production
// jsonld = jsonld();
const nodeDocumentLoader = jsonld.documentLoaders.node({
  secure: false,
  strictSSL: false
});
jsonld.documentLoader = (url, callback) => {
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
const ledgerStateMachines = {};

// FIXME: ledger keys should be in a collection
const ledgerAuthorizedKeys = {};

// FIXME: pending write event hash should be in a collection or Redis
const ledgerPendingWriteHash = {};

bedrock.events.on('bedrock-mongodb.ready', callback => async.auto({
  openCollections: callback => database.openCollections(['ledger'], callback),
  createIndexes: ['openCollections', (results, callback) =>
    database.createIndexes([{
      collection: 'ledger',
      fields: {id: 1},
      options: {unique: true, background: false}
    }, {
      collection: 'ledger',
      fields: {name: 1},
      options: {unique: true, background: false}
    }], callback)
  ],
  createKeys: ['createIndexes', (results, callback) => {
    // FIXME: open all existing ledgers
    callback();
  }]
}, err => callback(err)));

/**
 * Authorizes a block to be added to provided ledger. All of the checks
 * necessary to start gathering consensus around a block are performed
 * and the authorized block (with modifications, if necessary) are returned
 * if authorization was successful.
 *
 * @param actor the Identity performing the action.
 * @param ledgerId the ID of the ledger associated with the block.
 * @param block the block to authorize.
 * @param options block authorization options
 * @param callback(err, block) called once the operation completes.
 */
api.authorizeBlock = function(
  actor, ledgerId, block, options, callback) {
  // FIXME: Implement this feature
  callback(null, block);
};

/**
 * Gathers consensus on a block that is expected to be added to the provided
 * ledger. If consensus is reached, the block is returned (with modifications,
 * if necessary).
 *
 * @param actor the Identity performing the action.
 * @param ledgerId the ID of the ledger associated with the block.
 * @param block the block that should undergo the consensus process.
 * @param options block consensus options
 * @param callback(err, block) called once the operation completes.
 */
api.consentToBlock = function(
  actor, ledgerId, block, options, callback) {
  // FIXME: Implement this feature
  callback(null, block);
};

/**
 * Creates a new ledger.
 *
 * @param actor the Identity performing the action.
 * @param ledgerConfigEvent the ledger configuration.
 * @param options ledger creation options
 * @param callback(err, record) called once the operation completes.
 */
api.createLedger = function(actor, ledgerConfigEvent, options, callback) {
  const ledgerConfig = ledgerConfigEvent.ledgerConfig;
  const ledgerCollection = 'ledger_' + ledgerConfig.name;
  // FIXME: using options.baseUri is temporary, determine permanent method
  const accessUrl = options.baseUri + '/' + ledgerConfig.name;
  async.auto({
    checkConfig: callback => {
      // FIXME: check ledger configuration
      callback();
    },
    checkPermission: ['checkConfig', (results, callback) => {
      // ensure actor has permission to create ledgers on this system
      /* brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_CREATE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    }],
    checkKeyAuthorization: ['checkPermission', (results, callback) => {
      // FIXME: trusted signature keys should depend on type of proof
      if(!(ledgerConfigEvent.signature
        && ledgerConfigEvent.signature.creator)) {
        return callback(new BedrockError(
          'Signature is missing or invalid.', 'PermissionDenied', {
            httpStatusCode: 403,
            signature: ledgerConfigEvent.signature,
            public: true
          }));
      }
      const signingKey = ledgerConfigEvent.signature.creator;
      const authorizedKeys =
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
    checkSignature: ['checkKeyAuthorization', (results, callback) => {
      // check to see that the signature is valid
      jsigs.verify(ledgerConfigEvent, {}, (err, verified) => {
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
    // create a separate collection per ledger
    createLedger: ['checkSignature', (results, callback) =>
      database.openCollections([ledgerCollection], callback)
    ],
    // create ledger-specific indexes
    // TODO: We may want to pass separate indexing options in the future
    createIndexes: ['createLedger', (results, callback) =>
      database.createIndexes([{
        collection: ledgerCollection,
        fields: {id: 1},
        options: {unique: true, background: false}
      }], callback)
    ],
    insertConfig: ['createIndexes', (results, callback) => {
      // FIXME: authorized keys for the ledger should be in database collection
      ledgerAuthorizedKeys[ledgerConfig.name] =
        ledgerConfig.consensusAlgorithm.approvedSigner;

      // insert the ledger configuration
      const now = Date.now();
      const record = {
        id: ledgerConfig.id,
        name: ledgerConfig.name,
        accessUrl: accessUrl,
        meta: {
          created: now,
          updated: now
        },
        ledgerConfig: ledgerConfig
      };
      database.collections[ledgerCollection].insert(
        record, database.writeOptions, (err, result) => {
          if(err) {
            if(database.isDuplicateError(err)) {
              return callback(new BedrockError(
                'The ledger is a duplicate and could not be added.',
                'DuplicateLedger', {httpStatusCode: 409, public: true}));
            }
            return callback(err);
          }
          callback(null, result.ops[0]);
        });
    }],
    calculateEventHash: ['insertConfig', (results, callback) =>
      api.calculateLedgerEventHash(ledgerConfigEvent, {}, callback)
    ],
    phaseOneCommit: ['calculateEventHash', (results, callback) => {
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
    phaseTwoCommit: ['phaseOneCommit', (results, callback) => {
      // add the initial ledger config event to the ledger
      const now = Date.now();
      const record = {
        id: ledgerConfigEvent.id,
        meta: {
          created: now,
          updated: now
        },
        ledgerEvent: ledgerConfigEvent
      };
      // FIXME: should this use writeLedgerEvent instead?
      database.collections[ledgerCollection].insert(
        record, database.writeOptions, (err, result) => {
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
    }]
  }, (err, results) => {
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
  const ledgerCollection = 'ledger_' + ledgerName;
  // FIXME: options.baseUri is temporary
  const eventUrl = options.baseUri + '/' + ledgerName + '/' + ledgerEvent.id;
  async.auto({
    checkConfig: callback => {
      // FIXME: check ledger event
      callback();
    },
    checkPermission: ['checkConfig', (results, callback) => {
      // ensure actor has permission to write events to this ledger
      /* brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_WRITE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    }],
    checkLedger: ['checkPermission', (results, callback) => {
      // FIXME: Make sure the ledger exists before writing to it
      database.openCollections([ledgerCollection], callback);
    }],
    checkKeyAuthorization: ['checkLedger', (results, callback) => {
      if(!(ledgerEvent.signature
        && ledgerEvent.signature.creator)) {
        return callback(new BedrockError(
          'Signature is missing or invalid.', 'PermissionDenied', {
            httpStatusCode: 403,
            signature: ledgerEvent.signature,
            public: true
          }));
      }
      // FIXME: trusted signature keys should depend on type of proof
      const signingKey = ledgerEvent.signature.creator;
      const authorizedKeys = ledgerAuthorizedKeys[ledgerName];
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
    checkSignature: ['checkKeyAuthorization', (results, callback) => {
      // check to see that the signature is valid
      jsigs.verify(ledgerEvent, {}, (err, verified) => {
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
    calculateEventHash: ['checkSignature', (results, callback) =>
      api.calculateLedgerEventHash(ledgerEvent, {}, callback)
    ],
    phaseOneCommit: ['calculateEventHash', (results, callback) => {
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
    phaseTwoCommit: ['phaseOneCommit', (results, callback) => {
      // insert the ledger event
      const now = Date.now();
      const record = {
        id: ledgerEvent.id,
        meta: {
          created: now,
          updated: now
        },
        ledgerEvent: ledgerEvent
      };
      database.collections[ledgerCollection].insert(
        record, database.writeOptions, (err, result) => {
          if(err) {
            return callback(err);
          }
          // FIXME: Write update to ledger state machines database?
          const updates = ledgerEvent.replacesObject;
          if(updates) {
            // add each update to the ledger state machine
            [].concat(updates).forEach(
              item => ledgerStateMachines[ledgerName][item.id] = item);
          }

          // mark the second phase as successful
          ledgerPendingWriteHash[ledgerName].previousEvent =
            _.cloneDeep(ledgerPendingWriteHash[ledgerName].nextEvent);
          ledgerPendingWriteHash[ledgerName].nextEvent.id =
            _calculateNextEventId(ledgerEvent.id);
          delete ledgerPendingWriteHash[ledgerName].nextEvent.hash;

          callback(null, result.ops[0]);
        });
    }]
  }, err => callback(err, eventUrl));
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
  const ledgerCollection = 'ledger_' + ledgerName;
  if(!(ledgerCollection in database.collections)) {
    return callback(new BedrockError(
      'Ledger not found.',
      'NotFound',
      {httpStatusCode: 404, ledgerName: ledgerName, public: true}
    ));
  }

  async.auto({
    checkPermission: callback => {
      // ensure actor has permission to write events to this ledger
      /* brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_WRITE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    find: ['checkPermission', (results, callback) => {
      const query = {};
      query.name = ledgerName;
      database.collections[ledgerCollection].findOne(query, {}, callback);
    }],
    getLatestEvent: ['checkPermission', (results, callback) =>
      database.collections[ledgerCollection].find().limit(1)
        .sort({'meta.created': -1}).toArray(callback)
    ],
    calcEventHash: ['getLatestEvent', (results, callback) =>
      api.calculateLedgerEventHash(
        results.getLatestEvent[0].ledgerEvent, {}, callback)
    ]
  }, (err, results) => {
    const record = results.find;
    if(!record) {
      return callback(new BedrockError(
        'Ledger not found.',
        'NotFound',
        {httpStatusCode: 404, ledgerName: ledgerName, public: true}
      ));
    }

    // build the ledger metadata object
    const nextEventId = _calculateNextEventId(results.getLatestEvent[0].id);
    const latestEvent = results.getLatestEvent[0];
    const latestEventHash = results.calcEventHash;
    const ledger = {
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
    const meta = record.meta;
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
    checkPermission: callback => {
      // ensure actor has permission to write events to this ledger
      /* brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_WRITE,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    getLedgers: ['checkPermission', (results, callback) =>
      // FIXME: this needs to be fixed since each ledger has its own collection
      database.collections.ledger.find({}, {name: 1}).toArray(callback)
    ],
    getMetadata: ['getLedgers', (results, callback) => {
      async.map(results.getLedgers, (ledger, callback) =>
        api.getLedgerMetadata(actor, ledger.name, {}, callback)
      , callback);
    }]
  }, (err, results) => callback(err, {ledger: results.getMetadata}));
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
  const ledgerCollection = 'ledger_' + ledgerName;
  async.auto({
    checkPermission: callback => {
      // ensure actor has permission to write events to this ledger
      /* brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_READ,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    find: ['checkPermission', (results, callback) => {
      const query = {
        'ledgerEvent.id': eventId
      };
      database.collections[ledgerCollection].findOne(query, {}, callback);
    }]
  }, (err, results) => {
    const record = results.find;
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
    const ledgerEvent = record.ledgerEvent;
    const meta = record.meta;
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
  async.auto({
    checkPermission: callback => {
      // ensure actor has permission to write events to this ledger
      /* brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_READ,
        {resource: ledgerConfig.consensusAlgorithm,
        translate: 'approvedSigner'}, callback);*/
      callback();
    },
    find: ['checkPermission', (results, callback) => {
      callback(null, ledgerStateMachines[ledgerName][objectId]);
    }]
  }, (err, results) => {
    const record = results.find;
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
    // normalize ledger event to nquads
    normalize: callback => jsonld.normalize(ledgerEvent, {
      algorithm: 'URDNA2015',
      format: 'application/nquads'
    }, callback),
    hash: ['normalize', (results, callback) => {
      // hash normalized ledger event
      const algorithm = options.algorithm || 'sha256';
      const digest = 'urn:' + algorithm + ':' + crypto.createHash(algorithm)
        .update(results.normalize).digest('hex');
      callback(null, digest);
    }]
  }, (err, results) => callback(err, results.hash));
};

/**
 * FIXME: This should use the event IDs from the database
 *
 * Calculates the next event ID for a given ledger by incrementing the number
 * at the end of the given URL.
 *
 * @return the next event ID URL.
 */
const _calculateNextEventId = function(url) {
  const re = /[0-9]+$/;
  const number = parseInt(url.match(re)[0], 10) + 1;
  const baseEventUrl = url.replace(re, '');

  return baseEventUrl + number;
};
