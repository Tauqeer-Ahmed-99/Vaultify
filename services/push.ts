import type { User } from 'firebase/auth';
export interface PushDestination {
  v: 1; eventId: string; recipientUid: string; type: 'transaction' | 'link' | 'invitation';
  kind: 'personal' | 'group'; ownerUid: string; accountId: string; transactionId?: string;
}
export const pushSupported = false;
export function startPushSession(_uid: string | null) {}
export async function registerPush(_requestPermission = false): Promise<string> { return 'Push notifications are available in the Android and iOS app.'; }
export async function unregisterPush(_user: User): Promise<void> {}
export async function openPushSettings() {}
export function listenForPush(_listener: (data: unknown) => void): () => void { return () => {}; }
export function setPushPreview(_enabled: boolean, _hideDetails: boolean) {}
