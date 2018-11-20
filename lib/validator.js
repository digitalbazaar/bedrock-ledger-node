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

api.validate = async ({ledgerConfiguration, ledgerNode, operation}) => {
  // if config.get() is null, then the config we are validating
  // must be treated as the genesis config, so validate against itself
  const ledgerConfig = (await ledgerNode.config.get()) || ledgerConfiguration;
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
    _validateOperation(operation);
    validatorInput = operation;
  }
  if(ledgerConfiguration) {
    // a ledgerConfiguration is being validated
    validatorConfigs = ledgerConfig.ledgerConfigurationValidator || [];
    validatorInput = ledgerConfiguration;
  }
  if(validatorConfigs.length === 0) {
    // nothing to validate
    return;
  }

  if(typeof validatorInput !== 'object') {
    throw new TypeError('validatorInput must be an object.');
  }

  // run all the validators in parallel
  const validatorReports = await Promise.all(validatorConfigs.map(
    validatorConfig => _runValidator(
      {ledgerConfig, ledgerNode, validatorConfig, validatorInput})));

  // at least one validator MUST validate the operation
  if(!validatorReports.some(r => r.mustValidate)) {
    throw new BedrockError(
      'No validator was found for the given input.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        validatorInput,
        validatorReports
      });
  }

  // any validator that MUST validate should validate successfully
  if(!validatorReports.every(r => r.mustValidate ? r.validated : true)) {
    logger.debug(
      'Errors occurred during operation validation.', validatorReports);
    throw new BedrockError(
      'The input is invalid.', 'ValidationError', {
        httpStatusCode: 400,
        public: true,
        validatorInput,
        validatorReports
      });
  }

  // success
};

api.validateGenesisLedgerConfiguration = async ({ledgerConfiguration}) => {
  const validation = validate(
    'webledger-validator.ledgerConfiguration', ledgerConfiguration);
  if(!validation.valid) {
    throw validation.error;
  }
};

async function _runValidator(
  {ledgerConfig, ledgerNode, validatorConfig, validatorInput}) {
  const {api: validatorApi} = ledgerNode.injector.use(validatorConfig.type);
  const mustValidate = await validatorApi.mustValidate(
    {validatorInput, ledgerConfig, ledgerNode, validatorConfig});

  const report = {};
  report.validatorConfig = validatorConfig;
  report.mustValidate = mustValidate;
  if(!report.mustValidate) {
    return report;
  }

  try {
    await validatorApi.validate(
      {validatorInput, ledgerConfig, ledgerNode, validatorConfig});
  } catch(e) {
    report.error = serializeError(e);
  }

  report.validated = !report.error;
  report.timeStamp = Date.now();
  return report;
}

function _validateOperation(operation) {
  const context = operation['@context'];
  _validateContext(context);
  const validation = validate('webledger-validator.operation', operation);
  if(!validation.valid) {
    throw validation.error;
  }
}

function _validateContext(context) {
  const wlContextUrl = constants.WEB_LEDGER_CONTEXT_V1_URL;
  if(typeof context === 'string' && context !== wlContextUrl) {
    throw new BedrockError(
      `Operation context must be "${wlContextUrl}"`,
      'SyntaxError', {context});
  }
  if(Array.isArray(context) && context[0] !== wlContextUrl) {
    throw new BedrockError(
      `Operation context must contain "${wlContextUrl}" as the first element.`,
      'SyntaxError', {context});
  }
}
