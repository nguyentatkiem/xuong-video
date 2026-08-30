#!/usr/bin/env node
// CLI dựng hàng loạt không cần mở web:
//   node scripts/dung.js video.mp4 --style podcast-hormozi --tieu-de "..." --ten-kenh "@kenh"
//   node scripts/dung.js thu-muc-video/ --style storytime --muc-cat manh
import { readdirSync, readFileSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chayViec, chonFfmpeg } from '../server/duong-day.js';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const layCo = (ten, macDinh = '') => {
  const i = args.indexOf('--' + ten);
  return i >= 0 && args[i + 1] ? args[i + 1] : macDinh;
};

const duongNguon = args[0] && !args[0].startsWith('--') ? args[0] : null;
if (!duongNguon) {
  console.error('Cách dùng: node scripts/dung.js <video|thư mục> --style <id> [--tieu-de ...] [--ten-kenh ...] [--muc-cat vua] [--xuat-them ngang,vuong]');
  process.exit(1);
}

const idStyle = layCo('style', 'podcast-hormozi');
const style = JSON.parse(readFileSync(path.join(GOC, 'styles', idStyle + '.json'), 'utf8'));

const cacTep = statSync(duongNguon).isDirectory()
  ? readdirSync(duongNguon).filter((t) => /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(t)).map((t) => path.join(duongNguon, t))
  : [duongNguon];

await chonFfmpeg();
console.log(`🎬 Dựng ${cacTep.length} video với style "${style.ten}"`);

for (const tep of cacTep) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const thuMuc = path.join(GOC, 'du-lieu', 'viec', id);
  mkdirSync(thuMuc, { recursive: true });
  const tepGoc = 'goc' + path.extname(tep).toLowerCase();
  copyFileSync(tep, path.join(thuMuc, tepGoc));

  console.log(`\n▶ ${path.basename(tep)} → du-lieu/viec/${id}/`);
  try {
    await chayViec({
      id, thuMuc, tepGoc, tenTepGoc: path.basename(tep), style,
      tuyChon: {
        tieuDe: layCo('tieu-de'), tenKenh: layCo('ten-kenh'),
        mucCat: layCo('muc-cat', style.mucCatMacDinh || 'vua'),
        xuatThem: layCo('xuat-them').split(',').map((s) => s.trim()).filter(Boolean),
      },
    }, (buoc, trangThai, chiTiet) => {
      if (trangThai === 'xong' || trangThai === 'boqua') console.log(`  ${trangThai === 'xong' ? '✅' : '⏭️'} ${buoc}${chiTiet ? ' — ' + chiTiet : ''}`);
    });
    console.log(`  🎉 Xong: du-lieu/viec/${id}/ra.mp4`);
  } catch (e) {
    console.error(`  ❌ Lỗi: ${e.message}`);
  }
}
