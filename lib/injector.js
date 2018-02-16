/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const BedrockError = bedrock.util.BedrockError;

// used to track registered plugins
const plugins = {};

class Injector {
  /**
   * Registers or retrieves a ledger plugin.
   *
   * A plugin can be registered to extend the capabilities of the ledger
   * subsystem by adding new storage, consensus, and authorization mechanisms.
   *
   * @param capabilityName (required) the name of the capability.
   * @param [capabilityValue | callback] either the value of the capability:
   *          type type type of plugin (e.g. 'storage', 'authorization',
   *            'consensus').
   *          api the javascript API for the plugin.
   *        or a callback to use this function as an asynchronous getter.
   */
  use(capabilityName, capabilityValue) {
    if(!capabilityName) {
      throw new TypeError('`capabilityName` is a required parameter.');
    }
    if(!capabilityValue) {
      throw new TypeError('`capabilityValue` is a required parameter.');
    }
    // this function is an asynchronous getter if the second value is a function
    let callback;
    if(typeof capabilityValue === 'function') {
      callback = capabilityValue;
    }

    const plugin = plugins[capabilityName];

    // asynchronous getter
    if(callback) {
      if(!plugin) {
        return callback(new BedrockError('Plugin not found.', 'DataError', {
          httpStatusCode: 400,
          public: true,
          plugin: capabilityName
        }));
      }
      return callback(null, plugin);
    }

    // synchronous setter
    if(plugin) {
      throw new BedrockError(
        'Plugin already registered.', 'DuplicateError', {
          capabilityName
        });
    }
    if(!(capabilityValue.api && capabilityValue.type)) {
      throw new TypeError(
        '`api` and `type` are required `capabililtyValue` properties.');
    }
    plugins[capabilityName] = capabilityValue;
  }
}

module.exports = new Injector();
