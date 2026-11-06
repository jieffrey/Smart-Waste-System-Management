/**
 * Every user-facing text in the mobile app, in Bahasa Indonesia (casual-polite, short), in one file so it is
 * easy to review. Backend error messages (English) are translated at the bottom; unknown ones pass through.
 */
import type { ReportStatus, WasteCategory } from '@/types/api';

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Menunggu',
  in_progress: 'Diproses',
  completed: 'Selesai',
  rejected: 'Ditolak',
};

export const CATEGORY_LABELS: Record<WasteCategory, string> = {
  organic: 'Organik',
  paper: 'Kertas',
  plastic: 'Plastik',
};

export const t = {
  appName: 'SWMS',
  web: {
    title: 'Buka lewat aplikasi di HP',
    message: 'Pelaporan sampah SWMS jalan di Android dan iOS (Expo Go). Petugas memakai dasbor web.',
  },

  common: {
    loading: 'Memuat…',
    tryAgain: 'Coba lagi',
    cancel: 'Batal',
    openSettings: 'Buka pengaturan',
    somethingWrong: 'Ada yang tidak beres',
    genericError: 'Ada yang tidak beres. Coba lagi, ya.',
    loadMore: 'Muat lagi',
  },

  auth: {
    headline: 'Lihat sampah? Foto, kirim,',
    headlineHighlight: 'beres.',
    subline: 'AI memilah jenis sampahnya, petugas yang turun tangan, dan kamu bisa memantau sampai selesai.',
    loginTitle: 'Masuk',
    email: 'Email',
    password: 'Kata sandi',
    logIn: 'Masuk',
    noAccount: 'Belum punya akun?',
    createOne: 'Daftar di sini',
    registerTitle: 'Buat akun',
    registerIntro: 'Daftar untuk mulai melaporkan sampah di sekitarmu.',
    fullName: 'Nama lengkap',
    passwordHint: 'Kata sandi (8–72 karakter)',
    createAccount: 'Buat akun',
    haveAccount: 'Sudah punya akun?',
    goToLogin: 'Masuk di sini',
  },

  onboarding: {
    skip: 'Lewati',
    next: 'Lanjut',
    start: 'Mulai lapor',
    progress: (step: number, total: number) => `Langkah ${step} dari ${total}`,
    slides: [
      {
        kicker: '01 · lihat',
        title: 'Lihat sampah?\nJepret aja.',
        body: 'Satu foto cukup. Lokasinya ikut tercatat otomatis, nggak perlu ngetik alamat.',
      },
      {
        kicker: '02 · pilah',
        title: 'AI langsung\nmilahin.',
        body: 'Organik, kertas, atau plastik? Ketahuan dalam hitungan detik.',
      },
      {
        kicker: '03 · beres',
        title: 'Petugas gerak,\nkamu pantau.',
        body: 'Dari menunggu sampai selesai, semua kelihatan di HP-mu. Sampai beres.',
      },
    ],
    stickers: {
      snap: 'cekrek!',
      ai: 'AI',
      done: 'beres!',
    },
  },
  tabs: {
    myReports: 'Laporan saya',
    report: 'Lapor',
    account: 'Akun',
  },

  myReports: {
    title: 'Laporan saya',
    loading: 'Memuat laporanmu…',
    emptyTitle: 'Belum ada laporan',
    emptyMessage: 'Lihat tumpukan sampah? Foto dan laporkan, biar petugas yang urus.',
    emptyAction: 'Buat laporan pertama',
    emptyFiltered: (status: string) => `Tidak ada laporan berstatus ${status.toLowerCase()}.`,
    reportDetailTitle: 'Detail laporan',
    count: (n: number) => `${n} laporan`,
    back: 'Kembali',
  },

  filter: {
    label: 'Status',
    all: 'Semua',
    dialogTitle: 'Tampilkan laporan',
  },

  newReport: {
    title: 'Lapor sampah',
    intro: 'Foto sampahnya. AI langsung mengenali: organik, kertas, atau plastik.',
    photoTap: 'Ketuk untuk memotret',
    photoHint: 'Foto jelas, satu tumpukan saja',
    photoLabel: 'Foto',
    selectedPhoto: 'Foto yang dipilih',
    retake: 'Foto ulang',
    fromGallery: 'Pilih dari galeri',
    cameraDenied: 'Izinkan akses kamera untuk memotret. Kamu bisa mengubahnya di pengaturan.',
    galleryDenied: 'Izinkan akses foto untuk memilih gambar. Kamu bisa mengubahnya di pengaturan.',
    location: 'Lokasi',
    locating: 'Mencari lokasimu…',
    refreshLocation: 'Perbarui lokasi',
    locationDenied: 'Izinkan akses lokasi supaya petugas tahu di mana sampahnya. Laporan tidak bisa dikirim tanpa lokasi.',
    locationError: 'Lokasi tidak ditemukan. Pastikan GPS menyala, lalu coba lagi.',
    address: 'Alamat (opsional)',
    addressPlaceholder: 'Jalan, daerah, atau patokan',
    description: 'Keterangan',
    descriptionPlaceholder: 'Sampah apa dan seberapa banyak?',
    submit: 'Kirim laporan',
    submitting: 'Mengunggah dan memilah fotomu… bisa sampai 30 detik.',
    stillNeeded: (items: string[]) => `Masih perlu: ${items.join(', ')}.`,
    neededPhoto: 'foto',
    neededLocation: 'lokasi',
    neededDescription: 'keterangan',
    aiUnavailable: 'Layanan AI sedang tidak tersedia. Laporanmu belum tersimpan, coba kirim lagi, ya.',
  },

  result: {
    detected: (category: string) => `Terdeteksi sampah ${category.toLowerCase()}.`,
    whatNext: 'Laporanmu sudah masuk dan menunggu ditinjau petugas.',
    confidence: (value: string) => `Keyakinan AI ${value}`,
    journeyTitle: 'Perjalanan laporanmu',
    viewReport: 'Lihat laporan',
    reportAgain: 'Lapor lagi',
  },

  detail: {
    loading: 'Memuat laporan…',
    statusLabel: 'Status',
    reportedOn: (date: string) => `Dilaporkan ${date}`,
    adminNote: 'Catatan petugas',
    timeline: 'Riwayat',
    timelineReported: 'Laporan dibuat',
    timelineChanged: (from: string) => `dari ${from}`,
    noHistory: 'Belum ada perubahan status.',
    category: 'Kategori',
    aiSuggested: (category: string) => `AI menebak ${category.toLowerCase()}, lalu dikoreksi petugas.`,
    aiConfidence: (value: string) => `Keyakinan AI ${value}`,
    location: 'Lokasi',
    openMaps: 'Buka di Maps',
    description: 'Keterangan',
    photoLabel: 'Foto laporan',
  },

  journey: {
    sent: 'Terkirim',
    pending: 'Menunggu',
    in_progress: 'Diproses',
    completed: 'Selesai',
    now: 'sekarang',
  },

  account: {
    title: 'Akun',
    name: 'Nama',
    email: 'Email',
    logOut: 'Keluar',
    logOutTitle: 'Keluar dari akun?',
    logOutMessage: 'Kamu perlu masuk lagi untuk melapor.',
  },

  session: {
    expired: 'Sesimu sudah habis. Silakan masuk lagi.',
    adminOnly: 'Aplikasi ini untuk melapor sampah. Petugas memakai dasbor web.',
  },

  errors: {
    offlineStartup: 'Server tidak bisa dihubungi. Cek koneksi internetmu, lalu coba lagi.',
    noApiUrl: 'Alamat server belum diatur. Tambahkan EXPO_PUBLIC_API_URL di Mobile/.env lalu jalankan ulang Expo.',
    timeout: 'Server terlalu lama merespons. Coba lagi, ya.',
    network: 'Server tidak bisa dihubungi. Cek koneksi internet dan alamat server.',
    sendFailed: 'Permintaan gagal dikirim. Coba lagi, ya.',
    requestFailed: (status: number) => `Permintaan gagal (${status}).`,
  },
} as const;

// Backend messages (English) -> Indonesian. Matched exactly; patterns below handle messages with numbers.
const BACKEND_MESSAGES: Record<string, string> = {
  'Invalid email or password': 'Email atau kata sandi salah.',
  'Account is deactivated': 'Akunmu dinonaktifkan. Hubungi petugas.',
  'Invalid or expired token': t.session.expired,
  'Authentication required': t.session.expired,
  'Email is already registered': 'Email ini sudah terdaftar.',
  'Validation failed': 'Ada isian yang perlu dibetulkan.',
  'Email is required': 'Email wajib diisi.',
  'Email is invalid': 'Format email tidak valid.',
  'Email must be at most 255 characters': 'Email maksimal 255 karakter.',
  'Password is required': 'Kata sandi wajib diisi.',
  'Password must be at least 8 characters': 'Kata sandi minimal 8 karakter.',
  'Password must be at most 72 characters': 'Kata sandi maksimal 72 karakter.',
  'This password is too common. Please choose a less predictable one': 'Kata sandi ini terlalu umum. Pilih yang lebih sulit ditebak.',
  'Full name is required': 'Nama lengkap wajib diisi.',
  'Full name must be at least 2 characters': 'Nama lengkap minimal 2 karakter.',
  'Full name must be at most 100 characters': 'Nama lengkap maksimal 100 karakter.',
  'Description is required': 'Keterangan wajib diisi.',
  'Description must be at most 1000 characters': 'Keterangan maksimal 1000 karakter.',
  'Address must be at most 255 characters': 'Alamat maksimal 255 karakter.',
  'Image is required': 'Foto wajib dilampirkan.',
  'Image must be 5 MB or smaller': 'Ukuran foto maksimal 5 MB.',
  'Unsupported file type. Upload a JPEG, PNG or WebP image': 'Format foto tidak didukung. Pakai JPEG, PNG, atau WebP.',
  "The photo couldn't be processed. Try another photo.": 'Foto tidak bisa diproses. Coba foto lain, ya.',
  'AI service unavailable, please try again later': t.newReport.aiUnavailable,
  'Report not found': 'Laporan tidak ditemukan.',
  'Too many form fields': 'Isian formulir terlalu banyak.',
  'A form field is too long': 'Ada isian yang terlalu panjang.',
  'Request body is too large': 'Data yang dikirim terlalu besar.',
  'Internal server error': 'Terjadi kesalahan di server. Coba lagi nanti.',
};

// "Too many login attempts. Please try again in 15 minutes." and similar rate-limit messages.
const RATE_LIMIT = /^Too many (login attempts|sign-up attempts|new reports)\. Please try again in (\d+) minutes?\.$/;
const RATE_LIMIT_WHAT: Record<string, string> = {
  'login attempts': 'percobaan masuk',
  'sign-up attempts': 'percobaan daftar',
  'new reports': 'laporan baru',
};

export function translateBackendMessage(message: string): string {
  const exact = BACKEND_MESSAGES[message];
  if (exact) {
    return exact;
  }
  const limited = RATE_LIMIT.exec(message);
  if (limited) {
    return `Terlalu banyak ${RATE_LIMIT_WHAT[limited[1]]}. Coba lagi dalam ${limited[2]} menit.`;
  }
  return message;
}
