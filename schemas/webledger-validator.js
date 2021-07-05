/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config: {constants}} = require('bedrock');
const {schemas} = require('bedrock-validation');

const createOperation = {
  title: 'CreateWebLedgerRecord',
  // `proof` and `creator` are not required
  required: [
    '@context',
    'record',
    'type'
  ],
  type: 'object',
  properties: {
    // @context is thorougly validated in validator.js
    '@context': {
      anyOf: [
        schemas.url(), {
          type: 'array',
          minItems: 1,
          items: schemas.url(),
        }
      ]
    },
    creator: {
      type: 'string'
    },
    type: {
      type: 'string',
      enum: ['CreateWebLedgerRecord'],
    },
    record: {
      type: 'object',
      // additional properties are allowed here
      additionalProperties: true,
      // generally @context is not required, but specific ledger validators
      // may add this requirement
      required: ['id'],
      properties: {
        id: schemas.url()
      }
    },
    proof: schemas.linkedDataSignature2020()
  },
  additionalProperties: false
};

const recordPatch = {
  type: 'object',
  required: ['@context', 'patch', 'sequence', 'target'],
  additionalProperties: false,
  properties: {
    '@context': {
      type: 'array',
      minItems: 2,
      // must have json-ld-patch context in first position and then
      // ledger specific contexts to be validated by ledger validators
      // this schema syntax does *not* validate any items after the first one
      items: [{
        type: 'string',
        enum: [constants.JSON_LD_PATCH_CONTEXT_V1_URL],
      }]
    },
    // TODO: implement json-patch schema
    patch: {
      type: 'array',
      items: {
        type: 'object'
      },
      minItems: 1,
    },
    sequence: {
      type: 'integer',
      minimum: 0,
    },
    target: schemas.url(),
  }
};

const updateOperation = {
  title: 'UpdateWebLedgerRecord',
  // proof and creator are not required
  required: [
    '@context', 'recordPatch', 'type'
  ],
  additionalProperties: false,
  type: 'object',
  properties: {
    '@context': {
      anyOf: [
        schemas.jsonldContext(constants.WEB_LEDGER_CONTEXT_V1_URL), {
          type: 'array',
          items: schemas.url()
        }
      ]
    },
    creator: {
      type: 'string'
    },
    type: {
      type: 'string',
      enum: ['UpdateWebLedgerRecord'],
    },
    recordPatch,
    proof: schemas.linkedDataSignature2020(),
  },
};

const ledgerConfiguration = {
  title: 'WebLedgerConfiguration',
  additionalProperties: false,
  required: [
    '@context',
    'consensusMethod',
    'ledger',
    'sequence',
    'type',
  ],
  type: 'object',
  properties: {
    '@context': schemas.jsonldContext([
      constants.WEB_LEDGER_CONTEXT_V1_URL,
      constants.ED25519_2020_CONTEXT_V1_URL
    ]),
    consensusMethod: {
      type: 'string',
    },
    creator: {
      type: 'string'
    },
    witnessSelectionMethod: {
      type: 'object',
    },
    ledger: {
      // FIXME: enforce? did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59
      type: 'string',
    },
    ledgerConfigurationValidator: {
      type: 'array',
      minItems: 1,
      items: {
        additionalProperties: false,
        required: ['type'],
        type: 'object',
        properties: {
          type: {
            type: 'string',
          },
          approvedSigner: {
            type: 'array',
            minItems: 1
          },
          minimumSignaturesRequired: {
            type: 'integer',
            minimum: 1
          },
          validatorFilter: {
            type: 'array',
            minItems: 1,
            items: {
              additionalProperties: false,
              required: ['type', 'validatorFilterByType'],
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['ValidatorFilterByType'],
                },
                validatorFilterByType: {
                  type: 'array',
                  maxItems: 1,
                  minItems: 1,
                  items: {
                    type: 'string',
                    enum: ['WebLedgerConfiguration'],
                  },
                },
              }
            }
          },
        }
      }
    },
    operationValidator: {
      type: 'array',
      minItems: 1,
      items: {
        additionalProperties: false,
        required: [
          'type',
          'validatorFilter',
        ],
        type: 'object',
        properties: {
          type: {
            type: 'string',
          },
          validatorFilter: {
            type: 'array',
            minItems: 1,
            items: {
              additionalProperties: false,
              required: ['type', 'validatorFilterByType'],
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['ValidatorFilterByType'],
                },
                validatorFilterByType: {
                  type: 'array',
                  maxItems: 2,
                  minItems: 1,
                  uniqueItems: true,
                  items: {
                    type: 'string',
                    enum: ['CreateWebLedgerRecord', 'UpdateWebLedgerRecord'],
                  },
                },
              }
            }
          },
          approvedSigner: {
            type: 'array',
            minItems: 1
          },
          minimumSignaturesRequired: {
            type: 'integer',
            minimum: 1
          }
        }
      }
    },
    proof: schemas.linkedDataSignature2020(),
    sequence: {
      type: 'integer',
      minimum: 0,
    },
    type: {
      type: 'string',
      enum: ['WebLedgerConfiguration']
    }
  },
};

// NOTE: the ledgerNode API only uses this validator for validating a
// configuration event included in a genesis block
const genesisLedgerConfigurationEvent = {
  title: 'Genesis WebLedgerConfigurationEvent',
  type: 'object',
  additionalProperties: false,
  required: ['@context', 'ledgerConfiguration', 'type'],
  properties: {
    '@context': schemas.jsonldContext(constants.WEB_LEDGER_CONTEXT_V1_URL),
    ledgerConfiguration,
    type: {
      type: 'string',
      enum: ['WebLedgerConfigurationEvent']
    }
  }
};

module.exports.ledgerConfiguration = () => ledgerConfiguration;
module.exports.genesisLedgerConfigurationEvent = () =>
  genesisLedgerConfigurationEvent;
module.exports.operation = () => ({
  title: 'WebLedgerOperation',
  anyOf: [createOperation, updateOperation]
});
