// app.config.js — app.json'ın yerini alır, env değişkenlerini build sırasında okur.
// EAS build: eas env:create ile GOOGLE_MAPS_API_KEY eklenir.

const { withAndroidManifest } = require('@expo/config-plugins');

// Android Manifest'e Google Maps API key meta-data ekleyen custom plugin
const withGoogleMapsAndroid = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return cfg;

    const apiKey =
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
      process.env.GOOGLE_MAPS_API_KEY ??
      '';

    if (!apiKey) return cfg;

    // Varsa üzerine yaz, yoksa ekle
    if (!app['meta-data']) app['meta-data'] = [];
    const existing = app['meta-data'].find(
      (m) => m.$?.['android:name'] === 'com.google.android.geo.API_KEY'
    );
    if (existing) {
      existing.$['android:value'] = apiKey;
    } else {
      app['meta-data'].push({
        $: {
          'android:name': 'com.google.android.geo.API_KEY',
          'android:value': apiKey,
        },
      });
    }

    return cfg;
  });
};

module.exports = ({ config }) => {
  const cfg = {
    ...config,
    plugins: [
      'expo-asset',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#6C47FF',
        },
      ],
      '@react-native-community/datetimepicker',
      [
        'expo-calendar',
        {
          calendarPermission: 'Etkinlikleri takvimine ekleyebilmek için izin gereklidir.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Profil ve gönderi fotoğrafı seçmek için galeri erişimi gereklidir.',
          cameraPermission: 'Etkinlik ve profil fotoğrafı çekmek için kamera erişimi gereklidir.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Etkinlik sohbetinde konum paylaşmak için konum erişimi gereklidir.',
        },
      ],
    ],
  };

  return withGoogleMapsAndroid(cfg);
};
