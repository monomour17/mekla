import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CITIES } from '../../constants/cities';

export default function BasicInfoScreen({ navigation, route }) {
  const { accountType } = route.params;
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCities = search.trim()
    ? CITIES.filter((c) =>
        c.toLocaleLowerCase('tr').startsWith(search.toLocaleLowerCase('tr'))
      )
    : CITIES;

  const isValid = name.trim().length > 0 && city.length > 0;

  const handleNext = () => {
    if (!isValid) return;
    navigation.navigate('LookingFor', {
      accountType,
      name: name.trim(),
      city,
    });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Geri dön" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
              </TouchableOpacity>
              <Text style={styles.step}>2 / 6</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>Sizi tanıyalım</Text>
            </View>
          </View>

          <Text style={styles.label}>
            {accountType === 'couple' ? 'Çiftin adı' : 'Adın'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={accountType === 'couple' ? 'Örn: Ali & Ayşe' : 'Adın'}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <Text style={styles.label}>Şehir</Text>
          <TouchableOpacity
            style={styles.cityButton}
            onPress={() => { Keyboard.dismiss(); setSearch(''); setModalVisible(true); }}
          >
            <Text style={city ? styles.citySelected : styles.cityPlaceholder}>
              {city || 'Şehir seçin'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!isValid}
          >
            <Text style={styles.buttonText}>Devam Et</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={modalVisible} animationType="slide">
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şehir Seç</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Şehir ara..."
                value={search}
                onChangeText={setSearch}
                autoFocus
                autoCapitalize="words"
                returnKeyType="search"
              />
            </View>
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => { setCity(item); setModalVisible(false); }}
                >
                  <Text
                    style={[
                      styles.cityItemText,
                      city === item && styles.cityItemActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {city === item && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 20,
  },
  cityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  cityPlaceholder: { flex: 1, fontSize: 16, color: '#aaa' },
  citySelected: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  chevron: { fontSize: 22, color: '#aaa', marginTop: -2 },
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

  // Modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose: { fontSize: 18, color: '#888', padding: 4 },
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1a1a1a',
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  cityItemText: { flex: 1, fontSize: 16, color: '#333' },
  cityItemActive: { color: '#6C47FF', fontWeight: '700' },
  check: { fontSize: 16, color: '#6C47FF' },
});
