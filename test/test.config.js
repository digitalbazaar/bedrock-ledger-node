/*
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');
require('bedrock-permission');

const permissions = config.permission.permissions;
const roles = config.permission.roles;

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// MongoDB
config.mongodb.name = 'bedrock_ledger_node_test';
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

roles['bedrock-ledger.test'] = {
  id: 'bedrock-ledger.test',
  label: 'Test Role',
  comment: 'Role for Test User',
  sysPermission: [
    permissions.LEDGER_NODE_ACCESS.id,
    permissions.LEDGER_NODE_CREATE.id,
    permissions.LEDGER_NODE_REMOVE.id
  ]
};
