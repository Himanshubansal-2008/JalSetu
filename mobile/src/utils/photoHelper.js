/**
 * photoHelper.js
 * Reusable helper utility for photo capture, selection, resizing, compression,
 * and unsigned Cloudinary uploads.
 */

import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { strings } from '../strings';

/**
 * Prompts user to choose photo source: Camera or Gallery.
 * @returns {Promise<'camera' | 'gallery' | null>}
 */
export function promptPhotoSource() {
  return new Promise((resolve) => {
    Alert.alert(
      strings.selectPhotoSourceTitle || 'Add Photo',
      strings.selectPhotoSourceMessage || 'Choose an option to attach a photo',
      [
        {
          text: strings.cancel || 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
        {
          text: strings.takePhoto || 'Take Photo',
          onPress: () => resolve('camera'),
        },
        {
          text: strings.chooseFromGallery || 'Choose from Gallery',
          onPress: () => resolve('gallery'),
        },
      ],
      { onDismiss: () => resolve(null) }
    );
  });
}

/**
 * Resizes and compresses an image asset.
 * Longest side is capped at 1024px (preserving aspect ratio, no upscaling).
 * Compressed as JPEG with quality 0.7.
 *
 * @param {{ uri: string, width?: number, height?: number }} imageAsset
 * @returns {Promise<{ uri: string, width: number, height: number }>}
 */
export async function compressPhoto(imageAsset) {
  if (!imageAsset || !imageAsset.uri) {
    throw new Error('Invalid image asset provided for compression.');
  }

  const { uri, width, height } = imageAsset;
  const actions = [];

  // Cap longest side at 1024px while preserving aspect ratio (do not upscale smaller images)
  if (width && height) {
    const longestSide = Math.max(width, height);
    if (longestSide > 1024) {
      if (width >= height) {
        actions.push({ resize: { width: 1024 } });
      } else {
        actions.push({ resize: { height: 1024 } });
      }
    }
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Picks or captures a photo from 'camera' or 'gallery', requests permissions,
 * and compresses it.
 *
 * @param {'camera' | 'gallery'} [source] - Optional source. If omitted, prompts user.
 * @returns {Promise<{ uri: string, width: number, height: number } | null>}
 */
export async function pickAndCompressPhoto(source) {
  let selectedSource = source;

  // Prompt user if no source was explicitly provided
  if (!selectedSource) {
    selectedSource = await promptPhotoSource();
  }

  if (!selectedSource) {
    return null;
  }

  if (selectedSource === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        strings.cameraPermissionTitle || 'Camera Permission Needed',
        strings.cameraPermissionMessage ||
          'Camera permission is required to take photos. Please enable camera access in your device settings.',
        [
          { text: strings.cancel || 'Cancel', style: 'cancel' },
          {
            text: strings.openSettings || 'Open Settings',
            onPress: () => Linking.openSettings().catch(() => {}),
          },
        ]
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return await compressPhoto(result.assets[0]);
  }

  if (selectedSource === 'gallery') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        strings.mediaLibraryPermissionTitle || 'Gallery Permission Needed',
        strings.mediaLibraryPermissionMessage ||
          'Photo gallery permission is required to select photos. Please enable media access in your device settings.',
        [
          { text: strings.cancel || 'Cancel', style: 'cancel' },
          {
            text: strings.openSettings || 'Open Settings',
            onPress: () => Linking.openSettings().catch(() => {}),
          },
        ]
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return await compressPhoto(result.assets[0]);
  }

  throw new Error(`Invalid photo source: '${selectedSource}'. Expected 'camera' or 'gallery'.`);
}

/**
 * Uploads a local image uri to Cloudinary using an unsigned upload preset.
 *
 * @param {string} uri - Local file uri of the compressed image
 * @param {(progress: number) => void} [onProgress] - Optional upload progress callback (0-100)
 * @returns {Promise<string>} Resolves with the Cloudinary secure_url
 */
export function uploadToCloudinary(uri, onProgress) {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary configuration missing. Please ensure EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET are set in your environment.'
    );
  }

  if (!uri) {
    throw new Error('No image URI provided for Cloudinary upload.');
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const formData = new FormData();
    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri,
      name: filename,
      type,
    });
    formData.append('upload_preset', uploadPreset);

    xhr.open('POST', url);

    // Track upload progress using real XMLHttpRequest progress events
    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (onProgress && event.lengthComputable && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.secure_url) {
            if (onProgress) onProgress(100);
            resolve(response.secure_url);
          } else {
            reject(new Error('Cloudinary response did not contain secure_url.'));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Cloudinary response: ${err.message}`));
        }
      } else {
        let errorDetails = `Cloudinary upload failed with status ${xhr.status}`;
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          if (errorResponse.error && errorResponse.error.message) {
            errorDetails = `Cloudinary upload error: ${errorResponse.error.message}`;
          }
        } catch {
          // Keep generic errorDetails
        }
        reject(new Error(errorDetails));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during Cloudinary upload.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Cloudinary upload request timed out.'));
    };

    xhr.send(formData);
  });
}
