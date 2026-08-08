import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tg.pharmagarde.app',
  appName: 'PharmaGarde',
  webDir: 'dist/client',
  backgroundColor: "#234d3a",
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#234d3a",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
