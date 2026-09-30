import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

/**
 * OrganizerSummaryPanel
 * Sadece organizatöre gösterilen, etkinlik için hızlı sosyal kanıt + yönetim özeti.
 *
 * Gösterilenler:
 *  - Toplam başvuru (pending + approved + waiting)
 *  - Onaylı sayı (approved/attended)
 *  - Bekleyen istek
 *  - Yedek liste
 *  - Kapasite doluluk yüzdesi (görsel bar)
 */
export default function OrganizerSummaryPanel({
  pendingRequests = [],
  approvedParticipants = [],
  waitingParticipants = [],
  maxParticipants = 0,
}) {
  const approvedTotal = approvedParticipants.length + 1; // organizatör dahil
  const pendingCount = pendingRequests.length;
  const waitingCount = waitingParticipants.length;
  const totalApplications = pendingCount + approvedParticipants.length + waitingCount;

  const capacityPct = maxParticipants > 0
    ? Math.min(100, Math.round((approvedTotal / maxParticipants) * 100))
    : 0;

  const capacityColor =
    capacityPct >= 90 ? COLORS.warning :
    capacityPct >= 50 ? COLORS.primary : '#10b981';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="analytics" size={18} color={COLORS.primary} />
        <Text style={styles.title}>Organizatör Özeti</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat
          label="Başvuru"
          value={totalApplications}
          icon="people-outline"
          color={COLORS.textBody}
        />
        <Stat
          label="Onaylı"
          value={approvedParticipants.length}
          icon="checkmark-circle-outline"
          color="#10b981"
        />
        <Stat
          label="Bekleyen"
          value={pendingCount}
          icon="time-outline"
          color={COLORS.warning}
          highlight={pendingCount > 0}
        />
        <Stat
          label="Yedek"
          value={waitingCount}
          icon="hourglass-outline"
          color={COLORS.textSecondary}
        />
      </View>

      {maxParticipants > 0 && (
        <View style={styles.capacityWrap}>
          <View style={styles.capacityHeader}>
            <Text style={styles.capacityLabel}>Doluluk</Text>
            <Text style={[styles.capacityValue, { color: capacityColor }]}>
              {approvedTotal}/{maxParticipants} (%{capacityPct})
            </Text>
          </View>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                { width: `${capacityPct}%`, backgroundColor: capacityColor },
              ]}
            />
          </View>
        </View>
      )}

      {pendingCount > 0 && (
        <View style={styles.hintRow}>
          <Ionicons name="alert-circle" size={14} color={COLORS.warning} />
          <Text style={styles.hintText}>
            {pendingCount} istek senin onayını bekliyor.
          </Text>
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, icon, color, highlight }) {
  return (
    <View style={[styles.stat, highlight && styles.statHighlight]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#eef0f4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textBody,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: '#f8f9fb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statHighlight: {
    backgroundColor: '#FFF7E6',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  capacityWrap: {
    marginTop: 12,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  capacityLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  capacityValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  barBg: {
    height: 8,
    backgroundColor: '#eef0f4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  hintText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
});
