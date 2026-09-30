import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  TouchableWithoutFeedback, Keyboard, Modal, FlatList, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = [
  { id: 'cafe', label: '☕ Kafe' },
  { id: 'restaurant', label: '🍽️ Restoran' },
  { id: 'playground', label: '🧸 Oyun Alanı' },
  { id: 'sports', label: '⚽ Spor Merkezi' },
  { id: 'venue', label: '🎪 Etkinlik Mekanı' },
  { id: 'other', label: '🏪 Diğer' },
];

const CITIES = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya',
  'Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik',
  'Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli',
  'Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep',
  'Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir',
  'Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale',
  'Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin',
  'Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya',
  'Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ','Tokat','Trabzon',
  'Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak',
];

export default function BusinessInfoScreen({ navigation }) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState(null);
  const [city, setCity] = useState('');
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const filteredCities = citySearch.trim()
    ? CITIES.filter((c) => c.toLocaleLowerCase('tr').startsWith(citySearch.toLocaleLowerCase('tr')))
    : CITIES;

  const isValid = businessName.trim().length > 0 && category !== null && city.length > 0;

  const handleNext = () => {
    if (!isValid) return;
    navigation.navigate('BusinessMedia', {
      businessName: businessName.trim(),
      category,
      city,
    });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Geri dön" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
              </TouchableOpacity>
              <Text style={styles.step}>1 / 3</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>İşletmenizi tanıtalım</Text>
              <Text style={styles.subtitle}>Bu bilgiler işletme profilinizde görünecek</Text>
            </View>
          </View>

          <Text style={styles.label}>İşletme Adı *</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Mama Café, FitZone Spor"
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
            maxLength={60}
          />

          <Text style={styles.label}>Kategori *</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catCard, category === cat.id && styles.catCardActive]}
                onPress={() => setCategory(cat.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: category === cat.id }}
              >
                <Text style={[styles.catLabel, category === cat.id && styles.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Şehir *</Text>
          <TouchableOpacity
            style={styles.cityButton}
            onPress={() => { Keyboard.dismiss(); setCitySearch(''); setCityModal(true); }}
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
        </ScrollView>

        <Modal visible={cityModal} animationType="slide">
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şehir Seç</Text>
              <TouchableOpacity onPress={() => setCityModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Şehir ara..."
                value={citySearch}
                onChangeText={setCitySearch}
                autoFocus
                autoCapitalize="words"
              />
            </View>
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => { setCity(item); setCityModal(false); }}
                >
                  <Text style={[styles.cityItemText, city === item && styles.cityItemActive]}>
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

const PRIMARY = '#6C47FF';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 28 },
  headerLeft: { alignItems: 'center', gap: 4, paddingTop: 2 },
  headerRight: { flex: 1, gap: 4 },
  step: { color: '#aaa', fontSize: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 10 },
  input: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: '#1a1a1a', marginBottom: 24,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  catCard: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  catCardActive: { borderColor: PRIMARY, backgroundColor: '#F5F2FF' },
  catLabel: { fontSize: 14, fontWeight: '600', color: '#666' },
  catLabelActive: { color: PRIMARY },
  cityButton: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 32,
  },
  cityPlaceholder: { flex: 1, fontSize: 16, color: '#aaa' },
  citySelected: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  chevron: { fontSize: 22, color: '#aaa' },
  button: {
    backgroundColor: PRIMARY, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose: { fontSize: 18, color: '#888', padding: 4 },
  searchBox: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchInput: {
    backgroundColor: '#f5f5f5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
  },
  cityItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  cityItemText: { flex: 1, fontSize: 16, color: '#333' },
  cityItemActive: { color: PRIMARY, fontWeight: '700' },
  check: { fontSize: 16, color: PRIMARY },
});
