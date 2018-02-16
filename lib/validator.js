/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const injector = require('./injector');
const BedrockError = bedrock.util.BedrockError;

const api = {};
module.exports = api;

api.validate = (input, validatorConfigs, callback) => {
  // run all the validators in parallel
  const validatorReports = [];
  async.each(validatorConfigs, (validatorConfig, callback) =>
    _runValidator(input, validatorConfig, (err, report) => {
      if(err) {
        return callback(err);
      }
      validatorReports.push(report);
      callback();
    }), err => {
    if(err) {
      return callback(err);
    }
    // at least one validator MUST validate the operation
    if(!validatorReports.some(r => r.mustValidate)) {
      return callback(new BedrockError(
        'No validator was found for the given input.', 'ValidationError', {
          httpStatusCode: 400,
          public: true,
          input,
          validatorReports
        }, err));
    }
    // any validator that MUST validate should validate successfully
    if(!validatorReports.every(r => r.mustValidate ? r.validated : true)) {
      return callback(new BedrockError(
        'The input is invalid.', 'ValidationError', {
          httpStatusCode: 400,
          public: true,
          input,
          validatorReports
        }, err));
    }
    // success
    callback();
  });
};

function _runValidator(input, validatorConfig, callback) {
  const report = {};
  async.auto({
    getValidator: callback => injector.use(validatorConfig.type, callback),
    mustValidate: ['getValidator', (results, callback) =>
      results.getValidator.api.mustValidate(
        input, validatorConfig, (err, mustValidate) => {
          if(err) {
            return callback(err);
          }
          report.validatorConfig = validatorConfig;
          report.mustValidate = mustValidate;
          callback(null, report);
        })],
    validate: ['mustValidate', (results, callback) => {
      const report = results.mustValidate;
      if(!report.mustValidate) {
        return callback(null, report);
      }
      results.getValidator.api.validate(
        input, validatorConfig, err => {
        report.error = err;
        report.validated = !err;
        report.timeStamp = Date.now();
        callback(null, report);
      });
    }]
  }, err => callback(err, report));
}
