// A short, readable location from a reverse-geocoded Indonesian address (same rules as the web,
// web/src/lib/location.ts):
//   "Jl. Rtm No.50, RT.6/RW.10, Tugu, Kec. Cimanggis, Kota Depok, Jawa Barat 16451, Indonesia" -> "Tugu, Cimanggis"
// Without a district ("Kec." / "Kecamatan") it falls back to the first segment; without an address, to the
// coordinates.

const DISTRICT = /^(kec\.?|kecamatan)\s+/i;
const VILLAGE_PREFIX = /^(kel\.?|kelurahan|desa|ds\.)\s+/i;
// Segments that are a street, a neighbourhood unit or a number, not a place name.
const NOT_A_PLACE = /^(jl\.?|jln\.?|jalan|gg\.?|gang|komp\.?|kompleks|perum\.?|rt\.?|rw\.?|no\.?)(\s|\d|\/|$)|\d/i;

export function coordinatesLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function shortLocation(address: string | null | undefined, latitude: number, longitude: number): string {
  const segments = (address ?? '')
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return coordinatesLabel(latitude, longitude);
  }

  const districtIndex = segments.findIndex((segment) => DISTRICT.test(segment));
  if (districtIndex !== -1) {
    const district = segments[districtIndex].replace(DISTRICT, '');
    const before = segments[districtIndex - 1];
    const village = before && !NOT_A_PLACE.test(before) ? before.replace(VILLAGE_PREFIX, '') : null;
    return village ? `${village}, ${district}` : district;
  }

  return segments[0];
}
