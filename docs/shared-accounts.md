# Shared accounts

This feature uses the existing Firebase Authentication project and Realtime Database. It does not use Firestore, Cloud Functions, another database, or an email invitation service.

## Release

Deploy `database.rules.json` to the same RTDB instance used by `EXPO_PUBLIC_FIREBASE_RTDB_URL` **before releasing the app**. `firebase.json` points the Firebase CLI to this file. Select the correct Firebase project and database instance; no production project alias is committed.

```sh
npx firebase-tools deploy --only database --project <firebase-project-id>
```

For a project with multiple RTDB instances, configure the CLI database target for the instance in the app’s environment before deploying. Firebase rules are a separate deployment from an EAS build; EAS does not upload these rules. The project previously contained no rules file, so reconcile any additional production-only paths with the deny-by-default rules before deployment.

Enable Firebase Auth’s email/password provider and configure its verification email template and authorized domains. Keep the existing `EXPO_PUBLIC_FIREBASE_*` variables in the EAS environment. Build using the existing EAS profiles. Ship a fresh EAS binary: the dependency compatibility fixes include AsyncStorage 2.2.0, Firebase JS SDK 12, and SDK 57 patch updates. No generated `ios/` or `android/` files are needed.

## Using shared accounts

Create an account and choose **Group**. Its member screen opens after saving. The creator can invite an existing Vaultify user by their exact email or username, cancel a pending invitation, remove a member, and edit or delete the account.

The **Sharing** tab contains the invitation inbox and sharing profile. Members explicitly accept or reject invitations. A pending, rejected, cancelled, removed, or left membership never grants ledger access. Accepting adds the group account to the member’s home screen. Account and transaction changes update live.

Users can claim a permanent, case-insensitive username of 3–24 ASCII letters, numbers, or underscores. Email discovery requires a verified Firebase Auth email. Existing users must open the updated app to create their sharing profile, and refresh that profile after verifying their email. The person being invited must already have a Vaultify login and a discoverable username or verified email. Invitations appear inside Vaultify. Push delivery is implemented by the authenticated Vercel API described in [push-notifications.md](push-notifications.md); no invitation email is sent.

Everyone with access can read the complete shared ledger and add transactions. Only a transaction’s creator can change or delete it, including when another member is the group creator. Ownership and creation metadata are immutable. The interface labels transactions with their creator. Removing a member or leaving immediately ends server access, while their existing transactions stay in the ledger. Rejoining requires a new invitation and acceptance; original transaction ownership is retained. Deleting a group account permanently deletes the complete ledger for everyone.

The group ledger’s creator can use the single-line **Include in Total Assets** switch on its ledger screen to include or exclude its net balance from every member’s home summary. This applies to both **To Receive** and **To Send** balances. Members see only **Included in Total Assets** or **Excluded from Total Assets**, with no switch. RTDB rules restrict changes to the creator. Excluded ledgers remain visible with their complete balances and transactions. Existing and new group ledgers are included by default, and private ledgers always contribute to the summary.

## Data and compatibility

### Linked personal ledgers

In **New Account** or **Edit Account**, a personal ledger can optionally link to an existing user’s email or username. Select **Verify Contact** before saving. The contact must resolve to a registered user whose sharing profile contains a Firebase Auth-verified email flag. A username must belong to that UID; an email must match its verified email directory entry. Self-links, unknown users, invalid identifiers, and unverified profiles are rejected. If a contact changes while the form is open, verification is reset; the contact is resolved again when saving.

The verified flag is synchronized from the signed-in user’s Firebase Auth email-verification claim and protected by RTDB rules. Existing users must open the updated app, verify their email if needed, and refresh verification in Sharing so the proof is available. Display names are labels, not verified legal identities.

Linking immediately gives that person read-only access to this one ledger, including existing transactions. This is separate from group invitations and does not send an email. The creator alone manages the personal ledger and its transactions. The linked person sees each payment from their own perspective: a creator’s **Sent** payment becomes **Received**, a **Received** payment becomes **Sent**, and the balance and home summary contribution are reversed accordingly. The original payment direction is stored only once; mirrored values are calculated for display. The interface identifies the other party and labels the recipient’s ledger as read-only.

Editing the link requires fresh verification. Clear the contact field and save to return the ledger to private access. Linking, retargeting, and unlinking update the ledger and recipient discovery reference atomically; removing or changing the link revokes the old recipient’s access. Deleting a linked personal ledger also removes its recipient reference. Unlinked personal accounts continue to work without a contact or a data migration.

Deploy the updated rules before using this feature. The notification implementation now routes creation, linking and invitation reissue through an isolated Vercel backend; see [push-notifications.md](push-notifications.md) for required configuration, older-client compatibility and rollout order. Firebase Authentication and RTDB remain in place; no Cloud Function or Firestore is used.

| RTDB path | Purpose |
| --- | --- |
| `accounts/{uid}/{accountId}` | Personal ledgers in their existing location; only the creator writes, and an optional linked recipient can read the individual ledger |
| `personalLinks/{recipientUid}/{ownerUid}_{accountId}` | Recipient-only discovery references to linked personal ledgers |
| `groupAccounts/{accountId}` | One canonical shared ledger, creator, metadata, and transactions |
| `memberships/{accountId}_{recipientUid}` | Invitation and membership state, indexed by account and recipient |
| `profiles/{uid}` | Display name, optional username, and Auth-backed email-verification flag; no email stored here |
| `usernames/{normalizedUsername}` | Unique username claim mapped to an Auth UID |
| `emailDirectory/{uid}/email` | Email verified against the owner’s Firebase Auth token; lookup by exact email only |

Private accounts require no migration. Their old transactions without `ownerUid` continue to belong to their private account owner. New transaction ownership always comes from the signed-in user. There is no automatic conversion or duplication of private ledgers into groups. Routes are located in `src/app/`.

RTDB rules enforce membership, consent transitions, immutable ownership, exact-query discovery, and payload validation. Do not replace them with authenticated-wide `.read` or `.write` permissions: rules granted by an ancestor override restrictions below it. Display names are user-provided labels; Firebase UIDs determine access. Membership records preserve the names used when the invitation was sent.

Creating/reissuing invitations and other notification-producing mutations use authenticated Vercel endpoints with atomic RTDB mutations/idempotency and one-shot push attempts. Responding to invitations and editing transactions still use client RTDB transactions to resolve concurrent changes. Username claims and profiles commit atomically, and the rules enforce uniqueness. Multi-delete operations use atomic updates; new transactions and idempotency records commit atomically through the backend, followed by a one-shot push attempt. Realtime listeners are detached on sign-out, access changes, and screen cleanup. The Firebase JS SDK keeps pending writes in memory; this feature does not promise durable offline writes across app restarts.

## Local checks

```sh
npm run lint
npm run typecheck
```

No automated tests were added. Firebase rules must be deployed separately, and native behavior still needs verification on an EAS build with the configured Firebase project.
