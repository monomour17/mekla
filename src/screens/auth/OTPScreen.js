import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';

const RESEND_SECONDS = 60;

// Ağ donarsa (mobil veri/hotspot) fetch() süresiz asılı kalabilir — kullanıcı
// "Doğrulanıyor..." ekranında sonsuza kadar kilitli kalırdı.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export default function OTPScreen({ route, navigation }) {
  const { phone } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRef = useRef(null);

  // Geri sayım
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 6 rakam girilince otomatik doğrula
  useEffect(() => {
    if (otp.length === 6) handleVerify();
  }, [otp]);

  const handleVerify = async () => {
    if (otp.length !== 6 || loading) return;
    setLoading(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' }),
        15000,
      );
      if (error) {
        Alert.alert('Hata', 'Kod yanlış veya süresi dolmuş. Tekrar dene.');
        setOtp('');
        inputRef.current?.focus();
      }
      // Başarılıysa onAuthStateChange otomatik yönlendirir
    } catch (err) {
      const message = err?.message === 'timeout'
        ? 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.'
        : 'Bir şeyler ters gitti. Tekrar dene.';
      Alert.alert('Hata', message);
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setResending(false);
    if (error) {
      Alert.alert('Hata', 'Kod gönderilemedi. Birazdan tekrar dene.');
      return;
    }
    setOtp('');
    setCountdown(RESEND_SECONDS);
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header — her zaman görünür */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Geri dön"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Kodu Gir</Text>
            {/* İptal butonu — sağ üst */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="İptal"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
          </View>

          {/* İçerik */}
          <View style={styles.content}>
            <Text style={styles.logo}>Mekla</Text>

            <Text style={styles.subtitle}>
              <Text style={styles.phoneText}>{phone}</Text>
              {' '}numarasına gönderilen{'\n'}6 haneli kodu gir
            </Text>

            {/* OTP Input */}
            <TextInput
              ref={inputRef}
              style={[styles.input, loading && styles.inputDisabled]}
              placeholder="------"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              textAlign="center"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
              editable={!loading}
              accessibilityLabel="Doğrulama kodu"
            />

            {/* Doğrula butonu */}
            <TouchableOpacity
              style={[styles.button, (loading || otp.length < 6) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading || otp.length < 6}
              accessibilityRole="button"
              accessibilityLabel="Doğrula"
            >
              <Text style={styles.buttonText}>
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </Text>
            </TouchableOpacity>

            {/* Tekrar gönder */}
            <View style={styles.resendRow}>
              {countdown > 0 ? (
                <Text style={styles.countdownText}>
                  Tekrar gönder ({countdown}s)
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resending}
                  accessibilityRole="button"
                  accessibilityLabel="Kodu tekrar gönder"
                >
                  <Text style={styles.resendText}>
                    {resending ? 'Gönderiliyor...' : 'Kodu tekrar gönder'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Numara değiştir */}
            <TouchableOpacity
              style={styles.changePhoneBtn}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Farklı numara kullan"
            >
              <Ionicons name="arrow-back-outline" size={14} color={COLORS.primary} />
              <Text style={styles.changePhoneText}>Farklı numara kullan</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scroll: {
    flexGrow: 1,
  },

  // Header — her zaman en üstte, klavyeden etkilenmiyor
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  cancelBtn: {
    padding: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // İçerik
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 32,
    lineHeight: 22,
    textAlign: 'center',
  },
  phoneText: {
    fontWeight: '700',
    color: COLORS.textDark,
  },
  input: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 20,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    color: COLORS.textDark,
    letterSpacing: 10,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  countdownText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  changePhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  changePhoneText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
