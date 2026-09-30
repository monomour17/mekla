import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const options = [
  {
    type: 'family',
    emoji: '👨‍👩‍👧‍👦',
    title: 'Aile Buluşmaları',
    desc: 'Çocuklu ailelerle park, kafe, piknik buluşmaları',
  },
  {
    type: 'couple',
    emoji: '🥂',
    title: 'Çift Buluşmaları',
    desc: 'Çocuksuz, yetişkin sosyal aktiviteler',
  },
  {
    type: 'both',
    emoji: '✨',
    title: 'Her İkisi',
    desc: 'Hem aile hem çift buluşmalarına açığım',
  },
];

export default function LookingForScreen({ navigation, route }) {
  const params = route.params;
  const [selected, setSelected] = useState(null);

  const handleNext = () => {
    if (!selected) return;
    navigation.navigate('Children', { ...params, lookingFor: selected });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Geri dön" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.step}>3 / 6</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Hangi buluşmalara katılmak istersin?</Text>
            <Text style={styles.subtitle}>İstediğiniz zaman değiştirebilirsiniz</Text>
          </View>
        </View>

        {options.map((opt) => (
          <TouchableOpacity
            key={opt.type}
            style={[styles.card, selected === opt.type && styles.cardSelected]}
            onPress={() => setSelected(opt.type)}
          >
            <Text style={styles.cardEmoji}>{opt.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{opt.title}</Text>
              <Text style={styles.cardDesc}>{opt.desc}</Text>
            </View>
            <View style={[styles.radio, selected === opt.type && styles.radioSelected]} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!selected}
        >
          <Text style={styles.buttonText}>Devam Et</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 28 },
  headerLeft: { alignItems: 'center', gap: 4, paddingTop: 2 },
  headerRight: { flex: 1, gap: 4 },
  step: { color: '#aaa', fontSize: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#eee',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  cardSelected: { borderColor: '#6C47FF', backgroundColor: '#F5F2FF' },
  cardEmoji: { fontSize: 28, marginRight: 14 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#888' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  radioSelected: { borderColor: '#6C47FF', backgroundColor: '#6C47FF' },
  button: {
    backgroundColor: '#6C47FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
