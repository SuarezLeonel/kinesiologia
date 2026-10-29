import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const DEFAULT_CLOUD_API_URL = 'https://kinesiologia-backend.onrender.com/api/v1';

const getApiUrl = () => {
  // 1. Configuración explícita en app.json (extra.apiUrl)
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl;
  }

  // 2. Variable de entorno inyectada durante la compilación o en ejecución
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 3. En builds nativos (APK standalone / producción), conectar siempre al servidor en la nube
  if (!__DEV__) {
    return DEFAULT_CLOUD_API_URL;
  }

  // 4. En desarrollo Web local
  if (Platform.OS === 'web') {
    return DEFAULT_CLOUD_API_URL;
  }

  // 5. En desarrollo con Expo Go si Metro reporta host local
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest?.hostUri;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (
      hostIp &&
      hostIp !== 'localhost' &&
      hostIp !== '127.0.0.1' &&
      !hostIp.startsWith('192.168.56.')
    ) {
      return `http://${hostIp}:3000/api/v1`;
    }
  }

  return DEFAULT_CLOUD_API_URL;
};

export const API_BASE_URL = getApiUrl();
