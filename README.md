# DHS SBIR 2016 Phase I - Linked Data Ledgers

This source code repository includes a proof-of-concept Linked
Data ledger that does the following:

* block writes are authorized via a Linked Data digital signature
  on block data, using any key specified in a list of authorized keys
* local disk only read/write protocol
* public readability
* no mirroring

Tests include:

* a node reading and applying the ledger configuration to grant
  or deny write authorization to the ledger
* writes of identity credentials/verifiable claims to blocks

**Note**: This demo requires a [host file entry][] for
`dhs2016ledger.dev` pointing to `127.0.0.1` (localhost).

## Installation

```
npm install
```

## Running the demo

```
npm start
```

then, direct a web browser to `https://dhs2016ledger.dev:18443/`

[host file entry]:http://www.howtogeek.com/howto/27350/beginner-geek-how-to-edit-your-hosts-file/
