import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

export default function LocationPickerModal({
  visible,
  onClose,
  onSelectLocation,
  searchQuery,
  setSearchQuery,
  searchResults,
  onSearch,
  searching,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.locationPickerOverlay}>
          <View style={styles.locationPickerCard}>
            <View style={styles.locationPickerHeader}>
              <Text style={styles.locationPickerTitle}>Konum G{'\u00F6'}nder</Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.locationSearchRow}>
              <TextInput
                style={styles.locationSearchInput}
                placeholder="Yer ara... ({'\u00D6'}rn: Kad{\u0131}k{'\u00F6'}y Moda Sahili)"
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={onSearch}
                returnKeyType="search"
                autoFocus
                accessibilityLabel="Konum ara"
              />
              <TouchableOpacity
                style={styles.locationSearchBtn}
                onPress={onSearch}
                disabled={searching}
                accessibilityRole="button"
                accessibilityLabel="Ara"
              >
                {searching ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="search" size={20} color={COLORS.white} />
                )}
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(_, i) => String(i)}
                style={styles.locationResultsList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.locationResultItem}
                    onPress={() => onSelectLocation(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label} konumunu g\u00F6nder`}
                  >
                    <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.locationResultText} numberOfLines={2}>
                      {item.label}
                    </Text>
                    <Ionicons name="send" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.locationEmptyState}>
                <Ionicons name="map-outline" size={48} color={COLORS.textPlaceholder} />
                <Text style={styles.locationEmptyText}>Bir yer ad{\u0131} veya adres yaz{\u0131}p ara</Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  locationPickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  locationPickerCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, maxHeight: '70%',
  },
  locationPickerHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  locationPickerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark },
  locationSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  locationSearchInput: {
    flex: 1, backgroundColor: COLORS.inputBackground, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: COLORS.textBody,
  },
  locationSearchBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  locationResultsList: { maxHeight: 300 },
  locationResultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  locationResultText: { flex: 1, fontSize: 15, color: COLORS.textBody },
  locationEmptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  locationEmptyText: { fontSize: 14, color: COLORS.textMuted },
});
