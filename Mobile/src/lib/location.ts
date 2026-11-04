import * as Location from 'expo-location';

import { t } from '@/constants/strings';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LocationResult =
  | { kind: 'ok'; coords: Coordinates; address: string }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'error'; message: string };

const MAX_ADDRESS_LENGTH = 255; // backend limit

function formatAddress(place: Location.LocationGeocodedAddress | undefined) {
  if (!place) {
    return '';
  }
  const street = [place.street, place.streetNumber].filter(Boolean).join(' ');
  const parts = [street || place.name, place.district, place.city, place.region].filter(Boolean);
  return (place.formattedAddress ?? parts.join(', ')).slice(0, MAX_ADDRESS_LENGTH);
}

// Asks for permission, reads the current GPS position and tries to find a readable address.
// It never throws: the result says what happened. A missing address is not an error.
export async function readCurrentLocation(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return { kind: 'denied', canAskAgain: permission.canAskAgain };
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };

    let address = '';
    try {
      const [place] = await Location.reverseGeocodeAsync(coords);
      address = formatAddress(place);
    } catch {
      // Reverse geocoding is optional; the coordinates are enough for a report.
    }

    return { kind: 'ok', coords, address };
  } catch {
    return { kind: 'error', message: t.newReport.locationError };
  }
}
