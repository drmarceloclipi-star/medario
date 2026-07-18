# ADR 0003: Account erasure tombstones and professional-profile continuity

- Status: accepted
- Date: 2026-07-18

## Context

Deleting Firebase Auth first leaves a valid ID token able to recreate Firestore data for up to one token lifetime. Patient accounts may also own notification, appointment and professional-integration records outside `users/{uid}`.

## Decision

Account deletion creates a server-only `deletedUsers/{uid}` tombstone before any cleanup. `finalizeAfter` is two hours after creation and `expiresAt` is 24 hours after creation; both exceed Firebase's normal one-hour ID-token lifetime. Firestore Rules and authenticated callables reject an active tombstone. `deleteMyAccount` remains the exception so an interrupted deletion can be retried after reauthentication.

The server revokes refresh tokens, performs idempotent cleanup, then deletes Firebase Auth. A scheduled finalizer reruns the full cleanup after the token window and removes the tombstone only after that sweep succeeds. Failed sweeps retain the tombstone for retry.

Professional deletion always removes data owned strictly by the deleted UID: its account mapping, OAuth states and pending profile-change requests including audits. Calendar credentials, availability and outbox records belong to the doctor profile and are removed only when no other active professional account owns that `doctorId`; otherwise they and the claim remain intact for the surviving owner. It does not delete `doctors/{doctorId}` or `publicDoctors/{doctorId}` because those records form the public medical directory independently of account ownership. The claim is released only when no other active professional account owns the doctor and no explicit different `claimedByUid` exists. Public and private profile content remains intact; ownership identifiers are removed only in that case.

Appointments remain as operational records. Their `patientUid` is removed and deletion metadata retained without a replacement personal identifier.

## Consequences

- Stale tokens cannot recreate deleted data during the residual-cleanup window.
- Account creation with the same Auth identity is rejected while the tombstone is active.
- Cleanup can be retried safely by the callable, Auth trigger or scheduler.
- Public medical directory continuity survives deletion of a professional login.
- Password accounts with an old session must reauthenticate before retrying deletion.
