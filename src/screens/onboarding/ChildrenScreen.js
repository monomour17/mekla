import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ageGroups = [
  { id: '0-2', label: '0–2 yaş', emoji: '👶' },
  { id: '3-5', label: '3–5 yaş', emoji: '🧒' },
  { id: '6-10', label: '6–10 yaş', emoji: '🧑' },
  { id: '11+', label: '11+ yaş', emoji: '👦' },
];

const COUNTS = ['1', '2', '3', '4+'];

export default function ChildrenScreen({ navigation, route }) {
  const params = route.params;
  const [hasChildren, setHasChildren] = useState(null);
  const [childCount, setChildCount] = useState(null);
  const [selectedAges, setSelectedAges] = useState([]);

  const maxAges = childCount === '4+' ? 4 : childCount ? parseInt(childCount) : 0;

  const toggleAge = (id) => {
    setSelectedAges((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (prev.length >= maxAges) return prev;
      return [...prev, id];
    });
  };

  const isValid =
    hasChildren === false ||
    (hasChildren === true && childCount !== null && selectedAges.length > 0);

  const handleNext = () => {
    if (!isValid) return;
    navigation.navigate('Photo', {
      ...params,
      hasChildren,
      childCount: hasChildren ? childCount : null,
      childrenAges: hasChildren ? selectedAges : [],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Geri dön" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.step}>4 / 6</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Çocuğunuz var mı?</Text>
            <Text style={styles.subtitle}>Yaş aralığı yeterli, isim veya fotoğraf gerekmez</Text>
          </View>
        </View>

        <View style={styles.yesNo}>
          <TouchableOpacity
            style={[styles.choice, hasChildren === true && styles.choiceSelected]}
            onPress={() => setHasChildren(true)}
          >
            <Text style={styles.choiceText}>Evet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choice, hasChildren === false && styles.choiceSelected]}
            onPress={() => { setHasChildren(false); setChildCount(null); setSelectedAges([]); }}
          >
            <Text style={styles.choiceText}>Hayır</Text>
          </TouchableOpacity>
        </View>

        {hasChildren === true && (
          <View>
            <Text style={styles.ageLabel}>Kaç çocuğunuz var?</Text>
            <View style={styles.countRow}>
              {COUNTS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.countChip, childCount === c && styles.countChipSelected]}
                  onPress={() => {
                    setChildCount(c);
                    const max = c === '4+' ? 4 : parseInt(c);
                    setSelectedAges((prev) => prev.slice(0, max));
                  }}
                >
                  <Text style={[styles.countText, childCount === c && styles.countTextSelected]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {childCount && (
            <><Text style={styles.ageLabel}>Hangi yaş gruplarında?</Text>
            <View style={styles.ageGrid}>
              {ageGroups.map((ag) => {
                const isSelected = selectedAges.includes(ag.id);
                const isDisabled = !isSelected && selectedAges.length >= maxAges;
                return (
                  <TouchableOpacity
                    key={ag.id}
                    style={[
                      styles.ageChip,
                      isSelected && styles.ageChipSelected,
                      isDisabled && styles.ageChipDisabled,
                    ]}
                    onPress={() => toggleAge(ag.id)}
                    disabled={isDisabled}
                  >
                    <Text style={styles.ageEmoji}>{ag.emoji}</Text>
                    <Text
                      style={[
                        styles.ageText,
                        isSelected && styles.ageTextSelected,
                        isDisabled && styles.ageTextDisabled,
                      ]}
                    >
                      {ag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View></>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!isValid}
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
  yesNo: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  choice: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
    alignItems: 'center',
  },
  choiceSelected: { borderColor: '#6C47FF', backgroundColor: '#F5F2FF' },
  choiceText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  ageLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 14 },
  countRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  countChip: {
    width: 56,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipSelected: { borderColor: '#6C47FF', backgroundColor: '#F5F2FF' },
  countText: { fontSize: 16, fontWeight: '600', color: '#555' },
  countTextSelected: { color: '#6C47FF' },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  ageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#eee',
    gap: 6,
  },
  ageChipSelected: { borderColor: '#6C47FF', backgroundColor: '#F5F2FF' },
  ageChipDisabled: { opacity: 0.35 },
  ageEmoji: { fontSize: 16 },
  ageText: { fontSize: 14, color: '#555' },
  ageTextSelected: { color: '#6C47FF', fontWeight: '600' },
  ageTextDisabled: { color: '#bbb' },
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
