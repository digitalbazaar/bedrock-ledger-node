/*
 * Copyright (c) 2017-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {util: {clone}} = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const mockData = require('./mock.data');

const rdfCanonizeAndHash = brLedgerNode.consensus._rdfCanonizeAndHash;

describe('rdfCanonizeAndHash API', function() {
  describe('WebLedgerConfiguration', function() {
    it('should canonize & hash', async function() {
      const data = clone(mockData.ledgerConfiguration);
      const result = await rdfCanonizeAndHash(data);
      should.exist(result);
      result.should.be.an('object');
      result.should.have.property('canonizedBytes');
      result.should.have.property('hash');
      result.should.eql(mockData.canonize.ledgerConfiguration);
    });
    it('should have a unique hash', async function() {
      const data = clone(mockData.ledgerConfiguration);
      data.ledger = 'foo';
      const result = await rdfCanonizeAndHash(data);
      should.exist(result);
      result.should.be.an('object');
      result.should.have.property('canonizedBytes');
      result.should.have.property('hash');
      result.should.not.eql(mockData.canonize.ledgerConfiguration);
    });
  });
  describe('CreateWebLedgerRecord', function() {
    it('should canonize & hash', async function() {
      const data = clone(mockData.operations.alpha);
      const result = await rdfCanonizeAndHash(data);
      should.exist(result);
      result.should.be.an('object');
      result.should.have.property('canonizedBytes');
      result.should.have.property('hash');
      result.should.eql(mockData.canonize.alpha);
    });
    it('should have a unique hash', async function() {
      const data = clone(mockData.operations.alpha);
      data.record.name = 'unique-hash-test-name';
      const result = await rdfCanonizeAndHash(data);
      should.exist(result);
      result.should.be.an('object');
      result.should.have.property('canonizedBytes');
      result.should.have.property('hash');
      result.should.not.eql(mockData.canonize.alpha);
    });

  });
  describe('UpdateWebLedgerRecord', function() {
    it('should canonize & hash ', async function() {
      const data = clone(mockData.operations.gamma);
      const result = await rdfCanonizeAndHash(data);
      should.exist(result);
      result.should.be.an('object');
      result.should.have.property('canonizedBytes');
      result.should.have.property('hash');
      result.should.eql(mockData.canonize.gamma);
    });
    it('should have a unique hash', async function() {
      const data = clone(mockData.operations.gamma);
      data.recordPatch.sequence = 10;
      const result = await rdfCanonizeAndHash(data);
      should.exist(result);
      result.should.be.an('object');
      result.should.have.property('canonizedBytes');
      result.should.have.property('hash');
      result.should.not.eql(mockData.canonize.gamma);
    });
  });
});
