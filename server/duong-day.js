// Đường dây dựng video v2:
// thông tin → cắt im lặng → transcript → đạo diễn có mắt (claude) → render
// (camera ảo + ảnh + SFX + nhạc) → tự soát → xuất đa khung → xuất bản
import { spawn } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  phanTichImLang, tinhDoanGiu, xayDoLocPass1, chuoiMau,
  kichThuocKhung, taoAssPhuDe, taoAssDoHoa, taoSrt, tapTuNoiBat,
  edlDuPhong, trichJson, chuanHoaEdl, ghepMoTaSeo,
} from '../loi/core.js';
import {
  xayDoLocPass2V2, xayLocAmThanh, taoSuKienSfx, canhDuPhong, chuanHoaCanh,
  suKienChuongDong, suKienProgressBar, suKienCounter, suKienCta, CAC_DONG_TAC,
} from '../loi/dong-tac.js';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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
function chayLenh(lenh, args, { cwd, stdinText = null, gioiHanGiay = 1800, themPath = null } = {}) {
  return new Promise((resolve) => {
    const moiTruong = { ...process.env };
    delete moiTruong.CLAUDECODE;
    delete moiTruong.CLAUDE_CODE_ENTRYPOINT;
    if (themPath) moiTruong.PATH = `${themPath}:${moiTruong.PATH || ''}`;
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

/** Độ sáng trung bình (YAVG 0-255) của video — để chọn màu chữ không bị chìm. */
async function doDoSang(tep, cwd) {
  const kq = await chayLenh(FFMPEG, [
    '-hide_banner', '-i', tep, '-vf', 'fps=1/3,signalstats,metadata=print:key=lavfi.signalstats.YAVG',
    '-f', 'null', '-',
  ], { cwd });
  const cacGiaTri = [...(kq.err + kq.out).matchAll(/YAVG=([\d.]+)/g)].map((m) => parseFloat(m[1]));
  if (!cacGiaTri.length) return 110;
  return cacGiaTri.reduce((a, b) => a + b, 0) / cacGiaTri.length;
}

async function timWhisper() {
  for (const lenh of ['mlx_whisper', 'whisper']) {
    const kq = await chayLenh('sh', ['-c', `command -v ${lenh}`]);
    if (kq.ma === 0) return lenh;
  }
  return null;
}

function docTranscriptWhisper(j) {
  const doan = (j.segments || []).map((seg) => ({
    batDau: seg.start, ketThuc: seg.end, chu: String(seg.text || '').trim(),
    tu: Array.isArray(seg.words)
      ? seg.words.map((w) => ({ batDau: w.start, ketThuc: w.end, chu: String(w.word || '').trim() })).filter((w) => w.chu)
      : undefined,
  })).filter((d) => d.chu);
  return doan.length ? { doan } : null;
}

/** Áp các cặp sửa chữ (sai→đúng) vào transcript, giữ nguyên mốc thời gian. */
function apSuaChu(transcript, suaChu) {
  if (!transcript || !suaChu?.length) return transcript;
  const thay = (chu) => suaChu.reduce((s, sc) => s.split(sc.sai).join(sc.dung), chu);
  return {
    doan: transcript.doan.map((d) => ({
      ...d, chu: thay(d.chu),
      tu: d.tu ? d.tu.map((t) => ({ ...t, chu: thay(t.chu) })) : undefined,
    })),
  };
}

/** Đọc manifest thư viện media của kênh (media/manifest.json). */
async function docManifestAsync() {
  const tep = path.join(GOC, 'media', 'manifest.json');
  if (!existsSync(tep)) return [];
  try {
    const ds = JSON.parse(await readFile(tep, 'utf8'));
    return (Array.isArray(ds) ? ds : [])
      .filter((m) => m.tep && existsSync(path.join(GOC, 'media', m.tep)))
      .slice(0, 60);
  } catch { return []; }
}

/** Tải ảnh stock từ Pexels (nếu có key) — trả đường dẫn tệp cục bộ hoặc null. */
async function taiPexels(moTa, thuMuc, i) {
  const key = process.env.XUONG_PEXELS_KEY;
  if (!key) return null;
  try {
    const tim = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(moTa)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key }, signal: AbortSignal.timeout(15000) });
    const j = await tim.json();
    const url = j?.photos?.[0]?.src?.large2x;
    if (!url) return null;
    const anh = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const tepRa = path.join(thuMuc, `pexels-${i}.jpg`);
    await writeFile(tepRa, Buffer.from(await anh.arrayBuffer()));
    return { tep: tepRa, nguon: j.photos[0].url };
  } catch { return null; }
}

/** Trích khung hình mẫu để đạo diễn "nhìn" video. Trả danh sách đường dẫn tuyệt đối. */
async function trichKhungMau(tep, thuMuc, thoiLuong, tienTo = 'nhin') {
  const soKhung = Math.min(8, Math.max(3, Math.round(thoiLuong / 8)));
  const buoc = thoiLuong / (soKhung + 1);
  const cacTep = [];
  for (let i = 1; i <= soKhung; i++) {
    const ra = `${tienTo}-${String(i).padStart(2, '0')}.jpg`;
    const kq = await chayLenh(FFMPEG, [
      '-hide_banner', '-y', '-ss', (buoc * i).toFixed(2), '-i', tep,
      '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '5', ra,
    ], { cwd: thuMuc });
    if (kq.ma === 0) cacTep.push(path.join(thuMuc, ra));
  }
  return cacTep;
}

/** Gọi claude CLI. coMat=true cho phép claude Read các khung hình mẫu. */
async function goiClaude(prompt, { coMat = false, gioiHanGiay = 300 } = {}) {
  const args = ['-p'];
  if (coMat) args.push('--allowedTools', 'Read');
  if (process.env.XUONG_MODEL) args.push('--model', process.env.XUONG_MODEL);
  const kq = await chayLenh('claude', args, { stdinText: prompt, gioiHanGiay });
  if (kq.ma !== 0) throw new Error(`claude CLI lỗi (mã ${kq.ma}): ${(kq.err || kq.out).slice(-400)}`);
  return kq.out;
}

/** Đạo diễn v2: transcript + khung hình + manifest media → EDL đầy đủ. */
async function goiDaoDien({ transcript, style, thoiLuong, tuyChon, tenTep, khungMau, manifest }) {
  if (process.env.XUONG_BO_QUA_CLAUDE === '1') return null;

  const dongTacChoPhep = style.dongTacChoPhep?.length ? style.dongTacChoPhep : CAC_DONG_TAC;
  const phanTranscript = transcript
    ? 'Transcript (mốc giây theo video ĐÃ cắt im lặng):\n' + transcript.doan
        .map((d) => `[${d.batDau.toFixed(1)}–${d.ketThuc.toFixed(1)}s] ${d.chu}`)
        .join('\n').slice(0, 14000)
    : '(Không có transcript — chia cảnh theo nhịp đều, tu_khoa/chuong/sua_chu/so_dem để rỗng.)';

  const phanMat = khungMau.length
    ? `\nKHUNG HÌNH MẪU — hãy dùng công cụ Read xem các ảnh sau để biết cảnh nào là mặt người (nên punch-in), cảnh nào là màn hình/tài liệu (nên pan chậm), cảnh tối/sáng:\n${khungMau.map((k) => `- ${k}`).join('\n')}`
    : '';

  const phanMedia = manifest.length
    ? `\nTHƯ VIỆN MEDIA CỦA KÊNH (chỉ được dùng đúng các tệp này trong "anh"):\n${manifest.map((m) => `- ${m.tep}: ${m.moTa}`).join('\n')}`
    : '\n(Kênh chưa có thư viện media — "anh" để mảng rỗng.)';

  const prompt = `Bạn là đạo diễn dựng video chuyên nghiệp. Video dài ${thoiLuong.toFixed(1)} giây, tên tệp gốc "${tenTep}".
Style edit: ${style.ten} — ${style.moTa}
Tiêu đề người dùng đặt (có thể trống): "${tuyChon.tieuDe || ''}". Tên kênh: "${tuyChon.tenKenh || ''}".
${phanTranscript}${phanMat}${phanMedia}

Trả về DUY NHẤT một JSON theo mẫu:
{
  "tieu_de": ["3 phương án tiêu đề hấp dẫn tiếng Việt"],
  "mo_ta": "mô tả YouTube 3-5 câu kèm hashtag",
  "tags": ["10-15 tag"],
  "chuong": [{"giay": 0, "ten": "tên chương ngắn"}],
  "canh": [{"batDau": 0, "ketThuc": 4.2, "dongTac": "push-in", "cuongDo": 0.7}],
  "tu_khoa": [{"giay": 12.5, "chu": "TỪ KHOÁ <= 3 từ"}],
  "anh": [{"giay": 8, "tep": "ten-tep-trong-thu-vien.jpg", "kieu": "pop", "dai": 3.5}],
  "so_dem": [{"giay": 20, "tu": 0, "den": 347, "hau_to": "%"}],
  "sua_chu": [{"sai": "sường video", "dung": "Xưởng Video"}]
}
QUY TẮC:
- "canh" phải phủ kín [0, ${thoiLuong.toFixed(1)}] liên tục, mỗi cảnh 2–8 giây, ranh giới trùng ranh giới câu nói.
- dongTac chỉ được chọn từ: ${dongTacChoPhep.join(', ')}. Đổi động tác liên tục, tránh 2 cảnh liền nhau cùng động tác. punch-in cho câu quan trọng, push-in cho dẫn dắt, pan cho liệt kê, rung cho từ khoá mạnh, tinh để nghỉ mắt.
- "sua_chu": soát transcript tìm lỗi whisper nghe sai (tên riêng, thuật ngữ) và đưa cặp sửa.
- "so_dem" chỉ dùng khi trong lời nói có con số đáng nhấn mạnh (trả đúng số đó).
- Mật độ tu_khoa tối đa ~2 mỗi 10 giây. Mọi mốc giây trong [0, ${thoiLuong.toFixed(1)}].`;

  let ra = await goiClaude(prompt, { coMat: khungMau.length > 0 });
  let tho = trichJson(ra);
  if (!tho) { // một lần thử lại khi JSON hỏng
    ra = await goiClaude(`Câu trả lời trước không phải JSON hợp lệ. Chỉ trả về đúng một JSON theo mẫu đã yêu cầu.\n\n${prompt}`,
      { coMat: false });
    tho = trichJson(ra);
  }
  if (!tho) throw new Error('Không đọc được JSON từ câu trả lời của claude.');
  return tho;
}

/** Lượt tự soát: claude xem khung hình của bản dựng và đề nghị chỉnh. */
async function tuSoat({ thuMuc, thoiLuong }) {
  const khung = await trichKhungMau('ra.mp4', thuMuc, thoiLuong, 'soat');
  if (!khung.length) return null;
  const prompt = `Bạn là giám đốc sáng tạo đang duyệt bản dựng video. Hãy dùng công cụ Read xem các khung hình:
${khung.map((k) => `- ${k}`).join('\n')}

Chấm nhanh và trả về DUY NHẤT một JSON:
{"dat": true/false, "tat_tu_khoa": false, "giam_dong_tac": false, "ghi_chu": "1 câu nhận xét"}
- "tat_tu_khoa": true nếu chữ từ khoá che mặt người/đè lên chữ khác gây rối.
- "giam_dong_tac": true nếu hiệu ứng chuyển động dày tới mức khó chịu.
- Nếu ổn: dat=true và hai cờ kia false.`;
  try {
    const ra = await goiClaude(prompt, { coMat: true, gioiHanGiay: 240 });
    return trichJson(ra);
  } catch { return null; }
}

const SFX_CO_SAN = ['whoosh', 'pop', 'ding', 'tick', 'riser'];

/**
 * Render một khung hình (pass1 + pass2) — dùng lại cho khung chính và khung phụ.
 */
async function renderKhung({
  thuMuc, tepGoc, khung, doanGiu, style, edl, transcript, tuyChon, tenRa, nenSang,
}) {
  const kichThuoc = kichThuocKhung(khung);
  const doc = kichThuoc.cao > kichThuoc.rong;
  const hauTo = tenRa.replace('.mp4', '');

  // Lượt 1: cắt + khung + chuẩn tiếng
  const tepB1 = `buoc1-${hauTo}.mp4`;
  const p1 = xayDoLocPass1({ doanGiu, khung, loudnorm: style.loudnorm !== false });
  await ffmpeg([
    '-i', tepGoc, '-filter_complex', p1.filterComplex,
    '-map', p1.mapVideo, '-map', p1.mapAudio,
    '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k', tepB1,
  ], thuMuc);
  const sau = await doThongTin(tepB1, thuMuc);

  // Tệp chữ
  let tepPhuDe = null;
  if (CO_LIBASS && transcript && style.phuDe !== 'khong') {
    const tenAss = `phu-de-${hauTo}.ass`;
    await writeFile(path.join(thuMuc, tenAss), taoAssPhuDe(transcript, {
      ...kichThuoc, cheDo: style.phuDe, chuKieu: style.chuKieu || {},
      tuKhoaNoiBat: tapTuNoiBat(edl.tuKhoa), nenSang,
    }));
    tepPhuDe = tenAss;
  }
  const suKienThem = [];
  if (style.theChuong && edl.chuong.length) {
    suKienThem.push(...suKienChuongDong(edl.chuong, { ...kichThuoc, thoiLuong: sau.thoiLuong }));
  }
  if (style.progressBar !== false && sau.thoiLuong > 20) {
    suKienThem.push(...suKienProgressBar({ ...kichThuoc, thoiLuong: sau.thoiLuong }));
  }
  suKienThem.push(...suKienCounter(edl.soDem, { thoiLuong: sau.thoiLuong }));
  if (style.cta !== false) {
    suKienThem.push(...suKienCta(tuyChon.tenKenh, { thoiLuong: sau.thoiLuong }));
  }
  const tenDoHoa = `do-hoa-${hauTo}.ass`;
  await writeFile(path.join(thuMuc, tenDoHoa), taoAssDoHoa({
    ...kichThuoc, thoiLuong: sau.thoiLuong,
    tieuDe: style.chuTieuDe !== false ? (tuyChon.tieuDe || edl.tieuDe[0] || '') : '',
    tenKenh: style.watermark !== false ? (tuyChon.tenKenh || '') : '',
    tuKhoa: edl.tuKhoa,
    chuong: [], // chương dùng bản động trong suKienThem
    suKienThem,
  }));

  // Ảnh chèn: chỉ giữ ảnh có tệp tồn tại
  const anhHopLe = (edl.anh || []).filter((a) => existsSync(a.duongDan || ''));

  // Âm thanh: SFX + nhạc nền
  const suKienSfx = taoSuKienSfx(edl, { batSfx: style.sfx !== false });
  const tepNhac = style.nhacMood
    ? [`${style.nhacMood}.mp3`, `${style.nhacMood}.wav`, `${style.nhacMood}.m4a`]
        .map((t) => path.join(GOC, 'nhac', t)).find((t) => existsSync(t)) || null
    : null;

  const inputs = ['-i', tepB1];
  anhHopLe.forEach((a) => inputs.push('-i', a.duongDan));
  const viTriSfx = {};
  let viTri = 1 + anhHopLe.length;
  for (const ten of SFX_CO_SAN) {
    if (!suKienSfx.some((sk) => sk.sfx === ten)) continue;
    const tep = path.join(GOC, 'sfx', `${ten}.wav`);
    if (!existsSync(tep)) continue;
    inputs.push('-i', tep);
    viTriSfx[ten] = viTri++;
  }
  let viTriNhac = null;
  if (tepNhac) { inputs.push('-i', tepNhac); viTriNhac = viTri++; }

  const p2 = xayDoLocPass2V2({
    thoiLuong: sau.thoiLuong,
    canh: edl.canh,
    kichThuoc, mauSac: style.mauSac || 'khong', chuoiMauFn: chuoiMau,
    flashGiay: style.flash ? edl.chuong.map((c) => c.giay).filter((g) => g > 0.5) : [],
    anh: anhHopLe,
    tepPhuDe: CO_LIBASS ? tepPhuDe : null,
    tepDoHoa: CO_LIBASS ? tenDoHoa : null,
  });
  const amThanh = xayLocAmThanh({
    suKien: suKienSfx, viTriSfx, viTriNhac, thoiLuong: sau.thoiLuong,
  });

  const filterComplex = amThanh
    ? `${p2.filterComplex};${amThanh.filterAudio}`
    : p2.filterComplex;
  const args = [
    ...inputs, '-filter_complex', filterComplex,
    '-map', p2.mapVideo,
    ...(amThanh ? ['-map', amThanh.mapAudio, '-c:a', 'aac', '-b:a', '192k'] : ['-map', '0:a', '-c:a', 'copy']),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-movflags', '+faststart',
    tenRa,
  ];
  await ffmpeg(args, thuMuc);
  return { thoiLuong: sau.thoiLuong, kichThuoc, soSfx: suKienSfx.length, coNhac: Boolean(tepNhac) };
}

/**
 * Chạy trọn một việc dựng video.
 * viec = { id, thuMuc, tepGoc, style, tuyChon: {tieuDe, tenKenh, mucCat, xuatThem[]} }
 */
export async function chayViec(viec, ganBuoc) {
  const { thuMuc, tepGoc, style, tuyChon } = viec;
  const baoCao = { style: style.id };

  // ── 1. Thông tin ─────────────────────────────────────────────────────
  ganBuoc('thongtin', 'dang');
  const goc = await doThongTin(tepGoc, thuMuc);
  baoCao.thoiLuongGoc = goc.thoiLuong;
  ganBuoc('thongtin', 'xong', `${goc.rong}×${goc.cao}, ${goc.thoiLuong.toFixed(1)}s`);

  // ── 2. Dò khoảng lặng (tính doanGiu — dùng chung cho mọi khung) ─────
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
  // dựng nhanh bản đã-cắt tạm để whisper + đạo diễn làm việc trên timeline cuối
  const p1tam = xayDoLocPass1({ doanGiu, khung: style.khung, loudnorm: false });
  await ffmpeg([
    '-i', tepGoc, '-filter_complex', p1tam.filterComplex,
    '-map', p1tam.mapVideo, '-map', p1tam.mapAudio,
    '-r', '30', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26',
    '-c:a', 'aac', 'nhap.mp4',
  ], thuMuc);
  const sauCat = await doThongTin('nhap.mp4', thuMuc);
  baoCao.thoiLuongSauCat = sauCat.thoiLuong;
  baoCao.soDoanCat = mucCat ? Math.max(0, doanGiu.length - 1) : 0;
  baoCao.giayDaCat = tongCat;
  ganBuoc('catlang', 'xong', mucCat
    ? `Cắt ${tongCat.toFixed(1)}s im lặng (${baoCao.soDoanCat} chỗ), còn ${sauCat.thoiLuong.toFixed(1)}s`
    : 'Không cắt im lặng (theo tuỳ chọn/style)');

  // ── 3. Transcript ────────────────────────────────────────────────────
  ganBuoc('transcript', 'dang');
  let transcript = null;
  const lenhWhisper = await timWhisper();
  if (lenhWhisper && style.phuDe !== 'khong') {
    try {
      await ffmpeg(['-i', 'nhap.mp4', '-vn', '-ar', '16000', '-ac', '1', 'tieng.wav'], thuMuc);
      const ngonNgu = process.env.XUONG_NGON_NGU || 'vi';
      const model = process.env.XUONG_WHISPER_MODEL
        || (lenhWhisper === 'mlx_whisper' ? 'mlx-community/whisper-large-v3-turbo' : 'small');
      const args = lenhWhisper === 'mlx_whisper'
        ? ['tieng.wav', '--model', model, '--output-dir', '.', '--output-format', 'json', '--word-timestamps', 'True', '--language', ngonNgu]
        : ['tieng.wav', '--output_dir', '.', '--output_format', 'json', '--word_timestamps', 'True', '--language', ngonNgu, '--model', model];
      const kq = await chayLenh(lenhWhisper, args, {
        cwd: thuMuc, gioiHanGiay: 3600, themPath: path.dirname(FFMPEG),
      });
      if (kq.ma === 0 && existsSync(path.join(thuMuc, 'tieng.json'))) {
        transcript = docTranscriptWhisper(JSON.parse(await readFile(path.join(thuMuc, 'tieng.json'), 'utf8')));
      }
    } catch { /* thiếu transcript không chặn pipeline */ }
  }
  baoCao.coTranscript = Boolean(transcript);
  ganBuoc('transcript', transcript ? 'xong' : 'boqua', transcript
    ? `${transcript.doan.length} câu (${lenhWhisper})`
    : (style.phuDe === 'khong' ? 'Style này không dùng phụ đề'
      : 'Máy chưa cài whisper — bỏ qua phụ đề (cài: uv tool install mlx-whisper)'));

  // ── 4. Đạo diễn có mắt ──────────────────────────────────────────────
  ganBuoc('daodien', 'dang');
  const manifest = await docManifestAsync();
  const khungMau = process.env.XUONG_DAO_DIEN_MAT !== '0'
    ? await trichKhungMau('nhap.mp4', thuMuc, sauCat.thoiLuong) : [];
  const mocCau = transcript ? transcript.doan.map((d) => d.ketThuc) : [];
  const dongTacChoPhep = style.dongTacChoPhep?.length ? style.dongTacChoPhep : null;

  let edl;
  try {
    const tho = await goiDaoDien({
      transcript, style, thoiLuong: sauCat.thoiLuong, tuyChon,
      tenTep: viec.tenTepGoc || path.basename(tepGoc), khungMau, manifest,
    });
    if (tho) {
      const v1 = chuanHoaEdl(tho, sauCat.thoiLuong, style);
      const v2 = chuanHoaCanh(tho, sauCat.thoiLuong, { dongTacChoPhep });
      edl = {
        ...v1,
        canh: v2.canh || canhDuPhong(sauCat.thoiLuong, {
          matDo: style.zoom?.matDo || 'vua', dongTacChoPhep, moc: mocCau,
        }),
        anh: v2.anh, suaChu: v2.suaChu, soDem: v2.soDem,
      };
    } else {
      edl = {
        ...edlDuPhong(sauCat.thoiLuong, style, tuyChon),
        canh: canhDuPhong(sauCat.thoiLuong, { matDo: style.zoom?.matDo || 'vua', dongTacChoPhep, moc: mocCau }),
        anh: [], suaChu: [], soDem: [],
      };
    }
  } catch (e) {
    edl = {
      ...edlDuPhong(sauCat.thoiLuong, style, tuyChon),
      canh: canhDuPhong(sauCat.thoiLuong, { matDo: style.zoom?.matDo || 'vua', dongTacChoPhep, moc: mocCau }),
      anh: [], suaChu: [], soDem: [],
    };
    edl.loiClaude = String(e.message || e).slice(0, 300);
  }
  if (style.zoom?.batTat === false) {
    edl.canh = edl.canh.map((c) => ({ ...c, dongTac: 'tinh' }));
  }
  transcript = apSuaChu(transcript, edl.suaChu);

  // gán đường dẫn thật cho ảnh: thư viện kênh trước, Pexels sau (nếu có key)
  const anhThat = [];
  for (let i = 0; i < (edl.anh || []).length; i++) {
    const a = edl.anh[i];
    const trongKho = path.join(GOC, 'media', path.basename(a.tep));
    if (existsSync(trongKho)) { anhThat.push({ ...a, duongDan: trongKho }); continue; }
    if (a.tep.startsWith('pexels:')) {
      const px = await taiPexels(a.tep.slice(7), thuMuc, i);
      if (px) anhThat.push({ ...a, duongDan: px.tep, nguon: px.nguon });
    }
  }
  edl.anh = anhThat;

  const soDongTac = new Set(edl.canh.map((c) => c.dongTac)).size;
  baoCao.daoDien = edl.nguon;
  baoCao.soCanh = edl.canh.length;
  baoCao.soTuKhoa = edl.tuKhoa.length;
  baoCao.soAnh = edl.anh.length;
  ganBuoc('daodien', 'xong', edl.nguon === 'claude'
    ? `Claude${khungMau.length ? ' (đã xem ' + khungMau.length + ' khung hình)' : ''}: ${edl.canh.length} cảnh/${soDongTac} động tác, ${edl.tuKhoa.length} từ khoá, ${edl.chuong.length} chương, ${edl.anh.length} ảnh, ${edl.suaChu.length} sửa chữ`
    : `Nhịp dự phòng: ${edl.canh.length} cảnh/${soDongTac} động tác${edl.loiClaude ? ' — claude lỗi: ' + edl.loiClaude : ''}`);

  // ── 5. Render khung chính ───────────────────────────────────────────
  ganBuoc('render', 'dang');
  const nenSang = (await doDoSang('nhap.mp4', thuMuc)) > 170;
  const kq = await renderKhung({
    thuMuc, tepGoc, khung: style.khung, doanGiu, style, edl, transcript, tuyChon,
    tenRa: 'ra.mp4', nenSang,
  });
  baoCao.kichThuoc = kq.kichThuoc;
  baoCao.soSfx = kq.soSfx;
  baoCao.coNhac = kq.coNhac;
  baoCao.coLopChu = CO_LIBASS;
  ganBuoc('render', 'xong',
    `${kq.kichThuoc.rong}×${kq.kichThuoc.cao} · ${baoCao.soCanh} cảnh · ${kq.soSfx} SFX${kq.coNhac ? ' · nhạc nền' : ''}${CO_LIBASS ? '' : ' · KHÔNG lớp chữ (thiếu libass)'}`);

  // ── 6. Tự soát ──────────────────────────────────────────────────────
  ganBuoc('tusoat', 'dang');
  let ketSoat = null;
  if (process.env.XUONG_TU_SOAT !== '0' && edl.nguon === 'claude' && process.env.XUONG_BO_QUA_CLAUDE !== '1') {
    ketSoat = await tuSoat({ thuMuc, thoiLuong: kq.thoiLuong });
    if (ketSoat && ketSoat.dat === false && (ketSoat.tat_tu_khoa || ketSoat.giam_dong_tac)) {
      if (ketSoat.tat_tu_khoa) edl.tuKhoa = [];
      if (ketSoat.giam_dong_tac) {
        edl.canh = edl.canh.map((c, i) => (i % 2 ? { ...c, dongTac: 'tinh' } : c));
      }
      await renderKhung({
        thuMuc, tepGoc, khung: style.khung, doanGiu, style, edl, transcript, tuyChon,
        tenRa: 'ra.mp4', nenSang,
      });
      ganBuoc('tusoat', 'xong', `Đạo diễn yêu cầu sửa và đã render lại — ${ketSoat.ghi_chu || ''}`);
    } else {
      ganBuoc('tusoat', 'xong', ketSoat?.ghi_chu ? `Đạt — ${ketSoat.ghi_chu}` : 'Đạt');
    }
  } else {
    ganBuoc('tusoat', 'boqua', 'Tắt (XUONG_TU_SOAT=0 hoặc không dùng claude)');
  }
  baoCao.tuSoat = ketSoat;

  // ── 7. Xuất thêm khung ──────────────────────────────────────────────
  ganBuoc('khungthem', 'dang');
  const TEN_KHUNG = { ngang: 'ra-ngang.mp4', 'doc-crop': 'ra-doc.mp4', 'doc-blur': 'ra-doc.mp4', vuong: 'ra-vuong.mp4' };
  const themKhung = (tuyChon.xuatThem || []).filter((k) => TEN_KHUNG[k] && k !== style.khung);
  baoCao.khungThem = [];
  for (const k of themKhung) {
    try {
      await renderKhung({
        thuMuc, tepGoc, khung: k, doanGiu, style, edl, transcript, tuyChon,
        tenRa: TEN_KHUNG[k], nenSang,
      });
      baoCao.khungThem.push(TEN_KHUNG[k]);
    } catch { /* khung phụ lỗi không phá việc chính */ }
  }
  ganBuoc('khungthem', themKhung.length ? 'xong' : 'boqua',
    themKhung.length ? `Đã xuất thêm: ${baoCao.khungThem.join(', ')}` : 'Không yêu cầu');

  // ── 8. Xuất bản ─────────────────────────────────────────────────────
  ganBuoc('xuatban', 'dang');
  if (transcript) await writeFile(path.join(thuMuc, 'phu-de.srt'), taoSrt(transcript));
  let seo = ghepMoTaSeo(edl, tuyChon);
  const nguonAnh = edl.anh.filter((a) => a.nguon).map((a) => a.nguon);
  if (nguonAnh.length) seo += `\n\n## Nguồn ảnh stock\n${nguonAnh.join('\n')}`;
  await writeFile(path.join(thuMuc, 'mo-ta-seo.md'), seo);
  await writeFile(path.join(thuMuc, 'bao-cao.json'), JSON.stringify({
    ...baoCao, tieuDe: tuyChon.tieuDe, luc: new Date().toISOString(),
  }, null, 2));
  ganBuoc('xuatban', 'xong', 'Đã tạo mô tả SEO' + (transcript ? ' + phụ đề SRT' : ''));

  return baoCao;
}
