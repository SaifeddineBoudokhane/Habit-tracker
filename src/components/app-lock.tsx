import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';

import { Icon } from './icon';
import { Button } from './ui';

/** Re-lock after the app has been in the background this long. */
const GRACE_MS = 30_000;

// Whether this app session has been unlocked. Starts locked; module-level so Settings can mark it unlocked.
let unlocked = false;
const listeners = new Set<() => void>();
function setUnlocked(v: boolean) {
  unlocked = v;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Covers the app until the fingerprint / face / screen-lock check passes. */
export function AppLock() {
  const c = useColors();
  const { ready, settings } = useStore();
  const isUnlocked = useSyncExternalStore(subscribe, () => unlocked);
  const backgroundAt = useRef<number | null>(null);
  const authing = useRef(false);
  const locked = ready && settings.appLock && !isUnlocked;

  const unlock = useCallback(async () => {
    if (authing.current) return;
    authing.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Habit Tracker' });
      // If the phone's screen lock was removed, authentication can never succeed: don't lock you out.
      if (res.success || (!res.success && (res.error === 'not_enrolled' || res.error === 'passcode_not_set'))) setUnlocked(true);
    } finally {
      authing.current = false;
    }
  }, []);

  // Prompt straight away whenever the lock comes up.
  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  // Lock again after time in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (authing.current) return;
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current && Date.now() - backgroundAt.current > GRACE_MS) {
        backgroundAt.current = null;
        setUnlocked(false);
      }
    });
    return () => sub.remove();
  }, []);

  if (!locked) return null;
  return (
    <View style={[StyleSheet.absoluteFill, s.wrap, { backgroundColor: c.background }]}>
      <View style={[s.lockIcon, { backgroundColor: c.muted }]}>
        <Icon name="lock" size={40} color={c.text} />
      </View>
      <Text style={[s.title, { color: c.text }]}>Habit Tracker is locked</Text>
      <Button title="Unlock" icon="fingerprint" onPress={() => unlock()} style={{ minWidth: 180 }} />
    </View>
  );
}

export async function canUseAppLock(): Promise<boolean> {
  // Any screen lock counts (PIN, pattern, password or biometrics).
  return (await LocalAuthentication.getEnrolledLevelAsync()) > LocalAuthentication.SecurityLevel.NONE;
}

/** Asks for fingerprint / screen lock; on success the current session counts as unlocked. */
export async function confirmIdentity(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to turn on app lock' });
  if (r.success) setUnlocked(true);
  return r.success;
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 1000, elevation: 1000 },
  title: { fontSize: 20, fontWeight: '700' },
  lockIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
