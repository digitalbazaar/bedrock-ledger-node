/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
const {constants} = require('bedrock').config;
const {schemas} = require('bedrock-validation');

const proof = {
  title: '@context',
  required: true,
  type: 'object',
  properties: {
    type: schemas.url(),
    creator: schemas.url(),
    created: schemas.w3cDateTime()
  }
};

const createOperation = {
  title: 'CreateWebLedgerRecord',
  required: true,
  type: 'object',
  properties: {
    '@context': {
      type: [
        schemas.jsonldContext(constants.WEB_LEDGER_CONTEXT_V1_URL), {
          type: 'array',
          items: schemas.url()
        }
      ]
    },
    type: {
      type: 'string',
      enum: ['CreateWebLedgerRecord'],
      required: true
    },
    record: {
      type: 'object',
      required: true,
      properties: {
        id: schemas.url()
      }
    },
    proof: {
      type: [
        proof, {
          type: 'array',
          items: proof
        }
      ]
    }
  }
};

const updateOperation = {
  title: 'UpdateWebLedgerRecord',
  required: true,
  type: 'object',
  properties: {
    '@context': {
      type: [
        schemas.jsonldContext(constants.WEB_LEDGER_CONTEXT_V1_URL), {
          type: 'array',
          items: schemas.url()
        }
      ]
    },
    type: {
      type: 'string',
      enum: ['UpdateWebLedgerRecord'],
      required: true
    },
    recordPatch: {
      type: 'object',
      required: true,
      properties: {
        target: schemas.url()
      }
    },
    proof: {
      type: [
        proof, {
          type: 'array',
          items: proof
        }
      ]
    }
  }
};

module.exports.operation = () => ({
  title: 'WebLedgerOperation',
  required: true,
  type: [createOperation, updateOperation]
});
