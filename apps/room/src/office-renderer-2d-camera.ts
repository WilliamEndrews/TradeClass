/**
 * Camera do renderer 2D: zoom ancorado no cursor, pan e follow.
 * Zoom-in e a visao base (ver camera-zoom.ts).
 */
import {
  CAMERA_ZOOM_INICIAL,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
} from './camera-zoom';

export interface Camera {
  zoom: number;
  panX: number;
  panY: number;
  seguirAgente: string | null;
}

export function cameraInicial(): Camera {
  return { zoom: CAMERA_ZOOM_INICIAL, panX: 0, panY: 0, seguirAgente: null };
}

export function resetarCamera(camera: Camera): void {
  camera.zoom = CAMERA_ZOOM_INICIAL;
  camera.panX = 0;
  camera.panY = 0;
  camera.seguirAgente = null;
}

/** Zoom com ancora no ponto (cx,cy) em CSS px do canvas. */
export function aplicarZoomNoPonto(
  camera: Camera,
  fator: number,
  cx: number,
  cy: number,
  escalaBase: number,
  deslocX: number,
  deslocY: number,
): void {
  const novoZoom = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, camera.zoom * fator));
  const ea = escalaBase * camera.zoom;
  const ed = escalaBase * novoZoom;
  const wx = (cx - deslocX - camera.panX) / ea;
  const wy = (cy - deslocY - camera.panY) / ea;
  camera.panX = cx - deslocX - wx * ed;
  camera.panY = cy - deslocY - wy * ed;
  camera.zoom = novoZoom;
}

/** Suaviza pan para manter o ponto mundo (wx,wy) no centro da tela. */
export function seguirPontoMundo(
  camera: Camera,
  wx: number,
  wy: number,
  centroCssX: number,
  centroCssY: number,
  escalaEfetiva: number,
  deslocX: number,
  deslocY: number,
  suavizacao = 0.08,
): void {
  const alvoX = centroCssX - wx * escalaEfetiva;
  const alvoY = centroCssY - wy * escalaEfetiva;
  camera.panX += (alvoX - deslocX - camera.panX) * suavizacao;
  camera.panY += (alvoY - deslocY - camera.panY) * suavizacao;
}
