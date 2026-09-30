import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { runWithBackgroundRetry } from './backgroundRetry';

const MAX_PHOTOS = 6;

/**
 * Pick image(s) from gallery with permission handling.
 * @param {object} [options] – ImagePicker options override
 * @returns {Promise<string|string[]|null>} single URI, array of URIs if allowsMultipleSelection, or null
 */
export async function pickFromGallery(options = {}) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekli.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    ...options,
  });
  if (result.canceled) return null;
  if (options.allowsMultipleSelection) {
    return result.assets.map((a) => a.uri);
  }
  return result.assets[0].uri;
}

/**
 * Take photo with camera with permission handling.
 * @param {object} [options] – ImagePicker options override
 * @returns {Promise<string|null>} local URI or null if cancelled/denied
 */
export async function pickFromCamera(options = {}) {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('İzin Gerekli', 'Kamera izni gerekli.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    ...options,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function compressImage(uri) {
  const ctx = await ImageManipulator.manipulate(uri)
    .resize({ width: 1080 })
    .renderAsync();
  const result = await ctx.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return result.uri;
}

/**
 * Generic photo upload: compress → upload to any bucket/folder → return publicUrl.
 *
 * @param {string} bucket  – Supabase storage bucket name (e.g. 'photos', 'post-photos')
 * @param {string} folder  – Path prefix (e.g. 'chat/abc123', 'community/xyz')
 * @param {string} uri     – Local image URI
 * @returns {Promise<string>} publicUrl of the uploaded image
 */
export async function uploadPhoto(bucket, folder, uri) {
  const compressed = await compressImage(uri);
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const response = await fetch(compressed);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await runWithBackgroundRetry(() =>
    supabase.storage.from(bucket).upload(fileName, arrayBuffer, { contentType: 'image/jpeg' })
  );
  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return publicUrl;
}

export async function pickAndUploadPhoto(userId, existingPhotos) {
  if (existingPhotos.length >= MAX_PHOTOS) {
    Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf yükleyebilirsin.`);
    return null;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekli.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 1,
  });

  if (result.canceled) return null;

  const compressed = await compressImage(result.assets[0].uri);
  const fileName = `${userId}/${Date.now()}.jpg`;

  const response = await fetch(compressed);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await runWithBackgroundRetry(() =>
    supabase.storage.from('photos').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' })
  );

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('photos').getPublicUrl(fileName);

  const newPhotos = [...existingPhotos, publicUrl];

  const { error: updateError } = await runWithBackgroundRetry(() =>
    supabase.from('profiles').update({ photos: newPhotos }).eq('id', userId)
  );

  if (updateError) throw updateError;

  return newPhotos;
}

export async function removePhoto(userId, photoUrl, existingPhotos) {
  const pathMatch = photoUrl.match(/\/photos\/(.+)$/);
  if (pathMatch) {
    await runWithBackgroundRetry(() => supabase.storage.from('photos').remove([pathMatch[1]])).catch(() => {});
  }

  const newPhotos = existingPhotos.filter((p) => p !== photoUrl);

  const { error } = await runWithBackgroundRetry(() =>
    supabase.from('profiles').update({ photos: newPhotos }).eq('id', userId)
  );

  if (error) throw error;

  return newPhotos;
}
