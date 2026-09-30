import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureError } from '../services/monitoring';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (__DEV__) console.error('ErrorBoundary caught:', error, info?.componentStack);
    captureError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>:(</Text>
            <Text style={styles.title}>Bir Sorun Olustu</Text>
            <Text style={styles.subtitle}>
              Beklenmedik bir hata meydana geldi.{'\n'}
              Uygulamayi yeniden baslatmayi dene.
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => this.setState({ hasError: false })}
            >
              <Text style={styles.btnText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 56, marginBottom: 20, color: '#6C47FF', fontWeight: '900' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  btn: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
