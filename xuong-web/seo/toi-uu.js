// Tự sửa tiêu đề / mô tả yếu do bộ soát chỉ ra, ngay trong JSON nguồn.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { THU_MUC_NOI_DUNG, docCauHinh, docJson, ghiJson, dsJson, noi } from '../dung/tien-ich.js';
import { hoiJson } from './claude.js';

const MA_CAN_SUA = new Set(['tieu-de-do-dai', 'mo-ta-do-dai', 'mo-ta-thieu', 'tieu-de-trung', 'mo-ta-trung', 'tu-khoa-vang']);

/** url của trang → tệp JSON nguồn sinh ra nó. */
function timNguon(url) {
  const tepHtml = url === '/' ? 'index.html' : url.replace(/^\//, '').replace(/\/$/, '/index.html');
  for (const tep of dsJson(path.join(THU_MUC_NOI_DUNG, 'trang'))) {
    const dl = docJson(tep);
    const cua = dl.tep || `${dl.slug}.html`;
    if (cua === tepHtml) return { tep, dl, loai: 'trang' };
  }
  const khop = tepHtml.match(/^blog\/(.+)\.html$/);
  if (khop) {
    const tep = path.join(THU_MUC_NOI_DUNG, 'blog', `${khop[1]}.json`);
    if (existsSync(tep)) return { tep, dl: docJson(tep), loai: 'blog' };
  }
  return null;
}

/**
 * Với mỗi trang có lỗi meta, nhờ claude viết lại tiêu đề + mô tả và ghi vào JSON nguồn.
 * Trả danh sách thay đổi (chưa dựng lại — nơi gọi tự dựng).
 */
export async function toiUuMeta(baoCao, { toiDa = 5 } = {}) {
  const cauHinh = docCauHinh();
  const canSua = baoCao.trang
    .filter((t) => [...t.loi, ...t.nhac].some((v) => MA_CAN_SUA.has(v.ma)))
    .slice(0, toiDa);
  const thayDoi = [];

  for (const t of canSua) {
    const nguon = timNguon(t.url);
    if (!nguon) { noi(`  · bỏ qua ${t.url} (không tìm thấy JSON nguồn)`); continue; }
    const vanDe = [...t.loi, ...t.nhac].filter((v) => MA_CAN_SUA.has(v.ma)).map((v) => v.thongDiep);
    const tuKhoa = nguon.dl.tuKhoa || cauHinh.seo.tuKhoaGoc;
    const prompt = `Website của ${cauHinh.ten} — ${cauHinh.mucTieu}
Trang: ${t.url}
Tiêu đề hiện tại: "${nguon.dl.tieuDe || nguon.dl.tieuDeSeo || ''}"
Mô tả hiện tại: "${nguon.dl.moTa || ''}"
Từ khóa mục tiêu: ${tuKhoa.join(', ')}
Vấn đề cần sửa: ${vanDe.join('; ')}

Viết lại tiêu đề và mô tả bằng tiếng Việt tự nhiên, không nhồi từ khóa, đúng nội dung trang.
CHỈ trả về JSON: {"tieuDe": "≤ 65 ký tự", "moTa": "70–165 ký tự"}`;

    try {
      const moi = await hoiJson(prompt, { gioiHanGiay: 300 });
      if (!moi.tieuDe || !moi.moTa) continue;
      const truoc = { tieuDe: nguon.dl.tieuDe, moTa: nguon.dl.moTa };
      if (nguon.loai === 'blog') nguon.dl.tieuDeSeo = moi.tieuDe;
      else nguon.dl.tieuDe = moi.tieuDe;
      nguon.dl.moTa = moi.moTa;
      ghiJson(nguon.tep, nguon.dl);
      thayDoi.push({ url: t.url, tep: path.relative(THU_MUC_NOI_DUNG, nguon.tep), truoc, sau: moi });
    } catch (e) {
      noi(`  · ${t.url}: không sửa được — ${e.message}`);
    }
  }
  return thayDoi;
}
