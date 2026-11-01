import { User } from 'firebase/auth';
import { equalTo, get, orderByChild, query, ref, remove, update } from 'firebase/database';
import { auth, database } from '../firebaseConfig';
import { PersonalLedgerContact, UserProfile } from '../types';

export const normalizeUsername = (value: string) => value.trim().replace(/^@/, '').toLowerCase();

export async function syncIdentity(user: User) {
  await update(ref(database, `profiles/${user.uid}`), {
    displayName: (user.displayName || 'Vaultify member').slice(0, 100),
    emailVerified: user.emailVerified,
  });
  // Email discovery is bound to a verified Auth claim, never a client-supplied identity.
  if (user.emailVerified && user.email) {
    await update(ref(database, `emailDirectory/${user.uid}`), { email: user.email.toLowerCase() });
  } else {
    await remove(ref(database, `emailDirectory/${user.uid}`));
  }
}

export async function claimUsername(user: User, value: string) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new Error('Use 3–24 letters, numbers, or underscores for your username.');
  }
  const profile = (await get(ref(database, `profiles/${user.uid}`))).val() as UserProfile | null;
  if (profile?.username && profile.username !== username) {
    throw new Error('Your username is already set.');
  }
  const target = ref(database, `usernames/${username}`);
  const existing = await get(target);
  if (existing.exists() && existing.val() !== user.uid) throw new Error('That username is taken. Choose another.');
  // The claim and profile commit together. Rules choose the winner when two
  // users request the same name, without leaving an orphan claim on failure.
  try {
    await update(ref(database), {
      [`usernames/${username}`]: user.uid,
      [`profiles/${user.uid}/username`]: username,
      [`profiles/${user.uid}/displayName`]: (user.displayName || 'Vaultify member').slice(0, 100),
    });
  } catch (error) {
    const claimed = await get(target).catch(() => null);
    if (claimed?.exists() && claimed.val() !== user.uid) throw new Error('That username is taken. Choose another.');
    throw error;
  }
}

export async function findMember(identifier: string): Promise<{ uid: string; name: string; emailVerified: boolean }> {
  const input = identifier.trim().toLowerCase();
  let uid: string | undefined;
  if (input.includes('@') && !input.startsWith('@')) {
    const snapshot = await get(query(ref(database, 'emailDirectory'), orderByChild('email'), equalTo(input)));
    const matches = Object.keys(snapshot.val() || {});
    if (matches.length > 1) throw new Error('This email matches multiple profiles. Invite by username instead.');
    uid = matches[0];
  } else {
    const username = normalizeUsername(input);
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Enter a valid email or username.');
    uid = (await get(ref(database, `usernames/${username}`))).val() || undefined;
  }
  if (!uid) throw new Error('Member not found. Ask them to open Vaultify and set a username or verify their email in Sharing.');
  const profile = (await get(ref(database, `profiles/${uid}`))).val() as UserProfile | null;
  return { uid, name: profile?.username ? `@${profile.username}` : profile?.displayName || 'Vaultify member', emailVerified: profile?.emailVerified === true };
}

export function normalizeContactIdentifier(value: string) {
  const input = value.trim().toLowerCase();
  if (input.includes('@') && !input.startsWith('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || input.length > 254) throw new Error('Enter a valid email address.');
    return input;
  }
  const username = normalizeUsername(input);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Enter a valid email or username.');
  return `@${username}`;
}

export async function findVerifiedLedgerContact(value: string): Promise<PersonalLedgerContact> {
  const identifier = normalizeContactIdentifier(value);
  const member = await findMember(identifier);
  if (member.uid === auth.currentUser?.uid) throw new Error('Choose another person to link this ledger to.');
  if (!member.emailVerified) throw new Error('This user needs a verified profile. Ask them to verify their email and refresh it in Sharing.');
  return { uid: member.uid, name: member.name, identifier };
}
