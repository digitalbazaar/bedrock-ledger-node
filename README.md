[![Build Status](https://ci.digitalbazaar.com/buildStatus/icon?job=bedrock-ledger)](https://ci.digitalbazaar.com/job/bedrock-ledger)

# Bedrock Ledger

A [bedrock][] module for the creation and management of decentralized ledgers.

## Requirements

- npm v3+

## Quick Examples

```
npm install bedrock-ledger bedrock-ledger-storage-mongodb bedrock-ledger-authz-signature
```

```js
const bLedger = require('bedrock-ledger');
require('bedrock-ledger-storage-mongodb');
require('bedrock-ledger-authz-signature');

const actor = 'admin';
const options = {
  ledgerId: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  storage: 'mongodb',
  configBlock: {
    id: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59/blocks/1',
    type: 'WebLedgerConfigurationBlock',
    consensusMethod: {
      type: 'Continuity2017'
    },
    configurationAuthorizationMethod: {
      type: 'ProofOfSignature2016',
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    },
    writeAuthorizationMethod: {
      type: 'ProofOfSignature2016',
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    },
    signature: {
      type: 'RsaSignature2017',
      created: '2017-10-24T05:33:31Z',
      creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
      domain: 'example.com',
      signatureValue: 'eyiOiJJ0eXAK...EjXkgFWFO'
    }
  }
};

bLedger.create(actor, options, (err, ledgerNode) => {
  if(err) {
    throw new Error("Failed to create ledger:", err);
  }
  
  ledgerNode.events.create( /* create a new ledger event */);
  /* ... do other operations on the ledger */
});
```

## Configuration

For documentation on configuration, see [config.js](./lib/config.js).

## Ledger Node API

### Create a Ledger

Create a new ledger given a set of options to create the new
ledger. A Ledger Node API is returned that can then be used 
to operate on the ledger.

* actor - the actor performing the action.
* options - a set of options used when creating the ledger.
  * ledgerId (required) - the URI of the ledger.
  * storage (required) - the storage subsystem for the ledger.
  * configBlock (required) - the configuration block for the ledger.
* callback(err, ledger) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * ledgerNode - A ledger node API that can be used to
    perform actions on the newly created ledger.

```javascript
const bLedger = require('bedrock-ledger');

const options = {
  ledgerId: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  storage: 'mongodb',
  configBlock: {
    id: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59/blocks/1',
    type: 'WebLedgerConfigurationBlock',
    consensusMethod: {
      type: 'Continuity2017'
    },
    configurationAuthorizationMethod: {
      type: 'ProofOfSignature2016',
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    },
    writeAuthorizationMethod: {
      type: 'ProofOfSignature2016',
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    },
    signature: {
      type: 'RsaSignature2017',
      created: '2017-10-24T05:33:31Z',
      creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
      domain: 'example.com',
      signatureValue: 'eyiOiJJ0eXAK...EjXkgFWFO'
    }
  }
};

bLedger.create(actor, options, (err, ledgerNode) => {
  if(err) {
    throw new Error("Failed to create ledger:", err);
  }
  
  console.log("Ledger created", ledgerNode);
});
```

### Get a Ledger

Get an existing ledger node API given a set of options. 
A Ledger Node API is returned that can then be used 
to operate on the ledger.

* actor - the actor performing the action.
* options - a set of options used when creating the ledger.
  * ledgerId (required) - the URI of the ledger.
  * storage (required) - the storage subsystem for the ledger.
* callback(err, ledgerNode) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * ledgerNode - A ledger node API that can be used to
    perform actions on the newly created ledger.

```javascript
const bLedger = require('bedrock-ledger');

const options = {
  ledgerId: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59';
  storage: 'mongodb'
};

bLedger.get(actor, options, (err, ledgerNode) => {
  if(err) {
    throw new Error('Failed to retrieve ledger node API:', err);
  }
  
  ledgerNode.events.create( /* create a new ledger event */);
});
```

### Delete a Ledger

Delete an existing ledger given a set of options.

* actor - the actor performing the action.
* options - a set of options used when deleting the ledger.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise

```javascript
const bLedger = require('bedrock-ledger');

const actor = 'admin';
const options = {
  ledgerId: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  storage: 'mongodb'
};

bLedger.get(actor, options, (err, ledgerNode) => {
  if(err) {
    throw new Error('Failed to retrieve ledger node API:', err);
  }
  
  ledgerNode.delete(actor, options, err => {
    console.log('Ledger deleted.');
  });
});
```

## Blocks API

### Get a Ledger Block

node.blocks.get(blockId, options, callback)

## Events API

### Create a Ledger Event

node.events.create(event, options, callback)

### Get a Ledger Event

node.events.get(eventId, options, callback)

## Metadata API

node.meta.get(options, callback)

### Ledger Plugin Registration

ledgers.use(algorithmName, api)

[bedrock]: https://github.com/digitalbazaar/bedrock
