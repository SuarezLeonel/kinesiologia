import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { DataSyncProvider } from './src/context/DataSyncContext';
import { RootNavigator } from './src/navigation/RootNavigator';

// Intercepta el retorno de OAuth en ventana emergente (popup) sin afectar la ventana principal
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const completeResult = WebBrowser.maybeCompleteAuthSession();
  if (completeResult.type === 'success' && window.opener) {
    try {
      window.close();
    } catch {}
  }
} else {
  WebBrowser.maybeCompleteAuthSession();
}

const AppContent = () => {
  const { isDark } = useAppTheme();

  useEffect(() => {
    // Inyección de fuentes y estilos de viewport 100dvh para entorno Web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const fontId = 'google-material-icons-font';
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
        document.head.appendChild(link);
      }

      const viewportStyleId = 'kinesio-viewport-height-reset';
      if (!document.getElementById(viewportStyleId)) {
        const style = document.createElement('style');
        style.id = viewportStyleId;
        style.textContent = `
          html, body, #root {
            min-height: 100dvh;
            min-height: -webkit-fill-available;
            height: 100%;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <DataSyncProvider>
            <AppContent />
          </DataSyncProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
