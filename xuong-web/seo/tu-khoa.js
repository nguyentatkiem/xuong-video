// Kế hoạch từ khóa do AI lập, lưu thành hàng đợi nội dung cho bộ viết bài.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { THU_MUC_NOI_DUNG, docCauHinh, docJson, ghiJson, taoSlug, ngayHomNay } from '../dung/tien-ich.js';
import { hoiJson } from './claude.js';

const TEP_KE_HOACH = path.join(THU_MUC_NOI_DUNG, 'seo', 'tu-khoa.json');

export function docKeHoach() {
  if (!existsSync(TEP_KE_HOACH)) return { capNhat: null, cum: [] };
  return docJson(TEP_KE_HOACH);
}

export function ghiKeHoach(kh) {
  ghiJson(TEP_KE_HOACH, kh);
  return TEP_KE_HOACH;
}

/** Từ khóa chưa viết bài, ưu tiên cao trước. */
export function tuKhoaChoViet(so = 1) {
  const kh = docKeHoach();
  return kh.cum
    .filter((c) => c.trangThai !== 'da-viet')
    .sort((a, b) => (b.uuTien || 0) - (a.uuTien || 0))
    .slice(0, so);
}

export function danhDauDaViet(tuKhoa, slug) {
  const kh = docKeHoach();
  const c = kh.cum.find((x) => x.tuKhoa === tuKhoa);
  if (c) { c.trangThai = 'da-viet'; c.slug = slug; c.ngayViet = ngayHomNay(); }
  ghiKeHoach(kh);
}

/** Nhờ claude lập kế hoạch từ khóa cho một chủ đề, gộp vào kế hoạch hiện có. */
export async function lapKeHoach(chuDe, { so = 10 } = {}) {
  const cauHinh = docCauHinh();
  const kh = docKeHoach();
  const daCo = kh.cum.map((c) => c.tuKhoa);
  const prompt = `Bạn là chuyên gia SEO tiếng Việt cho website của ${cauHinh.ten} — ${cauHinh.mucTieu}
Chủ đề cần khai thác: "${chuDe}".
Từ khóa đã có trong kế hoạch (KHÔNG lặp lại): ${daCo.length ? daCo.join(' | ') : '(chưa có)'}

Hãy đề xuất ${so} cụm từ khóa người Việt thực sự gõ trên Google, ưu tiên cụm dài (long-tail) có ý định rõ ràng và có thể dẫn tới đăng ký khóa học.

CHỈ trả về một JSON đúng mẫu:
{
  "cum": [
    {
      "tuKhoa": "cụm từ khóa",
      "yDinh": "thong-tin | so-sanh | giao-dich",
      "doKho": 1-5,
      "uuTien": 1-5,
      "dangBai": "huong-dan | danh-sach | case-study | giai-thich",
      "tieuDeGoiY": "tiêu đề bài viết ≤ 65 ký tự chứa từ khóa",
      "gocNhin": "một câu nêu góc tiếp cận riêng, tránh viết chung chung"
    }
  ]
}`;
  const dl = await hoiJson(prompt);
  const moi = (dl.cum || [])
    .filter((c) => c.tuKhoa && !daCo.includes(c.tuKhoa))
    .map((c) => ({ ...c, chuDe, slug: taoSlug(c.tieuDeGoiY || c.tuKhoa), trangThai: 'moi', ngayThem: ngayHomNay() }));
  kh.cum = [...kh.cum, ...moi];
  kh.capNhat = ngayHomNay();
  ghiKeHoach(kh);
  return { them: moi.length, tong: kh.cum.length, cum: moi };
}
