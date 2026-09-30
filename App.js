import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import { AuthProvider } from './src/context/AuthContext';
import { queryClient } from './src/services/queryClient';
import { initMonitoring, Sentry } from './src/services/monitoring';

// Crash reporting'i mümkün olan en erken noktada başlat
initMonitoring();

// İlk render'a kadar native splash ekranda kalsın (beyaz ekran flaşını önler)
SplashScreen.preventAutoHideAsync();

function App() {
  useEffect(() => {
    // Sistem fontu kullanılıyor — beklenecek kaynak yok, splash hemen kapanır
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <OfflineBanner />
          <Navigation />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Sentry.wrap: native crash'leri ve touch event breadcrumb'larını yakalar
export default Sentry.wrap(App);
