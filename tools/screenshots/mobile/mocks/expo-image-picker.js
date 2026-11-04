// SCREENSHOT MOCK ONLY (never in the app): "the camera" returns a sample photo served by the mock API.
const photo = { uri: 'http://localhost:4100/uploads/sample-0.jpg', width: 1200, height: 900 };
const granted = async () => ({ granted: true, canAskAgain: true, status: 'granted' });
export const requestCameraPermissionsAsync = granted;
export const requestMediaLibraryPermissionsAsync = granted;
export async function launchCameraAsync() { return { canceled: false, assets: [photo] }; }
export async function launchImageLibraryAsync() { return { canceled: false, assets: [photo] }; }
