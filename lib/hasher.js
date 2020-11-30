/*!
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
const rdfCanonizeAndHash = require('./rdfCanonizeAndHash');

module.exports = async data => {
  if(!data) {
    throw new TypeError('The `data` parameter must be a JSON-LD document.');
  }
  const {hash} = await rdfCanonizeAndHash(data);
  return hash;
};
