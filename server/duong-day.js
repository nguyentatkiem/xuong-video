// Đường dây dựng video: thông tin → cắt im lặng → transcript → đạo diễn (claude) → render → xuất bản
import { spawn } from 'node:child_process';
import { writeFile, readFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  phanTichImLang, tinhDoanGiu, xayDoLocPass1, xayDoLocPass2,
  chiaDoanZoom, kichThuocKhung, taoAssPhuDe, taoAssDoHoa, taoSrt,
  edlDuPhong, trichJson, chuanHoaEdl, ghepMoTaSeo,
} from '../loi/core.js';

const MUC_CAT = {
  nhe: { noise: '-42dB', d: 1.2, dem: 0.35, imToiThieu: 0.6 },
  vua: { noise: '-38dB', d: 0.7, dem: 0.25, imToiThieu: 0.45 },
  manh: { noise: '-33dB', d: 0.45, dem: 0.15, imToiThieu: 0.35 },
};

// ── Chọn binary ffmpeg: ưu tiên bản có libass (vẽ chữ/phụ đề) ─────────
const UNG_VIEN_FFMPEG = [
  process.env.XUONG_FFMPEG,
  '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',
  '/usr/local/opt/ffmpeg-full/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean);

let FFMPEG = 'ffmpeg';
let FFPROBE = 'ffprobe';
let CO_LIBASS = false;

/** Gọi một lần lúc server khởi động. Trả về {binary, coLibass}. */
export async function chonFfmpeg() {
  for (const uv of UNG_VIEN_FFMPEG) {
    const kq = await chayLenh(uv, ['-hide_banner', '-filters'], { gioiHanGiay: 15 });
    if (kq.ma !== 0) continue;
    const coAss = /\bass\b/.test(kq.out);
    if (coAss || FFMPEG === 'ffmpeg') {
      FFMPEG = uv;
      FFPROBE = uv === 'ffmpeg' ? 'ffprobe' : path.join(path.dirname(uv), 'ffprobe');
      CO_LIBASS = coAss;
    }
    if (coAss) break;
  }
  return { binary: FFMPEG, coLibass: CO_LIBASS };
}

/** Chạy một tiến trình, trả {ma, out, err}. KHÔNG ném lỗi — nơi gọi tự quyết. */
function chayLenh(lenh, args, { cwd, stdinText = null, gioiHanGiay = 1800 } = {}) {
  return new Promise((resolve) => {
    const moiTruong = { ...process.env };
    delete moiTruong.CLAUDECODE;
    delete moiTruong.CLAUDE_CODE_ENTRYPOINT;
    const tt = spawn(lenh, args, { cwd, env: moiTruong });
    let out = '', err = '';
    const henGio = setTimeout(() => tt.kill('SIGKILL'), gioiHanGiay * 1000);
    tt.stdout.on('data', (d) => { out += d; });
    tt.stderr.on('data', (d) => { err += d; if (err.length > 400_000) err = err.slice(-200_000); });
    tt.on('error', (e) => { clearTimeout(henGio); resolve({ ma: -1, out, err: String(e) }); });
    tt.on('close', (ma) => { clearTimeout(henGio); resolve({ ma, out, err }); });
    if (stdinText !== null) tt.stdin.write(stdinText);
    tt.stdin.end();
  });
}

async function ffmpeg(args, cwd) {
  const kq = await chayLenh(FFMPEG, ['-hide_banner', '-y', ...args], { cwd });
  if (kq.ma !== 0) throw new Error(`ffmpeg lỗi (mã ${kq.ma}):\n${kq.err.slice(-1500)}`);
  return kq;
}

async function doThongTin(tep, cwd) {
  const kq = await chayLenh(FFPROBE, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', tep,
  ], { cwd });
  if (kq.ma !== 0) throw new Error(`ffprobe lỗi: ${kq.err.slice(-500)}`);
  const j = JSON.parse(kq.out);
  const video = (j.streams || []).find((s) => s.codec_type === 'video');
  const audio = (j.streams || []).find((s) => s.codec_type === 'audio');
  if (!video) throw new Error('Tệp không có luồng hình.');
  if (!audio) throw new Error('Tệp không có luồng tiếng — pipeline hiện cần video có âm thanh.');
  return {
    thoiLuong: parseFloat(j.format?.duration || video.duration || 0),
    rong: video.width, cao: video.height,
  };
}

/** Tìm CLI whisper khả dụng trên máy (nếu có) để bóc transcript. */
async function timWhisper() {
  for (const lenh of ['mlx_whisper', 'whisper']) {
    const kq = await chayLenh('sh', ['-c', `command -v ${lenh}`]);
    if (kq.ma === 0) return lenh;
  }
  return null;
}

/** Đọc JSON whisper (openai-whisper / mlx_whisper cùng dạng segments+words). */
function docTranscriptWhisper(j) {
  const doan = (j.segments || []).map((seg) => ({
    batDau: seg.start, ketThuc: seg.end, chu: String(seg.text || '').trim(),
    tu: Array.isArray(seg.words)
      ? seg.words.map((w) => ({ batDau: w.start, ketThuc: w.end, chu: String(w.word || '').trim() })).filter((w) => w.chu)
      : undefined,
  })).filter((d) => d.chu);
  return doan.length ? { doan } : null;
}

/** Gọi claude CLI làm "đạo diễn": nhận transcript + style → EDL + gói SEO. */
async function goiDaoDien({ transcript, style, thoiLuong, tuyChon, tenTep }) {
  if (process.env.XUONG_BO_QUA_CLAUDE === '1') return null;

  const phanTranscript = transcript
    ? 'Transcript (mốc giây theo video ĐÃ cắt im lặng):\n' + transcript.doan
        .map((d) => `[${d.batDau.toFixed(1)}s] ${d.chu}`)
        .join('\n').slice(0, 14000)
    : '(Không có transcript — chỉ cần trả tiêu đề/mô tả/tags dựa trên bối cảnh, và chọn nhịp zoom đều hợp lý.)';

  const prompt = `Bạn là đạo diễn dựng video. Video dài ${thoiLuong.toFixed(1)} giây, tên tệp gốc "${tenTep}".
Style edit: ${style.ten} — ${style.moTa}
Tiêu đề người dùng đặt (có thể trống): "${tuyChon.tieuDe || ''}". Tên kênh: "${tuyChon.tenKenh || ''}".
${phanTranscript}

Trả về DUY NHẤT một JSON (không thêm chữ nào ngoài JSON) theo mẫu:
{
  "tieu_de": ["3 phương án tiêu đề hấp dẫn, tiếng Việt"],
  "mo_ta": "mô tả YouTube 3-5 câu kèm 3-5 hashtag",
  "tags": ["10-15 tag"],
  "chuong": [{"giay": 0, "ten": "tên chương ngắn"}],
  "zoom_giay": [các mốc giây nên zoom nhấn mạnh, cách nhau >= 3 giây],
  "tu_khoa": [{"giay": 12.5, "chu": "TỪ KHOÁ <= 3 từ"}]
}
Quy tắc: mốc thời gian phải nằm trong [0, ${thoiLuong.toFixed(1)}]. Nếu không có transcript thì "tu_khoa" và "chuong" để mảng rỗng, "zoom_giay" rải đều mỗi ${style.zoom?.matDo === 'day' ? 5 : 9} giây. Mật độ tu_khoa tối đa ~2 từ khoá/10 giây.`;

  const args = ['-p'];
  if (process.env.XUONG_MODEL) args.push('--model', process.env.XUONG_MODEL);
  const kq = await chayLenh('claude', args, { stdinText: prompt, gioiHanGiay: 240 });
  if (kq.ma !== 0) throw new Error(`claude CLI lỗi (mã ${kq.ma}): ${(kq.err || kq.out).slice(-400)}`);
  const tho = trichJson(kq.out);
  if (!tho) throw new Error('Không đọc được JSON từ câu trả lời của claude.');
  return tho;
}

/**
 * Chạy trọn một việc dựng video.
 * viec = { id, thuMuc, tepGoc, style, tuyChon: {tieuDe, tenKenh, mucCat} }
 * ganBuoc(id_buoc, trangThai, chiTiet) — cập nhật tiến độ cho UI.
 */
export async function chayViec(viec, ganBuoc) {
  const { thuMuc, tepGoc, style, tuyChon } = viec;
  const kichThuoc = kichThuocKhung(style.khung);
  const baoCao = { style: style.id, kichThuoc };

  // ── Bước 1: thông tin video ───────────────────────────────────────────
  ganBuoc('thongtin', 'dang');
  const goc = await doThongTin(tepGoc, thuMuc);
  baoCao.thoiLuongGoc = goc.thoiLuong;
  ganBuoc('thongtin', 'xong', `${goc.rong}×${goc.cao}, ${goc.thoiLuong.toFixed(1)}s`);

  // ── Bước 2: cắt khoảng lặng + đổi khung + chuẩn âm lượng ─────────────
  ganBuoc('catlang', 'dang');
  const mucCat = tuyChon.mucCat && tuyChon.mucCat !== 'tat' && style.catImLang !== false
    ? MUC_CAT[tuyChon.mucCat] || MUC_CAT.vua : null;

  let doanGiu = [{ batDau: 0, ketThuc: goc.thoiLuong }];
  let tongCat = 0;
  if (mucCat) {
    const kq = await chayLenh(FFMPEG, [
      '-hide_banner', '-i', tepGoc,
      '-af', `silencedetect=noise=${mucCat.noise}:d=${mucCat.d}`, '-f', 'null', '-',
    ], { cwd: thuMuc });
    const imLang = phanTichImLang(kq.err, goc.thoiLuong);
    ({ doanGiu, tongCat } = tinhDoanGiu(imLang, goc.thoiLuong, mucCat));
  }
  const p1 = xayDoLocPass1({ doanGiu, khung: style.khung, loudnorm: style.loudnorm !== false });
  await ffmpeg([
    '-i', tepGoc, '-filter_complex', p1.filterComplex,
    '-map', p1.mapVideo, '-map', p1.mapAudio,
    '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k', 'buoc1.mp4',
  ], thuMuc);
  const sauCat = await doThongTin('buoc1.mp4', thuMuc);
  baoCao.thoiLuongSauCat = sauCat.thoiLuong;
  baoCao.soDoanCat = mucCat ? Math.max(0, doanGiu.length - 1) : 0;
  baoCao.giayDaCat = tongCat;
  ganBuoc('catlang', 'xong', mucCat
    ? `Cắt ${tongCat.toFixed(1)}s im lặng (${baoCao.soDoanCat} chỗ), còn ${sauCat.thoiLuong.toFixed(1)}s`
    : 'Style/tuỳ chọn tắt cắt im lặng — chỉ đổi khung + chuẩn âm lượng');

  // ── Bước 3: transcript (nếu máy có whisper) ──────────────────────────
  ganBuoc('transcript', 'dang');
  let transcript = null;
  const lenhWhisper = await timWhisper();
  if (lenhWhisper && style.phuDe !== 'khong') {
    try {
      await ffmpeg(['-i', 'buoc1.mp4', '-vn', '-ar', '16000', '-ac', '1', 'tieng.wav'], thuMuc);
      const args = lenhWhisper === 'mlx_whisper'
        ? ['tieng.wav', '--output-dir', '.', '--output-format', 'json', '--word-timestamps', 'True', '--language', 'vi']
        : ['tieng.wav', '--output_dir', '.', '--output_format', 'json', '--word_timestamps', 'True', '--language', 'vi', '--model', 'small'];
      const kq = await chayLenh(lenhWhisper, args, { cwd: thuMuc, gioiHanGiay: 3600 });
      if (kq.ma === 0 && existsSync(path.join(thuMuc, 'tieng.json'))) {
        transcript = docTranscriptWhisper(JSON.parse(await readFile(path.join(thuMuc, 'tieng.json'), 'utf8')));
      }
    } catch { /* thiếu transcript không chặn pipeline */ }
  }
  baoCao.coTranscript = Boolean(transcript);
  ganBuoc('transcript', transcript ? 'xong' : 'boqua', transcript
    ? `${transcript.doan.length} câu (${lenhWhisper})`
    : (style.phuDe === 'khong' ? 'Style này không dùng phụ đề'
      : 'Máy chưa cài whisper — bỏ qua phụ đề (cài: pip install mlx-whisper)'));

  // ── Bước 4: đạo diễn (claude CLI) ────────────────────────────────────
  ganBuoc('daodien', 'dang');
  let edl;
  try {
    const tho = await goiDaoDien({
      transcript, style, thoiLuong: sauCat.thoiLuong, tuyChon, tenTep: path.basename(tepGoc),
    });
    edl = tho ? chuanHoaEdl(tho, sauCat.thoiLuong, style)
              : edlDuPhong(sauCat.thoiLuong, style, tuyChon);
  } catch (e) {
    edl = edlDuPhong(sauCat.thoiLuong, style, tuyChon);
    edl.loiClaude = String(e.message || e).slice(0, 300);
  }
  baoCao.daoDien = edl.nguon;
  baoCao.soZoom = edl.zoomGiay.length;
  baoCao.soTuKhoa = edl.tuKhoa.length;
  ganBuoc('daodien', 'xong', edl.nguon === 'claude'
    ? `Claude chọn ${edl.zoomGiay.length} điểm zoom, ${edl.tuKhoa.length} từ khoá, ${edl.chuong.length} chương`
    : `Dùng nhịp dự phòng (${edl.zoomGiay.length} điểm zoom)${edl.loiClaude ? ' — claude lỗi: ' + edl.loiClaude : ''}`);

  // ── Bước 5: render hiệu ứng + chữ ────────────────────────────────────
  ganBuoc('render', 'dang');
  let tepPhuDe = null;
  if (transcript && style.phuDe !== 'khong') {
    await writeFile(path.join(thuMuc, 'phu-de.ass'),
      taoAssPhuDe(transcript, { ...kichThuoc, cheDo: style.phuDe }));
    tepPhuDe = 'phu-de.ass';
  }
  const doHoa = taoAssDoHoa({
    ...kichThuoc, thoiLuong: sauCat.thoiLuong,
    tieuDe: style.chuTieuDe !== false ? (tuyChon.tieuDe || edl.tieuDe[0] || '') : '',
    tenKenh: style.watermark !== false ? (tuyChon.tenKenh || '') : '',
    tuKhoa: edl.tuKhoa,
    chuong: style.theChuong ? edl.chuong : [],
  });
  await writeFile(path.join(thuMuc, 'do-hoa.ass'), doHoa);

  const doanZoom = chiaDoanZoom(sauCat.thoiLuong, edl.zoomGiay);
  const p2 = xayDoLocPass2({
    thoiLuong: sauCat.thoiLuong, doanZoom,
    tiLeZoom: style.zoom?.tiLe || 1.12, kichThuoc,
    mauSac: style.mauSac || 'khong',
    tepPhuDe: CO_LIBASS ? tepPhuDe : null,
    tepDoHoa: CO_LIBASS ? 'do-hoa.ass' : null,
  });
  await ffmpeg([
    '-i', 'buoc1.mp4', '-filter_complex', p2.filterComplex,
    '-map', p2.mapVideo, '-map', '0:a', '-c:a', 'copy',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-movflags', '+faststart',
    'ra.mp4',
  ], thuMuc);
  baoCao.coLopChu = CO_LIBASS;
  ganBuoc('render', 'xong', CO_LIBASS
    ? `Video ${kichThuoc.rong}×${kichThuoc.cao} đã render`
    : `Video ${kichThuoc.rong}×${kichThuoc.cao} đã render — KHÔNG có lớp chữ (ffmpeg thiếu libass, cài: brew install ffmpeg-full)`);

  // ── Bước 6: xuất bản gói kèm ─────────────────────────────────────────
  ganBuoc('xuatban', 'dang');
  if (transcript) await writeFile(path.join(thuMuc, 'phu-de.srt'), taoSrt(transcript));
  await writeFile(path.join(thuMuc, 'mo-ta-seo.md'), ghepMoTaSeo(edl, tuyChon));
  await writeFile(path.join(thuMuc, 'bao-cao.json'), JSON.stringify(baoCao, null, 2));
  ganBuoc('xuatban', 'xong', 'Đã tạo mô tả SEO' + (transcript ? ' + phụ đề SRT' : ''));

  return baoCao;
}
