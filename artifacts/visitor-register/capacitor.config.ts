import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.harbor.visitorregister',
  appName: 'Harbor Visitor Register',
  webDir: 'dist/public',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#f8fafc',
  },
};

export default config;
