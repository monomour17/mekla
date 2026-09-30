import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { clearPushToken } from '../../services/notifications';
import useAppStore from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';

export default function SettingsScreen({ navigation }) {
  const { user } = useAuth();
  const setHasProfile = useAppStore((state) => state.setHasProfile);
  const setIsFrozen = useAppStore((state) => state.setIsFrozen);

  const [freezing, setFreezing] = useState(false);
  const [accountType, setAccountType] = useState(null);

  // Erişilebilirlik
  const colorBlindMode = useAppStore((state) => state.colorBlindMode);
  const setColorBlindMode = useAppStore((state) => state.setColorBlindMode);

  // Bildirim tercihleri
  const [notifPrefs, setNotifPrefs] = useState({
    event_reminder: true,
    request_update: true,
    new_question: true,
    community_post: true,
    business_events: true,
  });

  useEffect(() => {
    AsyncStorage.getItem('@color_blind_mode').then((val) => {
      if (val === 'true') setColorBlindMode(true);
    });
    if (user?.id) {
      supabase
        .from('profiles')
        .select('notification_prefs, account_type')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.notification_prefs) setNotifPrefs((p) => ({ ...p, ...data.notification_prefs }));
          if (data?.account_type) setAccountType(data.account_type);
        });
    }
  }, [user?.id]);

  const toggleNotifPref = async (key, val) => {
    const next = { ...notifPrefs, [key]: val };
    setNotifPrefs(next);
    if (user?.id) {
      await supabase.from('profiles').update({ notification_prefs: next }).eq('id', user.id);
    }
  };

  const toggleColorBlindMode = async (val) => {
    setColorBlindMode(val);
    await AsyncStorage.setItem('@color_blind_mode', val ? 'true' : 'false');
  };

  // SMS OTP states for account deletion
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');

  const ACCOUNT_TYPE_LABELS = { couple: 'Çift', individual: 'Bireysel Ebeveyn' };

  const handleChangeAccountType = () => {
    const next = accountType === 'couple' ? 'individual' : 'couple';
    Alert.alert(
      'Hesap Türü',
      `Hesap türünü "${ACCOUNT_TYPE_LABELS[next]}" olarak değiştirmek istiyor musun?\n\nBazı etkinlikler yalnızca belirli hesap türlerine açıktır; katılabileceğin etkinlikler buna göre değişir.`,
      [
        { text: LABELS.cancel, style: 'cancel' },
        {
          text: 'Değiştir',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ account_type: next })
              .eq('id', user.id);
            if (error) {
              Alert.alert('Hata', 'Hesap türü değiştirilemedi, tekrar dene.');
              return;
            }
            setAccountType(next);
          },
        },
      ],
    );
  };

  const handleFreezeAccount = () => {
    Alert.alert(
      'Hesabı Dondur',
      'Hesabın gizliye alınacak. Diğer kullanıcılar seni göremeyecek. İstediğin zaman tekrar aktifleştirebilirsin.',
      [
        { text: LABELS.cancel, style: 'cancel' },
        {
          text: 'Dondur',
          onPress: async () => {
            setFreezing(true);
            const { error } = await supabase
              .from('profiles')
              .update({ is_active: false })
              .eq('id', user.id);
            setFreezing(false);
            if (error) {
              Alert.alert('Hata', 'Hesap dondurulamadı, tekrar dene.');
              return;
            }
            setIsFrozen(true);
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(LABELS.logout, 'Hesabından çıkmak istediğine emin misin?', [
      { text: LABELS.cancel, style: 'cancel' },
      {
        text: LABELS.logout,
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          setHasProfile(false);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabını silmek istediğine emin misin? Bu işlem geri alınamaz. Telefonuna doğrulama kodu gönderilecek.',
      [
        { text: LABELS.cancel, style: 'cancel' },
        {
          text: 'Devam Et',
          style: 'destructive',
          onPress: sendDeleteOtp,
        },
      ]
    );
  };

  const sendDeleteOtp = async () => {
    setOtpSending(true);
    if (!user?.phone) {
      Alert.alert('Hata', 'Telefon numarası bulunamadı.');
      setOtpSending(false);
      return;
    }

    setOtpPhone(user.phone);

    const { error } = await supabase.auth.signInWithOtp({
      phone: user.phone,
    });

    setOtpSending(false);

    if (error) {
      Alert.alert('Hata', 'Doğrulama kodu gönderilemedi: ' + error.message);
      return;
    }

    setOtpCode('');
    setShowOtpModal(true);
  };

  const verifyAndDelete = async () => {
    if (otpCode.length < 6) return;

    setOtpVerifying(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: otpPhone,
      token: otpCode,
      type: 'sms',
    });

    if (verifyError) {
      setOtpVerifying(false);
      Alert.alert('Hata', 'Doğrulama kodu yanlış. Tekrar dene.');
      return;
    }

    // Hesap silinmeden önce push token'ı temizle
    // (delete_my_account profiles satırını sildiğinden sonradan güncellenemez)
    await clearPushToken(user?.id);

    const { error: deleteError } = await supabase.rpc('delete_my_account');

    setOtpVerifying(false);
    setShowOtpModal(false);

    if (deleteError) {
      Alert.alert('Hata', 'Hesap silinemedi, tekrar dene.');
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch (_) {
      // signOut başarısız olsa bile local state'i temizle
    }
    setHasProfile(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Geri">
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{LABELS.settings}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Gizlilik */}
        <Text style={styles.sectionTitle}>Gizlilik</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('BlockedUsers')}
            accessibilityRole="button"
            accessibilityLabel="Engellenen kullanıcılar"
          >
            <Text style={styles.menuIcon}>🚫</Text>
            <Text style={styles.menuText}>Engellenen Kullanıcılar</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* Hesap */}
        <Text style={styles.sectionTitle}>Hesap</Text>
        <View style={styles.card}>
          {(accountType === 'couple' || accountType === 'individual') && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleChangeAccountType}
              accessibilityRole="button"
              accessibilityLabel="Hesap türünü değiştir"
            >
              <Text style={styles.menuIcon}>👤</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>Hesap Türü</Text>
                <Text style={styles.menuSubtext}>{ACCOUNT_TYPE_LABELS[accountType]}</Text>
              </View>
              <Ionicons name="swap-horizontal" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleFreezeAccount}
            disabled={freezing}
            accessibilityRole="button"
            accessibilityLabel="Hesabı dondur"
          >
            {freezing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Text style={styles.menuIcon}>❄️</Text>
                <Text style={styles.menuText}>Hesabı Dondur</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Çıkış yap">
            <Text style={styles.menuIcon}>🚪</Text>
            <Text style={[styles.menuText, { color: COLORS.error }]}>{LABELS.logout}</Text>
          </TouchableOpacity>
        </View>

        {/* Bildirimler */}
        <Text style={styles.sectionTitle}>Bildirimler</Text>
        <View style={styles.card}>
          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>⏰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Etkinlik Hatırlatıcısı</Text>
              <Text style={styles.menuSubtext}>24 saat ve 2 saat öncesi</Text>
            </View>
            <Switch
              value={notifPrefs.event_reminder}
              onValueChange={(v) => toggleNotifPref('event_reminder', v)}
              trackColor={{ false: '#e5e7eb', true: COLORS.primaryLight }}
              thumbColor={notifPrefs.event_reminder ? COLORS.primary : '#f4f3f4'}
            />
          </View>
          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Katılım Onayı</Text>
              <Text style={styles.menuSubtext}>Başvurun onaylandığında / reddedildiğinde</Text>
            </View>
            <Switch
              value={notifPrefs.request_update}
              onValueChange={(v) => toggleNotifPref('request_update', v)}
              trackColor={{ false: '#e5e7eb', true: COLORS.primaryLight }}
              thumbColor={notifPrefs.request_update ? COLORS.primary : '#f4f3f4'}
            />
          </View>
          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>❓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Yeni Soru</Text>
              <Text style={styles.menuSubtext}>Etkinliğine soru gelirse</Text>
            </View>
            <Switch
              value={notifPrefs.new_question}
              onValueChange={(v) => toggleNotifPref('new_question', v)}
              trackColor={{ false: '#e5e7eb', true: COLORS.primaryLight }}
              thumbColor={notifPrefs.new_question ? COLORS.primary : '#f4f3f4'}
            />
          </View>
          <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.menuIcon}>👥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Topluluk Gönderileri</Text>
              <Text style={styles.menuSubtext}>Üyesi olduğun topluluklardaki yeni paylaşımlar</Text>
            </View>
            <Switch
              value={notifPrefs.community_post}
              onValueChange={(v) => toggleNotifPref('community_post', v)}
              trackColor={{ false: '#e5e7eb', true: COLORS.primaryLight }}
              thumbColor={notifPrefs.community_post ? COLORS.primary : '#f4f3f4'}
            />
          </View>
          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>🏢</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>İşletme Etkinlikleri</Text>
              <Text style={styles.menuSubtext}>Takip ettiğin işletmeler yeni etkinlik açınca</Text>
            </View>
            <Switch
              value={notifPrefs.business_events}
              onValueChange={(v) => toggleNotifPref('business_events', v)}
              trackColor={{ false: '#e5e7eb', true: COLORS.primaryLight }}
              thumbColor={notifPrefs.business_events ? COLORS.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Erişilebilirlik */}
        <Text style={styles.sectionTitle}>Erişilebilirlik</Text>
        <View style={styles.card}>
          <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.menuIcon}>👁️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Renk Körü Modu</Text>
              <Text style={styles.menuSubtext}>Durumlar renk yerine ikon ile de gösterilir</Text>
            </View>
            <Switch
              value={colorBlindMode}
              onValueChange={toggleColorBlindMode}
              trackColor={{ false: '#e5e7eb', true: COLORS.primaryLight }}
              thumbColor={colorBlindMode ? COLORS.primary : '#f4f3f4'}
              accessibilityLabel="Renk körü modu"
            />
          </View>
        </View>

        {/* Tehlikeli Alan */}
        <Text style={styles.sectionTitle}>Tehlikeli Alan</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={handleDeleteAccount}
            disabled={otpSending}
            accessibilityRole="button"
            accessibilityLabel="Hesabımı sil"
          >
            {otpSending ? (
              <ActivityIndicator size="small" color="#999" />
            ) : (
              <>
                <Text style={styles.menuIcon}>🗑️</Text>
                <Text style={[styles.menuText, { color: '#999' }]}>Hesabımı Sil</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>
          Hesabını sildiğinde tüm verilerin kalıcı olarak kaldırılır.
        </Text>
      </ScrollView>

      {/* SMS Doğrulama Modal */}
      <Modal visible={showOtpModal} transparent animationType="fade">
        <View style={styles.otpOverlay}>
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Telefon Doğrulama</Text>
            <Text style={styles.otpSub}>
              {otpPhone} numarasına gönderilen 6 haneli kodu gir
            </Text>

            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="000000"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
              accessibilityLabel="Doğrulama kodu"
            />

            <TouchableOpacity
              style={[
                styles.otpConfirmBtn,
                otpCode.length < 6 && styles.otpConfirmBtnDisabled,
              ]}
              onPress={verifyAndDelete}
              disabled={otpCode.length < 6 || otpVerifying}
              accessibilityRole="button"
              accessibilityLabel="Hesabı sil"
            >
              {otpVerifying ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.otpConfirmText}>Hesabı Sil</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.otpCancelBtn}
              onPress={() => {
                setShowOtpModal(false);
                setOtpCode('');
              }}
              accessibilityRole="button"
              accessibilityLabel="İptal"
            >
              <Text style={styles.otpCancelText}>{LABELS.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backText: { fontSize: 34, color: COLORS.primary, lineHeight: 38 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  menuIcon: { fontSize: 18 },
  menuText: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  menuSubtext: { fontSize: 12, color: '#888', marginTop: 2 },
  footnote: { fontSize: 12, color: '#aaa', marginTop: 8, paddingHorizontal: 4 },

  // OTP Modal
  otpOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  otpCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  otpTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 8 },
  otpSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  otpInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
    letterSpacing: 8,
    width: '100%',
    marginBottom: 20,
  },
  otpConfirmBtn: {
    backgroundColor: COLORS.error,
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  otpConfirmBtnDisabled: { backgroundColor: '#ccc' },
  otpConfirmText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  otpCancelBtn: { paddingVertical: 8 },
  otpCancelText: { color: '#888', fontSize: 14 },
});
