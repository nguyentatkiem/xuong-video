// Soát SEO kỹ thuật + nội dung cho mọi trang HTML đã dựng. Không phụ thuộc thư viện ngoài.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  GOC, THU_MUC_WEB, dsHtml, urlCuaTep, demTu, docCauHinh, ghiJson, ghiTep, ngayHomNay,
} from '../dung/tien-ich.js';

const NGUONG = {
  tieuDe: [30, 65],
  moTa: [70, 165],
  tuToiThieu: 300,
  lienKetNoiBo: 3,
};

const lay = (html, re) => (html.match(re) || [])[1] || '';
const dem = (html, re) => (html.match(re) || []).length;

function docTrang(tep) {
  const html = readFileSync(tep, 'utf8');
  const than = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  return {
    tep,
    url: urlCuaTep(tep),
    html,
    than,
    tieuDe: lay(html, /<title>([\s\S]*?)<\/title>/i).trim(),
    moTa: lay(html, /<meta\s+name="description"\s+content="([^"]*)"/i).trim(),
    canonical: lay(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i),
    ngonNgu: lay(html, /<html[^>]*\blang="([^"]*)"/i),
    h1: (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []).map((h) => h.replace(/<[^>]+>/g, '').trim()),
    soH2: dem(html, /<h2[\s>]/gi),
    anh: html.match(/<img\b[^>]*>/gi) || [],
    lienKet: html.match(/<a\b[^>]*href="([^"]*)"/gi) || [],
    ogThieu: ['og:title', 'og:description', 'og:image', 'og:url']
      .filter((k) => !new RegExp(`property="${k}"`).test(html)),
    twitterThieu: ['twitter:card', 'twitter:title', 'twitter:image']
      .filter((k) => !new RegExp(`name="${k}"`).test(html)),
    jsonLd: (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || []),
    coViewport: /name="viewport"/i.test(html),
    tuKhoa: lay(html, /<meta\s+name="keywords"\s+content="([^"]*)"/i).split(',').map((t) => t.trim()).filter(Boolean),
    soTu: demTu((html.match(/<main[\s\S]*?<\/main>/i) || [html])[0]),
  };
}

function soatMotTrang(t, trungTieuDe, trungMoTa) {
  const loi = [];
  const nhac = [];
  const them = (ds, ma, thongDiep, cach) => ds.push({ ma, thongDiep, cach });

  if (!t.tieuDe) them(loi, 'tieu-de-thieu', 'Thiếu thẻ <title>.', 'Thêm "tieuDe" vào JSON của trang.');
  else if (t.tieuDe.length < NGUONG.tieuDe[0] || t.tieuDe.length > NGUONG.tieuDe[1]) {
    them(nhac, 'tieu-de-do-dai', `Tiêu đề ${t.tieuDe.length} ký tự (nên ${NGUONG.tieuDe.join('–')}).`, 'Viết lại "tieuDe" cho gọn và chứa từ khóa chính.');
  }
  if (!t.moTa) them(loi, 'mo-ta-thieu', 'Thiếu meta description.', 'Thêm "moTa" vào JSON của trang.');
  else if (t.moTa.length < NGUONG.moTa[0] || t.moTa.length > NGUONG.moTa[1]) {
    them(nhac, 'mo-ta-do-dai', `Mô tả ${t.moTa.length} ký tự (nên ${NGUONG.moTa.join('–')}).`, 'Viết lại "moTa" nêu rõ lợi ích + từ khóa.');
  }
  if (trungTieuDe.has(t.tieuDe) && trungTieuDe.get(t.tieuDe) > 1) {
    them(loi, 'tieu-de-trung', 'Tiêu đề trùng với trang khác.', 'Mỗi trang cần một tiêu đề riêng.');
  }
  if (t.moTa && trungMoTa.get(t.moTa) > 1) {
    them(nhac, 'mo-ta-trung', 'Mô tả trùng với trang khác.', 'Viết mô tả riêng cho từng trang.');
  }
  if (!t.canonical) them(loi, 'canonical-thieu', 'Thiếu thẻ canonical.', 'Bộ dựng tự thêm — kiểm tra "tenMien" trong cau-hinh.json.');
  if (!t.ngonNgu) them(loi, 'lang-thieu', 'Thẻ <html> thiếu thuộc tính lang.', 'Đặt "ngonNgu" trong cau-hinh.json.');
  if (t.h1.length === 0) them(loi, 'h1-thieu', 'Trang không có <h1>.', 'Mỗi trang cần đúng 1 thẻ h1.');
  else if (t.h1.length > 1) them(loi, 'h1-nhieu', `Có ${t.h1.length} thẻ <h1>.`, 'Giữ đúng 1 h1, các mục còn lại dùng h2.');
  if (t.soH2 < 2) them(nhac, 'h2-it', `Chỉ có ${t.soH2} thẻ <h2>.`, 'Chia nội dung thành các mục có tiêu đề rõ ràng.');

  const anhThieuAlt = t.anh.filter((a) => !/\balt="[^"]+"/i.test(a));
  if (anhThieuAlt.length) {
    them(loi, 'alt-thieu', `${anhThieuAlt.length} ảnh thiếu alt.`, 'Mô tả ảnh bằng tiếng Việt có chứa ngữ cảnh.');
  }
  const anhThieuKichThuoc = t.anh.filter((a) => !/\bwidth=/.test(a) && !/\bloading="lazy"/.test(a));
  if (anhThieuKichThuoc.length) {
    them(nhac, 'anh-chua-toi-uu', `${anhThieuKichThuoc.length} ảnh chưa có width/height hoặc lazy-load.`, 'Thêm loading="lazy" (ảnh dưới màn hình đầu) hoặc kích thước cố định để tránh nhảy layout.');
  }
  if (t.ogThieu.length) them(nhac, 'og-thieu', `Thiếu thẻ Open Graph: ${t.ogThieu.join(', ')}.`, 'Cần cho ảnh xem trước khi chia sẻ Facebook/Zalo.');
  if (t.twitterThieu.length) them(nhac, 'twitter-thieu', `Thiếu thẻ Twitter Card: ${t.twitterThieu.join(', ')}.`, 'Bổ sung trong bo-cuc.js.');
  if (!t.jsonLd.length) them(loi, 'schema-thieu', 'Không có dữ liệu có cấu trúc (JSON-LD).', 'Bộ dựng tự thêm — kiểm tra lại khối nội dung.');
  else {
    for (const khoi of t.jsonLd) {
      const tho = khoi.replace(/<\/?script[^>]*>/gi, '');
      try { JSON.parse(tho); } catch {
        them(loi, 'schema-hong', 'JSON-LD không phải JSON hợp lệ.', 'Kiểm tra ký tự đặc biệt trong nội dung.');
      }
    }
  }
  if (!t.coViewport) them(loi, 'viewport-thieu', 'Thiếu thẻ viewport.', 'Trang sẽ vỡ trên điện thoại.');
  if (t.soTu < NGUONG.tuToiThieu) {
    them(nhac, 'noi-dung-mong', `Chỉ ${t.soTu} từ trong <main> (nên ≥ ${NGUONG.tuToiThieu}).`, 'Bổ sung nội dung trả lời đúng ý định tìm kiếm.');
  }
  const noiBo = t.lienKet.filter((a) => /href="\/(?!\/)/.test(a)).length;
  if (noiBo < NGUONG.lienKetNoiBo) {
    them(nhac, 'lien-ket-noi-bo-it', `Chỉ ${noiBo} liên kết nội bộ.`, 'Liên kết sang khóa học, blog, trang liên hệ liên quan.');
  }
  const tuChinh = t.tuKhoa[0];
  if (tuChinh) {
    const trongTieuDe = t.tieuDe.toLowerCase().includes(tuChinh.toLowerCase());
    const trongH1 = t.h1.join(' ').toLowerCase().includes(tuChinh.toLowerCase());
    if (!trongTieuDe && !trongH1) {
      them(nhac, 'tu-khoa-vang', `Từ khóa chính "${tuChinh}" không xuất hiện trong tiêu đề lẫn h1.`, 'Đưa từ khóa vào tiêu đề một cách tự nhiên.');
    }
  }

  const diem = Math.max(0, 100 - loi.length * 12 - nhac.length * 4);
  return {
    url: t.url,
    tep: path.relative(THU_MUC_WEB, t.tep),
    tieuDe: t.tieuDe,
    soTu: t.soTu,
    soAnh: t.anh.length,
    diem,
    loi,
    nhac,
  };
}

/** Soát toàn bộ site. Trả {diem, trang[], tongKet}. */
export function soatSeo() {
  const cauHinh = docCauHinh();
  const cacTep = dsHtml();
  const trangs = cacTep.map(docTrang);

  const trungTieuDe = new Map();
  const trungMoTa = new Map();
  for (const t of trangs) {
    trungTieuDe.set(t.tieuDe, (trungTieuDe.get(t.tieuDe) || 0) + 1);
    trungMoTa.set(t.moTa, (trungMoTa.get(t.moTa) || 0) + 1);
  }

  const ketQua = trangs.map((t) => soatMotTrang(t, trungTieuDe, trungMoTa));
  const diem = ketQua.length
    ? Math.round(ketQua.reduce((s, t) => s + t.diem, 0) / ketQua.length)
    : 0;
  const soLoi = ketQua.reduce((s, t) => s + t.loi.length, 0);
  const soNhac = ketQua.reduce((s, t) => s + t.nhac.length, 0);

  return {
    ngay: ngayHomNay(),
    tenMien: cauHinh.tenMien,
    diem,
    soTrang: ketQua.length,
    soLoi,
    soNhac,
    trang: ketQua.sort((a, b) => a.diem - b.diem),
  };
}

/** Xuất báo cáo Markdown + JSON vào du-lieu/seo/. */
export function xuatBaoCao(bc) {
  const thuMuc = path.join(GOC, 'du-lieu', 'seo');
  const dong = [
    `# Báo cáo SEO — ${bc.tenMien}`,
    '',
    `Ngày soát: **${bc.ngay}** · Điểm trung bình: **${bc.diem}/100** · ${bc.soTrang} trang · ${bc.soLoi} lỗi · ${bc.soNhac} nhắc nhở`,
    '',
    '| Trang | Điểm | Từ | Lỗi | Nhắc |',
    '|---|---:|---:|---:|---:|',
    ...bc.trang.map((t) => `| \`${t.url}\` | ${t.diem} | ${t.soTu} | ${t.loi.length} | ${t.nhac.length} |`),
    '',
  ];
  for (const t of bc.trang) {
    if (!t.loi.length && !t.nhac.length) continue;
    dong.push(`## ${t.url} — ${t.diem}/100`, '');
    for (const v of t.loi) dong.push(`- ❌ **${v.thongDiep}** → ${v.cach}`);
    for (const v of t.nhac) dong.push(`- ⚠️ ${v.thongDiep} → ${v.cach}`);
    dong.push('');
  }
  ghiTep(path.join(thuMuc, `soat-${bc.ngay}.md`), `${dong.join('\n')}\n`);
  ghiTep(path.join(thuMuc, 'soat-moi-nhat.md'), `${dong.join('\n')}\n`);
  ghiJson(path.join(thuMuc, 'soat-moi-nhat.json'), bc);
  return path.join(thuMuc, 'soat-moi-nhat.md');
}
