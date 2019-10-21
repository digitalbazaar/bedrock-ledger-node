/*!
 * Copyright (c) 2016-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

exports.hasValue = (obj, key, value) => [].concat(obj[key]).includes(value);
