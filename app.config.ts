import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'Vaultify',
  slug: config.slug || 'react-native-assets-app',
  android: {
    ...config.android,
    // EAS secret file variable, or the ignored file from the existing Firebase app.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
});
