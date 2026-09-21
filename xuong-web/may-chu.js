// Máy chủ xem thử + bảng điều khiển quản trị. Không phụ thuộc thư viện ngoài.
import http from 'node:http';
import path from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { GOC, THU_MUC_WEB, GOC_XUONG, docCauHinh, docJson, ghiJson, dsJson, THU_MUC_NOI_DUNG, ngayHomNay, noi } from './dung/tien-ich.js';
import { dungTatCa } from './dung/dung.js';
import { soatSeo, xuatBaoCao } from './seo/soat.js';
import { chayTuDong } from './seo/tu-dong.js';
import { docKeHoach, lapKeHoach } from './seo/tu-khoa.js';
import { vietBai } from './seo/bai-viet.js';
import { taoLanding } from './seo/landing.js';

const PORT = Number(process.env.WEB_PORT || 5680);
const TEP_DANG_KY = path.join(GOC, 'du-lieu', 'web', 'dang-ky.json');

const KIEU = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};

const traJson = (res, dl, ma = 200) => {
  res.writeHead(ma, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dl));
};

function docThan(req) {
  return new Promise((giai) => {
    let tho = '';
    req.on('data', (d) => { tho += d; if (tho.length > 1e6) req.destroy(); });
    req.on('end', () => { try { giai(JSON.parse(tho || '{}')); } catch { giai({}); } });
  });
}

function phucVuTinh(res, tep) {
  if (!existsSync(tep) || statSync(tep).isDirectory()) return false;
  res.writeHead(200, {
    'content-type': KIEU[path.extname(tep)] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(tep).pipe(res);
  return true;
}

function luuDangKy(muc) {
  const kho = existsSync(TEP_DANG_KY) ? docJson(TEP_DANG_KY) : { muc: [] };
  kho.muc.unshift({ ...muc, luc: new Date().toISOString() });
  ghiJson(TEP_DANG_KY, kho);
  return kho.muc.length;
}

async function api(req, res, duong) {
  // ── Công khai: form tư vấn trên site ──
  if (duong === '/api/dang-ky' && req.method === 'POST') {
    const dl = await docThan(req);
    if (!dl.ten || !dl.dienThoai) return traJson(res, { ok: false, loi: 'Thiếu tên hoặc số điện thoại.' }, 400);
    const so = luuDangKy({
      ten: String(dl.ten).slice(0, 120),
      dienThoai: String(dl.dienThoai).slice(0, 40),
      email: String(dl.email || '').slice(0, 160),
      nhuCau: String(dl.nhuCau || '').slice(0, 1000),
      tuTrang: String(dl.tuTrang || '').slice(0, 200),
    });
    noi(`📥 Đăng ký mới (#${so}): ${dl.ten} — ${dl.dienThoai}`);
    return traJson(res, { ok: true, thongDiep: 'Đã nhận thông tin, đội ngũ sẽ liên hệ trong 24 giờ làm việc.' });
  }

  // ── Quản trị ──
  if (duong === '/api/tong-quan') {
    const cauHinh = docCauHinh();
    const bc = soatSeo();
    const dangKy = existsSync(TEP_DANG_KY) ? docJson(TEP_DANG_KY).muc : [];
    const kh = docKeHoach();
    return traJson(res, {
      site: { ten: cauHinh.ten, tenMien: cauHinh.tenMien },
      seo: { diem: bc.diem, soTrang: bc.soTrang, soLoi: bc.soLoi, soNhac: bc.soNhac, trang: bc.trang },
      noiDung: {
        trang: dsJson(path.join(THU_MUC_NOI_DUNG, 'trang')).map((t) => path.basename(t)),
        bai: dsJson(path.join(THU_MUC_NOI_DUNG, 'blog')).map((t) => path.basename(t)),
      },
      tuKhoa: { tong: kh.cum.length, cho: kh.cum.filter((c) => c.trangThai !== 'da-viet').length, cum: kh.cum.slice(0, 50) },
      dangKy: dangKy.slice(0, 50),
      ngay: ngayHomNay(),
    });
  }
  if (duong === '/api/dung' && req.method === 'POST') {
    const trang = dungTatCa({ imLang: true });
    return traJson(res, { ok: true, soTrang: trang.length, trang });
  }
  if (duong === '/api/soat' && req.method === 'POST') {
    const bc = soatSeo();
    xuatBaoCao(bc);
    return traJson(res, { ok: true, ...bc });
  }
  if (duong === '/api/tu-dong' && req.method === 'POST') {
    const dl = await docThan(req);
    try {
      const kq = await chayTuDong({ soBai: Number(dl.soBai ?? 1), chuDe: dl.chuDe || '', suaMeta: dl.suaMeta !== false });
      return traJson(res, { ok: true, ...kq });
    } catch (e) { return traJson(res, { ok: false, loi: e.message }, 500); }
  }
  if (duong === '/api/tu-khoa' && req.method === 'POST') {
    const dl = await docThan(req);
    if (!dl.chuDe) return traJson(res, { ok: false, loi: 'Thiếu chủ đề.' }, 400);
    try { return traJson(res, { ok: true, ...(await lapKeHoach(dl.chuDe, { so: Number(dl.so || 10) })) }); }
    catch (e) { return traJson(res, { ok: false, loi: e.message }, 500); }
  }
  if (duong === '/api/bai-viet' && req.method === 'POST') {
    const dl = await docThan(req);
    if (!dl.tuKhoa) return traJson(res, { ok: false, loi: 'Thiếu từ khóa.' }, 400);
    try {
      const kq = await vietBai(dl.tuKhoa, { ghiDe: !!dl.ghiDe });
      dungTatCa({ imLang: true });
      return traJson(res, { ok: true, ...kq });
    } catch (e) { return traJson(res, { ok: false, loi: e.message }, 500); }
  }
  if (duong === '/api/landing' && req.method === 'POST') {
    const dl = await docThan(req);
    if (!dl.brief) return traJson(res, { ok: false, loi: 'Thiếu mô tả landing page.' }, 400);
    try {
      const kq = await taoLanding(dl.brief, { slug: dl.slug, ghiDe: !!dl.ghiDe, dungAi: dl.dungAi !== false });
      dungTatCa({ imLang: true });
      return traJson(res, { ok: true, ...kq });
    } catch (e) { return traJson(res, { ok: false, loi: e.message }, 500); }
  }
  return traJson(res, { loi: 'Không có API này.' }, 404);
}

export function chayMayChu({ cong = PORT, dungTruoc = true } = {}) {
  if (dungTruoc) dungTatCa({ imLang: true });

  const mayChu = http.createServer(async (req, res) => {
    const duong = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      if (duong.startsWith('/api/')) return await api(req, res, duong);

      if (duong === '/bang-dieu-khien' || duong === '/bang-dieu-khien/') {
        return phucVuTinh(res, path.join(GOC_XUONG, 'bang-dieu-khien', 'index.html')) || traJson(res, { loi: 'thiếu bảng điều khiển' }, 404);
      }
      if (duong.startsWith('/bang-dieu-khien/')) {
        const tep = path.join(GOC_XUONG, 'bang-dieu-khien', duong.replace('/bang-dieu-khien/', ''));
        if (tep.startsWith(path.join(GOC_XUONG, 'bang-dieu-khien')) && phucVuTinh(res, tep)) return;
      }

      const trongWeb = path.join(THU_MUC_WEB, duong.replace(/^\/+/, ''));
      if (!trongWeb.startsWith(THU_MUC_WEB)) { res.writeHead(403); return res.end('Cấm'); }
      const ungVien = [
        trongWeb,
        path.join(trongWeb, 'index.html'),
        `${trongWeb.replace(/\/$/, '')}.html`,
      ];
      for (const tep of ungVien) if (phucVuTinh(res, tep)) return;

      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>Không có trang này. <a href="/">Về trang chủ</a></p>');
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Lỗi máy chủ: ${e.message}`);
    }
  });

  mayChu.listen(cong, () => {
    noi(`🌐 Website      → http://localhost:${cong}/`);
    noi(`🎛  Quản trị     → http://localhost:${cong}/bang-dieu-khien`);
  });
  return mayChu;
}
