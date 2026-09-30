import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { LABELS } from '../constants/strings';

const ACCOUNT_LABELS = { couple: 'Çift', individual: 'Bireysel Ebeveyn' };
const LOOKING_OPTIONS = [
  { id: 'family', label: 'Aile Buluşmaları' },
  { id: 'couple', label: 'Çift Buluşmaları' },
  { id: 'both', label: 'Her İkisi' },
];
const AGE_GROUPS = [
  { id: '0-2', label: '0–2 yaş' },
  { id: '3-5', label: '3–5 yaş' },
  { id: '6-10', label: '6–10 yaş' },
  { id: '11+', label: '11+ yaş' },
];
const AGE_LABELS = Object.fromEntries(AGE_GROUPS.map((a) => [a.id, a.label]));

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ProfileViewCard({
  profile,
  photos,
  eventStats,
  pendingRequestsCount,
  refreshing,
  onRefresh,
  onEdit,
  onSettings,
  onEventRequests,
  onNavigateToEvents,
}) {
  const initials = profile.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Photo warning */}
        {photos.length === 0 && (
          <TouchableOpacity style={styles.photoWarning} onPress={onEdit} accessibilityRole="button" accessibilityLabel="Fotoğraf ekle uyarısı, düzenlemek için dokun">
            <Text style={styles.photoWarningText}>
              Profilin Keşfet'te görünmesi için en az 1 fotoğraf ekle
            </Text>
          </TouchableOpacity>
        )}

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {photos[0] ? (
            <Image source={{ uri: photos[0] }} style={styles.avatarPhoto} contentFit="cover" />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.city}>📍 {profile.city}</Text>
          {profile.bio ? (
            <Text style={styles.bioView}>{profile.bio}</Text>
          ) : null}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editBtn} onPress={onEdit} accessibilityRole="button" accessibilityLabel="Profili düzenle">
              <Text style={styles.editBtnText}>{LABELS.edit}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={onEventRequests}
              accessibilityRole="button"
              accessibilityLabel={`Etkinlik istekleri${pendingRequestsCount > 0 ? `, ${pendingRequestsCount} bekleyen` : ''}`}
            >
              <Ionicons name="mail-unread-outline" size={18} color="#888" style={{ marginRight: 6 }} />
              <Text style={styles.settingsBtnText}>İstekler</Text>
              {pendingRequestsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={onSettings} accessibilityRole="button" accessibilityLabel={LABELS.settings}>
              <Ionicons name="settings-outline" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bilgiler */}
        <View style={styles.card}>
          <Row label="Hesap Türü" value={ACCOUNT_LABELS[profile.account_type]} />
          <Row label="Arıyor" value={LOOKING_OPTIONS.find((o) => o.id === profile.looking_for)?.label ?? '—'} />
          {profile.has_children ? (
            <>
              <Row label="Çocuk Sayısı" value={`${profile.child_count} çocuk`} />
              <Row
                label="Yaş Grupları"
                value={
                  profile.children_ages?.length > 0
                    ? profile.children_ages.map((a) => AGE_LABELS[a]).join(', ')
                    : '—'
                }
              />
            </>
          ) : (
            <Row label="Çocuk" value="Yok" />
          )}
        </View>

        {/* Etkinlik İstatistikleri */}
        <TouchableOpacity
          style={styles.eventStatsCard}
          activeOpacity={0.7}
          onPress={onNavigateToEvents}
          accessibilityRole="button"
          accessibilityLabel="Etkinliklerim"
        >
          <Text style={styles.eventStatsTitle}>Etkinliklerim</Text>
          <View style={styles.eventStatsRow}>
            <View style={styles.eventStatItem}>
              <Text style={styles.eventStatNumber}>{eventStats.participating}</Text>
              <Text style={styles.eventStatLabel}>Katılacağın</Text>
            </View>
            <View style={styles.eventStatDivider} />
            <View style={styles.eventStatItem}>
              <Text style={styles.eventStatNumber}>{eventStats.created}</Text>
              <Text style={styles.eventStatLabel}>Düzenlediğin</Text>
            </View>
          </View>
          <View style={styles.eventStatsFooter}>
            <Text style={styles.eventStatsFooterText}>Tüm etkinliklerini gör</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  scroll: { paddingBottom: 40 },

  // Photo warning
  photoWarning: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  photoWarningText: { fontSize: 13, fontWeight: '600', color: '#E65100', textAlign: 'center' },

  // View mode
  avatarWrap: { alignItems: 'center', paddingVertical: 36 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { color: COLORS.white, fontSize: 28, fontWeight: '800' },
  avatarPhoto: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
  name: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  city: { fontSize: 15, color: '#888', marginBottom: 8 },
  bioView: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 24 },
  actionRow: { flexDirection: 'row', gap: 10 },
  editBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  editBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    backgroundColor: COLORS.white,
  },
  settingsBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

  card: {
    marginHorizontal: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 15, color: '#666' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', maxWidth: '55%', textAlign: 'right' },

  // Etkinlik İstatistikleri Kartı
  eventStatsCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  eventStatsTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  eventStatsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  eventStatItem: { flex: 1, alignItems: 'center' },
  eventStatNumber: { fontSize: 28, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  eventStatLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  eventStatDivider: { width: 1, height: 40, backgroundColor: '#f0f0f0' },
  eventStatsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  eventStatsFooterText: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginRight: 4 },
});
