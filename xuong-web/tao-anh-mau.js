#!/usr/bin/env node
// Sinh bộ ảnh SVG tạm cho website (chân dung, ảnh khóa học, thumbnail…).
// Thay bằng ảnh thật: giữ nguyên tên tệp trong trang-web/tai-nguyen/anh/ là xong.
import path from 'node:path';
import { THU_MUC_WEB, ghiTep, noi, xong } from './dung/tien-ich.js';

const THU_MUC = path.join(THU_MUC_WEB, 'tai-nguyen', 'anh');
const XANH = ['#0b3f96', '#1560d4', '#4a90f0', '#93c0ff'];

const bocSvg = (r, c, trong) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r} ${c}" width="${r}" height="${c}" role="img">${trong}</svg>\n`;

const doc = (id, tu, den, goc = '135') => `<linearGradient id="${id}" gradientTransform="rotate(${goc})">
  <stop offset="0%" stop-color="${tu}"/><stop offset="100%" stop-color="${den}"/></linearGradient>`;

const luoi = (id, buoc = 28, mau = '#ffffff22') => `<pattern id="${id}" width="${buoc}" height="${buoc}" patternUnits="userSpaceOnUse">
  <path d="M${buoc} 0H0V${buoc}" fill="none" stroke="${mau}" stroke-width="1"/></pattern>`;

/** Bóng người: đầu + vai, dùng cho mọi ảnh chân dung tạm. */
const nguoi = (r, c, mau = '#ffffff', mo = 0.92) => {
  const tam = r / 2;
  const banKinh = r * 0.155;
  const dauY = c * 0.3;
  return `<g fill="${mau}" opacity="${mo}">
    <circle cx="${tam}" cy="${dauY}" r="${banKinh}"/>
    <path d="M${tam - banKinh * 2.35} ${c} c0-${c * 0.3} ${banKinh * 0.9}-${c * 0.36} ${banKinh * 2.35}-${c * 0.36}
             s${banKinh * 2.35} ${c * 0.06} ${banKinh * 2.35} ${c * 0.36}z"/>
  </g>`;
};

const chu = (x, y, noiDung, { co = 20, dam = 700, mau = '#fff', canh = 'middle', mo = 1 } = {}) =>
  `<text x="${x}" y="${y}" fill="${mau}" opacity="${mo}" font-family="'Be Vietnam Pro',system-ui,sans-serif" font-size="${co}" font-weight="${dam}" text-anchor="${canh}">${noiDung}</text>`;

const ghiChuMau = (r, c) => chu(r / 2, c - 14, 'ẢNH MẪU — thay bằng ảnh thật', { co: Math.max(10, r * 0.028), dam: 500, mo: 0.5 });

function chanDung(ten, r, c, nhan) {
  const trong = `<defs>${doc('n', XANH[0], XANH[2])}${luoi('l')}</defs>
  <rect width="${r}" height="${c}" fill="url(#n)"/>
  <rect width="${r}" height="${c}" fill="url(#l)"/>
  <circle cx="${r * 0.5}" cy="${c * 0.42}" r="${r * 0.42}" fill="#ffffff14"/>
  ${nguoi(r, c)}
  ${nhan ? chu(r / 2, c * 0.12, nhan, { co: r * 0.055, mo: 0.85 }) : ''}
  ${ghiChuMau(r, c)}`;
  ghiTep(path.join(THU_MUC, ten), bocSvg(r, c, trong));
}

function anhTron(ten, r, nhan) {
  const trong = `<defs>${doc('n', XANH[1], XANH[0])}</defs>
  <rect width="${r}" height="${r}" rx="${r / 2}" fill="url(#n)"/>
  ${nguoi(r, r, '#fff', 0.9)}
  ${nhan ? chu(r / 2, r * 0.92, nhan, { co: r * 0.11, mo: 0.75 }) : ''}`;
  ghiTep(path.join(THU_MUC, ten), bocSvg(r, r, trong));
}

function biaKhoaHoc(ten, tieuDe, hoaVan) {
  const r = 560, c = 245;
  const hoa = {
    mang: `<g stroke="#ffffff55" fill="none" stroke-width="1.5">
      <circle cx="280" cy="122" r="46"/><circle cx="180" cy="80" r="16"/><circle cx="390" cy="70" r="14"/>
      <circle cx="160" cy="180" r="12"/><circle cx="405" cy="180" r="18"/>
      <path d="M196 88l44 20M374 80l-48 24M172 172l64-28M388 170l-62-26"/></g>`,
    song: `<g stroke="#ffffff55" fill="none" stroke-width="2">
      <path d="M40 180c60-70 120 40 180-30s120 30 180-40"/>
      <path d="M40 210c60-70 120 40 180-30s120 30 180-40" opacity=".5"/></g>`,
    cot: `<g fill="#ffffff44"><rect x="150" y="150" width="34" height="60" rx="6"/><rect x="200" y="120" width="34" height="90" rx="6"/>
      <rect x="250" y="90" width="34" height="120" rx="6"/><rect x="300" y="60" width="34" height="150" rx="6"/></g>`,
    chu: `${chu(280, 140, 'AI', { co: 96, dam: 800, mo: 0.22 })}`,
    khoi: `<g fill="none" stroke="#ffffff55" stroke-width="1.6">
      <path d="M280 62l70 40v80l-70 40-70-40v-80z"/><path d="M280 62v80l70 40M280 142l-70 40"/></g>`,
    tron: `<g fill="none" stroke="#ffffff55" stroke-width="1.6"><circle cx="280" cy="122" r="70"/><circle cx="280" cy="122" r="44"/>
      <path d="M280 52v140M210 122h140"/></g>`,
  }[hoaVan] || '';
  const trong = `<defs>${doc('n', '#06214f', XANH[1], '120')}${luoi('l', 22)}</defs>
  <rect width="${r}" height="${c}" fill="url(#n)"/><rect width="${r}" height="${c}" fill="url(#l)"/>
  ${hoa}
  ${chu(r / 2, c - 34, tieuDe, { co: 26, dam: 700 })}`;
  ghiTep(path.join(THU_MUC, ten), bocSvg(r, c, trong));
}

function thumbnail(ten, tieuDe) {
  const r = 480, c = 270;
  const trong = `<defs>${doc('n', '#06214f', XANH[1])}</defs>
  <rect width="${r}" height="${c}" fill="url(#n)"/>
  ${nguoi(r, c * 1.25, '#ffffff', 0.35)}
  <circle cx="${r / 2}" cy="${c / 2}" r="34" fill="#ffffffee"/>
  <path d="M${r / 2 - 9} ${c / 2 - 14}l26 14-26 14z" fill="${XANH[0]}"/>
  ${chu(r / 2, c - 22, tieuDe, { co: 18, dam: 600, mo: 0.9 })}`;
  ghiTep(path.join(THU_MUC, ten), bocSvg(r, c, trong));
}

function anhSuKien(ten, thanhPho) {
  const r = 300, c = 300;
  const toa = thanhPho === 'HN'
    ? `<g fill="#ffffff55"><path d="M60 210h180v12H60z"/><path d="M96 210V150l54-40 54 40v60z"/><path d="M132 210v-34h36v34z" fill="#ffffff88"/></g>`
    : `<g fill="#ffffff55"><rect x="70" y="150" width="40" height="80" rx="4"/><rect x="120" y="110" width="46" height="120" rx="4"/>
       <rect x="176" y="70" width="40" height="160" rx="4"/><path d="M196 70l-2-28-2 28z" fill="#ffffff88"/></g>`;
  const trong = `<defs>${doc('n', XANH[0], XANH[2], '160')}${luoi('l', 20)}</defs>
  <rect width="${r}" height="${c}" fill="url(#n)"/><rect width="${r}" height="${c}" fill="url(#l)"/>
  ${toa}
  ${chu(r / 2, 268, thanhPho === 'HN' ? 'HÀ NỘI' : 'TP. HCM', { co: 22, dam: 700, mo: 0.9 })}`;
  ghiTep(path.join(THU_MUC, ten), bocSvg(r, c, trong));
}

function hopSanPham() {
  const r = 420, c = 420;
  const trong = `<defs>${doc('n', '#e8f1ff', '#c9ddff', '150')}${doc('h', '#06214f', XANH[1], '135')}</defs>
  <rect width="${r}" height="${c}" fill="url(#n)" rx="18"/>
  <g transform="translate(96 54)">
    <rect x="0" y="0" width="190" height="300" rx="12" fill="url(#h)"/>
    <rect x="0" y="0" width="26" height="300" rx="12" fill="#ffffff22"/>
    ${chu(108, 108, 'SOLO', { co: 34, dam: 800 })}
    ${chu(108, 146, 'AI CEO', { co: 34, dam: 800 })}
    ${chu(108, 186, 'XÂY CÔNG TY 1 NGƯỜI', { co: 13, dam: 500, mo: .85 })}
    ${chu(108, 206, 'VỚI AI', { co: 13, dam: 500, mo: .85 })}
    <circle cx="108" cy="250" r="30" fill="#ffffff22"/>
    ${nguoi(216, 300, '#ffffff', 0.25)}
  </g>
  ${ghiChuMau(r, c)}`;
  ghiTep(path.join(THU_MUC, ten_hop()), bocSvg(r, c, trong));
}
const ten_hop = () => 'hop-solo-ai-ceo.svg';

function anhChiaSe() {
  const r = 1200, c = 630;
  const trong = `<defs>${doc('n', '#06214f', XANH[1], '120')}${luoi('l', 40)}</defs>
  <rect width="${r}" height="${c}" fill="url(#n)"/><rect width="${r}" height="${c}" fill="url(#l)"/>
  ${chu(80, 250, 'LÀM CHỦ AI. LÀM CHỦ TƯƠNG LAI.', { co: 26, dam: 600, canh: 'start', mo: .8 })}
  ${chu(80, 330, 'THIẾT LẬP CÔNG TY 1 NGƯỜI', { co: 62, dam: 800, canh: 'start' })}
  ${chu(80, 404, 'TRONG KỶ NGUYÊN AI', { co: 62, dam: 800, canh: 'start', mau: '#93c0ff' })}
  ${chu(80, 470, 'nguyentatkiem.com', { co: 24, dam: 500, canh: 'start', mo: .75 })}`;
  ghiTep(path.join(THU_MUC, 'og-mac-dinh.svg'), bocSvg(r, c, trong));
}

// ── Sinh toàn bộ ───────────────────────────────────────────────
chanDung('chan-dung-hero.svg', 520, 640, 'NGUYỄN TẤT KIỂM');
chanDung('chan-dung-trich-dan.svg', 480, 420, '');
chanDung('chan-dung-gioi-thieu.svg', 480, 560, '');
chanDung('chan-dung-cta.svg', 240, 320, '');
anhTron('chan-dung-so-do.svg', 240, 'CEO');
['hoc-vien-1', 'hoc-vien-2', 'hoc-vien-3', 'hoc-vien-4'].forEach((t) => anhTron(`${t}.svg`, 96, ''));
thumbnail('video-1.svg', 'Từ 1 người đến doanh thu gấp 3 lần');
thumbnail('video-2.svg', 'Tự động hóa 80% công việc');
thumbnail('video-3.svg', 'Cuộc sống tự do hơn nhờ AI');
biaKhoaHoc('khoa-hoc-1.svg', 'AI BUSINESS SYSTEMS', 'mang');
biaKhoaHoc('khoa-hoc-2.svg', 'BRAND UP', 'song');
biaKhoaHoc('khoa-hoc-3.svg', 'ULTIMATE SALES SYSTEMS', 'cot');
biaKhoaHoc('khoa-hoc-4.svg', 'AI COACHING', 'chu');
biaKhoaHoc('khoa-hoc-5.svg', 'AI SUPERBUILDER', 'khoi');
biaKhoaHoc('khoa-hoc-6.svg', 'AI PERSONALITY MASTER', 'tron');
anhSuKien('su-kien-1.svg', 'HN');
anhSuKien('su-kien-2.svg', 'HN');
anhSuKien('su-kien-3.svg', 'HCM');
hopSanPham();
anhChiaSe();

noi(`Thư mục: ${path.relative(process.cwd(), THU_MUC)}`);
xong('Đã sinh bộ ảnh mẫu SVG.');
