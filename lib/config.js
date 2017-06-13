/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const config = require('bedrock').config;

// permissions
var permissions = config.permission.permissions;
permissions.LEDGER_ACCESS = {
  id: 'LEDGER_ACCESS',
  label: 'Access Ledger',
  comment: 'Required to access a Ledger.'
};
permissions.LEDGER_CREATE = {
  id: 'LEDGER_CREATE',
  label: 'Create Ledger',
  comment: 'Required to create a Ledger.'
};
permissions.LEDGER_EDIT = {
  id: 'LEDGER_EDIT',
  label: 'Edit Ledger',
  comment: 'Required to edit a Ledger.'
};
permissions.LEDGER_REMOVE = {
  id: 'LEDGER_REMOVE',
  label: 'Remove Ledger',
  comment: 'Required to remove a Ledger.'
};
