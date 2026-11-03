import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import { readCurrentLocation, type Coordinates, type LocationResult } from '@/lib/location';
import { prepareImage } from '@/lib/prepare-image';
import { createReport } from '@/services/reports';
import type { Report } from '@/types/api';
import { CATEGORY_LABELS, formatConfidence } from '@/utils/format';

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
  const theme = useTheme();
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
      setLocation({ status: 'error', message: result.message });
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
      setPhotoMessage(
        source === 'camera'
          ? 'Camera access is needed to take a photo. You can allow it in the settings.'
          : 'Photo access is needed to choose a picture. You can allow it in the settings.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled) {
      const { uri, width, height } = result.assets[0];
      setPhoto({ uri, width, height });
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
        setSubmitError('The classification service is unavailable right now. Your report was not saved — please try again.');
      } else {
        setSubmitError(getErrorMessage(err));
        setFieldErrors(getFieldErrors(err));
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

  // ---- After a successful submit: show the AI result ----
  if (createdReport) {
    return (
      <Screen>
        <ThemedText type="subtitle">Report submitted</ThemedText>
        <Image
          source={{ uri: photo?.uri }}
          style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}
          contentFit="cover"
        />
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">AI category</ThemedText>
          <ThemedText type="subtitle">{CATEGORY_LABELS[createdReport.category]}</ThemedText>
          <ThemedText themeColor="textSecondary">
            Confidence: {formatConfidence(createdReport.ai_confidence)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Status: pending. You can follow it under My reports.
          </ThemedText>
        </View>
        <Button
          title="View report"
          onPress={() => router.push({ pathname: '/reports/[id]', params: { id: createdReport.id } })}
        />
        <Button title="Report more waste" onPress={startNewReport} variant="secondary" />
      </Screen>
    );
  }

  // ---- The form ----
  const missing = [
    !photo && 'a photo',
    location.status !== 'ready' && 'your location',
    !description.trim() && 'a description',
  ].filter(Boolean);

  return (
    <Screen>
      <ThemedText type="subtitle">New report</ThemedText>
      <ThemedText themeColor="textSecondary">
        Take a photo of the waste. The AI detects whether it is organic, paper or plastic.
      </ThemedText>

      {/* Photo */}
      <ThemedText type="smallBold">Photo</ThemedText>
      {photo ? (
        <Image
          source={{ uri: photo.uri }}
          style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}
          contentFit="cover"
          accessibilityLabel="Selected photo"
        />
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title={photo ? 'Retake' : 'Take photo'} onPress={() => pickPhoto('camera')} variant="secondary" />
        </View>
        <View style={styles.flex}>
          <Button title="From gallery" onPress={() => pickPhoto('library')} variant="secondary" />
        </View>
      </View>
      {photoMessage ? (
        <View style={styles.notice}>
          <ThemedText type="small" style={{ color: theme.danger }}>
            {photoMessage}
          </ThemedText>
          <Button title="Open settings" onPress={() => Linking.openSettings()} variant="secondary" />
        </View>
      ) : null}

      {/* Location */}
      <ThemedText type="smallBold">Location</ThemedText>
      <LocationStatus location={location} onRetry={refreshLocation} />
      {location.status === 'ready' ? (
        <TextField
          label="Address (optional)"
          value={address}
          onChangeText={setAddress}
          error={fieldErrors.address}
          placeholder="Street, area or landmark"
          maxLength={255}
        />
      ) : null}

      {/* Description */}
      <TextField
        label={`Description (${description.length}/${MAX_DESCRIPTION_LENGTH})`}
        value={description}
        onChangeText={setDescription}
        error={fieldErrors.description}
        placeholder="What and how much waste is there?"
        multiline
        maxLength={MAX_DESCRIPTION_LENGTH}
      />

      {submitError ? <ThemedText style={{ color: theme.danger }}>{submitError}</ThemedText> : null}
      {submitting ? (
        <ThemedText type="small" themeColor="textSecondary">
          Uploading and classifying your photo… this can take up to 30 seconds.
        </ThemedText>
      ) : null}

      <Button title="Submit report" onPress={submit} loading={submitting} disabled={missing.length > 0} />
      {missing.length > 0 && !submitting ? (
        <ThemedText type="small" themeColor="textSecondary">
          Still needed: {missing.join(', ')}.
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function LocationStatus({ location, onRetry }: { location: LocationState; onRetry: () => void }) {
  const theme = useTheme();

  if (location.status === 'locating') {
    return (
      <View style={styles.row}>
        <ActivityIndicator color={theme.primary} />
        <ThemedText themeColor="textSecondary">Getting your location…</ThemedText>
      </View>
    );
  }

  if (location.status === 'ready') {
    return (
      <View style={styles.notice}>
        <ThemedText>
          {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
        </ThemedText>
        <Button title="Refresh location" onPress={onRetry} variant="secondary" />
      </View>
    );
  }

  const message =
    location.status === 'denied'
      ? 'Location access is needed to record where the waste is. A report cannot be sent without it.'
      : location.message;
  const canOnlyUseSettings = location.status === 'denied' && !location.canAskAgain;

  return (
    <View style={styles.notice}>
      <ThemedText type="small" style={{ color: theme.danger }}>
        {message}
      </ThemedText>
      {canOnlyUseSettings ? (
        <Button title="Open settings" onPress={() => Linking.openSettings()} variant="secondary" />
      ) : (
        <Button title="Try again" onPress={onRetry} variant="secondary" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  notice: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
});
