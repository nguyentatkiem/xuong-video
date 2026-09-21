// Viết bài blog chuẩn SEO bằng claude → lưu JSON vào noi-dung/blog/ để bộ dựng render.
import path from 'node:path';
import { existsSync } from 'node:fs';
import {
  THU_MUC_NOI_DUNG, docCauHinh, ghiJson, taoSlug, ngayHomNay, demTu,
} from '../dung/tien-ich.js';
import { hoiJson } from './claude.js';
import { danhDauDaViet } from './tu-khoa.js';

const THE_CHO_PHEP = /^(p|h2|h3|ul|ol|li|strong|em|blockquote|a|table|thead|tbody|tr|th|td|figure|figcaption|img|br|hr|code|pre)$/i;

/** Lọc HTML do AI sinh: bỏ script/style/iframe, bỏ thuộc tính on*, chỉ giữ thẻ trong danh sách. */
export function locHtml(html = '') {
  return String(html)
    .replace(/<\/?(script|style|iframe|object|embed|form|input|button)[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\shref="javascript:[^"]*"/gi, ' href="#"')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (khop, the, thuocTinh) =>
      (THE_CHO_PHEP.test(the) ? khop.replace(/\sstyle="[^"]*"/gi, '') : ''))
    .trim();
}

function kiemTraBai(b, tuKhoa) {
  const loi = [];
  if (!b.tieuDe) loi.push('thiếu tiêu đề');
  if ((b.tieuDeSeo || b.tieuDe || '').length > 65) loi.push('tiêu đề SEO dài hơn 65 ký tự');
  if (!b.moTa || b.moTa.length < 70 || b.moTa.length > 165) loi.push('mô tả không nằm trong 70–165 ký tự');
  if (!/<h2[\s>]/i.test(b.html || '')) loi.push('thân bài không có h2');
  const tu = demTu(b.html || '');
  if (tu < 700) loi.push(`thân bài chỉ ${tu} từ (cần ≥ 700)`);
  if (tuKhoa && !`${b.tieuDe} ${b.moTa}`.toLowerCase().includes(String(tuKhoa).toLowerCase().split(' ')[0])) {
    loi.push('từ khóa chính không xuất hiện ở tiêu đề/mô tả');
  }
  return loi;
}

/**
 * Viết một bài từ cụm từ khóa. `cum` có thể là chuỗi hoặc mục trong kế hoạch từ khóa.
 * Bài không đạt kiểm tra → yêu cầu claude sửa lại 1 lần.
 */
export async function vietBai(cum, { chuyenMuc = 'Ứng dụng AI', ghiDe = false } = {}) {
  const cauHinh = docCauHinh();
  const tuKhoa = typeof cum === 'string' ? cum : cum.tuKhoa;
  const goiY = typeof cum === 'string' ? {} : cum;

  const prompt = `Bạn là biên tập viên nội dung của ${cauHinh.ten} — ${cauHinh.mucTieu}
Giọng văn: thẳng thắn, thực chiến, dành cho chủ doanh nghiệp Việt Nam, xưng "bạn", không sáo rỗng, không hứa hẹn thổi phồng, không bịa số liệu hay tên người thật.

Viết một bài blog tối ưu cho từ khóa chính: "${tuKhoa}".
${goiY.tieuDeGoiY ? `Gợi ý tiêu đề: ${goiY.tieuDeGoiY}` : ''}
${goiY.gocNhin ? `Góc tiếp cận: ${goiY.gocNhin}` : ''}
${goiY.dangBai ? `Dạng bài: ${goiY.dangBai}` : ''}

Yêu cầu:
- 900–1400 từ, có 4–6 thẻ <h2>, mỗi mục 2–4 đoạn ngắn.
- Mở bài nêu đúng nỗi đau của chủ doanh nghiệp trong 3 câu đầu, có chứa từ khóa chính.
- Có ít nhất một danh sách <ul> các bước làm được ngay và một ví dụ tình huống cụ thể.
- Chèn 1–2 liên kết nội bộ dạng <a href="/landing/solo-ai-ceo.html">…</a> hoặc <a href="/#khoa-hoc">…</a> một cách tự nhiên.
- Chỉ dùng các thẻ: p, h2, h3, ul, ol, li, strong, em, blockquote, a, table. KHÔNG dùng h1, script, style, thuộc tính style.
- Không nhắc tới việc bài do AI viết.

CHỈ trả về một JSON đúng mẫu:
{
  "tieuDe": "tiêu đề hiển thị",
  "tieuDeSeo": "tiêu đề thẻ <title> ≤ 65 ký tự",
  "moTa": "meta description 70–165 ký tự",
  "slug": "duong-dan-khong-dau",
  "tuKhoa": ["từ khóa chính", "từ khóa phụ"],
  "phutDoc": 7,
  "keuGoi": "một câu CTA cuối bài",
  "html": "<p>…</p><h2>…</h2>…"
}`;

  let bai = await hoiJson(prompt, { gioiHanGiay: 900 });
  let loi = kiemTraBai(bai, tuKhoa);
  if (loi.length) {
    bai = await hoiJson(`Bản nháp chưa đạt vì: ${loi.join('; ')}. Hãy viết lại cho đạt, giữ nguyên định dạng JSON đã yêu cầu.\n\n${prompt}`, { gioiHanGiay: 900 });
    loi = kiemTraBai(bai, tuKhoa);
  }

  const slug = taoSlug(bai.slug || bai.tieuDe);
  const tep = path.join(THU_MUC_NOI_DUNG, 'blog', `${slug}.json`);
  if (existsSync(tep) && !ghiDe) throw new Error(`Bài "${slug}" đã tồn tại — dùng --ghi-de để viết đè.`);

  const dl = {
    slug,
    tieuDe: bai.tieuDe,
    tieuDeSeo: bai.tieuDeSeo || bai.tieuDe,
    moTa: bai.moTa,
    tuKhoa: bai.tuKhoa || [tuKhoa],
    chuyenMuc: goiY.chuDe || chuyenMuc,
    tacGia: cauHinh.ten,
    ngay: ngayHomNay(),
    capNhat: ngayHomNay(),
    phutDoc: bai.phutDoc || Math.max(3, Math.round(demTu(bai.html) / 200)),
    keuGoi: bai.keuGoi,
    nguon: 'claude',
    html: locHtml(bai.html),
  };
  ghiJson(tep, dl);
  if (typeof cum !== 'string') danhDauDaViet(tuKhoa, slug);
  return { tep, slug, tieuDe: dl.tieuDe, soTu: demTu(dl.html), canhBao: loi };
}
