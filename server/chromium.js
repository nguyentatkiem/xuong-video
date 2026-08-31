// Cầu nối Playwright/Chromium: chụp canvas nền, mặt nạ bo góc,
// đo bố cục và xuất chuỗi frame PNG trong suốt của lớp đồ hoạ HTML.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KHONG_GIAN, TI_LE_NET, cssSkin } from '../loi/storyboard.js';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEP_ENGINE = path.join(GOC, 'do-hoa', 'overlay.html');
const THU_MUC_FONT = 'file://' + path.join(GOC, 'assets', 'fonts');

let _chromium = null;
let _thu = false;

/** Có Chromium dùng được không (kiểm một lần, nhớ kết quả). */
export async function coChromium() {
  if (_thu) return Boolean(_chromium);
  _thu = true;
  try {
    const { chromium } = await import('playwright');
    const trinhDuyet = await chromium.launch();
    await trinhDuyet.close();
    _chromium = chromium;
  } catch { _chromium = null; }
  return Boolean(_chromium);
}

async function moTrang({ html, tepHtml = null, rong, cao, tiLe = TI_LE_NET }) {
  const trinhDuyet = await _chromium.launch();
  const trang = await trinhDuyet.newPage({
    viewport: { width: rong, height: cao }, deviceScaleFactor: tiLe,
  });
  if (tepHtml) {
    // trang có font file:// phải mở bằng goto (setContent chạy ở about:blank sẽ chặn nạp font)
    await writeFile(tepHtml, html);
    await trang.goto('file://' + tepHtml, { waitUntil: 'networkidle' });
  } else {
    await trang.setContent(html, { waitUntil: 'networkidle' });
  }
  return { trinhDuyet, trang };
}

/** Ghép trang overlay hoàn chỉnh từ template + skin + storyboard. */
export async function xayTrangOverlay({ storyboard, skin, khongGian }) {
  const kg = KHONG_GIAN[khongGian];
  const mau = await readFile(TEP_ENGINE, 'utf8');
  return mau
    .replaceAll('__FONT_DIR__', THU_MUC_FONT)
    .replace('__SKIN__', cssSkin(skin, khongGian))
    .replaceAll('__W__', String(kg.rong))
    .replaceAll('__H__', String(kg.cao))
    .replace('__STORY__', JSON.stringify(storyboard));
}

/** Đo kích thước thật của từng module (cho soi bố cục) — nhanh, 1 lần mở trang. */
export async function doDacOverlay({ storyboard, skin, khongGian, thuMuc = '/tmp' }) {
  if (!(await coChromium())) return null;
  const kg = KHONG_GIAN[khongGian];
  const html = await xayTrangOverlay({ storyboard, skin, khongGian });
  const { trinhDuyet, trang } = await moTrang({
    html, tepHtml: path.join(thuMuc, 'do-dac.html'), rong: kg.rong, cao: kg.cao, tiLe: 1,
  });
  try {
    await trang.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    return await trang.evaluate(() => window.doDac());
  } finally { await trinhDuyet.close(); }
}

/** Chụp chuỗi frame PNG trong suốt của lớp đồ hoạ + phụ đề. */
export async function chupOverlay({ storyboard, skin, khongGian, thuMuc, fps = 30 }) {
  if (!(await coChromium())) return null;
  const kg = KHONG_GIAN[khongGian];
  const html = await xayTrangOverlay({ storyboard, skin, khongGian });
  const thuMucFrame = path.join(thuMuc, 'overlay-frames');
  await mkdir(thuMucFrame, { recursive: true });
  const { trinhDuyet, trang } = await moTrang({
    html, tepHtml: path.join(thuMuc, 'overlay.html'), rong: kg.rong, cao: kg.cao,
  });
  try {
    await trang.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    const soFrame = Math.max(1, Math.ceil(storyboard.dur * fps));
    for (let i = 0; i < soFrame; i++) {
      await trang.evaluate((t) => window.setT(t), i / fps);
      await trang.screenshot({
        path: path.join(thuMucFrame, `${String(i).padStart(5, '0')}.png`),
        omitBackground: true,
      });
    }
    return { thuMucFrame, soFrame };
  } finally { await trinhDuyet.close(); }
}

/** Canvas nền: màu nền + lưới mờ + quầng sáng, vẽ bằng CSS rồi chụp một tấm. */
export async function chupCanvas({ skin = {}, khongGian, thuMuc, ten = 'canvas.png' }) {
  if (!(await coChromium())) return null;
  const kg = KHONG_GIAN[khongGian];
  const nen = skin.nen || {};
  const [r, g, b] = nen.bg || [15, 14, 12];
  const [gr, gg, gb] = nen.glowRgb || [150, 132, 40];
  const luoi = nen.grid ?? 90;
  const glows = nen.glows || [[0.28, 0.20, 0.55, 74], [0.86, 0.78, 0.45, 40]];
  const lopGlow = glows.map(([cx, cy, bk, a]) =>
    `radial-gradient(circle ${Math.round(bk * kg.rong)}px at ${cx * 100}% ${cy * 100}%, rgba(${gr},${gg},${gb},${(a / 255).toFixed(3)}), transparent 70%)`).join(',');
  const lopLuoi = luoi > 0
    ? `background-image:${lopGlow},repeating-linear-gradient(0deg,rgba(150,145,120,.10) 0 1px,transparent 1px ${luoi}px),repeating-linear-gradient(90deg,rgba(150,145,120,.10) 0 1px,transparent 1px ${luoi}px);`
    : `background-image:${lopGlow};`;
  const html = `<!doctype html><style>html,body{margin:0;width:${kg.rong}px;height:${kg.cao}px;background:rgb(${r},${g},${b})}#c{position:absolute;inset:0;${lopLuoi}}</style><div id="c"></div>`;
  const { trinhDuyet, trang } = await moTrang({ html, rong: kg.rong, cao: kg.cao });
  try {
    const tep = path.join(thuMuc, ten);
    await trang.screenshot({ path: tep });
    return tep;
  } finally { await trinhDuyet.close(); }
}

/** Mặt nạ bo góc trắng-trên-đen cho thẻ video (kích thước điểm ảnh thật). */
export async function chupMask({ rongThe, caoThe, boGoc, thuMuc, ten }) {
  if (!(await coChromium())) return null;
  const html = `<!doctype html><style>html,body{margin:0;width:${rongThe}px;height:${caoThe}px;background:#000}div{position:absolute;inset:0;background:#fff;border-radius:${boGoc}px}</style><div></div>`;
  const { trinhDuyet, trang } = await moTrang({ html, rong: rongThe, cao: caoThe, tiLe: 1 });
  try {
    const tep = path.join(thuMuc, ten);
    await trang.screenshot({ path: tep });
    return tep;
  } finally { await trinhDuyet.close(); }
}

/** Ghi trang overlay ra tệp để soi tay khi cần gỡ lỗi. */
export async function luuTrangOverlay({ storyboard, skin, khongGian, thuMuc }) {
  const html = await xayTrangOverlay({ storyboard, skin, khongGian });
  const tep = path.join(thuMuc, 'overlay.html');
  await writeFile(tep, html);
  return tep;
}
