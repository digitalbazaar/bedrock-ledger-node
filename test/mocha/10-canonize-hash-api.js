/*
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brLedgerNode = require('bedrock-ledger-node');
const mockData = require('./mock.data');

const rdfCanonizeAndHash = brLedgerNode.consensus._rdfCanonizeAndHash;

describe('rdfCanonizeAndHash API', function() {
  it('should canonize & hash WebLedgerConfiguration', async function() {
    const data = {...mockData.ledgerConfiguration};
    const result = await rdfCanonizeAndHash(data);
    should.exist(result);
    result.should.be.an('object');
    result.should.have.property('canonizedBytes');
    result.should.have.property('hash');
    result.should.eql(mockData.canonize.ledgerConfiguration);
  });
  it('should canonize & hash CreateWebLedgerRecord', async function() {
    const data = {...mockData.operations.alpha};
    const result = await rdfCanonizeAndHash(data);
    should.exist(result);
    result.should.be.an('object');
    result.should.have.property('canonizedBytes');
    result.should.have.property('hash');
    result.should.eql(mockData.canonize.alpha);
  });
  it('should canonize & hash UpdateWebLedgerRecord', async function() {
    const data = {...mockData.operations.gamma};
    const result = await rdfCanonizeAndHash(data);
    should.exist(result);
    result.should.be.an('object');
    result.should.have.property('canonizedBytes');
    result.should.have.property('hash');
    result.should.eql(mockData.canonize.gamma);
  });
});
