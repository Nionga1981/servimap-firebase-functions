import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.servimap.app',
  appName: 'ServiMap',
  webDir: 'out',
  backgroundColor: '#3B82F6',
  android: {
    backgroundColor: '#3B82F6',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    backgroundColor: '#3B82F6',
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false
  },
  server: {
    url: 'https://servimap-nyniz.web.app',
    cleartext: true
  }
};

export default config;
