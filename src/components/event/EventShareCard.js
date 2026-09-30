import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { formatDate } from '../../utils/dateFormat';

// Card designed at 1080×1350 (Instagram Story 4:5) scaled to 360×450 on screen.
// ViewShot captures this at 3× → 1080×1350.

const EventShareCard = forwardRef(function EventShareCard({ event, participantCount }, ref) {
  const emoji = event.category?.split(' ')[0] ?? '📅';
  const dateStr = formatDate(event.event_date);
  const location = event.location_detail || event.city;
  const hasCover = !!event.cover_photo_url;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* Background */}
      {hasCover && (
        <Image
          source={{ uri: event.cover_photo_url }}
          style={styles.bgImage}
          contentFit="cover"
        />
      )}
      <View style={[styles.overlay, !hasCover && styles.overlayNoCover]} />

      {/* Top: Mekla branding */}
      <View style={styles.topRow}>
        <View style={styles.brandPill}>
          <Text style={styles.brandText}>mekla</Text>
        </View>
      </View>

      {/* Center: event info */}
      <View style={styles.centerBlock}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
          <Text style={styles.metaText} numberOfLines={1}>{dateStr}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
          <Text style={styles.metaText} numberOfLines={2}>{location}</Text>
        </View>
        {participantCount > 0 && (
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.metaText}>{participantCount}/{event.max_participants} katılımcı</Text>
          </View>
        )}
      </View>

      {/* Bottom: CTA */}
      <View style={styles.bottomBlock}>
        <View style={styles.ctaPill}>
          <Text style={styles.ctaText}>Katılmak için Mekla'yı indir 👇</Text>
        </View>
        <Text style={styles.domain}>meklasocial.com</Text>
      </View>
    </View>
  );
});

export default EventShareCard;

const styles = StyleSheet.create({
  card: {
    width: 360,
    height: 450,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
    justifyContent: 'space-between',
    padding: 28,
  },
  bgImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(40,20,100,0.72)',
  },
  overlayNoCover: {
    backgroundColor: 'rgba(108,71,255,0.1)',
  },

  topRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  brandPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  brandText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  centerBlock: { flex: 1, justifyContent: 'center', paddingVertical: 16 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 32,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
  },

  bottomBlock: { alignItems: 'center', gap: 8 },
  ctaPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ctaText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  domain: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
});
