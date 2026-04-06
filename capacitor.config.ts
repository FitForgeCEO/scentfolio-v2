import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.scentfolio.app',
  appName: 'ScentFolio',
  webDir: 'dist',
  server: {
    // In production, the app loads from the built bundle.
    // For dev, uncomment the url below and point to your Vite dev server:
    // url: 'http://192.168.x.x:5173',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#191210',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#191210',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'ScentFolio',
  },
  android: {
    backgroundColor: '#191210',
  },
}

export default config
