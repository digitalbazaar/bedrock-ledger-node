/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {constants} = require('bedrock').config;
const {schemas} = require('bedrock-validation');

const proof = {
  title: '@context',

  // TODO: update this schema for properties of PoW, possibly tighten this
  // up to allow only certain proof types: 'Ed25519Signature2018'
  // 'RsaSignature2018', make use of `schemas.linkedDataSignature2018()`

  // jws is not required
  required: [
    'creator', 'created', 'type'
  ],
  type: 'object',
  properties: {
    creator: schemas.url(),
    created: schemas.w3cDateTime(),
    jws: {
      type: 'string'
    },
    type: {
      type: 'string'
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
      oneOf: [
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
      oneOf: [
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
      oneOf: [
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
      oneOf: [
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
  oneOf: [createOperation, updateOperation]
});
