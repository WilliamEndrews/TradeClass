/**
 * Camera do renderer 2D: zoom ancorado no cursor, pan e follow.
 */
export interface Camera {
  zoom: number;
  panX: number;
  panY: number;
  seguirAgente: string | null;
}

export function cameraInicial(): Camera {
  return { zoom: 1, panX: 0, panY: 0, seguirAgente: null };
}

export function resetarCamera(camera: Camera): void {
  camera.zoom = 1;
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
  const novoZoom = Math.max(0.4, Math.min(4, camera.zoom * fator));
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
