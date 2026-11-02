import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { notificationApi } from './notificationApi';
export type { PushDestination } from './push';

export const pushSupported = true;
let sessionUid: string | null = null;
let previewEnabled = true;
let previewHidden = false;
let registrationTail: Promise<unknown> = Promise.resolve();
const installationKey = 'vaultify:push-installation';
async function installation() {
  const stored = await AsyncStorage.getItem(installationKey);
  if (stored) return JSON.parse(stored) as { deviceId: string; secret: string };
  const value = { deviceId: Crypto.randomUUID(), secret: `${Crypto.randomUUID()}${Crypto.randomUUID()}` };
  await AsyncStorage.setItem(installationKey, JSON.stringify(value));
  return value;
}
Notifications.setNotificationHandler({ handleNotification: async notification => {
  const data = notification.request.content.data;
  const allowed = previewEnabled && !!sessionUid && auth.currentUser?.uid === sessionUid && data?.recipientUid === sessionUid;
  const visible = allowed && !(previewHidden && data?.type === 'transaction');
  return { shouldShowBanner: visible, shouldShowList: visible, shouldPlaySound: visible, shouldSetBadge: false };
} });
export function setPushPreview(enabled: boolean, hideDetails: boolean) { previewEnabled = enabled; previewHidden = hideDetails; }
export function startPushSession(uid: string | null) { sessionUid = uid; }
export function registerPush(requestPermission = false): Promise<string> {
  const uid = sessionUid;
  const user = auth.currentUser;
  const run = async () => {
    if (!uid || user?.uid !== uid || sessionUid !== uid || auth.currentUser?.uid !== uid) return 'Sign in to enable notifications.';
    if (!Device.isDevice || Constants.appOwnership === 'expo') return 'Use a fresh Vaultify device build to enable push notifications.';
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('ledger-updates', {
      name: 'Ledger updates', importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && requestPermission && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!(permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL)) return 'Notifications are off. Enable them in system settings, then retry.';
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('The existing EAS project ID is missing.');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const proof = await installation();
    if (sessionUid !== uid || auth.currentUser?.uid !== uid) return 'Account changed. Retry notifications.';
    await notificationApi('devices', { ...proof, token, projectId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }, user);
    return 'Notifications enabled on this device.';
  };
  const result = registrationTail.then(run, run);
  registrationTail = result.catch(() => undefined);
  return result;
}
export async function unregisterPush(user: User) {
  // Serialize against an in-flight registration so it cannot re-subscribe after logout.
  sessionUid = null;
  await registrationTail.catch(() => undefined);
  const stored = await AsyncStorage.getItem(installationKey);
  if (stored) {
    try { await notificationApi('devices', { ...JSON.parse(stored), unregister: true }, user); }
    catch { sessionUid = user.uid; throw new Error('Connect to the internet and retry signing out so this device can stop receiving your notifications.'); }
  }
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
}
export async function openPushSettings() { await Linking.openSettings(); }
export function listenForPush(listener: (data: unknown) => void) {
  let active = true;
  const receive = (response: Notifications.NotificationResponse | null) => {
    if (active && response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      listener(response.notification.request.content.data);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    }
  };
  const taps = Notifications.addNotificationResponseReceivedListener(receive);
  void Notifications.getLastNotificationResponseAsync().then(receive).catch(() => undefined);
  const refresh = Notifications.addPushTokenListener(() => { void registerPush().catch(() => undefined); });
  return () => { active = false; taps.remove(); refresh.remove(); };
}
