// SCREENSHOT MOCK ONLY (never in the app): a fixed position in Depok with a phone-style reverse-geocoded address.
export const Accuracy = { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 };
export async function requestForegroundPermissionsAsync() { return { granted: true, canAskAgain: true, status: 'granted' }; }
export async function getCurrentPositionAsync() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { coords: { latitude: -6.37712, longitude: 106.86094, accuracy: 12 }, timestamp: Date.now() };
}
export async function reverseGeocodeAsync() {
  return [{ formattedAddress: 'Jl. Rtm No.50, RT.6/RW.10, Tugu, Kec. Cimanggis, Kota Depok, Jawa Barat 16451, Indonesia' }];
}
