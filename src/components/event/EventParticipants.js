import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import EmptyState from '../EmptyState';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';

/* ====== PULSE OVERLAY (for new pending requests) ====== */
export function PulseOverlay({ anim }) {
  return (
    <Animated.View
      style={{
        position: 'absolute', top: -2, left: -2, right: -2, bottom: -2,
        borderRadius: 18, borderWidth: 2.5, borderColor: COLORS.primary,
        opacity: anim,
      }}
      pointerEvents="none"
    />
  );
}

/* ====== PENDING REQUESTS LIST (Organizator only) ====== */
export function PendingRequestsList({
  requests, profiles, highlightUserIds, actionLoading,
  onApprove, onReject, onViewProfile, PulseOverlayComponent,
}) {
  if (requests.length === 0) return null;
  return (
    <>
      <Text style={s.sectionTitle}>Bekleyen İstekler ({requests.length})</Text>
      {requests.map((req) => {
        const prof = profiles[req.user_id];
        const isHighlighted = highlightUserIds.includes(req.user_id);
        return (
          <View key={req.id} style={s.requestCard}>
            {isHighlighted && PulseOverlayComponent}
            <TouchableOpacity style={s.requestTop} activeOpacity={0.7} onPress={() => onViewProfile(prof)}>
              <Avatar profile={prof} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.reqName}>{prof?.display_name ?? '?'}</Text>
                {req.join_message ? <Text style={s.reqMsg}>{req.join_message}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textPlaceholder} />
            </TouchableOpacity>
            <View style={s.requestActions}>
              <TouchableOpacity style={[s.approveBtn, actionLoading && { opacity: 0.5 }]} onPress={() => onApprove(req.user_id)} disabled={actionLoading}>
                <Text style={s.approveBtnText}>{LABELS.approve}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.rejectBtn, actionLoading && { opacity: 0.5 }]} onPress={() => onReject(req.user_id)} disabled={actionLoading}>
                <Text style={s.rejectBtnText}>{LABELS.reject}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </>
  );
}

/* ====== PARTICIPANTS GRID ====== */
export function ParticipantsGrid({ participants, profiles, total, maxParticipants, waitingCount, onPress }) {
  return (
    <>
      <Text style={s.sectionTitle}>
        Katılımcılar ({total}/{maxParticipants})
        {waitingCount > 0 ? ` · ${waitingCount} bekliyor` : ''}
      </Text>
      {participants.length > 0 ? (
        <View style={s.participantsGrid}>
          {participants.map((p) => {
            const prof = profiles[p.user_id];
            const isAttended = p.status === 'attended';
            const isNoShow = p.status === 'no_show';
            return (
              <TouchableOpacity key={p.id} style={s.partItem} activeOpacity={0.7} onPress={() => onPress(p.user_id)}>
                <View>
                  <Avatar profile={prof} size={44} />
                  {isAttended && (
                    <View style={[s.attendBadge, { backgroundColor: COLORS.success }]}>
                      <Ionicons name="checkmark" size={10} color={COLORS.white} />
                    </View>
                  )}
                  {isNoShow && (
                    <View style={[s.attendBadge, { backgroundColor: COLORS.error }]}>
                      <Ionicons name="close" size={10} color={COLORS.white} />
                    </View>
                  )}
                </View>
                <Text style={s.partName} numberOfLines={1}>{prof?.display_name ?? '?'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <EmptyState icon="people-outline" title="Henüz katılımcı yok" description="Henüz onaylanmış katılımcı yok." />
      )}
    </>
  );
}

/* ====== WAITING LIST ====== */
export function WaitingList({ participants, profiles, onPress }) {
  if (participants.length === 0) return null;
  return (
    <>
      <Text style={s.sectionTitle}>Bekleme Listesi ({participants.length})</Text>
      <View style={s.participantsGrid}>
        {participants.map((p) => {
          const prof = profiles[p.user_id];
          return (
            <TouchableOpacity key={p.id} style={s.partItem} activeOpacity={0.7} onPress={() => onPress(p.user_id)}>
              <View>
                <Avatar profile={prof} size={44} />
                <View style={[s.attendBadge, { backgroundColor: COLORS.warning }]}>
                  <Ionicons name="time" size={10} color={COLORS.white} />
                </View>
              </View>
              <Text style={s.partName} numberOfLines={1}>{prof?.display_name ?? '?'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 10, marginTop: 8 },

  requestCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  requestTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  reqName: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  reqMsg: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  requestActions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  approveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  rejectBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.error },
  rejectBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 14 },

  participantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  partItem: { alignItems: 'center', width: 64 },
  partName: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  attendBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white,
  },
});
