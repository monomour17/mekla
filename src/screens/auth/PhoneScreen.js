import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { otpSendErrorMessage } from '../../utils/errorHandler';

export default function PhoneScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 10) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası girin.');
      return;
    }

    const fullPhone = cleaned.startsWith('+')
      ? cleaned
      : `+90${cleaned.replace(/^0/, '')}`;

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);

    if (error) {
      if (__DEV__) console.error('[OTP gönder]', error.message);
      Alert.alert('Hata', otpSendErrorMessage(error));
      return;
    }

    navigation.navigate('OTP', { phone: fullPhone });
  };

  const isValid = phone.replace(/\s/g, '').length >= 10;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        <Text style={styles.logo}>Mekla</Text>
        <Text style={styles.title}>Telefon numaranı gir</Text>
        <Text style={styles.subtitle}>
          SMS ile doğrulama kodu göndereceğiz
        </Text>

        {/* Numara input */}
        <View style={styles.inputRow}>
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>🇹🇷 +90</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="5XX XXX XX XX"
            placeholderTextColor={COLORS.textPlaceholder}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={11}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSend}
            accessibilityLabel="Telefon numarası"
          />
        </View>

        {/* Devam butonu */}
        <TouchableOpacity
          style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={!isValid || loading}
          accessibilityRole="button"
          accessibilityLabel="Devam et"
        >
          <Text style={styles.buttonText}>
            {loading ? 'Gönderiliyor...' : 'Devam Et'}
          </Text>
        </TouchableOpacity>

        {/* Küçük bilgi notu */}
        <Text style={styles.note}>
          Numaranı yalnızca doğrulama için kullanıyoruz.
        </Text>

      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 32,
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 28,
  },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  prefix: {
    backgroundColor: '#f3f0ff',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  prefixText: {
    fontSize: 15,
    color: COLORS.textDark,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: COLORS.textDark,
    fontWeight: '600',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    color: COLORS.textPlaceholder,
    textAlign: 'center',
  },
});
