// Tiện ích dùng chung cho bộ dựng trang + công cụ SEO
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GOC_XUONG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const GOC = path.dirname(GOC_XUONG);
export const THU_MUC_WEB = process.env.WEB_THU_MUC
  ? path.resolve(GOC, process.env.WEB_THU_MUC)
  : path.join(GOC, 'trang-web');
export const THU_MUC_NOI_DUNG = path.join(THU_MUC_WEB, 'noi-dung');

/** Thoát ký tự HTML — mọi chuỗi từ JSON đều đi qua đây trước khi vào trang. */
export const an = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Thoát cho thuộc tính nằm trong dấu nháy kép. */
export const anThuocTinh = (s = '') => an(s).replace(/\n/g, ' ');

/** Nhiều dòng → nhiều thẻ <span> (dùng cho chữ viết tay, chữ ký). */
export const nhieuDong = (s = '', the = 'span') => String(s).split('\n')
  .map((d) => `<${the}>${an(d)}</${the}>`).join('');

/** Bỏ dấu tiếng Việt + gạch nối → slug sạch cho URL. */
export function taoSlug(chuoi = '') {
  return String(chuoi).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function docJson(tep) {
  return JSON.parse(readFileSync(tep, 'utf8'));
}

export function ghiJson(tep, dl) {
  mkdirSync(path.dirname(tep), { recursive: true });
  writeFileSync(tep, `${JSON.stringify(dl, null, 2)}\n`);
}

/** Ghi tệp, tự tạo thư mục cha. Trả về đường dẫn tương đối so với gốc web. */
export function ghiTep(tep, noiDung) {
  mkdirSync(path.dirname(tep), { recursive: true });
  writeFileSync(tep, noiDung);
  return path.relative(THU_MUC_WEB, tep);
}

/** Liệt kê tệp JSON trong thư mục (bỏ qua thư mục không tồn tại). */
export function dsJson(thuMuc) {
  if (!existsSync(thuMuc)) return [];
  return readdirSync(thuMuc).filter((t) => t.endsWith('.json')).sort()
    .map((t) => path.join(thuMuc, t));
}

/** Liệt kê mọi tệp HTML trong thư mục web (đệ quy, bỏ node_modules). */
export function dsHtml(thuMuc = THU_MUC_WEB) {
  const ra = [];
  const di = (d) => {
    for (const muc of readdirSync(d, { withFileTypes: true })) {
      if (muc.name.startsWith('.') || muc.name === 'node_modules') continue;
      const p = path.join(d, muc.name);
      if (muc.isDirectory()) di(p);
      else if (muc.name.endsWith('.html')) ra.push(p);
    }
  };
  if (existsSync(thuMuc)) di(thuMuc);
  return ra.sort();
}

/** Đường dẫn tệp HTML → URL trang (bỏ index.html, luôn bắt đầu bằng "/"). */
export function urlCuaTep(tep) {
  const tuongDoi = path.relative(THU_MUC_WEB, tep).split(path.sep).join('/');
  return `/${tuongDoi}`.replace(/\/index\.html$/, '/');
}

export const docCauHinh = () => docJson(path.join(THU_MUC_NOI_DUNG, 'cau-hinh.json'));

/** Ngày dạng 2026-09-21 theo giờ địa phương. */
export const ngayHomNay = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Ngày ISO → "21/09/2026" cho người đọc. */
export function ngayDep(iso) {
  const [nam, thang, ngay] = String(iso).split('-');
  return ngay ? `${ngay}/${thang}/${nam}` : String(iso);
}

/** Đếm từ trong một đoạn HTML (đã gỡ thẻ + script + style). */
export function demTu(html) {
  const chu = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return chu.split(/\s+/).filter(Boolean).length;
}

/** In ra terminal có màu nhẹ. */
export const noi = (...p) => console.log(...p);
export const canhBao = (...p) => console.log('⚠️ ', ...p);
export const xong = (...p) => console.log('✅', ...p);
