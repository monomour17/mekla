import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert, StatusBar, Share, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOWS } from '../../constants/colors';
import { formatDate } from '../../utils/dateFormat';
import { pickFromGallery, uploadPhoto, removePhoto } from '../../utils/photos';
import { lightImpact, mediumImpact, successNotification } from '../../utils/haptics';

const { width: SW } = Dimensions.get('window');
const GALLERY_GAP = 4;
const GALLERY_ITEM_SIZE = (SW - GALLERY_GAP * 4) / 3;
const COVER_HEIGHT = 240;
const LOGO_SIZE = 90;
const LOGO_OVERLAP = 45;

const CATEGORY_LABELS = {
  cafe: '☕ Kafe',
  restaurant: '🍽️ Restoran',
  playground: '🧸 Oyun Alanı',
  sports: '⚽ Spor Merkezi',
  venue: '🎪 Etkinlik Mekanı',
  other: '🏪 İşletme',
};

export default function BusinessProfileScreen({ route, navigation }) {
  const { businessId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;

    const now = new Date().toISOString();

    const [profileRes, upcomingRes, pastRes, countRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', businessId).single(),
      supabase.from('events')
        .select('id, title, event_date, location_detail, city, cover_photo_url')
        .eq('business_id', businessId)
        .neq('status', 'cancelled')
        .gte('event_date', now)
        .order('event_date', { ascending: true })
        .limit(5),
      supabase.from('events')
        .select('id, title, event_date, location_detail, city, cover_photo_url')
        .eq('business_id', businessId)
        .neq('status', 'cancelled')
        .lt('event_date', now)
        .order('event_date', { ascending: false })
        .limit(5),
      supabase.from('business_follows')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId),
      user
        ? supabase.from('business_follows')
            .select('follower_id')
            .eq('business_id', businessId)
            .eq('follower_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    setUpcomingEvents(upcomingRes.data ?? []);
    setPastEvents(pastRes.data ?? []);
    setFollowerCount(countRes.count ?? 0);
    setIsFollowing(!!followRes.data);
    setLoading(false);
  }, [businessId, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleFollow = async () => {
    if (!user || followLoading) return;
    mediumImpact();
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('business_follows').delete()
        .eq('follower_id', user.id).eq('business_id', businessId);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('business_follows').insert({ follower_id: user.id, business_id: businessId });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
      successNotification();
    }
    setFollowLoading(false);
  };

  const handleAddGalleryPhoto = async () => {
    if (!user || uploadingPhoto) return;
    lightImpact();
    setUploadingPhoto(true);
    try {
      const uri = await pickFromGallery({ quality: 0.85 });
      if (!uri) return;
      const publicUrl = await uploadPhoto('photos', `${user.id}/gallery`, uri);
      const newPhotos = [...(profile.photos ?? []), publicUrl];
      await supabase.from('profiles').update({ photos: newPhotos }).eq('id', user.id);
      setProfile((prev) => ({ ...prev, photos: newPhotos }));
    } catch {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemoveGalleryPhoto = (photoUrl) => {
    Alert.alert('Fotoğrafı Sil', 'Bu fotoğrafı galerinizden kaldırmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            const newPhotos = await removePhoto(user.id, photoUrl, profile.photos ?? []);
            setProfile((prev) => ({ ...prev, photos: newPhotos }));
          } catch (error) {
            Alert.alert('Hata', 'Fotoğraf silinemedi.');
          }
        },
      },
    ]);
  };

  const openLink = async (url) => {
    try {
      const full = url.startsWith('http') ? url : `https://${url}`;
      await Linking.openURL(full);
    } catch {
      Alert.alert('Hata', 'Bağlantı açılamadı.');
    }
  };

  const handleShareProfile = async () => {
    const name = profile.business_name ?? profile.display_name ?? 'İşletme';
    const profileUrl = `https://meklasocial.com/isletme/${businessId}`;
    const message = `${name} — Etkinliklerini ve duyurularını Mekla uygulamasında takip et!\n\n${profileUrl}`;
    try {
      await Share.share({ message, title: name });
    } catch (_) {}
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) return null;

  const logoUrl = profile.photos?.[0] ?? null;
  const galleryPhotos = (profile.photos ?? []).slice(1);
  const categoryLabel = CATEGORY_LABELS[profile.business_category] ?? '🏢 İşletme';
  const isOwner = user?.id === businessId;
  const mapQuery = encodeURIComponent(
    profile.business_address
      ? `${profile.business_address}, ${profile.city}`
      : profile.city
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── COVER (edge-to-edge, goes under status bar) ── */}
        <View style={styles.coverWrap}>
          {profile.business_cover_url ? (
            <Image
              source={{ uri: profile.business_cover_url }}
              style={styles.cover}
              contentFit="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="business" size={64} color="rgba(255,255,255,0.25)" />
            </View>
          )}

          {/* Top scrim for button readability */}
          <View style={styles.coverScrim} />

          {/* Floating navigation buttons */}
          <View style={[styles.floatingNav, { top: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.floatBtn}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Geri"
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={styles.floatBtn}
                onPress={handleShareProfile}
                accessibilityRole="button"
                accessibilityLabel="Profili paylaş"
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
              {isOwner && (
                <TouchableOpacity
                  style={styles.floatBtn}
                  onPress={() => navigation.navigate('Settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Ayarlar"
                >
                  <Ionicons name="settings-outline" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── PROFILE SECTION ── */}
        <View style={styles.profileSection}>

          {/* Logo — overlaps cover by LOGO_OVERLAP */}
          <View style={styles.logoShadowWrap}>
            <View style={styles.logoWrap}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoInitial}>
                    {(profile.business_name ?? profile.display_name)[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Business name + category */}
          <Text style={styles.businessName}>{profile.business_name ?? profile.display_name}</Text>
          <Text style={styles.categoryBadge}>{categoryLabel}</Text>

          {/* Stats card */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{followerCount}</Text>
              <Text style={styles.statLabel}>Takipçi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{upcomingEvents.length}</Text>
              <Text style={styles.statLabel}>Yaklaşan</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{pastEvents.length}</Text>
              <Text style={styles.statLabel}>Geçmiş</Text>
            </View>
          </View>

          {/* Location chip */}
          <TouchableOpacity
            style={styles.infoChip}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${mapQuery}`)}
            accessibilityRole="link"
            accessibilityLabel="Konumu haritada göster"
          >
            <Ionicons name="location-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoChipText} numberOfLines={1}>
              {profile.business_address
                ? `${profile.business_address}, ${profile.city}`
                : profile.city}
            </Text>
            <Ionicons name="open-outline" size={13} color={COLORS.primary} />
          </TouchableOpacity>

          {/* Bio */}
          {profile.business_bio ? (
            <Text style={styles.bioText}>{profile.business_bio}</Text>
          ) : null}

          {/* Link chips */}
          {(profile.business_website || profile.business_instagram) ? (
            <View style={styles.linksRow}>
              {profile.business_website ? (
                <TouchableOpacity
                  style={styles.linkChip}
                  onPress={() => openLink(profile.business_website)}
                >
                  <Ionicons name="globe-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.linkText} numberOfLines={1}>
                    {profile.business_website.replace(/https?:\/\//, '')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {profile.business_instagram ? (
                <TouchableOpacity
                  style={styles.linkChip}
                  onPress={() => openLink(`https://instagram.com/${profile.business_instagram}`)}
                >
                  <Ionicons name="logo-instagram" size={15} color={COLORS.primary} />
                  <Text style={styles.linkText}>@{profile.business_instagram}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Follow / Owner button */}
          {!isOwner ? (
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={handleFollow}
              disabled={followLoading}
              accessibilityRole="button"
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? COLORS.primary : '#fff'} />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? 'notifications' : 'notifications-outline'}
                    size={17}
                    color={isFollowing ? COLORS.primary : '#fff'}
                  />
                  <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                    {isFollowing ? 'Takip Ediliyor' : 'Takip Et — Etkinliklerden Haberdar Ol'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── GALLERY ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📷 Galeri</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={handleAddGalleryPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : (
                    <>
                      <Ionicons name="add" size={16} color={COLORS.primary} />
                      <Text style={styles.addPhotoText}>Fotoğraf Ekle</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            )}
          </View>

          {galleryPhotos.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('BusinessGallery', { businessId })}
            >
              <View style={styles.galleryGrid}>
                {galleryPhotos.slice(0, 6).map((uri, i) => (
                  <View key={i} style={styles.galleryItem}>
                    <Image source={{ uri }} style={styles.galleryImg} contentFit="cover" />
                    {i === 5 && galleryPhotos.length > 6 && (
                      <View style={styles.galleryMoreOverlay}>
                        <Text style={styles.galleryMoreText}>+{galleryPhotos.length - 6}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <Text style={styles.galleryShowAll}>
                Tümünü Gör ({galleryPhotos.length} fotoğraf) →
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.emptyGallery}
              onPress={isOwner ? () => navigation.navigate('BusinessGallery') : undefined}
            >
              <Ionicons name="images-outline" size={36} color="#ccc" />
              <Text style={styles.emptyText}>
                {isOwner ? 'Fotoğraf eklemek için tıkla' : 'Henüz fotoğraf yok'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── UPCOMING EVENTS ── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 Yaklaşan Etkinlikler</Text>
            {isOwner && (
              <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')}>
                <Text style={styles.addPhotoText}>+ Yeni Etkinlik</Text>
              </TouchableOpacity>
            )}
          </View>
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>Henüz aktif etkinlik yok.</Text>
          )}
        </View>

        {/* ── PAST EVENTS ── */}
        {pastEvents.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>🗓 Geçmiş Etkinlikler</Text>
            {pastEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                past
                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function EventRow({ event, past = false, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.eventItem, past && styles.eventItemPast]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {event.cover_photo_url ? (
        <Image source={{ uri: event.cover_photo_url }} style={styles.eventThumb} contentFit="cover" />
      ) : (
        <View style={[styles.eventThumb, styles.eventThumbPlaceholder]}>
          <Ionicons name="calendar-outline" size={22} color="#ccc" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.eventTitle, past && styles.eventTitlePast]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.eventMeta}>{past ? '✓ ' : '📅 '}{formatDate(event.event_date)}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>
          📍 {event.location_detail || event.city}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#ccc" />
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  /* Cover */
  coverWrap: { height: COVER_HEIGHT, position: 'relative' },
  cover: { width: '100%', height: COVER_HEIGHT },
  coverPlaceholder: {
    width: '100%', height: COVER_HEIGHT,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  coverScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 100,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },

  /* Floating nav */
  floatingNav: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  floatBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center', alignItems: 'center',
  },

  /* Profile section */
  profileSection: { paddingHorizontal: 20, paddingBottom: 8 },

  /* Logo */
  logoShadowWrap: {
    marginTop: -LOGO_OVERLAP,
    marginBottom: 12,
    width: LOGO_SIZE + 8,
    ...SHADOWS.card,
    borderRadius: 22,
  },
  logoWrap: {
    width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 4, borderColor: '#fff',
  },
  logo: { width: '100%', height: '100%' },
  logoFallback: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  logoInitial: { color: '#fff', fontSize: 32, fontWeight: '800' },

  /* Name & category */
  businessName: { fontSize: 22, fontWeight: '800', color: COLORS.textDark, marginBottom: 4 },
  categoryBadge: { fontSize: 14, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 2 },

  /* Stats card */
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 18, marginTop: 16, marginBottom: 16,
    ...SHADOWS.card,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: '#eee' },
  statNum: { fontSize: 22, fontWeight: '800', color: COLORS.textDark },
  statLabel: { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary, marginTop: 3 },

  /* Info chip (location) */
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F2FF', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 12,
  },
  infoChipText: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.primary },

  /* Bio */
  bioText: { fontSize: 15, fontWeight: '400', color: '#444', lineHeight: 22, marginBottom: 14 },

  /* Link chips */
  linksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  linkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#F5F2FF', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    maxWidth: SW / 2,
  },
  linkText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  /* Follow button */
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 14, marginTop: 4,
  },
  followBtnActive: { backgroundColor: '#F5F2FF', borderWidth: 1.5, borderColor: COLORS.primary },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  followBtnTextActive: { color: COLORS.primary },

  /* Sections */
  sectionWrap: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addPhotoText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  /* Gallery */
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GALLERY_GAP },
  galleryItem: { width: GALLERY_ITEM_SIZE, height: GALLERY_ITEM_SIZE },
  galleryImg: { width: '100%', height: '100%', borderRadius: 12 },
  galleryMoreOverlay: {
    position: 'absolute', inset: 0, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center', alignItems: 'center',
  },
  galleryMoreText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  galleryShowAll: {
    fontSize: 13, fontWeight: '600', color: COLORS.primary,
    marginTop: 12, textAlign: 'right',
  },
  emptyGallery: {
    alignItems: 'center', gap: 10, paddingVertical: 28,
    backgroundColor: '#f9f9f9', borderRadius: 14,
  },
  emptyText: { fontSize: 13, fontWeight: '400', color: '#aaa', textAlign: 'center' },

  /* Event cards */
  eventItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginBottom: 10,
    ...SHADOWS.card,
  },
  eventItemPast: { opacity: 0.65 },
  eventThumb: { width: 58, height: 58, borderRadius: 11 },
  eventThumbPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  eventTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, marginBottom: 3 },
  eventTitlePast: { color: COLORS.textSecondary },
  eventMeta: { fontSize: 12, fontWeight: '400', color: '#888', marginBottom: 1 },
});
