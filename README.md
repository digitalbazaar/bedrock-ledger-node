# Bedrock Ledger

A [bedrock][] module for the creation and management of decentralized ledgers.

## Requirements

- npm v3+

## Quick Examples

```
npm install bedrock-ledger
```

```js
var actor = 'admin';
var ledgerConfigEvent = {
  '@context': 'https://w3id.org/flex/v1',
  id: 'did:c02915fc-672d-4568-8e6e-b12a0b35cbb3/events/1',
  type: 'LedgerConfigurationEvent',
  ledgerConfig: {
    id: 'did:c02915fc-672d-4568-8e6e-b12a0b35cbb3',
    type: 'LedgerConfiguration',
    name: 'test-ledger',
    description: 'A test ledger',
    storageMechanism: 'SequentialList',
    consensusAlgorithm: {
      type: 'ProofOfSignature2016',
      approvedSigner: [ 'https://example.org/keys/authorized-1' ],
      minimumSignaturesRequired: 1
    },
  },
  previousEvent: {
    hash: 'urn:sha256:0000000000000000000000000000000000000000000000000000000000000000';
  }
};

ledger.createLedger(actor, ledgerConfigEvent, {}, function(err, ledgerUrl) {
  if(err) {
    console.log('Ledger creation failed:', err);
  } else {
    console.log('Ledger created:', ledgerUrl);
  }
});
```

## Configuration

For documentation on configuration, see [config.js](./lib/config.js).

## API

### createLedger(actor, ledgerConfigEvent, options, callback)

Creates a ledger.

 * actor the Identity performing the action.
 * ledgerConfigEvent the ledger configuration.
 * options ledger creation options
 * callback(err, record) called once the operation completes.

### writeLedgerEvent(actor, ledgerName, ledgerEvent, options, callback)

Writes an event to a given ledger.

 * actor the Identity performing the action.
 * ledgerName the name of the ledger.
 * ledgerEvent the ledger event to write to the ledger.
 * options ledger write options
 * callback(err, record) called once the operation completes.

### getLedgerMetadata(actor, ledgerName, options, callback)

Gets metadata about a specific ledger in the system.

 * actor the Identity performing the action.
 * ledgerName the name of the ledger.
 * options ledger metadata query options
 * callback(err, record) called once the operation completes.
 */

### getAllLedgerMetadata(actor, options, callback)

Gets metadata about all ledgers in the system.

 * actor the Identity performing the action.
 * options ledger metadata query options
 * callback(err, record) called once the operation completes.

### getLedgerEvent(actor, ledgerName, eventId, options, callback)

Get ledger event metadata.

 * actor the Identity performing the action.
 * ledgerName the name of the ledger.
 * eventId the name of the ledger.
 * options ledger event query options
 * callback(err, record) called once the operation completes.

### getStateMachineObject(actor, ledgerName, objectId, options, callback)

Retrieves an object from the current state machine.

 * actor the Identity performing the action.
 * ledgerName the name of the ledger associated with the state machine.
 * objectId the id of the object to retrieve.
 * options ledger state machine query options
 * callback(err, record) called once the operation completes.

### calculateLedgerEventHash(ledgerEvent, options, callback)

Calculate a ledger event hash value.

 * actor the Identity performing the action.
 * ledgerEvent the ledger event.
 * options hash value generation options
 *    (algorithm) the digest algorithm to use. Defaults to 'sha256'.
 * callback(err, record) called once the operation completes.

[bedrock]: https://github.com/digitalbazaar/bedrock
