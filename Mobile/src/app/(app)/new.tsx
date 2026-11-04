import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AiResult } from '@/components/reports/ai-result';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FieldMessage } from '@/components/ui/field-message';
import { Rule } from '@/components/ui/rule';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import { readCurrentLocation, type Coordinates, type LocationResult } from '@/lib/location';
import { prepareImage } from '@/lib/prepare-image';
import { createReport } from '@/services/reports';
import type { Report } from '@/types/api';
import { coordinatesLabel, shortLocation } from '@/utils/short-location';

const MAX_DESCRIPTION_LENGTH = 1000;

interface Photo {
  uri: string;
  width: number;
  height: number;
}

type LocationState =
  | { status: 'locating' }
  | { status: 'ready'; coords: Coordinates }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

export default function NewReportScreen() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: 'locating' });
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdReport, setCreatedReport] = useState<Report | null>(null);

  const handleLocationResult = useCallback((result: LocationResult) => {
    if (result.kind === 'ok') {
      setLocation({ status: 'ready', coords: result.coords });
      if (result.address) {
        setAddress(result.address);
      }
    } else if (result.kind === 'denied') {
      setLocation({ status: 'denied', canAskAgain: result.canAskAgain });
    } else {
      setLocation({ status: 'error', message: t.newReport.locationError });
    }
  }, []);

  // Start locating as soon as the screen opens (state only changes in the callback).
  useEffect(() => {
    readCurrentLocation().then(handleLocationResult);
  }, [handleLocationResult]);

  function refreshLocation() {
    setLocation({ status: 'locating' });
    readCurrentLocation().then(handleLocationResult);
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setPhotoMessage(null);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoMessage(source === 'camera' ? t.newReport.cameraDenied : t.newReport.galleryDenied);
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled) {
      const { uri, width, height } = result.assets[0];
      setPhoto({ uri, width, height });
      // A new photo replaces the one the server couldn't process.
      setFieldErrors(({ image: _rejected, ...otherErrors }) => otherErrors);
    }
  }

  async function submit() {
    if (!photo || location.status !== 'ready' || !description.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      const photoUri = await prepareImage(photo);
      const { report } = await createReport({
        photoUri,
        description: description.trim(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address.trim() || undefined,
      });
      setCreatedReport(report);
    } catch (err) {
      // The form keeps everything the user entered, so they can simply try again.
      if (err instanceof ApiError && err.status === 503) {
        setSubmitError(t.newReport.aiUnavailable);
      } else {
        const errors = getFieldErrors(err);
        setFieldErrors(errors);
        // A photo the AI couldn't process (422) is shown on the photo itself, not as a general error.
        setSubmitError(errors.image ? null : getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startNewReport() {
    setCreatedReport(null);
    setPhoto(null);
    setDescription('');
    setSubmitError(null);
    setFieldErrors({});
    refreshLocation();
  }

  // ---- After a successful submit: the AI result ----
  if (createdReport) {
    return (
      <Screen>
        <AiResult
          report={createdReport}
          onViewReport={() => router.push({ pathname: '/reports/[id]', params: { id: createdReport.id } })}
          onReportAgain={startNewReport}
        />
      </Screen>
    );
  }

  // ---- The form: photo first ----
  const missing: string[] = [];
  if (!photo) missing.push(t.newReport.neededPhoto);
  if (location.status !== 'ready') missing.push(t.newReport.neededLocation);
  if (!description.trim()) missing.push(t.newReport.neededDescription);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title" accessibilityRole="header">
          {t.newReport.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t.newReport.intro}</ThemedText>
      </View>

      {/* Photo: the hero and the first action (camera); gallery is a secondary text action */}
      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? t.newReport.retake : t.newReport.photoTap}
          onPress={() => pickPhoto('camera')}
          style={({ pressed }) => [styles.photoArea, fieldErrors.image && styles.photoError, pressed && styles.photoPressed]}>
          {photo ? (
            <>
              <Image
                source={{ uri: photo.uri }}
                style={styles.photo}
                contentFit="cover"
                accessibilityLabel={t.newReport.selectedPhoto}
              />
              <View style={styles.retakeBar}>
                <MaterialCommunityIcons name="camera-retake-outline" size={18} color={Palette.snow} />
                <Text style={styles.retakeText}>{t.newReport.retake}</Text>
              </View>
            </>
          ) : (
            <View style={styles.photoEmpty}>
              <View style={styles.cameraMark}>
                <MaterialCommunityIcons name="camera" size={36} color={Palette.ink} />
              </View>
              <Text style={styles.photoTap}>{t.newReport.photoTap}</Text>
              <Text style={styles.photoHint}>{t.newReport.photoHint}</Text>
            </View>
          )}
        </Pressable>
        <Button title={t.newReport.fromGallery} onPress={() => pickPhoto('library')} variant="text" />
        {fieldErrors.image ? <FieldMessage>{fieldErrors.image}</FieldMessage> : null}
        {photoMessage ? (
          <View style={styles.notice}>
            <FieldMessage>{photoMessage}</FieldMessage>
            <Button title={t.common.openSettings} onPress={() => Linking.openSettings()} variant="text" />
          </View>
        ) : null}
      </View>

      {/* Location: short human form, coordinates in small mono, refresh as a small icon action */}
      <View style={styles.section}>
        <Rule />
        <ThemedText type="micro" themeColor="textSecondary">
          {t.newReport.location}
        </ThemedText>
        <LocationStatus location={location} address={address} onRetry={refreshLocation} />
      </View>

      {location.status === 'ready' ? (
        <TextField
          label={t.newReport.address}
          value={address}
          onChangeText={setAddress}
          error={fieldErrors.address}
          placeholder={t.newReport.addressPlaceholder}
          maxLength={255}
        />
      ) : null}

      <TextField
        label={`${t.newReport.description} (${description.length}/${MAX_DESCRIPTION_LENGTH})`}
        value={description}
        onChangeText={setDescription}
        error={fieldErrors.description}
        placeholder={t.newReport.descriptionPlaceholder}
        multiline
        maxLength={MAX_DESCRIPTION_LENGTH}
      />

      {submitError ? <FieldMessage>{submitError}</FieldMessage> : null}
      {submitting ? <FieldMessage tone="info">{t.newReport.submitting}</FieldMessage> : null}

      <Button title={t.newReport.submit} onPress={submit} loading={submitting} disabled={missing.length > 0} />
      {missing.length > 0 && !submitting ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t.newReport.stillNeeded(missing)}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function LocationStatus({ location, address, onRetry }: { location: LocationState; address: string; onRetry: () => void }) {
  if (location.status === 'locating') {
    return (
      <View style={styles.locationRow}>
        <ActivityIndicator color={Palette.ink} />
        <ThemedText themeColor="textSecondary">{t.newReport.locating}</ThemedText>
      </View>
    );
  }

  if (location.status === 'ready') {
    const { latitude, longitude } = location.coords;
    return (
      <View style={styles.locationRow}>
        <View style={styles.locationText}>
          <ThemedText type="heading">{shortLocation(address, latitude, longitude)}</ThemedText>
          <ThemedText type="mono" themeColor="textSecondary">
            {coordinatesLabel(latitude, longitude)}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.newReport.refreshLocation}
          onPress={onRetry}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={Palette.ink} />
        </Pressable>
      </View>
    );
  }

  const message = location.status === 'denied' ? t.newReport.locationDenied : location.message;
  const canOnlyUseSettings = location.status === 'denied' && !location.canAskAgain;

  return (
    <View style={styles.notice}>
      <FieldMessage>{message}</FieldMessage>
      {canOnlyUseSettings ? (
        <Button title={t.common.openSettings} onPress={() => Linking.openSettings()} variant="text" />
      ) : (
        <Button title={t.common.tryAgain} onPress={onRetry} variant="text" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  photoArea: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.gray100,
    overflow: 'hidden',
  },
  photoError: {
    borderWidth: 3,
  },
  photoPressed: {
    opacity: 0.85,
  },
  photo: {
    flex: 1,
  },
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  cameraMark: {
    width: 72,
    height: 72,
    backgroundColor: Palette.signal, // ink icon on red orange: the main action
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  photoTap: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    color: Palette.ink,
  },
  photoHint: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Palette.gray600, // 5.37:1 on gray-100
  },
  retakeBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Palette.ink,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  retakeText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Palette.snow,
  },
  notice: {
    gap: Spacing.one,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  locationText: {
    flex: 1,
    gap: Spacing.half,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: {
    backgroundColor: Palette.gray100,
  },
});
