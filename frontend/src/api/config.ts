import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Si corre en emulador Android o dispositivo físico, la IP no puede ser localhost
const getLocalApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000/api/v1';
  }

  // En Expo Go / Dispositivo móvil físico:
  // Detectar la IP de la máquina host desde la URI de desarrollo de Metro
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest?.hostUri;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:3000/api/v1`;
    }
  }

  // Fallback con la IP local de desarrollo para dispositivos físicos en la misma red Wi-Fi
  return 'http://192.168.0.5:3000/api/v1';
};

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  getLocalApiUrl();
