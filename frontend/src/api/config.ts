import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Si corre en emulador Android o dispositivo físico, la IP no puede ser localhost
const getLocalApiUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/v1'; // Android emulator host alias
  }
  return 'http://localhost:3000/api/v1';
};

export const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || getLocalApiUrl();
