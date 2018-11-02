/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {constants} = require('bedrock').config;
const {schemas} = require('bedrock-validation');

// TODO: create schemas for each proof type
const proof = {
  title: 'Operation Proof',
  // jws is not required, EquihashProof2018 does not include creator
  required: [
    'created', 'type'
  ],
  type: 'object',
  properties: {
    capability: {type: 'string'},
    capabilityAction: {type: 'string'},
    creator: schemas.url(),
    created: schemas.w3cDateTime(),
    equihashParameterK: {type: 'integer'},
    equihashParameterN: {type: 'integer'},
    jws: {type: 'string'},
    nonce: {type: 'string'},
    proofPurpose: {type: 'string'},
    proofValue: {type: 'string'},
    type: {
      anyOf: [
        schemas.jsonldType('Ed25519Signature2018'),
        schemas.jsonldType('RsaSignature2018'),
        schemas.jsonldType('EquihashProof2018'),
      ]
    },
  },
  additionalProperties: false
};

const createOperation = {
  title: 'CreateWebLedgerRecord',
  // proof is not required
  required: [
    '@context',
    'record',
    'type'
  ],
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
    type: {
      type: 'string',
      enum: ['CreateWebLedgerRecord'],
    },
    record: {
      required: ['@context', 'id'],
      // additional properties are allowed here
      type: 'object',
      properties: {
        '@context': schemas.jsonldContext(),
        id: schemas.url()
      }
    },
    proof: {
      anyOf: [
        proof, {
          type: 'array',
          items: proof
        }
      ]
    }
  },
  additionalProperties: false
};

const updateOperation = {
  title: 'UpdateWebLedgerRecord',
  // proof is not required
  required: [
    '@context', 'recordPatch', 'type'
  ],
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
    type: {
      type: 'string',
      enum: ['UpdateWebLedgerRecord'],
    },
    recordPatch: {
      type: 'object',
      required: ['target'],
      properties: {
        target: schemas.url()
      }
    },
    proof: {
      anyOf: [
        proof, {
          type: 'array',
          items: proof
        }
      ]
    }
  },
  additionalProperties: false
};

const ledgerConfiguration = {
  title: 'WebLedgerConfiguration',
  additionalProperties: false,
  required: [
    '@context',
    'consensusMethod',
    // 'electorSelectionMethod',
    'ledger',
    // 'ledgerConfigurationValidator',
    // 'operationValidator',
    'type',
  ],
  type: 'object',
  properties: {
    '@context': schemas.jsonldContext(constants.WEB_LEDGER_CONTEXT_V1_URL),
    consensusMethod: {
      type: 'string',
    },
    electorSelectionMethod: {
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
    proof: {
      anyOf: [{
        type: 'object',
      }, {
        type: 'array',
      }]
    },
    type: {
      type: 'string',
      enum: ['WebLedgerConfiguration']
    }
  },
};

module.exports.ledgerConfiguration = () => ledgerConfiguration;
module.exports.operation = () => ({
  title: 'WebLedgerOperation',
  anyOf: [createOperation, updateOperation]
});
