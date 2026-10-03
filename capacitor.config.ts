import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zomindia.twa',
  appName: 'Zomindia',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
