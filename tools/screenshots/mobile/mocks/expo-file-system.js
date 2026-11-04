// SCREENSHOT MOCK ONLY (never in the app): a File the browser's FormData can upload (the mock API ignores it).
export class File extends Blob {
  constructor(uri) {
    super([String(uri)], { type: 'image/jpeg' });
    this.uri = uri;
    this.name = 'photo.jpg';
  }
}
