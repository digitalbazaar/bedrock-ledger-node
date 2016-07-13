# Linked Data Ledgers Proof of Concept

This source code repository includes a proof-of-concept Linked
Data ledger. On start-up, the ledger does the following:

* initializes itself by writing a basic configuration block 
  to the ledger (if one doesn't already exist)
* enables writes to the ledger given a set of pre-authorized keys

The ledger in this demo has the following features:

* writes via digital signatures from pre-authorized keys to an
  append-only ledger
* exposes ledger internals via the [Flex Ledger][] data model 
  specification
* disk-only read/write protocol (no mirroring)
* public readability of ledger contents

To exercise the proof of concepts, a test suite is included
that tests:

* a node reading and applying the ledger configuration to grant
  or deny write authorization to the ledger
* writes of identity credentials/verifiable claims to blocks

## Installation

```
npm install
```

**Note**: This proof of concept requires a [host file entry][] 
for `dhs2016ledger.dev` pointing to `127.0.0.1` (localhost)
or the public IP address of your computer.

## Running the demo

```
npm start
```

then, direct a web browser to `https://dhs2016ledger.dev:18443/`

## Disclaimer

This proof of concept, a part of the "Credentials on Public/Private 
Linked Ledgers" project, has been funded in part by the United States 
Department of Homeland Security's Science and Technology Directorate 
under contract HSHQDC-16-C-00058. The content of this specification 
does not necessarily reflect the position or the policy of the U.S. 
Government and no official endorsement should be inferred.

[host file entry]:http://www.howtogeek.com/howto/27350/beginner-geek-how-to-edit-your-hosts-file/
[Flex Ledger]:https://digitalbazaar.github.io/flex-ledger/
