// Server web Xưởng Video: upload → hàng đợi → pipeline → trả kết quả
import express from 'express';
import multer from 'multer';
import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chayViec, chonFfmpeg } from './duong-day.js';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const THU_MUC_DU_LIEU = path.join(GOC, 'du-lieu', 'viec');
const PORT = Number(process.env.PORT || 5675);
mkdirSync(THU_MUC_DU_LIEU, { recursive: true });

// ── Nạp style ───────────────────────────────────────────────────────────
const STYLES = readdirSync(path.join(GOC, 'styles'))
  .filter((t) => t.endsWith('.json'))
  .map((t) => JSON.parse(readFileSync(path.join(GOC, 'styles', t), 'utf8')))
  .sort((a, b) => (a.thuTu || 99) - (b.thuTu || 99));
const timStyle = (id) => STYLES.find((s) => s.id === id);

// ── Danh sách bước hiển thị cho UI ─────────────────────────────────────
const CAC_BUOC = [
  { id: 'thongtin', ten: 'Đọc thông tin video' },
  { id: 'catlang', ten: 'Cắt khoảng lặng + đổi khung + chuẩn âm lượng' },
  { id: 'transcript', ten: 'Bóc transcript (whisper)' },
  { id: 'daodien', ten: 'Đạo diễn AI chọn nhịp edit (claude)' },
  { id: 'render', ten: 'Render hiệu ứng + chữ' },
  { id: 'xuatban', ten: 'Xuất gói SEO + phụ đề' },
];

// ── Hàng đợi: mỗi lúc chỉ chạy 1 việc (ffmpeg + claude đều nặng) ───────
const cacViec = new Map();
const hangDoi = [];
let dangChay = false;

async function bomHangDoi() {
  if (dangChay) return;
  const viec = hangDoi.shift();
  if (!viec) return;
  dangChay = true;
  viec.trangThai = 'dang-chay';
  try {
    viec.baoCao = await chayViec(viec, (idBuoc, trangThai, chiTiet) => {
      const b = viec.buoc.find((x) => x.id === idBuoc);
      if (b) { b.trangThai = trangThai; if (chiTiet) b.chiTiet = chiTiet; }
    });
    viec.trangThai = 'xong';
  } catch (e) {
    viec.trangThai = 'loi';
    viec.loi = String(e.message || e);
    const dang = viec.buoc.find((b) => b.trangThai === 'dang');
    if (dang) dang.trangThai = 'loi';
  } finally {
    dangChay = false;
    setImmediate(bomHangDoi);
  }
}

// ── Upload ─────────────────────────────────────────────────────────────
const luuTru = multer.diskStorage({
  destination(req, file, cb) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    req.idViec = id;
    const thuMuc = path.join(THU_MUC_DU_LIEU, id);
    mkdirSync(thuMuc, { recursive: true });
    cb(null, thuMuc);
  },
  filename(req, file, cb) {
    const duoi = (path.extname(file.originalname) || '.mp4').toLowerCase();
    cb(null, 'goc' + duoi);
  },
});
const upload = multer({
  storage: luuTru,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(file.originalname);
    cb(ok ? null : new Error('Chỉ nhận tệp video: mp4, mov, mkv, webm, m4v, avi'), ok);
  },
});

const app = express();
app.use(express.static(path.join(GOC, 'web')));

app.get('/api/styles', (req, res) => res.json(STYLES));

app.post('/api/viec', upload.single('video'), (req, res) => {
  const style = timStyle(req.body.style);
  if (!req.file) return res.status(400).json({ loi: 'Thiếu tệp video.' });
  if (!style) return res.status(400).json({ loi: 'Style không tồn tại.' });

  const viec = {
    id: req.idViec,
    thuMuc: path.dirname(req.file.path),
    tepGoc: path.basename(req.file.path),
    tenTepGoc: req.file.originalname,
    style,
    tuyChon: {
      tieuDe: (req.body.tieuDe || '').trim().slice(0, 120),
      tenKenh: (req.body.tenKenh || '').trim().slice(0, 60),
      mucCat: ['tat', 'nhe', 'vua', 'manh'].includes(req.body.mucCat) ? req.body.mucCat : 'vua',
    },
    trangThai: 'cho',
    buoc: CAC_BUOC.map((b) => ({ ...b, trangThai: 'cho', chiTiet: '' })),
    baoCao: null,
    loi: null,
  };
  cacViec.set(viec.id, viec);
  hangDoi.push(viec);
  bomHangDoi();
  res.json({ id: viec.id });
});

app.get('/api/viec/:id', (req, res) => {
  const viec = cacViec.get(req.params.id);
  if (!viec) return res.status(404).json({ loi: 'Không tìm thấy việc.' });
  res.json({
    id: viec.id, trangThai: viec.trangThai, buoc: viec.buoc,
    baoCao: viec.baoCao, loi: viec.loi, style: viec.style.id,
    viTriHang: viec.trangThai === 'cho' ? hangDoi.indexOf(viec) + 1 : 0,
  });
});

app.get('/api/viec/:id/video', (req, res) => {
  const tep = path.join(THU_MUC_DU_LIEU, path.basename(req.params.id), 'ra.mp4');
  if (!existsSync(tep)) return res.status(404).json({ loi: 'Chưa có video đầu ra.' });
  res.sendFile(tep);
});

const TEP_CHO_TAI = new Set(['mo-ta-seo.md', 'phu-de.srt', 'bao-cao.json']);
app.get('/api/viec/:id/tep/:ten', (req, res) => {
  if (!TEP_CHO_TAI.has(req.params.ten)) return res.status(403).json({ loi: 'Tệp không cho tải.' });
  const tep = path.join(THU_MUC_DU_LIEU, path.basename(req.params.id), req.params.ten);
  if (!existsSync(tep)) return res.status(404).json({ loi: 'Chưa có tệp này.' });
  res.sendFile(tep);
});

app.use((err, req, res, next) => {
  res.status(400).json({ loi: String(err.message || err) });
});

const ff = await chonFfmpeg();
app.listen(PORT, () => {
  console.log(`🎬 Xưởng Video chạy tại http://localhost:${PORT} — ${STYLES.length} style sẵn sàng`);
  console.log(ff.coLibass
    ? `   ffmpeg: ${ff.binary} (có libass — đủ hiệu ứng chữ)`
    : `   ⚠️ ffmpeg: ${ff.binary} KHÔNG có libass — video sẽ thiếu lớp chữ. Cài: brew install ffmpeg-full`);
});
