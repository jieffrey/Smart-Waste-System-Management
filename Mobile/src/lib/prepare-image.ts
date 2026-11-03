import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 1600; // px, longest side
const JPEG_QUALITY = 0.7;

// Shrinks a photo before upload so it stays far below the backend's 5 MB limit. It is always saved as
// JPEG, which also converts formats the backend does not accept (e.g. HEIC photos from an iPhone gallery).
export async function prepareImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return result.uri;
}
