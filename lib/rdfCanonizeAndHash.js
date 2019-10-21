/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const crypto = require('crypto');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const jsonld = require('jsonld');
const multibase = require('multibase');
const multihash = require('multihashes');

module.exports = async data => {
  if(!data) {
    throw new TypeError('The `data` parameter must be a JSON-LD document.');
  }
  // canonize ledger event to nquads
  const canonized = await jsonld.canonize(data, {
    algorithm: 'URDNA2015',
    documentLoader,
    format: 'application/n-quads'
  });
  const canonizedBuffer = Buffer.from(canonized, 'utf8');
  const canonizedBytes = canonizedBuffer.length;
  const hash = crypto.createHash('sha256').update(canonizedBuffer).digest();
  const mh = multihash.encode(hash, 'sha2-256');
  const mb = multibase.encode('base58btc', mh).toString();
  return {canonizedBytes, hash: mb};
};
