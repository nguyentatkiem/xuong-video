// Vòng chạy SEO tự động: dựng → soát → sửa meta → viết bài mới → dựng lại → soát lại.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { GOC, docJson, ghiJson, ngayHomNay, noi, canhBao, xong } from '../dung/tien-ich.js';
import { dungTatCa } from '../dung/dung.js';
import { soatSeo, xuatBaoCao } from './soat.js';
import { toiUuMeta } from './toi-uu.js';
import { tuKhoaChoViet, lapKeHoach } from './tu-khoa.js';
import { vietBai } from './bai-viet.js';
import { coClaude } from './claude.js';

const TEP_NHAT_KY = path.join(GOC, 'du-lieu', 'seo', 'nhat-ky.json');

function ghiNhatKy(muc) {
  const nk = existsSync(TEP_NHAT_KY) ? docJson(TEP_NHAT_KY) : { lan: [] };
  nk.lan.unshift(muc);
  nk.lan = nk.lan.slice(0, 200);
  ghiJson(TEP_NHAT_KY, nk);
}

/**
 * Một lượt chăm sóc site.
 * @param {object} tuyChon
 * @param {number} tuyChon.soBai  số bài viết mới sẽ sinh (0 = không viết)
 * @param {boolean} tuyChon.suaMeta  cho phép AI viết lại tiêu đề/mô tả yếu
 * @param {string}  tuyChon.chuDe  chủ đề để bổ sung từ khóa khi hàng đợi cạn
 */
export async function chayTuDong({ soBai = 1, suaMeta = true, chuDe = '' } = {}) {
  const batDau = Date.now();
  const viec = { ngay: ngayHomNay(), luc: new Date().toISOString(), baiMoi: [], metaSua: [], loi: [] };

  noi('▸ Dựng lại site…');
  dungTatCa({ imLang: true });

  noi('▸ Soát SEO…');
  let bc = soatSeo();
  viec.diemTruoc = bc.diem;
  noi(`  điểm hiện tại: ${bc.diem}/100 (${bc.soLoi} lỗi, ${bc.soNhac} nhắc)`);

  const sanSang = await coClaude();
  if (!sanSang) {
    canhBao('Không gọi được lệnh `claude` — bỏ qua phần AI, chỉ dựng + soát.');
    viec.loi.push('thiếu claude CLI');
  } else {
    if (suaMeta) {
      noi('▸ Sửa tiêu đề / mô tả yếu…');
      try {
        viec.metaSua = await toiUuMeta(bc);
        for (const t of viec.metaSua) noi(`  · ${t.url} → "${t.sau.tieuDe}"`);
      } catch (e) { viec.loi.push(`sửa meta: ${e.message}`); canhBao(e.message); }
    }

    if (soBai > 0) {
      let hangDoi = tuKhoaChoViet(soBai);
      if (hangDoi.length < soBai && chuDe) {
        noi(`▸ Hàng đợi từ khóa cạn — lập thêm kế hoạch cho "${chuDe}"…`);
        try { await lapKeHoach(chuDe, { so: 10 }); hangDoi = tuKhoaChoViet(soBai); }
        catch (e) { viec.loi.push(`lập kế hoạch: ${e.message}`); canhBao(e.message); }
      }
      for (const cum of hangDoi) {
        noi(`▸ Viết bài: "${cum.tuKhoa}"…`);
        try {
          const kq = await vietBai(cum);
          viec.baiMoi.push({ slug: kq.slug, tieuDe: kq.tieuDe, soTu: kq.soTu, tuKhoa: cum.tuKhoa });
          noi(`  · ${kq.slug} — ${kq.soTu} từ${kq.canhBao.length ? ` (còn lưu ý: ${kq.canhBao.join('; ')})` : ''}`);
        } catch (e) { viec.loi.push(`viết "${cum.tuKhoa}": ${e.message}`); canhBao(e.message); }
      }
      if (!hangDoi.length) noi('  (không có từ khóa nào trong hàng đợi)');
    }
  }

  noi('▸ Dựng lại + soát lần cuối…');
  dungTatCa({ imLang: true });
  bc = soatSeo();
  const tepBaoCao = xuatBaoCao(bc);
  viec.diemSau = bc.diem;
  viec.soTrang = bc.soTrang;
  viec.giay = Math.round((Date.now() - batDau) / 1000);
  ghiNhatKy(viec);

  xong(`Xong sau ${viec.giay}s — điểm SEO ${viec.diemTruoc} → ${viec.diemSau}/100, ${viec.baiMoi.length} bài mới, ${viec.metaSua.length} meta được sửa.`);
  noi(`   Báo cáo: ${path.relative(process.cwd(), tepBaoCao)}`);
  return viec;
}
