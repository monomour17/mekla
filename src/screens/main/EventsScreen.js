import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
  ScrollView,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOWS } from '../../constants/colors';
import EmptyState from '../../components/EmptyState';
import { EventListSkeleton } from '../../components/SkeletonLoader';
import { LABELS, MESSAGES } from '../../constants/strings';
import { formatDate } from '../../utils/dateFormat';
import { usePendingRatings } from '../../hooks/usePendingRatings';
import { useDiscoverEventsQuery, useMyEventsQuery } from '../../hooks/queries/useEventsQuery';
import { selectionFeedback } from '../../utils/haptics';
import HeaderBell from '../../components/HeaderBell';
import CityPickerModal from '../../components/CityPickerModal';
import { getCityCoords } from '../../utils/geocoding';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const CATEGORIES = [
  'Tümü',
  '🧸 Oyun Grubu',
  '🍷 Çift Buluşması',
  '🏕️ Doğa/Kamp',
  '👩 Sadece Anneler',
  '👨 Sadece Babalar',
  '👨‍👩‍👧 Aile Etkinliği',
  '🧑 Tekler Buluşması',
  '🎉 Diğer',
];

const PAYMENT_LABELS = {
  free: 'Ücretsiz',
  dutch: 'Alman Usulü',
  organizer: 'Organizatör Karşılar',
};

const BUSINESS_CATEGORY_LABELS = {
  cafe: '☕ Kafe', restaurant: '🍽️ Restoran',
  playground: '🧸 Oyun Alanı', sports: '⚽ Spor',
  venue: '🎪 Etkinlik Mekanı', other: '🏪 İşletme',
};

const BusinessListCard = memo(function BusinessListCard({ business, onPress }) {
  const logoUrl = business.photos?.[0] ?? null;
  return (
    <TouchableOpacity
      style={styles.businessCard}
      onPress={() => onPress(business)}
      activeOpacity={0.85}
    >
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.businessLogo} contentFit="cover" />
      ) : (
        <View style={[styles.businessLogo, styles.businessLogoFallback]}>
          <Text style={styles.businessLogoInitial}>
            {(business.business_name ?? business.display_name)[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.businessCardName} numberOfLines={1}>
          {business.business_name ?? business.display_name}
        </Text>
        <Text style={styles.businessCardCat}>
          {BUSINESS_CATEGORY_LABELS[business.business_category] ?? '🏢 İşletme'}
        </Text>
        {business.business_bio ? (
          <Text style={styles.businessCardBio} numberOfLines={2}>
            {business.business_bio}
          </Text>
        ) : null}
        <Text style={styles.businessCardCity}>📍 {business.city}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );
});

/**
 * PendingRatingBanner
 * Değerlendirme bekleyen en eski geçmiş etkinliği gösterir.
 * mine tab içinde FlashList ListHeaderComponent olarak kullanılır.
 * Rating tamamlanınca usePendingRatings re-fetch yapar → banner kapanır.
 */
function PendingRatingBanner({ event, onPress }) {
  if (!event) return null;
  return (
    <TouchableOpacity
      style={pendingStyles.card}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title} etkinliğini değerlendir`}
    >
      <View style={pendingStyles.iconWrap}>
        <Ionicons name="star" size={22} color={COLORS.warning} />
      </View>
      <View style={pendingStyles.textWrap}>
        <Text style={pendingStyles.label}>Değerlendirme Bekliyor</Text>
        <Text style={pendingStyles.title} numberOfLines={1}>{event.title}</Text>
      </View>
      <View style={pendingStyles.cta}>
        <Text style={pendingStyles.ctaText}>Değerlendir</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.warning} />
      </View>
    </TouchableOpacity>
  );
}

const pendingStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350f',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.warning,
  },
});

// useEventsQuery/useDiscoverEventsQuery/useMyEventsQuery hepsi React Query
// kullanıyor — structuralSharing (varsayılan açık) sayesinde her refetch'te
// queryFn yeni obje üretse bile, içeriği değişmeyen event'ler için React
// Query otomatik olarak ESKİ referansı koruyor. Bu yüzden burada Community
// feed'indeki gibi özel bir karşılaştırma fonksiyonuna gerek yok, düz
// memo() (referans eşitliği) yeterli — CommunityPostCard'dan daha basit.
const EventCard = memo(function EventCard({ event, onPress }) {
  const eventPassed = new Date(event.event_date) < new Date();
  const isClosed = event.status === 'closed';
  const fillRatio = (event._approvedCount ?? 0) / (event.max_participants || 1);
  const remaining = (event.max_participants || 0) - (event._approvedCount ?? 0);
  const isAlmostFull = !eventPassed && !isClosed && fillRatio >= 0.8 && remaining > 0;
  const isFillingFast = !eventPassed && !isClosed && fillRatio >= 0.5 && fillRatio < 0.8;
  const creatorName = event._creatorProfile?.display_name ?? '?';
  const creatorPhoto = event._creatorProfile?.photos?.[0] ?? null;
  const creatorRating = event._creatorRating;
  const isTrustedOrganizer =
    creatorRating?.avgRating != null &&
    creatorRating.avgRating >= 4.0 &&
    (creatorRating.reviewCount ?? 0) >= 3;
  const initials = creatorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleBadgeLabel =
    event._myRole === 'creator'
      ? 'Organizatör'
      : event._myStatus === 'pending'
        ? 'Onay Bekliyor'
        : 'Katılımcı';

  const roleBadgeBg =
    event._myRole === 'creator'
      ? COLORS.primary
      : event._myStatus === 'pending'
        ? COLORS.warning
        : '#10b981';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => onPress(event)}
      accessibilityRole="button"
      accessibilityLabel={`${event.title} etkinliği`}
    >
      {event.cover_photo_url ? (
        <Image
          source={{ uri: event.cover_photo_url }}
          style={styles.cardImage}
          contentFit="cover"
          accessibilityLabel={`${event.title} kapak fotoğrafı`}
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]} accessibilityElementsHidden>
          <Ionicons name="calendar" size={48} color="#c4b5fd" />
        </View>
      )}

      <View
        style={[
          styles.badgeContainer,
          eventPassed ? styles.badgeFinished
            : isClosed ? styles.badgeClosed
            : isAlmostFull ? styles.badgeAlmostFull
            : isFillingFast ? styles.badgeFillingFast
            : null,
        ]}
      >
        <Text style={[styles.badgeText, (eventPassed || isClosed || isAlmostFull || isFillingFast) && { color: COLORS.white }]}>
          {eventPassed ? 'Bitti'
            : isClosed ? 'Kayıt Kapandı'
            : isAlmostFull ? `🔥 Son ${remaining} Yer!`
            : isFillingFast ? '🚀 Hızla Doluyor'
            : 'Açık'}
        </Text>
      </View>

      {event._myRole && (
        <View style={[styles.roleBadge, { backgroundColor: roleBadgeBg }]}>
          <Text style={styles.roleBadgeText}>{roleBadgeLabel}</Text>
        </View>
      )}

      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.categoryText}>{event.category}</Text>
          <Text style={styles.paymentText}>
            {PAYMENT_LABELS[event.payment_type] ?? event.payment_type}
          </Text>
        </View>

        <Text style={styles.cardTitle}>{event.title}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>{formatDate(event.event_date)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {event.location_rough || event.city}
          </Text>
        </View>

        {isTrustedOrganizer && (
          <View style={styles.trustBanner} accessibilityLabel="Güvenilir Organizatör">
            <Ionicons name="shield-checkmark" size={13} color={COLORS.primary} />
            <Text style={styles.trustBannerText}>Mekla Yıldızı Organizatör</Text>
            {creatorRating?.avgRating != null && (
              <>
                <Ionicons name="star" size={12} color={COLORS.warning} style={{ marginLeft: 6 }} />
                <Text style={styles.trustBannerRating}>{creatorRating.avgRating.toFixed(1)}</Text>
                <Text style={styles.trustBannerCount}>({creatorRating.reviewCount})</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.organizerRow}>
          {creatorPhoto ? (
            <Image source={{ uri: creatorPhoto }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          <Text style={styles.organizerText} numberOfLines={1}>
            <Text style={{ fontWeight: '600' }}>{creatorName}</Text> tarafından
          </Text>
          {!isTrustedOrganizer && creatorRating?.avgRating != null && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={11} color={COLORS.warning} />
              <Text style={styles.ratingBadgeText}>
                {creatorRating.avgRating.toFixed(1)}
              </Text>
              {creatorRating.reviewCount > 0 && (
                <Text style={styles.ratingBadgeCount}>
                  ({creatorRating.reviewCount})
                </Text>
              )}
            </View>
          )}
          {isTrustedOrganizer && (
            <View style={styles.trustStar} accessibilityLabel="Mekla Yıldızı organizatör">
              <Ionicons name="shield-checkmark" size={11} color={COLORS.white} />
            </View>
          )}
        </View>

        <View style={styles.participantSection}>
          <View style={styles.participantTop}>
            <View style={styles.avatarStack}>
              {(event._participantAvatars ?? []).map((av, i) =>
                av.photo ? (
                  <Image
                    key={av.id}
                    source={{ uri: av.photo }}
                    style={[styles.stackAvatar, i > 0 && { marginLeft: -10 }]}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    key={av.id}
                    style={[styles.stackAvatarPlaceholder, i > 0 && { marginLeft: -10 }]}
                  >
                    <Text style={styles.stackAvatarInitial}>{av.initials}</Text>
                  </View>
                )
              )}
              {(event._participantAvatars ?? []).length === 0 && (
                <Ionicons name="people-outline" size={18} color="#aaa" />
              )}
            </View>

            <Text style={styles.participantCountText}>
              {event._approvedCount ?? 0}/{event.max_participants} katılımcı
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    (((event._approvedCount ?? 0) / (event.max_participants || 1)) * 100),
                    100
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function EventsScreen({ route, navigation }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── React Query ─────────────────────────────────────────────
  // cityOverride: başlıktaki 📍 ile geçici şehir değişimi (profil şehri sabit kalır)
  const [cityOverride, setCityOverride] = useState(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const discoverQuery = useDiscoverEventsQuery(cityOverride);
  const myEventsQuery = useMyEventsQuery();

  const events = discoverQuery.data?.events ?? [];
  const hasPhotos = discoverQuery.data?.hasPhotos ?? true;
  const myCity = discoverQuery.data?.city ?? '';
  const myEvents = myEventsQuery.data ?? [];

  // ── Local UI State ───────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterOnlyOpen, setFilterOnlyOpen] = useState(false);
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterTime, setFilterTime] = useState('all');
  const [activeTab, setActiveTab] = useState('discover');
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);

  const { pendingRatings } = usePendingRatings();
  const firstPendingRating = pendingRatings[0] ?? null;

  // Yeni etkinlik oluşturulunca veya profile dönüldüğünde fresh veri gerekir
  const needsRefreshRef = useRef(false);

  // ── Tab'dan gelen initialTab parametresi ────────────────────
  useEffect(() => {
    if (route.params?.initialTab === 'mine') {
      setActiveTab('mine');
    }
  }, [route.params?.initialTab]);

  // ── Harita için şehir koordinatı ─────────────────────────────
  const lastMapCityRef = useRef(null);
  useEffect(() => {
    if (!myCity || lastMapCityRef.current === myCity) return;
    lastMapCityRef.current = myCity;
    getCityCoords(myCity).then((coords) => {
      if (coords) {
        setMapRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        });
      }
    });
  }, [myCity, mapRegion]);

  // ── İşletmeler listesini çek ─────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'businesses') return;
    setBusinessesLoading(true);
    supabase
      .from('profiles')
      .select('id, display_name, business_name, business_category, business_bio, city, photos')
      .eq('account_type', 'business')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setBusinesses(data ?? []);
        setBusinessesLoading(false);
      });
  }, [activeTab]);

  // ── Focus: needsRefresh ise sorgular invalidate edilir ──────
  useFocusEffect(
    useCallback(() => {
      if (needsRefreshRef.current) {
        needsRefreshRef.current = false;
        queryClient.invalidateQueries({ queryKey: ['discoverEvents'] });
        queryClient.invalidateQueries({ queryKey: ['myEvents'] });
      }
    }, [queryClient])
  );

  // ── Refresh ──────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'discover') {
      await discoverQuery.refetch();
    } else {
      await myEventsQuery.refetch();
    }
    setRefreshing(false);
  }, [activeTab, discoverQuery, myEventsQuery]);

  // EventCard/BusinessListCard memo() ile sarılı — bu her render'da yeniden
  // oluşturulursa memo etkisiz kalır (bkz. Meydan/Topluluk feed'lerinde aynı
  // sebepten yapılan düzeltme).
  const navigateToEventDetail = useCallback((event) => {
    navigation.navigate('EventDetail', { eventId: event.id });
  }, [navigation]);

  const navigateToBusiness = useCallback((business) => {
    navigation.navigate('BusinessProfile', { businessId: business.id });
  }, [navigation]);

  // ── Filtre uygulama ──────────────────────────────────────────
  const applyFilters = () => {
    let result = events;

    if (activeCategory !== 'Tümü') {
      result = result.filter((e) => e.category === activeCategory);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.location_rough && e.location_rough.toLowerCase().includes(q))
      );
    }

    if (filterOnlyOpen) {
      result = result.filter((e) => e.status === 'open');
    }

    if (filterPayment !== 'all') {
      result = result.filter((e) => e.payment_type === filterPayment);
    }

    if (filterTime === 'today') {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      result = result.filter((e) => {
        const d = new Date(e.event_date);
        return d >= startOfDay && d < endOfDay;
      });
    } else if (filterTime === 'weekend') {
      result = result.filter((e) => {
        const d = new Date(e.event_date);
        return d.getDay() === 0 || d.getDay() === 6;
      });
    } else if (filterTime === 'next7days') {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      result = result.filter((e) => {
        const d = new Date(e.event_date);
        return d >= now && d <= nextWeek;
      });
    }

    return result;
  };

  const filtered = applyFilters();

  if (discoverQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <EventListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  if (discoverQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>📡</Text>
        <Text style={styles.emptyTitle}>Bağlantı Sorunu</Text>
        <Text style={styles.emptyText}>Etkinlikler yüklenemedi. İnternet bağlantını kontrol et.</Text>
        <TouchableOpacity
          style={[
            styles.fab,
            {
              position: 'relative',
              bottom: 'auto',
              right: 'auto',
              marginTop: 24,
              width: 'auto',
              height: 'auto',
              borderRadius: 14,
              paddingHorizontal: 28,
              paddingVertical: 14,
            },
          ]}
          onPress={() => discoverQuery.refetch()}
          accessibilityRole="button"
          accessibilityLabel="Tekrar dene"
        >
          <Text style={{ color: COLORS.white, fontSize: 15, fontWeight: '700' }}>
            {LABELS.retry}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{LABELS.events}</Text>
          {myCity ? (
            <TouchableOpacity
              style={styles.cityPill}
              onPress={() => setCityPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Şehir: ${myCity}. Değiştirmek için dokun`}
            >
              <Text style={styles.headerSubtitle}>📍 {myCity}</Text>
              <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
              {cityOverride && (
                <TouchableOpacity
                  onPress={() => setCityOverride(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Kendi şehrine dön"
                >
                  <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
        <HeaderBell />
      </View>

      <CityPickerModal
        visible={cityPickerVisible}
        title="Etkinlikleri Nerede Ara?"
        onSelect={(c) => { setCityOverride(c); setCityPickerVisible(false); }}
        onClose={() => setCityPickerVisible(false)}
      />

      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'discover' && styles.segmentBtnActive]}
          onPress={() => { selectionFeedback(); setActiveTab('discover'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'discover' }}
          accessibilityLabel={LABELS.discover}
        >
          <Ionicons
            name="compass-outline"
            size={16}
            color={activeTab === 'discover' ? COLORS.white : COLORS.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.segmentText, activeTab === 'discover' && styles.segmentTextActive]}>
            {LABELS.discover}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'businesses' && styles.segmentBtnActive]}
          onPress={() => { selectionFeedback(); setActiveTab('businesses'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'businesses' }}
          accessibilityLabel="İşletmeler"
        >
          <Ionicons
            name="storefront-outline"
            size={16}
            color={activeTab === 'businesses' ? COLORS.white : COLORS.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.segmentText, activeTab === 'businesses' && styles.segmentTextActive]}>
            İşletmeler
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'mine' && styles.segmentBtnActive]}
          onPress={() => { selectionFeedback(); setActiveTab('mine'); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'mine' }}
          accessibilityLabel={LABELS.myEvents}
        >
          <Ionicons
            name="person-outline"
            size={16}
            color={activeTab === 'mine' ? COLORS.white : COLORS.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.segmentText, activeTab === 'mine' && styles.segmentTextActive]}>
            {LABELS.myEvents}
          </Text>
          {myEvents.length > 0 && (
            <View style={styles.segmentBadge}>
              <Text style={styles.segmentBadgeText}>{myEvents.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'discover' && (
        <>
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Etkinlik veya mekan ara..."
                placeholderTextColor="#aaa"
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Etkinlik veya mekan ara"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Aramayı temizle"
                >
                  <Ionicons name="close-circle" size={18} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setShowFilterModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Filtreler"
            >
              <Ionicons name="options-outline" size={22} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mapToggleBtn}
              onPress={() => {
                selectionFeedback();
                setViewMode((m) => (m === 'list' ? 'map' : 'list'));
                setSelectedEvent(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={viewMode === 'list' ? 'Harita görünümü' : 'Liste görünümü'}
            >
              <Ionicons
                name={viewMode === 'list' ? 'map-outline' : 'list-outline'}
                size={22}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
            >
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                    onPress={() => { selectionFeedback(); setActiveCategory(cat); }}
                    accessibilityRole="button"
                    accessibilityLabel={cat}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {viewMode === 'list' ? (
            <FlashList
              data={filtered}
              keyExtractor={(item) => item.id}
              estimatedItemSize={400}
              renderItem={({ item }) => (
                <EventCard event={item} onPress={navigateToEventDetail} />
              )}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={COLORS.primary}
                />
              }
              ListEmptyComponent={(() => {
                const hasActiveFilter = activeCategory !== 'Tümü' || searchQuery.trim() || filterOnlyOpen || filterPayment !== 'all' || filterTime !== 'all';
                if (hasActiveFilter) {
                  return (
                    <EmptyState
                      icon="search-outline"
                      title="Sonuç Bulunamadı"
                      description="Bu filtreye uygun etkinlik yok. Filtreleri değiştirerek tekrar dene."
                      actionLabel="Filtreleri Sıfırla"
                      onAction={() => {
                        setActiveCategory('Tümü');
                        setSearchQuery('');
                        setFilterOnlyOpen(false);
                        setFilterPayment('all');
                        setFilterTime('all');
                      }}
                    />
                  );
                }
                return (
                  <View style={styles.pioneerEmpty}>
                    <Text style={styles.pioneerEmoji}>🔥</Text>
                    <Text style={styles.pioneerTitle}>Şehrinde ilk ateşi{'\n'}sen yak!</Text>
                    <Text style={styles.pioneerDesc}>
                      {myCity ? `${myCity}'de` : 'Bölgende'} henüz etkinlik yok.{'\n'}Mekla'nın ilk öncüsü ol ve{'\n'}çevrendeki aileleri bir araya getir.
                    </Text>
                    <TouchableOpacity
                      style={styles.pioneerBtn}
                      onPress={() => { needsRefreshRef.current = true; navigation.navigate('CreateEvent'); }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="İlk etkinliği oluştur"
                    >
                      <Ionicons name="add-circle-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                      <Text style={styles.pioneerBtnText}>İlk Etkinliği Oluştur</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            />
          ) : (
            /* ── Harita Görünümü ── */
            <View style={styles.mapContainer}>
              {mapRegion ? (
                <MapView
                  style={styles.map}
                  initialRegion={mapRegion}
                  showsUserLocation
                  showsMyLocationButton={false}
                  onPress={() => setSelectedEvent(null)}
                >
                  {filtered
                    .filter((e) => e.rough_latitude != null && e.rough_longitude != null)
                    .map((event) => {
                      const emoji = event.category?.split(' ')[0] ?? '📍';
                      const isSelected = selectedEvent?.id === event.id;
                      const roughCoord = { latitude: event.rough_latitude, longitude: event.rough_longitude };
                      return (
                        <React.Fragment key={event.id}>
                          {/* Tam konum değil — yaklaşık bölgeyi gösteren bulanık daire */}
                          <Circle
                            center={roughCoord}
                            radius={400}
                            strokeColor="rgba(108,71,255,0.25)"
                            fillColor="rgba(108,71,255,0.08)"
                          />
                          <Marker
                            coordinate={roughCoord}
                            onPress={() => { selectionFeedback(); setSelectedEvent(event); }}
                          >
                            <View style={[styles.markerWrap, isSelected && styles.markerWrapSelected]}>
                              <Text style={styles.markerEmoji}>{emoji}</Text>
                            </View>
                            <View style={[styles.markerTail, isSelected && styles.markerTailSelected]} />
                          </Marker>
                        </React.Fragment>
                      );
                    })}
                </MapView>
              ) : (
                <View style={styles.mapLoading}>
                  <Ionicons name="map-outline" size={48} color={COLORS.primary} />
                  <Text style={styles.mapLoadingText}>Harita yükleniyor...</Text>
                </View>
              )}

              {/* Koordinatsız etkinlik uyarısı */}
              {(() => {
                const withCoords = filtered.filter((e) => e.rough_latitude != null).length;
                const total = filtered.length;
                if (total > 0 && withCoords < total) {
                  return (
                    <View style={styles.mapBanner}>
                      <Ionicons name="information-circle-outline" size={14} color="#92400e" />
                      <Text style={styles.mapBannerText}>
                        {withCoords}/{total} etkinlik haritada gösteriliyor
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Seçili etkinlik kartı */}
              {selectedEvent && (
                <TouchableOpacity
                  style={styles.mapEventCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('EventDetail', { eventId: selectedEvent.id })}
                >
                  <View style={styles.mapEventCardLeft}>
                    {selectedEvent.cover_photo_url ? (
                      <Image
                        source={{ uri: selectedEvent.cover_photo_url }}
                        style={styles.mapEventThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.mapEventThumb, styles.mapEventThumbPlaceholder]}>
                        <Text style={{ fontSize: 22 }}>{selectedEvent.category?.split(' ')[0] ?? '📍'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.mapEventCardBody}>
                    <Text style={styles.mapEventTitle} numberOfLines={1}>{selectedEvent.title}</Text>
                    <Text style={styles.mapEventMeta} numberOfLines={1}>
                      {formatDate(selectedEvent.event_date)}
                    </Text>
                    <Text style={styles.mapEventMeta} numberOfLines={1}>
                      📍 {selectedEvent.location_rough || selectedEvent.city}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}

      {activeTab === 'businesses' && (
        businessesLoading ? (
          <EventListSkeleton count={4} />
        ) : businesses.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            title="Henüz işletme yok"
            description="Bölgenizdeki ilk işletmeler yakında burada görünecek."
          />
        ) : (
          <FlashList
            data={businesses}
            keyExtractor={(item) => item.id}
            estimatedItemSize={90}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <BusinessListCard business={item} onPress={navigateToBusiness} />
            )}
          />
        )
      )}

      {activeTab === 'mine' &&
        (() => {
          if (myEventsQuery.isLoading && !refreshing) {
            return (
              <SafeAreaView style={styles.container} edges={['top']}>
                <EventListSkeleton count={4} />
              </SafeAreaView>
            );
          }

          const now = new Date();
          const upcomingEvents = myEvents.filter((e) => new Date(e.event_date) >= now);
          const pastEvents = myEvents
            .filter((e) => new Date(e.event_date) < now)
            .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

          const sections = [];
          if (upcomingEvents.length > 0) {
            sections.push({ type: 'header', key: 'h-upcoming', title: 'Yaklaşan', count: upcomingEvents.length });
          }
          upcomingEvents.forEach((e) => sections.push({ type: 'event', key: e.id, event: e }));
          if (pastEvents.length > 0) {
            sections.push({ type: 'header', key: 'h-past', title: 'Geçmiş', count: pastEvents.length });
          }
          pastEvents.forEach((e) => sections.push({ type: 'event', key: e.id, event: e }));

          return (
            <FlashList
              data={sections}
              keyExtractor={(item) => item.key}
              estimatedItemSize={400}
              getItemType={(item) => item.type}
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return (
                    <View style={styles.mineSectionHeader}>
                      <Text style={styles.mineSectionTitle}>{item.title}</Text>
                      <View style={styles.mineSectionBadge}>
                        <Text style={styles.mineSectionBadgeText}>{item.count}</Text>
                      </View>
                    </View>
                  );
                }
                return <EventCard event={item.event} onPress={navigateToEventDetail} />;
              }}
              ListHeaderComponent={
                <PendingRatingBanner
                  event={firstPendingRating}
                  onPress={() =>
                    firstPendingRating &&
                    navigation.navigate('EventDetail', { eventId: firstPendingRating.id })
                  }
                />
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={COLORS.primary}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="clipboard-outline"
                  title="Henüz Etkinliğin Yok"
                  description="Bir etkinlik oluştur ya da keşfet sekmesinden mevcut etkinliklere başvur!"
                  actionLabel="Etkinliklere Göz At"
                  onAction={() => { selectionFeedback(); setActiveTab('discover'); }}
                />
              }
            />
          );
        })()}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Yeni etkinlik oluştur"
        onPress={() => {
          if (!hasPhotos) {
            Alert.alert(
              'Fotoğraf Gerekli',
              'Etkinlik oluşturmak için profiline en az 1 fotoğraf eklemelisin.',
              [
                { text: LABELS.cancel, style: 'cancel' },
                { text: 'Profile Git', onPress: () => navigation.navigate('Profil') },
              ]
            );
            return;
          }
          needsRefreshRef.current = true;
          navigation.navigate('CreateEvent');
        }}
      >
        <Ionicons name="add" size={32} color={COLORS.white} />
      </TouchableOpacity>

      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setShowFilterModal(false)}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtreler</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.filterSection}>
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.filterLabel}>Sadece Açık Etkinlikler</Text>
                    <Text style={styles.filterSub}>Kontenjanı dolanları gizle</Text>
                  </View>
                  <Switch
                    value={filterOnlyOpen}
                    onValueChange={setFilterOnlyOpen}
                    trackColor={{ false: '#e1e1e1', true: COLORS.avatarFallback }}
                    thumbColor={filterOnlyOpen ? COLORS.primary : COLORS.white}
                    accessibilityRole="switch"
                    accessibilityLabel="Sadece açık etkinlikler"
                  />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Ücret Durumu</Text>
                <View style={styles.chipRow}>
                  {['all', 'free', 'dutch'].map((val) => {
                    const label = val === 'all' ? 'Tümü' : val === 'free' ? 'Ücretsiz' : 'Alman Usulü';
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[styles.filterChip, filterPayment === val && styles.filterChipActive]}
                        onPress={() => setFilterPayment(val)}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        accessibilityState={{ selected: filterPayment === val }}
                      >
                        <Text style={[styles.filterChipText, filterPayment === val && styles.filterChipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Zaman</Text>
                <View style={styles.chipRow}>
                  {[
                    { val: 'all', label: 'Tüm Zamanlar' },
                    { val: 'today', label: 'Bugün' },
                    { val: 'weekend', label: 'Bu Haftasonu' },
                    { val: 'next7days', label: 'Önümüzdeki 7 Gün' },
                  ].map(({ val, label }) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.filterChip, filterTime === val && styles.filterChipActive]}
                      onPress={() => setFilterTime(val)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: filterTime === val }}
                    >
                      <Text style={[styles.filterChipText, filterTime === val && styles.filterChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setFilterOnlyOpen(false);
                  setFilterPayment('all');
                  setFilterTime('all');
                }}
                accessibilityRole="button"
                accessibilityLabel="Filtreleri temizle"
              >
                <Text style={styles.resetFilterText}>Temizle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyFilterBtn}
                onPress={() => setShowFilterModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Sonuçları gör"
              >
                <Text style={styles.applyFilterText}>Sonuçları Gör</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  cityPill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },

  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentBtnActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  segmentTextActive: { color: COLORS.white },
  segmentBadge: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  segmentBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },

  mineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  mineSectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  mineSectionBadge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
    marginLeft: 8,
  },
  mineSectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textBody, height: '100%' },
  clearSearchBtn: { padding: 4 },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  categoriesWrapper: {
    backgroundColor: COLORS.white,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoriesList: { paddingHorizontal: 16, gap: 8 },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryPillActive: { backgroundColor: COLORS.primary },
  categoryPillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  categoryPillTextActive: { color: COLORS.white },

  listContainer: { padding: 16, paddingBottom: 100 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginBottom: 20,
    ...SHADOWS.card,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 180, backgroundColor: '#e1e1e1' },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeClosed: { backgroundColor: COLORS.warning },
  badgeFinished: { backgroundColor: '#888' },
  badgeAlmostFull: { backgroundColor: '#ef4444' },
  badgeFillingFast: { backgroundColor: '#f97316' },
  badgeText: { fontSize: 12, fontWeight: '700', color: COLORS.success },

  roleBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  cardContent: { padding: 16 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  paymentText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { fontSize: 14, color: COLORS.textBody, marginLeft: 6, flex: 1 },

  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarImg: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  avatarInitial: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  organizerText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
    gap: 2,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  ratingBadgeCount: {
    fontSize: 10,
    color: '#92400E',
    marginLeft: 1,
  },
  trustStar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 4,
    alignSelf: 'flex-start',
  },
  trustBannerText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  trustBannerRating: { fontSize: 12, fontWeight: '800', color: '#B45309' },
  trustBannerCount: { fontSize: 11, color: '#92400E' },

  participantSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  participantTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  stackAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.avatarFallback,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  stackAvatarInitial: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  participantCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },

  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  pioneerEmpty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  pioneerEmoji: { fontSize: 64, marginBottom: 16 },
  pioneerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  pioneerDesc: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  pioneerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: COLORS.primaryShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  pioneerBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '800' },

  mapToggleBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },

  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  mapLoadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  mapBanner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  markerWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  markerWrapSelected: {
    borderColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  markerEmoji: {
    fontSize: 22,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.white,
    alignSelf: 'center',
    marginTop: -1,
  },
  markerTailSelected: {
    borderTopColor: COLORS.primary,
  },
  mapEventCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    ...SHADOWS.elevated,
  },
  mapEventCardLeft: {},
  mapEventThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  mapEventThumbPlaceholder: {
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapEventCardBody: {
    flex: 1,
    gap: 3,
  },
  mapEventTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  mapEventMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primaryShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterSection: { marginBottom: 16 },
  filterLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 6,
  },
  filterSub: { fontSize: 13, color: COLORS.textMuted },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: COLORS.primary },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 16 },

  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resetFilterBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetFilterText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  applyFilterBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  applyFilterText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  businessCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14,
    ...SHADOWS.subtle,
  },
  businessLogo: { width: 56, height: 56, borderRadius: 12 },
  businessLogoFallback: {
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  businessLogoInitial: { color: '#fff', fontSize: 22, fontWeight: '800' },
  businessCardName: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 2 },
  businessCardCat: { fontSize: 13, color: '#888', marginBottom: 4 },
  businessCardBio: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 4 },
  businessCardCity: { fontSize: 12, color: '#aaa' },
});
