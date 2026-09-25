/**
 * AssetIds Create das cameras de cinema (pick / live POV).
 */
export const CAMERA_CINEMA_ASSET_IDS = new Set([
  'created-cinema-camera',
  'created-cinema-camera-pro',
]);

export function ehCameraCinema(assetId: string | undefined): boolean {
  return Boolean(assetId && CAMERA_CINEMA_ASSET_IDS.has(assetId));
}
