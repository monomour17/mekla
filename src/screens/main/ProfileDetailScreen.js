import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';
import { handleError } from '../../utils/errorHandler';
import LoadingState from '../../components/LoadingState';
import { fetchOrganizerStats, calculateOrganizerBadge } from '../../utils/organizerBadge';
import { membershipDuration } from '../../utils/dateFormat';

const { width: SW } = Dimensions.get('window');
const PHOTO_HEIGHT = SW * 1.1;

const LOOKING_LABELS = {
  family: '👨‍👩‍👧 Aile Buluşmaları',
  couple: '🥂 Çift Buluşmaları',
  both: '✨ Her İkisi',
};
const ACCOUNT_LABELS = { couple: '👫 Çift', individual: '🧑 Bireysel Ebeveyn' };
const AGE_LABELS = {
  '0-2': '0–2 yaş',
  '3-5': '3–5 yaş',
  '6-10': '6–10 yaş',
  '11+': '11+ yaş',
};

const REPORT_REASONS = [
  'Uygunsuz davranış',
  'Spam / Reklam',
  'Taciz veya zorbalık',
  'Sahte profil',
  'Diğer',
];

export default function ProfileDetailScreen({ route, navigation }) {
  const { profile, userId: routeUserId } = route.params;
  const { user } = useAuth();
  const setFeedStale = useAppStore((s) => s.setFeedStale);
  const [profileData, setProfileData] = useState(profile || null);
  const [loadingProfile, setLoadingProfile] = useState(!profile && !!routeUserId);

  // Load profile from userId if not passed directly
  useEffect(() => {
    if (profileData || !routeUserId) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', routeUserId)
        .single();
      if (data) setProfileData(data);
      setLoadingProfile(false);
    })();
  }, [routeUserId, profileData]);

  const p = profileData;
  const photos = p?.photos ?? [];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [avgRating, setAvgRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);

  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (!p) return;
    (async () => {
      const stats = await fetchOrganizerStats(p.id);
      setEventCount(stats.eventCount);
      setAvgRating(stats.avgRating);
      setReviewCount(stats.reviewCount);
    })();
  }, [p?.id]);

  useEffect(() => {
    if (!p || !user) return;
    (async () => {
      const { data } = await supabase
        .from('blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', p.id)
        .maybeSingle();
      setIsBlocked(!!data);
    })();
  }, [p?.id, user?.id]);

  const handleBlock = () => {
    setMenuVisible(false);
    if (isBlocked) {
      Alert.alert(
        'Engeli Kaldır',
        `${p.display_name} adlı kullanıcının engelini kaldırmak istiyor musun?`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Engeli Kaldır',
            onPress: async () => {
              await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', p.id);
              setIsBlocked(false);
              setFeedStale(true);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Kullanıcıyı Engelle',
        `${p.display_name} adlı kullanıcıyı engellemek istediğine emin misin? Bu kişi artık seni göremez, sen de onu göremezsin.`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Engelle',
            style: 'destructive',
            onPress: async () => {
              await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: p.id });
              setIsBlocked(true);
              setFeedStale(true);
              navigation.goBack();
            },
          },
        ]
      );
    }
  };

  const handleOpenReport = () => {
    setMenuVisible(false);
    setReportReason('');
    setReportVisible(true);
  };

  const handleReport = async () => {
    if (!reportReason) return;
    setReporting(true);
    await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: p.id,
      reason: reportReason,
    });
    setReporting(false);
    setReportVisible(false);
    Alert.alert('Teşekkürler', 'Şikayetiniz iletildi. Ekibimiz en kısa sürede inceleyecek.');
  };

  if (loadingProfile || !p) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const initials = p.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isOwnProfile = user?.id === p.id;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Photo carousel */}
        {photos.length > 0 ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photos[photoIndex] }} style={styles.photo} contentFit="cover" accessibilityLabel={`${p.display_name} fotoğrafı ${photoIndex + 1}`} />
            {photos.length > 1 && (
              <>
                <Pressable
                  style={styles.tapLeft}
                  onPress={() => setPhotoIndex((i) => Math.max(0, i - 1))}
                  accessibilityRole="button"
                  accessibilityLabel="Önceki fotoğraf"
                />
                <Pressable
                  style={styles.tapRight}
                  onPress={() => setPhotoIndex((i) => Math.min(photos.length - 1, i + 1))}
                  accessibilityRole="button"
                  accessibilityLabel="Sonraki fotoğraf"
                />
                <View style={styles.dots}>
                  {photos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                  ))}
                </View>
              </>
            )}
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>
                {photoIndex + 1}/{photos.length}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <Text style={styles.name}>{p.display_name}</Text>
            {calculateOrganizerBadge(avgRating, reviewCount).hasBadge && (
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.white} />
                <Text style={styles.trustBadgeText}>Mekla Yıldızı</Text>
              </View>
            )}
          </View>
          <Text style={styles.city}>📍 {p.city}</Text>
          {p.created_at && (
            <Text style={styles.membershipText}>{membershipDuration(p.created_at)}</Text>
          )}

          {p.bio ? (
            <Text style={styles.bio}>{p.bio}</Text>
          ) : null}

          <View style={styles.tags}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{ACCOUNT_LABELS[p.account_type]}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{LOOKING_LABELS[p.looking_for]}</Text>
            </View>
            {p.has_children ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  🧒 {p.child_count} çocuk •{' '}
                  {p.children_ages?.map((a) => AGE_LABELS[a]).join(', ')}
                </Text>
              </View>
            ) : (
              <View style={styles.chip}>
                <Text style={styles.chipText}>Çocuksuz</Text>
              </View>
            )}
          </View>

          {/* Organizator Istatistikleri */}
          {eventCount > 0 && (
            <View style={styles.statsBox}>
              <View style={styles.statItem}>
                <Ionicons name="calendar" size={18} color={COLORS.primary} />
                <Text style={styles.statValue}>{eventCount}</Text>
                <Text style={styles.statLabel}>Etkinlik</Text>
              </View>
              {avgRating !== null && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="star" size={18} color={COLORS.warning} />
                    <Text style={styles.statValue}>{avgRating}</Text>
                    <Text style={styles.statLabel}>{reviewCount} değerlendirme</Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={LABELS.back}>
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>

      {/* 3-dot menu button — only for other users */}
      {!isOwnProfile && (
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)} accessibilityRole="button" accessibilityLabel="Menü">
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Action sheet menu */}
      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)} accessibilityRole="button" accessibilityLabel={LABELS.close}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <TouchableOpacity style={styles.menuItem} onPress={handleOpenReport} accessibilityRole="button" accessibilityLabel={LABELS.report}>
              <Ionicons name="flag-outline" size={22} color={COLORS.warning} />
              <Text style={styles.menuItemText}>{LABELS.report}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleBlock} accessibilityRole="button" accessibilityLabel={isBlocked ? 'Engeli kaldır' : LABELS.block}>
              <Ionicons name="ban-outline" size={22} color={COLORS.error} />
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>{isBlocked ? 'Engeli Kaldır' : LABELS.block}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancel} onPress={() => setMenuVisible(false)} accessibilityRole="button" accessibilityLabel={LABELS.cancel}>
              <Text style={styles.menuCancelText}>{LABELS.cancel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Report reasons modal */}
      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setReportVisible(false)} accessibilityRole="button" accessibilityLabel={LABELS.close}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.reportTitle}>Şikayet Nedeni</Text>
            <Text style={styles.reportSub}>Lütfen bir neden seçin</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonItem, reportReason === reason && styles.reasonItemSelected]}
                onPress={() => setReportReason(reason)}
                accessibilityRole="button"
                accessibilityLabel={reason}
                accessibilityState={{ selected: reportReason === reason }}
              >
                <View style={[styles.reasonRadio, reportReason === reason && styles.reasonRadioSelected]}>
                  {reportReason === reason && <View style={styles.reasonRadioDot} />}
                </View>
                <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextSelected]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.reportSubmitBtn, !reportReason && styles.reportSubmitBtnDisabled]}
              onPress={handleReport}
              disabled={!reportReason || reporting}
              accessibilityRole="button"
              accessibilityLabel="Şikayeti gönder"
            >
              {reporting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.reportSubmitText}>{LABELS.send}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancel} onPress={() => setReportVisible(false)} accessibilityRole="button" accessibilityLabel={LABELS.cancel}>
              <Text style={styles.menuCancelText}>{LABELS.cancel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  // Photo
  photoWrap: { width: SW, height: PHOTO_HEIGHT, backgroundColor: '#f0f0f0' },
  photo: { width: '100%', height: '100%' },
  tapLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%' },
  tapRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%' },
  dots: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: COLORS.white, width: 20 },
  photoCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoCounterText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },

  // Avatar fallback
  avatarWrap: { alignItems: 'center', paddingVertical: 40 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 40, fontWeight: '800' },

  // Info
  info: { padding: 24 },
  name: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  city: { fontSize: 15, color: '#888', marginBottom: 4 },
  membershipText: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  bio: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Stats
  statsBox: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statItem: { alignItems: 'center', flex: 1, gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 12, color: '#888' },
  statDivider: { width: 1, height: 40, backgroundColor: '#e0e0e0' },

  // Trust Badge
  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  trustBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  // Back button
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { color: COLORS.white, fontSize: 26, lineHeight: 28, marginTop: -2 },

  // 3-dot menu button
  menuBtn: {
    position: 'absolute',
    top: 50,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Action sheet
  menuOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  menuItemText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: '#f0f0f0' },
  menuCancel: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
  },
  menuCancelText: { fontSize: 15, color: '#666', fontWeight: '600' },

  // Report
  reportTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  reportSub: { fontSize: 14, color: '#888', marginBottom: 16 },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  reasonItemSelected: { backgroundColor: '#faf8ff' },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonRadioSelected: { borderColor: COLORS.primary },
  reasonRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  reasonText: { fontSize: 15, color: '#444' },
  reasonTextSelected: { color: COLORS.primary, fontWeight: '600' },
  reportSubmitBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reportSubmitBtnDisabled: { backgroundColor: '#c4b5fd' },
  reportSubmitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  // Message button
  messageBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 34,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  messageBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
