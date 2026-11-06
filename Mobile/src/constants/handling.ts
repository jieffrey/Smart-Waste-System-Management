import type { WasteCategory } from '@/types/api';

// Cara menangani tiap kategori: apa itu, cara menanganinya, ke mana bisa dibawa. Satu peta untuk aplikasi
// (Bahasa Indonesia). Admin web punya peta yang sama dalam bahasa Inggris: web/src/lib/handling.ts.
export type HandlingGuide = { what: string; handle: string[]; goesTo: string };

export const HANDLING: Record<WasteCategory, HandlingGuide> = {
  organic: {
    what: 'Sisa makanan, kulit buah, daun, dan sampah kebun.',
    handle: ['Jangan dicampur dengan plastik atau kertas.', 'Simpan di wadah tertutup, cepat bau.'],
    goesTo: 'Bisa jadi kompos: komposter rumah, rumah kompos, atau TPS3R.',
  },
  paper: {
    what: 'Kardus, koran, kertas bekas, dan kemasan kertas.',
    handle: ['Keringkan dulu. Kertas basah atau berminyak susah didaur ulang.', 'Lipat kardus dan ikat jadi satu.'],
    goesTo: 'Bisa didaur ulang: bawa ke bank sampah atau pengepul.',
  },
  plastic: {
    what: 'Botol, gelas, kantong, dan kemasan plastik.',
    handle: ['Pisahkan dari sampah lain dan kosongkan isinya.', 'Bilas sebentar, botol bisa digepengkan.'],
    goesTo: 'Bisa ke bank sampah atau pengepul. Plastik kotor masuk sampah residu.',
  },
};
