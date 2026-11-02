import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useAuth } from './AuthContext';
import { useAccounts } from './AccountsContext';
import { notificationApi } from '../services/notificationApi';
import { listenForPush, openPushSettings, pushSupported, registerPush, setPushPreview, startPushSession, PushDestination } from '../services/push';
import { sharingRoute } from '../navigation/routes';

interface Preferences { enabled: boolean; hideDetails: boolean }
interface NotificationSettings extends Preferences {
  supported: boolean; ready: boolean; status: string | null; busy: boolean;
  enable: () => Promise<void>; settings: () => Promise<void>;
  save: (preferences: Preferences) => Promise<void>;
}
const Context = createContext<NotificationSettings | null>(null);
export function useNotificationSettings() { return useContext(Context)!; }
function destination(value: unknown): PushDestination | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const validKey = (key: unknown) => typeof key === 'string' && /^[\w-]{1,128}$/.test(key);
  if (data.v !== 1 || !validKey(data.eventId) || !validKey(data.recipientUid) || !validKey(data.ownerUid) || !validKey(data.accountId)) return null;
  if (!['transaction', 'link', 'invitation'].includes(String(data.type)) || !['personal', 'group'].includes(String(data.kind))) return null;
  if (data.type === 'transaction' && !validKey(data.transactionId)) return null;
  if ((data.type === 'invitation' && data.kind !== 'group') || (data.type === 'link' && data.kind !== 'personal')) return null;
  return { v: 1, eventId: data.eventId as string, recipientUid: data.recipientUid as string, ownerUid: data.ownerUid as string,
    accountId: data.accountId as string, type: data.type as PushDestination['type'], kind: data.kind as PushDestination['kind'],
    ...(data.type === 'transaction' ? { transactionId: data.transactionId as string } : {}) };
}
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: accountsLoading, error: accountsError } = useAccounts();
  const navigation = useRootNavigationState();
  const segments = useSegments();
  const [pending, setPending] = useState<PushDestination | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({ enabled: true, hideDetails: false });
  const [readyUid, setReadyUid] = useState<string | null>(null);
  const consumedEvent = useRef<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uid = user?.uid;
  const ready = !!uid && readyUid === uid;
  useEffect(() => listenForPush(data => { const parsed = destination(data); if (parsed) setPending(parsed); }), []);
  useEffect(() => {
    startPushSession(uid || null);
    setPushPreview(false, true);
    if (!user) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await notificationApi<Preferences>('preferences', undefined, user);
        if (!active) return;
        setPreferences(next); setPushPreview(next.enabled, next.hideDetails); setReadyUid(user?.uid || null);
        if (pushSupported && next.enabled) {
          const message = await registerPush(false);
          if (active) setStatus(message);
        }
      } catch (error) { if (active) setStatus(error instanceof Error ? error.message : 'Notification setup unavailable. Your ledgers still work.'); }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; subscription.remove(); startPushSession(null); setPushPreview(false, true); };
  }, [uid, user]);
  useEffect(() => {
    if (!pending || !navigation?.key || authLoading || !user || accountsLoading || accountsError || segments[0] !== '(main)') return;
    if (pending.recipientUid !== user.uid) { consumedEvent.current = pending.eventId; return; }
    if (consumedEvent.current === pending.eventId) return;
    if (pending.type === 'invitation') { consumedEvent.current = pending.eventId; router.push(sharingRoute); }
    else {
      const id = pending.kind === 'personal' && pending.ownerUid !== user.uid ? `linked_${pending.ownerUid}_${pending.accountId}` : pending.accountId;
      const navigate = (availability: { ledgerAvailable: boolean; transactionAvailable: boolean }) => {
        if (!active) return;
        consumedEvent.current = pending.eventId;
        // Local mapping only. Server check catches stale/offline realtime caches.
        router.push({ pathname: '/(main)/(tabs)/(accounts)/account/[id]', params: { id,
          notificationUnavailable: availability.ledgerAvailable ? undefined : 'ledger',
          ...(pending.transactionId ? { transactionId: pending.transactionId,
            transactionUnavailable: availability.transactionAvailable ? undefined : 'true' } : {}) } });
      };
      let active = true;
      void notificationApi<{ ledgerAvailable: boolean; transactionAvailable: boolean }>('destination', {
        kind: pending.kind, accountId: pending.accountId, ownerUid: pending.ownerUid,
        ...(pending.transactionId ? { transactionId: pending.transactionId } : {}),
      }, user).then(navigate).catch(() => navigate({ ledgerAvailable: false, transactionAvailable: false }));
      return () => { active = false; };
    }
  }, [pending, navigation?.key, user, authLoading, accountsLoading, accountsError, segments]);
  const save = async (next: Preferences) => {
    if (busy) return;
    setBusy(true);
    try {
      await notificationApi('preferences', next);
      setPreferences(next); setReadyUid(user?.uid || null); setPushPreview(next.enabled, next.hideDetails);
      setStatus(next.enabled ? 'Notification settings saved.' : 'Push notifications are off for your account.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  };
  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await notificationApi<Preferences>('preferences');
      setPreferences(next); setReadyUid(user?.uid || null);
      setPushPreview(next.enabled, next.hideDetails);
      if (!next.enabled) { setStatus('Turn on Push notifications above before registering this device.'); return; }
      setStatus(await registerPush(true));
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not enable notifications. Retry shortly.'); }
    finally { setBusy(false); }
  };
  return <Context.Provider value={{ ...preferences, supported: pushSupported, ready, status, busy, save, enable, settings: openPushSettings }}>{children}</Context.Provider>;
}
