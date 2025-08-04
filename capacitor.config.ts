import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.servimapp.app',
  appName: 'ServiMapp',
  webDir: 'out',
  backgroundColor: '#209ded',
  
  // Configuración Android
  android: {
    backgroundColor: '#209ded',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  
  // Configuración iOS
  ios: {
    backgroundColor: '#209ded',
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
    scrollEnabled: true,
    allowsLinkPreview: false
  },
  
  // Configuración del servidor
  server: {
    url: 'https://servimap-nyniz.web.app',
    cleartext: true
  },
  
  // Plugins básicos
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#209ded'
    },
    
    StatusBar: {
      style: 'default',
      backgroundColor: '#209ded'
    }
  }
};

export default config;
