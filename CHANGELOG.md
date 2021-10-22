# bedrock-ledger-node ChangeLog

## 15.2.0 - TBD

### Changed
- Upgraded `jsonld` to `^5.2.0`.

## 15.1.0 - 2021-09-24

### Changed
- Validator for `ledgerConfig.@context` is more lenient allowing more than 2 contexts
  & no longer requiring an ed25519 2020 context.
- Test project updated to more current dependencies.

## 15.0.0 - 2021-07-21

### Changed
- **BREAKING**: Upgrade to bedrock-ledger-context@19.

## 14.0.0 - 2021-07-16

### Changed
- **BREAKING**: Upgrade to witness selection.
- Add latest block summary cache.
- Fix caching bug that resulted in failed witness pool upgrades.

## 13.0.0 - 2021-07-02

### Changed
- **BREAKING**: Upgrade to 2020 cryptosuites.
- Update to latest lru-memoize@2.

### Added
- Add `getNodeRecord` API.

## 12.0.0 - 2021-04-29

### Changed
- **BREAKING**: Remove option to set work scheduler concurrency to more than
  one per instance. This simplifies the design; there are very few (if any)
  use cases for servicing more than one ledger node per core.
- **BREAKING**: `meta.deleted` is set to `-1` on records that have not been
  deleted to enable covered queries.
- **BREAKING**: Indexes have been changed to enable better coverage.
- Change default work session grace period to 1 minute.

### Added
- Add cache for LedgerNodeConfig.get API.
- Add cache for LedgerNodeOperations.exists API.

## 11.1.0 - 2021-01-11

### Added
- Implement LedgerNodePeers API.

## 11.0.0 - 2020-12-01

### Changed
- **BREAKING**: Use `bedrock-mongodb` 8.1.x.
- **BREAKING**: Remove callback version of the API (now promises only).
- **BREAKING**: Update consensus ledger work scheduler API to address
  potential race conditions that impact performance.
- Updated usage of MongoDB api to version 3.5.
- Use `collection.{updateOne, updateMany}` over `collection.update`.
- Pass `{projection}` to various methods as an option.

### Added
- Istanbul (nyc) code coverage.
- Github Actions CI tests.

## 10.1.2 - 2020-11-19

### Changed
- Name `rdfCanonizeAndHash` for easier profiling.

## 10.1.1 - 2019-12-11

### Changed
- Update jsonld.js related deps.

## 10.1.0 - 2019-12-11

### Added
- Implement getLatestBlockHeight API.

### Changed
- Use getLatestBlockHeight API to populate the basisBlockHeight property
  for new operations.
- Do not require `record['@context']` in `CreateWebLedgerRecord` documents.

## 10.0.0 -2019-12-09

### Changed
- **BREAKING**: Use bedrock-ledger-context@15.
- Use jsonld@2.

## 9.0.2 - 2019-11-12

### Changed
- Specify peer dep bedrock-ledger-context@14.

## 9.0.1 - 2019-10-22

### Changed
- Replace `hasValue` helper API with `bedrock.util.hasValue`.

## 9.0.0 - 2019-10-22

### Changed
- **BREAKING**: Refactor for use with bedrock@2.

## 8.0.3 - 2019-10-15

### Changed
- Update peer dependencies.
- Update dependencies in test suite.

## 8.0.2 - 2019-08-03

### Fixed
- Move scheduling of consensus work from `bedrock.init` event to
  `bedrock.ready`. Since bedrock-jobs@3 does not depend on `bedrock-mongodb`
  consensus work was being scheduled before Mongo collections were initialized.

## 8.0.1 - 2019-03-25

### Fixed
- Use bedrock-jobs@3 in peer dependencies.

## 8.0.0 - 2019-03-20

### Added
- Make the `validator` API public.

### Changed
- **BREAKING**: Use bedrock-jobs@3 which is not backwardly compatible.

## 7.2.0 - 2019-02-13

### Added
- Implement eslint-config-digitalbazaar and `npm run lint` script.

### Changed
- Use multibase@0.6.0.

## 7.1.0 - 2019-02-01

### Added
- Use JSON Schema to validate ledger configurations submitted via the
  `config.change` API.

## 7.0.0 - 2019-01-23

### Changed
- **BREAKING**: EquihashProof2018 is no longer supported on operations.

## 6.0.0 - 2019-01-17

### Changed
- **BREAKING**: Require `recordPatch` documents included in
  `UpdateWebLedgerRecord` operations to include `@context`.

## 5.1.0 - 2019-01-07

### Added
- Pass `basisBlockHeight` into validator APIs.

## 5.0.0 - 2018-12-31

### Changed
- **BREAKING**: Require `sequence` in ledger configurations.

### Added
- Operations and the genesis `WebLedgerConfigurationEvent` may include
  an optional `creator` property.
- Implement `rdfCanonizeAndHash` API that returns the Buffer that was used
  during the hashing operation. This Buffer can be used to measure the byte
  size of the operation.

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
- **BREAKING**: Changed names for ledger node permissions.
- **BREAKING**: Refactor validator APIs. Validators must use named parameter.
  Validators must also have a return value of {valid: <bool>, error: <Error>}.

## 3.0.0 - 2018-10-11

### Changed
- **BREAKING**: Change `capabilityAction` in the `Operation Proof` validation
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
