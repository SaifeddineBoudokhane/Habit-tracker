import type { ConfigContext, ExpoConfig } from 'expo/config';

// CI passes VERSION_CODE so every APK counts as a newer version of the app on the phone.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    versionCode: Number(process.env.VERSION_CODE ?? 1),
  },
});
