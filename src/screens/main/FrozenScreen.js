import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { clearPushToken } from '../../services/notifications';
import useAppStore from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';

export default function FrozenScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const setIsFrozen = useAppStore((state) => state.setIsFrozen);
  const setHasProfile = useAppStore((state) => state.setHasProfile);

  const handleReactivate = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: true })
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      Alert.alert('Hata', 'Hesap aktifleştirilemedi, tekrar dene.');
      return;
    }

    setIsFrozen(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabını silmek istediğine emin misin? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabımı Sil',
          style: 'destructive',
          onPress: async () => {
            // Profil satırı silinince push_token güncellenemez; önce temizle
            await clearPushToken(user?.id);
            const { error } = await supabase.rpc('delete_my_account');
            if (error) {
              Alert.alert('Hata', 'Hesap silinemedi, tekrar dene.');
              return;
            }
            await supabase.auth.signOut();
            setHasProfile(false);
            setIsFrozen(false);
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setHasProfile(false);
    setIsFrozen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>❄️</Text>
        <Text style={styles.title}>Hesabın Donduruldu</Text>
        <Text style={styles.subtitle}>
          Hesabın şu an gizli. Diğer kullanıcılar seni göremez.{'\n'}
          İstediğin zaman tekrar aktifleştirebilirsin.
        </Text>

        <TouchableOpacity
          style={styles.reactivateBtn}
          onPress={handleReactivate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.reactivateText}>Hesabı Aktifleştir</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Hesabımı Sil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 64, marginBottom: 20 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  reactivateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  reactivateText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  logoutBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    marginBottom: 12,
  },
  logoutText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },
  deleteBtn: { paddingVertical: 16, alignItems: 'center' },
  deleteText: { color: COLORS.textMuted, fontSize: 14, textDecorationLine: 'underline' },
});
