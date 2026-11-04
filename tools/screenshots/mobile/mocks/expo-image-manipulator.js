// SCREENSHOT MOCK ONLY (never in the app): returns the photo unchanged.
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' };
export const ImageManipulator = {
  manipulate(uri) {
    const context = { resize: () => context, renderAsync: async () => ({ saveAsync: async () => ({ uri }) }) };
    return context;
  },
};
