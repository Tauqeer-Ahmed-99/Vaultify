import type { Href } from 'expo-router';

// Explicit groups select the right tab and its nested stack, including on cold links.
export const accountsRoute = '/(main)/(tabs)/(accounts)' as Href;
export const sharingRoute = '/(main)/(tabs)/sharing' as Href;
