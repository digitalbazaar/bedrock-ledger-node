/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
const rdfCanonizeAndHash = require('./rdfCanonizeAndHash');
const {callbackify} = bedrock.util;

module.exports = callbackify(async data => {
  if(!data) {
    throw new TypeError('The `data` parameter must be a JSON-LD document.');
  }
  const {hash} = await rdfCanonizeAndHash(data);
  return hash;
});
