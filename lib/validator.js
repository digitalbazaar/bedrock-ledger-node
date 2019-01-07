/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {constants} = require('bedrock').config;
const logger = require('./logger');
const serializeError = require('serialize-error');
const {validate} = require('bedrock-validation');
const {BedrockError} = bedrock.util;

const api = {};
module.exports = api;

api.validate = async (
  {basisBlockHeight, ledgerConfiguration, ledgerNode, operation}) => {
  // if config.get() is null, then the config we are validating
  // must be treated as the genesis config, so validate against itself
  const ledgerConfig = (await ledgerNode.config.get(
    {blockHeight: basisBlockHeight + 1})) || ledgerConfiguration;
  if(!ledgerConfig) {
    throw new BedrockError(
      'The ledger has not been configured.', 'InvalidStateError');
  }
  let validatorConfigs = [];
  let validatorInput;
  if(operation) {
    // an operation is being validated
    validatorConfigs = ledgerConfig.operationValidator || [];
    // validate the basic shape of the operation
    const result = _validateOperation(operation);
    if(!result.valid) {
      return result;
    }
    validatorInput = operation;
  }
  if(ledgerConfiguration) {
    // a ledgerConfiguration is being validated
    validatorConfigs = ledgerConfig.ledgerConfigurationValidator || [];
    validatorInput = ledgerConfiguration;
  }
  if(validatorConfigs.length === 0) {
    // nothing to validate
    return {valid: true};
  }

  if(typeof validatorInput !== 'object') {
    throw new TypeError('validatorInput must be an object.');
  }

  // run all the validators in parallel
  const validatorReports = await Promise.all(validatorConfigs.map(
    validatorConfig => _runValidator({
      basisBlockHeight, ledgerConfig, ledgerNode, validatorConfig,
      validatorInput
    })));

  let error;
  // at least one validator MUST validate the operation
  if(!validatorReports.some(r => r.mustValidate)) {
    error = new BedrockError(
      'No validator was found for the given input.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        validatorInput,
        validatorReports
      });
  }
  // any validator that MUST validate should validate successfully
  if(!validatorReports.every(r => r.mustValidate ? r.valid : true)) {
    logger.debug(
      'Errors occurred during operation validation.', validatorReports);
    error = new BedrockError(
      'The input is invalid.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        validatorInput,
        validatorReports
      });
  }

  return {valid: !error, error};
};

api.validateGenesisLedgerConfiguration = async ({ledgerConfiguration}) => {
  return validate(
    'webledger-validator.ledgerConfiguration', ledgerConfiguration);
};

async function _runValidator({
  basisBlockHeight, ledgerConfig, ledgerNode, validatorConfig, validatorInput
}) {
  const {api: validatorApi} = ledgerNode.injector.use(validatorConfig.type);
  const mustValidate = await validatorApi.mustValidate({
    basisBlockHeight, ledgerConfig, ledgerNode, validatorConfig, validatorInput
  });

  const report = {};
  report.validatorConfig = validatorConfig;
  report.mustValidate = mustValidate;
  if(!report.mustValidate) {
    return report;
  }

  let result;
  try {
    result = await validatorApi.validate({
      basisBlockHeight, ledgerConfig, ledgerNode, validatorConfig,
      validatorInput
    });
  } catch(error) {
    // if a validator throws, it is an uncaught exception. Serialize the error
    // so that it will appear in the validator report for debugging purposes
    result = {valid: false, error};
  }

  report.valid = result.valid;
  report.error = serializeError(result.error);
  report.timeStamp = Date.now();
  return report;
}

function _validateOperation(operation) {
  const context = operation['@context'];
  const result = _validateContext(context);
  if(!result.valid) {
    return result;
  }
  return validate('webledger-validator.operation', operation);
}

function _validateContext(context) {
  const wlContextUrl = constants.WEB_LEDGER_CONTEXT_V1_URL;
  if(typeof context === 'string' && context !== wlContextUrl) {
    const error = new BedrockError(
      `Operation context must be "${wlContextUrl}"`,
      'SyntaxError', {context});
    return {error, valid: false};
  }
  if(Array.isArray(context) && context[0] !== wlContextUrl) {
    const error = new BedrockError(
      `Operation context must contain "${wlContextUrl}" as the first element.`,
      'SyntaxError', {context});
    return {error, valid: false};
  }
  return {valid: true};
}
