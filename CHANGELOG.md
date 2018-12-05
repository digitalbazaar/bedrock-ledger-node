# bedrock-ledger ChangeLog

## 4.1.0 - 2018-12-05

### Added
- Implement `basisBlockHeight`. `basisBlockHeight` is used to record on what
  basis ledger operations were validated. `basisBlockHeight` is recorded in
  `WebLedgerConfigurationEvent` and `WebLedgerOperationEvent` events. Peers
  receiving these types of events via gossip should validate the events and
  operations based on the state of the ledger indicated by `basisBlockHeight`.

## 4.0.0 - 2018-11-30

### Added
- Implement blocks.getLatestSummary API.

### Changed
- **BREAKING** Changed names for ledger node permissions.
- **BREAKING** Refactor validator APIs. Validators must use named parameter.
  Validators must also have a return value of {valid: <bool>, error: <Error>}.

## 3.0.0 - 2018-10-11

### Changed
- **BREAKING** Change `capabilityAction` in the `Operation Proof` validation
  schema to a string.

## 2.0.3 - 2018-09-24

### Fixed
- Fixed the `proof` validation schema.

## 2.0.2 - 2018-09-20

### Changed
- Use bedrock-ledger-context 2.x in test suite.

## 2.0.1 - 2018-09-20

### Changed
- Use bedrock-did-client 2.x.

## 2.0.0 - 2018-09-17

### Changed
- Use bedrock-validation 3.x.
- Improve `WebLedgerOperation` validation schema.
- Use bedrock-identity 6.x in test framework.

## 1.0.0 - 2018-09-11

- See git history for changes previous to this release.

## 0.3.5 - 2017-05-08

### Fixed
- Remove node_modules folder from repo.

## 0.3.4 - 2017-05-08

### Changed
- Upgrade to async@2.
- Utilize ES6 syntax.
- Add test suite.

## 0.3.3 - 2017-05-03

### Fixed
- Fix version of async used.

## 0.3.1 - 2017-05-02

### Fixed
- Fix bad version information.

## 0.2.0 - 2016-12-03

- See git history for changes previous to this release.
