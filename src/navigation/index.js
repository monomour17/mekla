import React, { useEffect, useRef, useState } from 'react';
import { setupNotificationListeners, registerForPushNotifications, savePushToken } from '../services/notifications';
import { View, Text, ActivityIndicator, Linking, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import useAppStore from '../store/useAppStore';
import { useAuth } from '../context/AuthContext';
import { selectionFeedback } from '../utils/haptics';

// Auth Screens
import PhoneScreen from '../screens/auth/PhoneScreen';
import OTPScreen from '../screens/auth/OTPScreen';

// Onboarding Screens
import AccountTypeScreen from '../screens/onboarding/AccountTypeScreen';
import BasicInfoScreen from '../screens/onboarding/BasicInfoScreen';
import LookingForScreen from '../screens/onboarding/LookingForScreen';
import ChildrenScreen from '../screens/onboarding/ChildrenScreen';
import PhotoScreen from '../screens/onboarding/PhotoScreen';
import FinishScreen from '../screens/onboarding/FinishScreen';
import BusinessInfoScreen from '../screens/onboarding/BusinessInfoScreen';
import BusinessMediaScreen from '../screens/onboarding/BusinessMediaScreen';
import BusinessAboutScreen from '../screens/onboarding/BusinessAboutScreen';

// Main Screens
import MeydanScreen from '../screens/main/MeydanScreen';
import CreatePostScreen from '../screens/main/CreatePostScreen';
import PostDetailScreen from '../screens/main/PostDetailScreen';
import CommunityScreen from '../screens/main/CommunityScreen';
import ChatsScreen from '../screens/main/ChatsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ProfileDetailScreen from '../screens/main/ProfileDetailScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import FrozenScreen from '../screens/main/FrozenScreen';
import EventsScreen from '../screens/main/EventsScreen';
import EventDetailScreen from '../screens/main/EventDetailScreen';
import CreateEventScreen from '../screens/main/CreateEventScreen';
import EventChatScreen from '../screens/main/EventChatScreen';
import EventRequestsScreen from '../screens/main/EventRequestsScreen';
import SavedPostsScreen from '../screens/main/SavedPostsScreen';
import BlockedUsersScreen from '../screens/main/BlockedUsersScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import BusinessProfileScreen from '../screens/main/BusinessProfileScreen';
import BusinessGalleryScreen from '../screens/main/BusinessGalleryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
    </Stack.Navigator>
  );
}

function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Normal kullanıcı akışı */}
      <Stack.Screen name="AccountType" component={AccountTypeScreen} />
      <Stack.Screen name="BasicInfo" component={BasicInfoScreen} />
      <Stack.Screen name="LookingFor" component={LookingForScreen} />
      <Stack.Screen name="Children" component={ChildrenScreen} />
      <Stack.Screen name="Photo" component={PhotoScreen} />
      <Stack.Screen name="Finish" component={FinishScreen} />
      {/* İşletme akışı */}
      <Stack.Screen name="BusinessInfo" component={BusinessInfoScreen} />
      <Stack.Screen name="BusinessMedia" component={BusinessMediaScreen} />
      <Stack.Screen name="BusinessAbout" component={BusinessAboutScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  Topluluk: ['home', 'home-outline'],
  Etkinlikler: ['calendar', 'calendar-outline'],
  Sohbetler: ['chatbubbles', 'chatbubbles-outline'],
  Profil: ['person', 'person-outline'],
};

function EtkinliklerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsHome" component={EventsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EventChat" component={EventChatScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
      <Stack.Screen name="BusinessGallery" component={BusinessGalleryScreen} />
      {/* BusinessProfileScreen (isOwner=true iken) buradan "Settings"e navigate
          ediyor — EventDetail/EventRequests ile aynı sebepten burada da
          doğrudan kayıtlı olması lazım. */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

function MeydanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MeydanHome" component={MeydanScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CommunityScreen" component={CommunityScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
      <Stack.Screen name="BusinessGallery" component={BusinessGalleryScreen} />
    </Stack.Navigator>
  );
}

function ProfilStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfilHome" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EventRequests" component={EventRequestsScreen} />
      {/* EventRequestsScreen buradan "EventDetail"e navigate ediyor — CreateEvent
          ile aynı sebepten (bkz. yukarı) burada da doğrudan kayıtlı olması lazım,
          aksi halde ProfilStack'te bulunamayıp "was not handled by any navigator"
          hatası veriyordu. */}
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      {/* EventDetailScreen (isCreator/katılımcı iken) buradan "EventChat"e
          navigate ediyor — yukarıdaki EventDetail ile aynı sebepten. */}
      <Stack.Screen name="EventChat" component={EventChatScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
      {/* PostDetailScreen (kendi gönderini düzenlerken) buradan "CreatePost"e
          navigate ediyor — SavedPosts → PostDetail yolu üzerinden buraya
          ulaşılabiliyor, aynı sebepten burada da doğrudan kayıtlı olması lazım. */}
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
      <Stack.Screen name="BusinessGallery" component={BusinessGalleryScreen} />
    </Stack.Navigator>
  );
}

// Notifications tüm tab'lardan erişilebilsin diye MainTabs'ı saran root stack
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

function SohbetlerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SohbetlerList" component={ChatsScreen} />
      <Stack.Screen name="EventChat" component={EventChatScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const unreadChatCount = useAppStore((s) => s.unreadChatCount);
  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => { selectionFeedback(); },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6C47FF',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { borderTopColor: '#f0f0f0' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = TAB_ICONS[route.name];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Topluluk" component={MeydanStack} />
      <Tab.Screen name="Etkinlikler" component={EtkinliklerStack} />
      <Tab.Screen
        name="Sohbetler"
        component={SohbetlerStack}
        options={{ tabBarBadge: unreadChatCount > 0 ? unreadChatCount : undefined }}
      />
      <Tab.Screen name="Profil" component={ProfilStack} />
    </Tab.Navigator>
  );
}

// Ağ donarsa (özellikle hotspot/mobil veri) fetch() süresiz asılı kalabilir —
// bu, kullanıcıyı splash ekranında sonsuza kadar kilitleyip uygulamayı
// kapatıp açmaya zorlardı. Belirli bir süre sonra "zaman aşımı" hatası fırlatıp
// çağırana devrediyoruz, sonsuz beklemeyi engelliyoruz. `controller` verilirse
// aynı anda gerçekten abort da ediyoruz — sadece pes etmiyoruz, altta asılı
// kalan isteği native seviyede de temizliyoruz (aksi halde "Tekrar Dene"
// sonrasında bile eski istek kaynakları meşgul tutmaya devam edebiliyordu).
function withTimeout(promise, ms, controller) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => {
      controller?.abort();
      reject(new Error('timeout'));
    }, ms)),
  ]);
}

async function checkProfile(userId, setHasProfile, setIsFrozen) {
  let data;
  try {
    const controller = new AbortController();
    const result = await withTimeout(
      supabase.from('profiles').select('id, is_active').eq('id', userId).single().abortSignal(controller.signal),
      15000,
      controller,
    );
    data = result.data;
  } catch (err) {
    // Zaman aşımı: ağ donmuş olabilir, hasProfile'ı tahmin etme — çağırana
    // bırak, kullanıcıya "tekrar dene" göstersin (yanlışlıkla mevcut bir
    // kullanıcıyı onboarding'e atmayalım)
    if (err?.message === 'timeout') throw err;
    // Diğer hatalar (örn. .single() sıfır satır bulduğunda) — yeni kullanıcı
    // varsayımıyla devam et, önceki davranış buydu
    setHasProfile(false);
    return;
  }

  try {
    if (data) {
      setHasProfile(true);
      setIsFrozen(data.is_active === false);
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
      // Geri dönen kullanıcılar: profil zaten var, push token'ı sessizce yenile.
      // İzin daha önce verilmişse sistem diyaloğu göstermez; yeni cihazda token güncellenir.
      try {
        const pushToken = await registerForPushNotifications();
        if (pushToken) await savePushToken(userId, pushToken);
      } catch { /* push başarısız olsa da uygulama çalışmaya devam eder */ }
    } else {
      // Profil yok → onboarding göster
      setHasProfile(false);
    }
  } catch {
    setHasProfile(false);
  }
}

export default function Navigation() {
  const { session, loading } = useAuth();
  const hasProfile = useAppStore((state) => state.hasProfile);
  const setHasProfile = useAppStore((state) => state.setHasProfile);
  const isFrozen = useAppStore((state) => state.isFrozen);
  const setIsFrozen = useAppStore((state) => state.setIsFrozen);
  const clearDataCache = useAppStore((state) => state.clearDataCache);
  const setColorBlindMode = useAppStore((state) => state.setColorBlindMode);

  // Session var ama profil kontrolü henüz bitmedi → splash göster, onboarding'i yakma
  const [profileChecking, setProfileChecking] = useState(false);
  // Ağ donduğunda (bkz. checkProfile/withTimeout) sonsuz splash yerine
  // kullanıcıya "tekrar dene" gösteriyoruz
  const [profileCheckTimedOut, setProfileCheckTimedOut] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('@color_blind_mode').then((val) => {
      if (val === 'true') setColorBlindMode(true);
    });
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      setProfileChecking(true);
      setProfileCheckTimedOut(false);
      checkProfile(session.user.id, setHasProfile, setIsFrozen)
        .catch((err) => {
          if (err?.message === 'timeout') setProfileCheckTimedOut(true);
        })
        .finally(() => {
          setProfileChecking(false);
        });
    } else if (session === null) {
      setHasProfile(false);
      setIsFrozen(false);
      clearDataCache();
    }
  }, [session, retryTick]);

  const navigationRef = useRef(null);

  // Push notification dinleyicilerini kur
  useEffect(() => {
    const cleanup = setupNotificationListeners(navigationRef);
    return cleanup;
  }, []);

  // Soğuk başlangıç deep link'i: uygulama kapalıyken linkle açıldığında
  // container splash/profil kontrolü bitene kadar mount edilmediği için
  // React Navigation'ın linking işleyişi başlangıç URL'ini kaçırabiliyor.
  // URL'i burada yakalayıp container hazır olduğunda elle yönlendiriyoruz.
  const pendingUrlRef = useRef(null);
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => { if (url) pendingUrlRef.current = url; })
      .catch(() => {});
  }, []);

  const consumePendingDeepLink = () => {
    const url = pendingUrlRef.current;
    if (!url || !session || !hasProfile || isFrozen) return;
    pendingUrlRef.current = null;
    const match = url.match(/event\/([0-9a-fA-F-]{36})/);
    if (match) {
      // Aynı ekrana ikinci navigate no-op olduğundan, linking'in kendisi
      // URL'i işlemişse bu çağrı zarar vermez.
      // 'Etkinlikler' MainTabs'ın içinde bir seviye derinde — root navigationRef'ten
      // önce MainTabs'a, sonra içinden Etkinlikler/EventDetail'e inmek gerekiyor
      // (bkz. NotificationsScreen.js'deki aynı sınıftan hata).
      navigationRef.current?.navigate('MainTabs', {
        screen: 'Etkinlikler',
        params: { screen: 'EventDetail', params: { eventId: match[1] } },
      });
    }
  };

  // Link'e tıklayan kullanıcı giriş yapmamışsa: login/onboarding bittiğinde
  // container zaten mount olduğundan onReady tekrar tetiklenmez — burada yakala.
  useEffect(() => {
    if (session && hasProfile && !isFrozen && navigationRef.current?.isReady?.()) {
      consumePendingDeepLink();
    }
  }, [session, hasProfile, isFrozen]);

  const splash = (
    <View style={{ flex: 1, backgroundColor: '#6C47FF', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: 1 }}>Mekla</Text>
      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>Etkinlikler & Topluluklar</Text>
      {profileCheckTimedOut ? (
        <>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 32, textAlign: 'center', paddingHorizontal: 32 }}>
            Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.
          </Text>
          <TouchableOpacity
            onPress={() => setRetryTick((t) => t + 1)}
            accessibilityRole="button"
            accessibilityLabel="Tekrar dene"
            style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ marginTop: 32 }} />
      )}
    </View>
  );

  if (loading || profileChecking) return splash;
  if (profileCheckTimedOut) return splash;

  const linking = {
    prefixes: ['mekla://', 'https://meklasocial.com', 'https://joinmeydan.com'],
    config: {
      screens: {
        Etkinlikler: {
          screens: {
            EventDetail: {
              path: 'event/:eventId',
              parse: { eventId: String },
            },
          },
        },
      },
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={session && hasProfile && !isFrozen ? linking : undefined}
      onReady={consumePendingDeepLink}
    >
      {!session ? (
        <AuthStack />
      ) : !hasProfile ? (
        <OnboardingStack />
      ) : isFrozen ? (
        <FrozenScreen />
      ) : (
        <MainStack />
      )}
    </NavigationContainer>
  );
}
