# Vaultify

Vaultify is a ledger app for tracking money you send, receive, owe, and are owed. Keep personal records or share a ledger with other people, with payment notes, dates, and balances in Indian rupees (₹).

Use it to keep track of a loan to a friend, household payments, or a running account with a group. **Send** and **Receive** record payments you make elsewhere; they do not transfer money.

**[Download Vaultify for Android](https://github.com/Tauqeer-Ahmed-99/Vaultify/releases/latest)**

## Download and install

The public download is an Android APK, the file used to install the app. The current release does not include an iPhone or iPad download.

1. On your Android phone, open the [latest release](https://github.com/Tauqeer-Ahmed-99/Vaultify/releases/latest).
2. Expand **Assets** and download the file ending in `.apk`, such as `Vaultify_2_1_0.apk`. The **Source code** downloads are for developers.
3. Open the downloaded APK from your browser's downloads or your phone's Files app.
4. If Android asks, open **Settings** and allow that browser or Files app to **Install unknown apps** / **Allow from this source**. Wording varies by phone.
5. Return to the APK, tap **Install**, then **Open**. You can turn off that installation permission afterward.

To update an existing installation, install the newer APK over Vaultify without uninstalling first.

## Create your login

1. Open Vaultify and choose **Sign Up**.
2. Enter your full name, email address, and a password of at least six characters.
3. Tap **Create Login**. If you already have a login, choose **Sign In** instead.

Use an internet connection to sign in, save payments, and sync shared ledgers. Wait for a save to finish before closing the app; pending offline changes may be lost when the app restarts.

The app has two tabs: **Accounts** for your ledgers and balances, and **Sharing** for invitations, your sharing profile, notifications, and **Sign Out**.

## Create a ledger

On **Accounts**, tap **New Account**, choose a type, enter an account name, an optional description, and an opening date, then tap **Create Account**.

| Type | How it works |
| --- | --- |
| **Personal** | You manage the ledger and its payments. Leave the link field empty to keep it private, or link one person for read-only access. |
| **Group** | Invite other Vaultify users to view the ledger and add payments. Each person can edit or delete only their own payments. |

For example, create a personal ledger named “Loan to Alex” or a group ledger named “Household”. Use **Search accounts** to find a ledger by its name or description.

## Record payments and read balances

1. Open a ledger from **Accounts**.
2. Tap **Send** for money you paid out, or **Receive** for money you received.
3. Enter a positive amount in rupees, with up to two decimal places.
4. Add an optional note, choose the transaction date, and tap **Record Payment**.

The balance is the total sent minus the total received:

- **To Receive**: you have sent more than you have received.
- **To Send**: you have received more than you have sent.
- **Settled**: the two totals are equal.

For example, recording ₹1,000 sent to Alex shows **₹1,000 To Receive**. Recording a ₹400 repayment as **Received** leaves **₹600 To Receive**.

**Total Assets** on the Accounts tab adds the balances of included ledgers, offsetting amounts to send against amounts to receive. Group balances reflect the whole ledger's entries. The group creator can turn **Include in Total Assets** on or off for everyone; the ledger remains accessible either way. Personal ledgers always contribute to the total.

### Correct or delete entries

Tap a transaction you can edit, change its details, and tap **Save Changes**. Use **Search transactions** to find entries by note or group member name.

To delete payments, tap **Select**, select the entries, and tap **Delete**. In a group, you can edit or delete only your own entries, even if you created the group.

To edit or delete a ledger you created, return to **Accounts**, tap **Select**, and select it. **Edit** works with one selected ledger. Deleting a ledger permanently removes all its transactions and ends other people's access.

## Share a ledger

### Set up your sharing profile

Open **Sharing**. To let people find you:

- Choose a unique **Username** and tap **Save Username**. Usernames use 3–24 letters, numbers, or underscores and are permanent once saved.
- Tap **Verify Email**, follow the link in your email, then return to Vaultify and tap **Refresh Verification**. This enables lookup by your email address.

The other person must already have a Vaultify login and have opened the app to set up their sharing profile.

### Link a personal ledger to one person

In **New Account** or **Edit Account**, choose a personal ledger and enter the other person's exact email or `@username` in **Link email or username (optional)**. Tap **Verify Contact**, check the displayed person, then save. Their email must be verified even when you find them by username.

Saving immediately shares the entire ledger, including past payments, with that person. They can view it but cannot add, edit, or delete entries. No invitation acceptance is required. Their payment directions and balance are reversed to show their perspective: money you sent appears as money they received.

To stop sharing, edit the account, clear the link field, and tap **Save Changes**.

### Invite people to a group

1. Create a **Group** account. Its **Members** screen opens after saving; you can also open it later from the ledger.
2. Enter an existing user's exact email or `@username`, then tap **Send Invitation**.
3. Ask them to open **Sharing** and tap **Accept**. The ledger then appears in their **Accounts** tab. They can also choose **Reject**.

Invitations appear inside Vaultify. An email address is used to find the person; no invitation email is sent.

Accepted members can see the full ledger and add their own payments. The creator manages the account and can **Cancel Invitation** or **Remove Member** from **Members**. A member can choose **Leave Account**. Leaving or removal ends access, while their existing payments stay in the ledger. Rejoining requires a new invitation.

## Notifications

In **Sharing → Notifications**, turn on **Push notifications** and allow Android's permission prompt. Use **Enable / Retry on This Device** if registration needs another attempt.

Turn on **Hide transaction details in previews** to keep payment details out of notification previews. If alerts are blocked, open **System Notification Settings** from the same section.

If a save reports **Transaction saved** but notification delivery failed, the entry is already recorded. Tap **Done** and check the ledger before entering it again.

## Keep Vaultify updated

Version 2.1.0 and later support automatic downloads of compatible app fixes. Open the app while online, allow the update to download, then fully close and reopen it to apply the update. Larger changes still require a newer APK from the [latest release](https://github.com/Tauqeer-Ahmed-99/Vaultify/releases/latest). Older installations need an APK upgrade to gain automatic update support.

## Get help

- **Forgot your password?** On **Sign In**, tap **Forgot Password?**, enter your login email, and tap **Send Reset Link**. Check your inbox and spam folder.
- **Person not found?** Ask them to open Vaultify, save a username or verify their email, and tap **Refresh Verification**. Check the exact email or username you entered.
- **Missing an invitation?** Check **Sharing** while signed in to the intended login. Invitations are delivered in the app.
- **Ledger not loading?** Check your connection, pull down on **Accounts** to refresh, or use the displayed **Retry** / **Retry Connection** button. Access also ends if the creator removes you or deletes the ledger.
- **Need to report a problem?** [Open a GitHub issue](https://github.com/Tauqeer-Ahmed-99/Vaultify/issues) with your app version, phone model, and steps to reproduce it. Omit passwords and private ledger details.
