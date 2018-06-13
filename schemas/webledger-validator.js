/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */

const createOperation = {
  title: 'CreateWebLedgerRecord',
  required: true,
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['CreateWebLedgerRecord'],
      required: true
    },
    record: {
      type: 'object',
      required: true,
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          required: true
        }
      }
    }
  }
};

const updateOperation = {
  title: 'UpdateWebLedgerRecord',
  required: true,
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['UpdateWebLedgerRecord'],
      required: true
    },
    recordPatch: {
      type: 'object',
      required: true,
      properties: {
        target: {
          type: 'string',
          minLength: 1,
          required: true
        }
      }
    }
  }
};

module.exports.operation = () => ({
  title: 'WebLedgerOperation',
  required: true,
  type: [createOperation, updateOperation]
});
