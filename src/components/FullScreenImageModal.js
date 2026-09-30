import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

/**
 * Tam ekran fotoğraf görüntüleyici.
 *
 * Tek fotoğraf:
 *   <FullScreenImageModal uri="https://..." visible={open} onClose={() => setOpen(false)} />
 *
 * Çoklu fotoğraf (kaydırmalı):
 *   <FullScreenImageModal uris={['url1','url2']} initialIndex={2} visible={open} onClose={...} />
 */
export default function FullScreenImageModal({ uri, uris, initialIndex = 0, visible, onClose }) {
  const photos = uris ?? (uri ? [uri] : []);
  const [index, setIndex] = useState(initialIndex);

  if (!photos.length) return null;

  const onViewableChanged = ({ viewableItems }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={s.overlay} edges={['top', 'bottom']}>
        {/* Kapatma butonu */}
        <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <View style={s.closeBtnCircle}>
            <Ionicons name="close" size={22} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Sayaç (birden fazla fotoğraf varsa) */}
        {photos.length > 1 && (
          <View style={s.counter}>
            <Text style={s.counterText}>{index + 1} / {photos.length}</Text>
          </View>
        )}

        {/* Fotoğraflar */}
        {photos.length === 1 ? (
          <TouchableOpacity activeOpacity={1} style={s.singleWrap} onPress={onClose}>
            <Image source={{ uri: photos[0] }} style={s.singleImg} contentFit="contain" />
          </TouchableOpacity>
        ) : (
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, i) => `${i}-${item}`}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
            onViewableItemsChanged={onViewableChanged}
            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={1}
                style={{ width: SW, height: SH, justifyContent: 'center' }}
                onPress={onClose}
              >
                <Image source={{ uri: item }} style={{ width: SW, height: SH }} contentFit="contain" />
              </TouchableOpacity>
            )}
          />
        )}

        {/* Nokta göstergesi (birden fazla fotoğraf varsa) */}
        {photos.length > 1 && (
          <View style={s.dots}>
            {photos.map((_, i) => (
              <View key={i} style={[s.dot, i === index && s.dotActive]} />
            ))}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
  },
  closeBtnCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  counter: {
    position: 'absolute', top: 58, alignSelf: 'center', zIndex: 10,
  },
  counterText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600',
  },
  singleWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  singleImg: {
    width: SW, height: SH * 0.8,
  },
  dots: {
    position: 'absolute', bottom: 40,
    flexDirection: 'row', alignSelf: 'center', gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: { backgroundColor: '#fff', width: 18 },
});
