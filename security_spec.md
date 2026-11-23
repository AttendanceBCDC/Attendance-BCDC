# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Workspace Isolation**: Every clinic record (`therapists`, `clients`, `sppPackages`, `attendanceEntries`, `therapistClaims`) belongs to a verified `ownerId` (`request.auth.uid`) and cannot be read, listed, modified, or deleted by unverified or non-owner users (except the bootstrapped clinic admin `byardeliaco@gmail.com` with `email_verified == true`).
2. **Referential Integrity**: Every `attendanceEntries`, `therapistClaims`, and `sppPackages` document created by a user must reference an existing `clientId` (and `therapistId` where applicable) whose `ownerId` matches `incoming().ownerId`.
3. **Strict Schema & No Shadow Fields**: Every `create` validates exact required and allowed keys via `hasAll` + `hasOnly` and every `update` validates `isValid[Entity](incoming())` and `affectedKeys().hasOnly(...)`.
4. **Temporal & Identity Immutability**: `ownerId` and `createdAt` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Path ID & String Length Hardening**: Document IDs match `^[a-zA-Z0-9_-]+$` with max length 128; all strings enforce strict upper bounds.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/clients/client_1`.
2. Unverified email (`email_verified: false`) create on `/therapists/t_1`.
3. Identity spoofing on `/clients/client_2` (`ownerId: "victim_uid"`).
4. Shadow field injection (`isAdmin: true`) on `/users/uid_1` create.
5. Oversized ID poisoning (`1500`-char document ID) on `/attendanceEntries/{longId}`.
6. Cross-tenant `list` query without `ownerId == request.auth.uid`.
7. Orphaned `attendanceEntries` create referencing a non-existent `clientId`.
8. Invalid therapy enum (`code: "INVALID"`) on `/attendanceEntries/e_1`.
9. Client-forged timestamp (`createdAt: "2020-01-01"`) instead of `request.time`.
10. Immutable field mutation (`ownerId` changed) during `update` on `/therapists/t_1`.
11. Unbounded string poisoning (`notes` length > 240) on `/attendanceEntries/e_1`.
12. Terminal state bypass on `/therapistClaims/c_1` once `reconcileStatus == "resolved"` by non-admin.
