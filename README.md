[![Build Status](https://ci.digitalbazaar.com/buildStatus/icon?job=bedrock-ledger)](https://ci.digitalbazaar.com/job/bedrock-ledger)

# Bedrock Ledger

A [bedrock][] module for the creation and management of
[Web Ledgers](https://w3c.github.io/web-ledger/).
The Web Ledger ecosystem consists of Ledger Agents,
Ledger Nodes, Ledgers, Blocks, and Events. This API
enables the management of ledger nodes, ledgers,
blocks, and events.

![An image of the Web Ledger ecosystem](https://w3c.github.io/web-ledger/diagrams/ecosystem.svg)

## The Ledger API

* Ledger Node API
  * api.add(actor, configEvent, options, (err, ledgerNode))
  * api.get(actor, ledgerId, options, (err, ledgerNode))
  * api.remove(actor, ledgerId, options, callback(err))
  * api.getNodeIterator(actor, options, callback(err, iterator))
* Ledger Node Metadata API
  * ledgerNode.meta.get(options, (err, ledgerMeta))
* Ledger Node Blocks API
  * ledgerNode.blocks.get(blockId, options, callback(err, block))
* Ledger Node Events API
  * ledgerNode.events.add(event, options, (err, event))
  * ledgerNode.events.get(eventId, options, (err, event))
* Ledger Node Plugin API
  * api.use(options, mongodbStorageApi)

## Quick Examples

```
npm install bedrock-ledger bedrock-ledger-storage-mongodb bedrock-ledger-authz-signature
```

```js
const ledger = require('bedrock-ledger');
require('bedrock-ledger-storage-mongodb');
require('bedrock-ledger-guard-signature');

const actor = 'admin';
const ledgerId = 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59';

ledger.get(actor, ledgerId, options, (err, ledgerNode) => {
  ledgerNode.events.add( /* new ledger event details go here */);
    /* ... do other operations on the ledger */
  });
});
```

## Configuration

For documentation on configuration, see [config.js](./lib/config.js).

## Ledger Node API

### Create a Ledger

Create a new ledger given a configuration event and a set
of options.

* actor - the actor performing the action.
* configEvent - the configuration Event for the ledger.
* options - a set of options used when creating the ledger.
  * genesis - if true, this is a new ledger that is being created
      (default: false).
  * storage - the storage subsystem for the ledger (default: 'mongodb').
  * owner - the owner of the ledger node (default: none, anyone can access
      the node).
* callback(err, ledger) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * ledgerNode - the ledger node associated with the ledger.

```javascript
const configEvent = {
  '@context': 'https://w3id.org/webledger/v1',
  type: 'WebLedgerConfigurationEvent',
  operation: 'Config',
  input: [{
    type: 'WebLedgerConfiguration',
    ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
    consensusMethod: {
      type: 'UnilateralConsensus2017'
    },
    eventGuard: [{
      type: 'ProofOfSignature2017',
      supportedEventType: 'WebLedgerEvent',
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    }, {
      type: 'ProofOfSignature2017',
      supportedEventType: 'WebLedgerConfigurationEvent',
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    }]
  }],
  signature: {
    type: 'RsaSignature2017',
    created: '2017-10-24T05:33:31Z',
    creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
    domain: 'example.com',
    signatureValue: 'eyiOiJJ0eXAK...EjXkgFWFO'
  }
};
const options = {
  genesis: true,
  owner: 'https://example.com/i/123'
};

brLedger.add(actor, configEvent, options, (err, ledgerNode) => {
  if(err) {
    throw new Error('Failed to create ledger:', err);
  }

  console.log('Ledger created:', ledgerNode.ledger);
});
```

### Get a Specific Ledger Node

Gets a ledger node given a ledgerId and a set of options.

* actor - the actor performing the action.
* ledgerId - the URI of the ledger.
* options - a set of options used when creating the ledger.
  * storage - the storage subsystem for the ledger (default 'mongodb').
* callback(err, ledgerNode) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * ledgerNode - A ledger node that can be used to
    perform actions on the ledger.

```javascript
const actor = 'admin';
const ledgerId = 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59';
const options = {};

ledger.get(actor,  ledgerId, options, (err, ledgerNode) => {
  if(err) {
    throw new Error('Failed to create ledger:', err);
  }

  console.log('Ledger created', ledgerNode.ledgerId);
});
```

### Delete a Ledger

Delete an existing ledger given a ledgerId and a set of options.

* actor - the actor performing the action.
* ledgerId - the URI of the ledger.
* options - a set of options used when deleting the ledger.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise

```javascript
const ledgerId = 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59';
const options = {};

ledger.remove(actor, ledgerId, options, err => {
  if(err) {
    throw new Error('Failed to delete ledger:', err);
  }

  console.log('Ledger deleted.');
});
```

### Iterate Through All Ledgers

Gets an iterator that will iterate over all ledgers in the system.
The iterator will return a ledgerNodeMeta which contains an
id that can be passed to the api.get() call to fetch an
instance of the ledgerNode storage for the associated ledger.

* actor - the actor performing the action.
* options - a set of options to use when retrieving the list.
* callback(err, iterator) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * iterator - An iterator that returns ledgerNodeMeta objects.

```javascript
const actor = 'admin';
const options = {};

bedrockLedger.getNodeIterator(actor, options, (err, iterator) => {
  if(err) {
    throw new Error('Failed to fetch iterator for ledger nodes:', err);
  }

  for(let ledgerNodeMeta of iterator) {
    console.log('Ledger node:',  ledgerNodeMeta);
  }
});
```

## Metadata API

### Get Ledger Metadata

Gets metadata associated with the ledger, such as most recent
configuration block and latest consensus block,
given a set of options.

* options - a set of options used when retrieving the ledger metadata.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.
  * ledgerMeta - metadata about the ledger.

```javascript
ledgerNode.meta.get(options, (err, ledgerMeta) => {
  if(err) {
    throw new Error('Ledger metadata retrieval failed:', err);
  }

  console.log('Ledger metadata:', ledgerMeta);
});
```

## Blocks API

### Get a Ledger Block

Gets a block from the ledger given a blockID and a set of options.

* blockId - the URI of the block to fetch.
* options - a set of options used when retrieving the block.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.

```javascript
const blockId = 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59/blocks/1';
const options = {};

ledgerNode.blocks.get(blockId, options, (err, block) => {
  if(err) {
    throw new Error('Block retrieval failed:', err);
  }

  console.log('Retrieved block:', blocks);
});
```

## Events API

### Create a Ledger Event

Creates an event to associate with a ledger given an event and a set of options.

* event - the event to associate with a ledger.
* options - a set of options used when creating the event.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.
  * event - the event that was written to the database.

```javascript
const event = {
  '@context': 'https://w3id.org/webledger/v1',
  type: 'WebLedgerEvent',
  operation: 'Create',
  input: [{
    '@context': 'https://schema.org/',
    id: 'https://example.com/events/123456'
    type: 'Concert',
    name: 'Big Band Concert in New York City',
    startDate: '2017-07-14T21:30',
    location: 'https://example.org/the-venue',
    offers: {
      type: 'Offer',
      price: '13.00',
      priceCurrency: 'USD',
      url: 'https://www.ticketfly.com/purchase/309433'
    }
  ],
  signature: {
    type: 'RsaSignature2017',
    created: '2017-05-10T19:47:15Z',
    creator: 'https://www.ticketfly.com/keys/789',
    signatureValue: 'JoS27wqa...BFMgXIMw=='
  }
}
const options = {};

ledgerNode.events.add(event, options, (err, event) => {
  if(err) {
    throw new Error('Failed to create the event:', err);
  }

  console.log('Event creation successful:', event.id);
});
```

### Get a Ledger Event

Gets an event associated with the ledger given an eventID
and a set of options.

* eventId - the event to fetch from the ledger.
* options - a set of options used when retrieving the event.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.
  * event - the event that was retrieved from the database.

```javascript
const eventId = 'ni:///sha-256;cGBSKHn2cBJ563oSt3SAf4OxZXXfwtSxj1xFO5LtkGkW';

ledgerNode.events.get(eventId, options, (err, event) => {
  if(err) {
    throw new Error('Event retrieval failed:', err);
  }

  console.log('Event retrieval successful:', events);
});
```

## Ledger Plugin Registration API

Enables plugins to register with the ledger such that they may be
used to extend the capabilities of the ledger subsystem by adding
new storage, consensus, and authorization mechanisms.

* options - a set of options used when retrieving the ledger metadata.
  * capabilityName (required) - the name of the capability
  * capabilityValue (required) - the value of the capability
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.

```javascript
// this code would be executed in a plugin
const bedrockLedger = require('bedrock-ledger');

const options = {
  capabilityName: 'storage',
  capabilityValue: 'mongodb'
};

bedrockLedger.use(options, mongodbStorageApi);
```

[bedrock]: https://github.com/digitalbazaar/bedrock
