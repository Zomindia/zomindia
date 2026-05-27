import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zomindia.app',
  appName: 'zomindia',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
