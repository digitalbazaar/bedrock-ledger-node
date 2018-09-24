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
    capabilityAction: {
      required: ['id'],
      type: 'object',
      properties: {
        id: {type: 'string'},
      }
    },
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

module.exports.operation = () => ({
  title: 'WebLedgerOperation',
  anyOf: [createOperation, updateOperation]
});
