#!/usr/bin/env node
// Xưởng Web — dòng lệnh quản lý website, landing page và SEO AI tự động.
import { noi, canhBao, xong, docCauHinh } from './dung/tien-ich.js';
import { dungTatCa } from './dung/dung.js';
import { soatSeo, xuatBaoCao } from './seo/soat.js';
import { taoSitemap } from './seo/sitemap.js';
import { lapKeHoach, docKeHoach } from './seo/tu-khoa.js';
import { vietBai } from './seo/bai-viet.js';
import { taoLanding } from './seo/landing.js';
import { chayTuDong } from './seo/tu-dong.js';
import { chayMayChu } from './may-chu.js';

const HUONG_DAN = `Xưởng Web — quản lý web, landing page & SEO AI tự động

  node xuong-web/cli.js dung                       Dựng toàn bộ site từ noi-dung/*.json
  node xuong-web/cli.js xem [--cong 5680]          Máy chủ xem thử + bảng điều khiển
  node xuong-web/cli.js landing "<mô tả>"          Tạo landing page mới (AI viết nội dung)
        [--slug ten-duong-dan] [--khong-ai] [--ghi-de]
  node xuong-web/cli.js seo soat                   Chấm điểm SEO toàn site + xuất báo cáo
  node xuong-web/cli.js seo sitemap                Sinh lại sitemap.xml + robots.txt
  node xuong-web/cli.js seo tu-khoa "<chủ đề>"     Lập kế hoạch từ khóa [--so 10]
  node xuong-web/cli.js seo bai-viet "<từ khóa>"   Viết 1 bài chuẩn SEO [--ghi-de]
  node xuong-web/cli.js seo tu-dong                Vòng tự động: dựng → soát → sửa meta → viết bài
        [--so-bai 1] [--chu-de "..."] [--khong-sua-meta]

Biến môi trường: WEB_PORT (mặc định 5680), WEB_MODEL (model cho claude), WEB_THU_MUC (thư mục site).
`;

const CO_GIA_TRI = new Set(['cong', 'slug', 'so', 'so-bai', 'chu-de']);
const doiSo = process.argv.slice(2);
const co = (ten) => doiSo.includes(`--${ten}`);
function giaTri(ten, macDinh) {
  const i = doiSo.indexOf(`--${ten}`);
  return i === -1 ? macDinh : doiSo[i + 1];
}
/** Các tham số không phải cờ (đã bỏ giá trị đi kèm cờ). */
function viTri() {
  const ra = [];
  for (let i = 0; i < doiSo.length; i++) {
    if (doiSo[i].startsWith('--')) { if (CO_GIA_TRI.has(doiSo[i].slice(2))) i++; continue; }
    ra.push(doiSo[i]);
  }
  return ra;
}

async function chay() {
  const vt = viTri();
  const [lenh, lenhCon] = vt;
  const tuDo = vt.slice(lenh === 'seo' ? 2 : 1);

  switch (lenh) {
    case undefined:
    case 'giup':
    case '--help':
    case '-h':
      noi(HUONG_DAN);
      return;

    case 'dung':
      noi('▸ Dựng site…');
      dungTatCa();
      return;

    case 'xem':
      chayMayChu({ cong: Number(giaTri('cong', process.env.WEB_PORT || 5680)) });
      return;

    case 'landing': {
      const brief = tuDo.join(' ');
      if (!brief) { canhBao('Cần mô tả landing page. Ví dụ: node xuong-web/cli.js landing "Khóa AI Sales 3 buổi cho chủ shop"'); process.exitCode = 1; return; }
      noi(`▸ Tạo landing: ${brief}`);
      const kq = await taoLanding(brief, { slug: giaTri('slug'), ghiDe: co('ghi-de'), dungAi: !co('khong-ai') });
      dungTatCa({ imLang: true });
      xong(`Đã tạo ${kq.tep} (nguồn: ${kq.nguon}) → /landing/${kq.slug}.html`);
      return;
    }

    case 'seo': {
      switch (lenhCon) {
        case 'soat': {
          const bc = soatSeo();
          noi(`Điểm SEO: ${bc.diem}/100 — ${bc.soTrang} trang, ${bc.soLoi} lỗi, ${bc.soNhac} nhắc nhở\n`);
          for (const t of bc.trang) {
            noi(`${String(t.diem).padStart(3)}/100  ${t.url}`);
            for (const v of t.loi) noi(`         ❌ ${v.thongDiep} → ${v.cach}`);
            for (const v of t.nhac) noi(`         ⚠️  ${v.thongDiep}`);
          }
          xong(`Báo cáo: ${xuatBaoCao(bc)}`);
          return;
        }
        case 'sitemap': {
          const trang = dungTatCa({ imLang: true });
          const kq = taoSitemap(trang, docCauHinh());
          xong(`sitemap.xml (${kq.soUrl} URL) + robots.txt đã cập nhật.`);
          return;
        }
        case 'tu-khoa': {
          const chuDe = tuDo.join(' ');
          if (!chuDe) { canhBao('Cần chủ đề. Ví dụ: seo tu-khoa "AI cho phòng marketing"'); process.exitCode = 1; return; }
          noi(`▸ Lập kế hoạch từ khóa cho "${chuDe}"…`);
          const kq = await lapKeHoach(chuDe, { so: Number(giaTri('so', 10)) });
          for (const c of kq.cum) noi(`  · [${c.yDinh}] ${c.tuKhoa} → ${c.tieuDeGoiY}`);
          xong(`Thêm ${kq.them} cụm, tổng ${kq.tong} trong hàng đợi.`);
          return;
        }
        case 'bai-viet': {
          const tuKhoa = tuDo.join(' ');
          if (!tuKhoa) { canhBao('Cần từ khóa. Ví dụ: seo bai-viet "AI Agent chăm sóc khách hàng"'); process.exitCode = 1; return; }
          noi(`▸ Viết bài cho "${tuKhoa}"…`);
          const kq = await vietBai(tuKhoa, { ghiDe: co('ghi-de') });
          dungTatCa({ imLang: true });
          if (kq.canhBao.length) canhBao(`Còn lưu ý: ${kq.canhBao.join('; ')}`);
          xong(`${kq.tieuDe} — ${kq.soTu} từ → /blog/${kq.slug}.html`);
          return;
        }
        case 'ke-hoach': {
          const kh = docKeHoach();
          noi(`Kế hoạch từ khóa (cập nhật ${kh.capNhat || 'chưa có'}) — ${kh.cum.length} cụm:`);
          for (const c of kh.cum) noi(`  ${c.trangThai === 'da-viet' ? '✅' : '⬜'} ${c.tuKhoa}${c.slug ? ` → /blog/${c.slug}.html` : ''}`);
          return;
        }
        case 'tu-dong':
          await chayTuDong({
            soBai: Number(giaTri('so-bai', 1)),
            chuDe: giaTri('chu-de', ''),
            suaMeta: !co('khong-sua-meta'),
          });
          return;
        default:
          canhBao(`Không rõ lệnh SEO "${lenhCon || ''}".`);
          noi(HUONG_DAN);
          process.exitCode = 1;
          return;
      }
    }

    default:
      canhBao(`Không rõ lệnh "${lenh}".`);
      noi(HUONG_DAN);
      process.exitCode = 1;
  }
}

chay().catch((e) => {
  canhBao(e.message);
  process.exitCode = 1;
});
