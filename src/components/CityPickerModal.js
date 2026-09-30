import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { CITIES } from '../constants/cities';

/**
 * 81 il arasından aranabilir şehir seçici.
 * Serbest metin girişini engellemek için tüm şehir alanlarında bu kullanılır.
 */
export default function CityPickerModal({ visible, onSelect, onClose, title = 'Şehir Seç' }) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? CITIES.filter((c) => c.toLocaleLowerCase('tr').startsWith(search.toLocaleLowerCase('tr')))
    : CITIES;

  const handleSelect = (city) => {
    setSearch('');
    onSelect(city);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity
            onPress={() => { setSearch(''); onClose(); }}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Şehir ara..."
            placeholderTextColor={COLORS.textPlaceholder}
            value={search}
            onChangeText={setSearch}
            autoFocus
            autoCapitalize="words"
            accessibilityLabel="Şehir ara"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.cityRow}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={item}
            >
              <Text style={styles.cityText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textDark },
  cityRow: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  cityText: { fontSize: 16, color: COLORS.textDark },
});
