# External audit-chain anchoring design

## Records and publication

Once per UTC day, a scheduled job reads the verified head hash and event count for each published auction ledger and the platform ledger. It emits canonical JSON containing the UTC period, ledger scope, head hash, event count, prior manifest hash, and generation time. The manifest is signed with an Ed25519 key held by a managed key service; the application database stores only the public key and key identifier.

Publish the signed manifest to immutable, public object storage. Submit the SHA-256 digest of the signed manifest to an independently operated public timestamping or ledger service. Keep the provider proof beside the manifest. This keeps participant data and event payloads off the external ledger while allowing an independent verifier to check the signature, manifest chain, provider proof, and local auction audit chain.

## Operations and ownership

The **platform security owner**, assigned by the pilot organization from its `super_admin` roster, owns key rotation, access review, and weekly verification of anchor freshness. The service operator owns job health and retries. A stale or invalid anchor raises an operational alert and does not alter auction outcomes. Before implementation, the pilot must record the named security owner, select the managed key service and independent anchor provider, and define retention and recovery procedures in the operator runbook.

The signing key is separate from JWT, database, and audit-chain secrets. The external service receives only a digest. Provider credentials and retry state must be managed outside source control. Anchoring supplements the existing hash chain; it does not replace it.
