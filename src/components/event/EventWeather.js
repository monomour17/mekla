import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { fetchEventWeather } from '../../utils/weather';

/**
 * Etkinlik detay sayfasında "O gün hava nasıl olacak?" modülü.
 * - Şehir + event_date'e göre Open-Meteo'dan tahmin çeker
 * - Etkinlik 15+ gün ileride ise nazik bilgi mesajı gösterir
 * - Hata olursa sessizce hiçbir şey render etmez
 */
export default function EventWeather({ city, eventDate }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchEventWeather(city, eventDate)
      .then((w) => { if (mounted) setData(w); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [city, eventDate]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="partly-sunny" size={18} color={COLORS.primary} />
          <Text style={styles.title}>O gün hava</Text>
        </View>
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
      </View>
    );
  }

  if (!data) return null;

  if (data.tooFar) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="partly-sunny" size={18} color={COLORS.primary} />
          <Text style={styles.title}>O gün hava</Text>
        </View>
        <Text style={styles.tooFarText}>
          Etkinliğe {data.daysAhead} gün var — hava tahmini etkinlik gününe yaklaştıkça (15 gün
          öncesinden itibaren) burada görünecek.
        </Text>
      </View>
    );
  }

  const toneColor =
    data.tone === 'bad' ? '#dc2626' :
    data.tone === 'warn' ? COLORS.warning :
    data.tone === 'good' ? '#10b981' : COLORS.textBody;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="partly-sunny" size={18} color={COLORS.primary} />
        <Text style={styles.title}>O gün hava</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: `${toneColor}15` }]}>
          <Ionicons name={data.icon} size={32} color={toneColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: toneColor }]}>{data.label}</Text>
          <Text style={styles.tempLine}>
            {data.tempMin}° / {data.tempMax}°
          </Text>
        </View>
        {data.precipProb > 0 && (
          <View style={styles.rainBox}>
            <Ionicons name="water" size={14} color="#0284c7" />
            <Text style={styles.rainText}>%{data.precipProb}</Text>
          </View>
        )}
      </View>

      {data.precipProb >= 60 && (
        <View style={styles.warnRow}>
          <Ionicons name="umbrella" size={14} color={COLORS.warning} />
          <Text style={styles.warnText}>Yağış ihtimali yüksek — yanına şemsiye al.</Text>
        </View>
      )}
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
  title: { fontSize: 15, fontWeight: '700', color: COLORS.textBody },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '700' },
  tempLine: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  rainBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rainText: { fontSize: 12, fontWeight: '700', color: '#0369a1' },
  tooFarText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  warnText: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
});
