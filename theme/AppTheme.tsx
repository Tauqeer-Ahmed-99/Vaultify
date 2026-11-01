import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Preserve Vaultify's existing purple theme and ledger palette.
export const colors = {
  background: '#0f0c29', surface: '#1a1a2e', raised: '#201d42',
  text: '#ffffff', secondary: '#d1cde2', muted: '#b9b4d2',
  accent: '#a78bfa', accentStrong: '#7c3aed', accentSoft: '#3c2860',
  positive: '#34d399', positiveSoft: '#173d37', negative: '#f87171', negativeSoft: '#492839',
  outgoing: '#fb923c', border: '#514965', input: '#15122f',
  controlBorder: '#88809d', scrim: 'rgba(0,0,0,0.65)',
};
export const backgroundGradient = ['#0f0c29', '#302b63', '#24243e'] as const;
export const ledgerColors = ['#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#f472b6', '#facc15', '#4ade80', '#60a5fa'];

const Preferences = createContext({ reduceMotion: true });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  return <Preferences.Provider value={{ reduceMotion }}>{children}</Preferences.Provider>;
}

export const useMotionPreferences = () => useContext(Preferences);
