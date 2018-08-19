/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {callbackify, BedrockError} = bedrock.util;
const {promisify} = require('util');

const api = {};
module.exports = api;

api.validate = callbackify(async (input, validatorConfigs, {ledgerNode}) => {
  if(validatorConfigs.length === 0) {
    // nothing to validate
    return;
  }

  // run all the validators in parallel
  const validatorReports = [];
  for(const validatorConfig of validatorConfigs) {
    const report = await _runValidator(input, validatorConfig, {ledgerNode});
    validatorReports.push(report);
  }

  // at least one validator MUST validate the operation
  if(!validatorReports.some(r => r.mustValidate)) {
    throw new BedrockError(
      'No validator was found for the given input.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        input,
        validatorReports
      });
  }

  // any validator that MUST validate should validate successfully
  if(!validatorReports.every(r => r.mustValidate ? r.validated : true)) {
    throw new BedrockError(
      'The input is invalid.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        input,
        validatorReports
      });
  }

  // success
});

async function _runValidator(input, validatorConfig, {ledgerNode}) {
  const {api: validatorApi} = ledgerNode.injector.use(validatorConfig.type);
  // FIXME: remove promisify once consensus method uses promises
  const mustValidate = await promisify(validatorApi.mustValidate)(
    input, validatorConfig, {ledgerNode});

  const report = {};
  report.validatorConfig = validatorConfig;
  report.mustValidate = mustValidate;
  if(!report.mustValidate) {
    return report;
  }

  try {
    // FIXME: remove promisify once consensus method uses promises
    await promisify(validatorApi.validate)(
      input, validatorConfig, {ledgerNode});
  } catch(e) {
    report.error = e;
  }

  report.validated = !report.error;
  report.timeStamp = Date.now();
  return report;
}
