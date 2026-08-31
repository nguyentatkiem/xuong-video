// Tầng motion-graphics Remotion: render composition React thành webm NỀN TRONG SUỐT
// (vp8 + yuva420p) để ffmpeg phủ lên video. Dùng lại Chromium của Playwright.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let _thu = false;
let _co = false;
let _serveUrl = null;

/** Có bộ Remotion dùng được không (kiểm một lần). */
export async function coRemotion() {
  if (_thu) return _co;
  _thu = true;
  try {
    await import('@remotion/renderer');
    await import('@remotion/bundler');
    _co = true;
  } catch { _co = false; }
  return _co;
}

async function layBundle() {
  if (_serveUrl) return _serveUrl;
  const { bundle } = await import('@remotion/bundler');
  _serveUrl = await bundle({
    entryPoint: path.join(GOC, 'remotion', 'index.ts'),
    publicDir: path.join(GOC, 'remotion', 'public'),
  });
  return _serveUrl;
}

export const DS_MOTION = ['intro', 'scorecard', 'sosanh', 'outro', 'endscreen'];

/**
 * Render một màn motion → tệp webm alpha. Ném lỗi khi hỏng — nơi gọi tự quyết.
 * loai ∈ DS_MOTION; duLieu là props riêng của composition.
 */
export async function renderMotion({ loai, duLieu = {}, skin = {}, kichThuoc, giay, tepRa }) {
  const { renderMedia, selectComposition } = await import('@remotion/renderer');
  const { chromium } = await import('playwright');
  const serveUrl = await layBundle();
  const inputProps = {
    ...duLieu, skin: { ...duLieu.skin, ...skin },
    rong: kichThuoc.rong, cao: kichThuoc.cao, giay,
  };
  const composition = await selectComposition({ serveUrl, id: loai, inputProps });
  await renderMedia({
    composition, serveUrl, inputProps,
    codec: 'vp8', imageFormat: 'png', pixelFormat: 'yuva420p',
    outputLocation: tepRa,
    browserExecutable: chromium.executablePath(),
    concurrency: 2,
  });
  return tepRa;
}
