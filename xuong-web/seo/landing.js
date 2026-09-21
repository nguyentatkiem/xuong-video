// Tạo landing page mới: từ mẫu sẵn có, hoặc nhờ claude viết nội dung theo brief.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { THU_MUC_NOI_DUNG, docCauHinh, docJson, ghiJson, taoSlug } from '../dung/tien-ich.js';
import { hoiJson } from './claude.js';
import { cacLoaiKhoi } from '../dung/khoi.js';

const TEP_MAU = path.join(THU_MUC_NOI_DUNG, 'mau', 'landing-mau.json');

/** Chỉ giữ khối có loại hợp lệ để bộ dựng không vỡ. */
function locKhoi(ds = []) {
  return ds.filter((k) => k && cacLoaiKhoi.includes(k.loai));
}

/** Tạo landing từ mẫu, thay các chỗ {{ten}} bằng giá trị trong `thay`. */
export function tuMau(slug, thay = {}) {
  const mau = JSON.stringify(docJson(TEP_MAU));
  const dl = JSON.parse(mau.replace(/\{\{(\w+)\}\}/g, (k, ten) => thay[ten] ?? k));
  dl.slug = slug;
  dl.tep = `landing/${slug}.html`;
  return dl;
}

/**
 * Landing page theo brief. Có claude → AI viết nội dung từng khối;
 * không có claude → trả về bản từ mẫu để sửa tay.
 */
export async function taoLanding(brief, { slug, ghiDe = false, dungAi = true } = {}) {
  const cauHinh = docCauHinh();
  const duongDan = taoSlug(slug || brief);
  const tep = path.join(THU_MUC_NOI_DUNG, 'trang', `landing-${duongDan}.json`);
  if (existsSync(tep) && !ghiDe) throw new Error(`Landing "${duongDan}" đã có — dùng --ghi-de để viết đè.`);

  if (!dungAi) {
    const dl = tuMau(duongDan, { ten: brief, tieuDe: brief });
    ghiJson(tep, dl);
    return { tep, slug: duongDan, nguon: 'mau' };
  }

  const mau = existsSync(TEP_MAU) ? docJson(TEP_MAU) : null;
  const prompt = `Bạn là copywriter trang bán hàng của ${cauHinh.ten} — ${cauHinh.mucTieu}
Giọng: thẳng, thực chiến, hướng tới chủ doanh nghiệp Việt Nam. Không bịa con số, không hứa hẹn kết quả tuyệt đối, không đặt tên người thật cho lời chứng thực (ghi rõ là ví dụ minh họa nếu cần).

Viết nội dung landing page cho: "${brief}".

Trả về JSON đúng cấu trúc dưới đây; giữ nguyên tên trường, chỉ thay nội dung tiếng Việt:
${JSON.stringify(mau || {}, null, 1).slice(0, 4000)}

Ràng buộc:
- "tieuDe" của trang ≤ 65 ký tự, "moTa" 70–165 ký tự, "tuKhoa" 3–6 cụm.
- Chỉ dùng các "loai" khối sau: ${cacLoaiKhoi.join(', ')}.
- Giữ nguyên mọi đường dẫn ảnh ("anh") có trong mẫu.
- Mọi nút bấm trỏ tới "#form-tu-van" trừ khi mẫu ghi khác.
CHỈ trả về JSON.`;

  const dl = await hoiJson(prompt, { gioiHanGiay: 900 });
  const trang = {
    slug: duongDan,
    tep: `landing/${duongDan}.html`,
    tieuDe: dl.tieuDe || brief,
    moTa: dl.moTa || '',
    tuKhoa: dl.tuKhoa || [],
    uuTien: '0.9',
    nguon: 'claude',
    khoi: locKhoi(dl.khoi),
  };
  if (!trang.khoi.length) throw new Error('claude không trả về khối nội dung hợp lệ.');
  ghiJson(tep, trang);
  return { tep, slug: duongDan, nguon: 'claude', soKhoi: trang.khoi.length };
}
