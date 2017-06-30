/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
require('bedrock-ledger');
require('bedrock-ledger-context');

// load ledger plugins
require('bedrock-ledger-storage-mongodb');
require('bedrock-ledger-consensus-uni');

require('bedrock-test');
bedrock.start();
