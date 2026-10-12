import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zomindia.twa',
  appName: 'Zomindia',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'zomindia.com'
  }
};

export default config;
