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
  lamSachTranscript, nguongImLang, chonKhungXuat, vungNoiTuImLang,
  tinhKhoangTrong, gopTranscript, locKhucBu,
  chuanHoaRamp, taoAnhXaThoiGian, doiThoiGianTranscript,
} from '../loi/core.js';
import {
  xayDoLocPass2V2, xayLocAmThanh, taoSuKienSfx, canhDuPhong, chuanHoaCanh,
  suKienChuongDong, suKienProgressBar, suKienCounter, suKienCta, CAC_DONG_TAC,
} from '../loi/dong-tac.js';
import {
  DS_MODULE, KHONG_GIAN, KHUNG_THE, TI_LE_NET, tenKhongGian,
  taoCaption, tinhDoanKhung, khungTheDuPhong, chuanHoaDoHoa,
  timLoiBoCuc, goPhanTuLoi, suKienSfxV3, timPhach, nepTheoPhach, chuanHoaMotion,
} from '../loi/storyboard.js';
import { coRemotion, renderMotion } from './remotion.js';
import { coChromium, doDacOverlay, chupOverlay, chupCanvas, chupMask, luuTrangOverlay } from './chromium.js';

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
  // video điện thoại hay lưu ngang + cờ xoay 90° — phải xét cờ mới biết hướng thật
  const xoay = Math.abs((video.side_data_list || []).find((sd) => sd.rotation !== undefined)?.rotation || 0);
  const [rongHien, caoHien] = xoay % 180 === 90 ? [video.height, video.width] : [video.width, video.height];
  return {
    thoiLuong: parseFloat(j.format?.duration || video.duration || 0),
    rong: rongHien, cao: caoHien, doc: caoHien > rongHien,
  };
}

/** Âm lượng trung bình (dB) — nền cho ngưỡng cắt im lặng thích ứng. */
async function doAmLuong(tep, cwd) {
  const kq = await chayLenh(FFMPEG, ['-hide_banner', '-i', tep, '-af', 'volumedetect', '-f', 'null', '-'], { cwd });
  const m = (kq.err + kq.out).match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
  return m ? parseFloat(m[1]) : -30;
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

/** Loudness 2-pass: đo thật rồi trả chuỗi thông số cho lượt chuẩn hoá tuyến tính. */
async function doLoudnorm2Pass(tep, cwd) {
  const kq = await chayLenh(FFMPEG, [
    '-hide_banner', '-i', tep,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-',
  ], { cwd });
  const j = trichJson(kq.err.slice(kq.err.lastIndexOf('{')));
  if (!j?.input_i) return null;
  return `measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}`;
}

/** Bóc biên độ sóng âm ~30 mẫu/giây (cho module waveform + dò phách). */
async function docSongAm(tepWav, cwd) {
  const kq = await new Promise((resolve) => {
    const tt = spawn(FFMPEG, ['-hide_banner', '-i', tepWav, '-ac', '1', '-ar', '3000', '-f', 's16le', '-'], { cwd });
    const phan = [];
    tt.stdout.on('data', (d) => phan.push(d));
    tt.on('close', () => resolve(Buffer.concat(phan)));
    tt.on('error', () => resolve(Buffer.alloc(0)));
  });
  const buoc = 100; // 3000Hz / 100 mẫu = 30 giá trị/giây
  const song = [];
  for (let i = 0; i + buoc * 2 <= kq.length; i += buoc * 2) {
    let dinh = 0;
    for (let j = 0; j < buoc; j++) dinh = Math.max(dinh, Math.abs(kq.readInt16LE(i + j * 2)));
    song.push(Math.round((dinh / 32768) * 1000) / 1000);
  }
  return { song, hz: 30 };
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

/** Mô tả thư viện module + khung thẻ cho prompt đạo diễn (chế độ đồ hoạ HTML). */
function taPhanDoHoa(style, khongGian) {
  const kg = KHONG_GIAN[khongGian];
  const bang = KHUNG_THE[khongGian];
  const choPhep = style.moduleChoPhep?.length ? style.moduleChoPhep : DS_MODULE;
  const CHO_TRONG = {
    doc: { full: 'nổi trên video', hero: 'y 680–1000', 'hero-low': 'y 24–320', tall: 'y 24–140', 'tall-low': 'y 24–290', mid: 'y 24–420 và 910–1000', 'mini-left': 'y 24–550', 'mini-center': 'y 24–550', 'mini-right': 'y 24–550' },
    ngang: { full: 'nổi trên video', 'hero-left': 'x 660–1232 (y 40–540)', 'hero-right': 'x 48–620 (y 40–540)', mid: 'hai cột x 24–420 và 860–1256' },
    vuong: { full: 'nổi trên video', hero: 'y 480–640' },
  }[khongGian];
  const dsPreset = (style.vongKhung?.length ? style.vongKhung : Object.keys(bang))
    .filter((p) => bang[p]).map((p) => `${p} (chỗ trống ${CHO_TRONG[p] || '?'})`).join(', ');

  return `
ĐỒ HOẠ HTML — toạ độ trong không gian ${kg.rong}×${kg.cao}, x là số px hoặc "center":
Module được dùng: ${choPhep.join(', ')}.
Tham số nhanh: tag{text ≤4 từ} · chips/qchips{items ≤4, mỗi mục ≤3 từ} · iconrow{items từ bộ: doc img vid chart clock bolt user shop link check folder phone laptop spark gear} · rows{items ≤5 [{text,icon}], active: chỉ số dòng vàng; cao = n×70−8px} · pill{text,sub} · flow{items ≤3} · bigtype{kicker,big,sub có |vàng|; cao ~200px} · lockup{l1,l2,l3 — dùng đúng 1 lần; cao ~220px} · steps{items ≤4; cao ~85px} · chart{kicker,label; cao ~180px} · gridfill{kicker,unit,total,count; cao ~205px} · myth{text ≤8 từ, strike_at = đúng giây phủ định; dùng ≤1 lần} · cta{text,sub — cuối video} · note{text có |vàng|} · counter{kicker,tu,den,hauTo} · lower3{text,sub} · waveform{h≈120 — sóng âm nhảy theo tiếng} · sticker{kieu: mui-ten|confetti|lap-lanh, co≈160 — dùng khi ăn mừng/chỉ trỏ} · databar{duLieu:[{ten,giaTri}] ≤5, hauTo — CHỈ khi lời nói nêu số liệu so sánh thật; cao ≈ n×30px} · datapie{giaTri 0-100, ten — một tỉ lệ phần trăm được nói ra}
Mọi module có thể thêm "vao3d": true (lật 3D nhẹ khi hiện) — dùng tiết chế, hợp intro/CTA.
Khung thẻ video (framing): ${dsPreset}. Đổi khung 5–8s một lần, tại điểm chuyển ý. pan_y 0.30–0.55 (mặc định 0.42, giảm nếu cắt mất trán).
QUY TẮC VÀNG: mỗi ý nói ra có đúng MỘT phần tử đồ hoạ hiện đúng giây đó (sai số <0.3s); không nghĩ ra khối phù hợp thì ĐỂ TRỐNG — vài giây chỉ có mặt người và phụ đề là nhịp nghỉ tốt. Luôn đặt "out" (cụm sống 6–12s). "stagger" = đúng nhịp liệt kê trong lời nói. CẤM đặt đồ hoạ vào dải phụ đề y ${kg.capDai[0]}–${kg.capDai[1]} và đè lên thẻ video đang hiện.
Trả THÊM hai trường trong JSON:
"framing": [{"t": 0, "preset": "hero", "pan_y": 0.42}],
"do_hoa": [{"module": "rows", "t": 12.0, "out": 20.0, "x": ${kg.le}, "y": 700, "w": ${kg.rongNoiDung}, "stagger": 1.0, "items": [{"text": "…", "icon": "doc"}]}]`;
}

/** Đạo diễn v2/v3: transcript + khung hình + manifest media → EDL đầy đủ. */
async function goiDaoDien({ transcript, style, thoiLuong, tuyChon, tenTep, khungMau, manifest, cheDoHtml = false, khongGian = 'doc', coMotion = false }) {
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

  const phanDoHoa = cheDoHtml ? taPhanDoHoa(style, khongGian) : '';
  const phanMotion = coMotion ? `
MÀN MOTION CAO CẤP (Remotion) — mỗi màn PHỦ TOÀN KHUNG trên nền mờ, dùng cho khoảnh khắc đắt nhất, tối đa 3 màn, trả trong trường "motion":
- intro {duLieu:{tieuDe, kenh}} — mở màn thương hiệu, t=0, ~3s
- scorecard {duLieu:{tieuChi:[{ten, diem 0-10}] ≤5, tong}} — CHỈ khi lời nói chấm điểm/đánh giá thật, ~5s
- sosanh {duLieu:{traiTen, phaiTen, hang:[{ten, trai, phai}] ≤5}} — CHỈ khi so sánh 2 thứ có thông số thật, ~5s
- outro {duLieu:{loiKeu, kenh}} — kêu gọi cuối video, t = cuối − 3.5s
Ví dụ: "motion": [{"loai":"intro","t":0,"giay":3,"duLieu":{"tieuDe":"...","kenh":"..."}}]
Trong lúc màn motion chiếu, ĐỪNG đặt module do_hoa trùng thời gian.` : '';
  const prompt = `Bạn là đạo diễn dựng video chuyên nghiệp. Video dài ${thoiLuong.toFixed(1)} giây, tên tệp gốc "${tenTep}".
Style edit: ${style.ten} — ${style.moTa}
Tiêu đề người dùng đặt (có thể trống): "${tuyChon.tieuDe || ''}". Tên kênh: "${tuyChon.tenKenh || ''}".
${phanTranscript}${phanMat}${phanMedia}${phanDoHoa}${phanMotion}

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
  "sua_chu": [{"sai": "sường video", "dung": "Xưởng Video"}]${style.speedRamp === true ? `,
  "ramp": [{"batDau": 10.0, "ketThuc": 14.0, "tocDo": 1.35}]` : ''}
}${style.speedRamp === true ? `
- "ramp": đổi tốc độ đoạn — 1.2–1.5 tua nhanh đoạn dẫn dắt/lặp ý, 0.6–0.8 cho khoảnh khắc đắt (thêm "cham": true nếu muốn slow-mo mượt). Mỗi đoạn ≥2s, tối đa 4 đoạn, KHÔNG ramp đoạn đang nói ý quan trọng.` : ''}
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
 * Render chế độ ĐỒ HOẠ HTML: video lồng thẻ bo góc trên canvas (hoặc toàn khung
 * có camera ảo) + lớp module/phụ đề chụp qua Chromium + tiêu đề/watermark ASS + SFX.
 */
async function renderKhungHtml({
  thuMuc, tepGoc, khung, doanGiu, style, edl, transcript, tuyChon, tenRa, ganChiTiet,
}) {
  const khongGian = tenKhongGian(khung);
  const kg = KHONG_GIAN[khongGian];
  const kichThuoc = { rong: Math.round(kg.rong * TI_LE_NET), cao: Math.round(kg.cao * TI_LE_NET) };
  const hauTo = tenRa.replace('.mp4', '');
  const dungThe = style.khungThe && edl.doanKhung.some((f) => f.preset !== 'full');

  // ── Video nền ────────────────────────────────────────────────────────
  let tepNen; // video-only hoặc kèm tiếng
  let tepTieng; // nguồn âm thanh giọng nói
  if (dungThe) {
    // lượt 1 giữ khung gốc + chuẩn tiếng
    const tepB1 = `buoc1-${hauTo}.mp4`;
    const p1 = xayDoLocPass1({ doanGiu, khung: 'goc', loudnorm: style.loudnorm !== false, ramp: edl.rampDoan, loudnormThongSo: edl.loudnormThongSo });
    await ffmpeg(['-i', tepGoc, '-filter_complex', p1.filterComplex,
      '-map', p1.mapVideo, '-map', p1.mapAudio, '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', tepB1], thuMuc);
    tepTieng = tepB1;

    // canvas nền + mặt nạ bo góc theo từng hình khối thẻ
    await chupCanvas({ skin: style.skin || {}, khongGian, thuMuc, ten: `canvas-${hauTo}.png` });
    const mau = chuoiMau(style.mauSac || 'khong');
    // kích thước điểm ảnh phải CHẴN: crop yuv420 tự hạ chiều lẻ xuống 1px làm lệch với mặt nạ
    const chan = (v) => 2 * Math.round((v * TI_LE_NET) / 2);
    const dsMask = new Map();
    for (const f of edl.doanKhung) {
      const [, , w, h, r] = f.the;
      const khoa = `${w}x${h}r${r}`;
      if (!dsMask.has(khoa)) {
        const ten = `mask-${hauTo}-${dsMask.size}.png`;
        await chupMask({
          rongThe: chan(w), caoThe: chan(h), boGoc: Math.round(r * TI_LE_NET), thuMuc, ten,
        });
        dsMask.set(khoa, ten);
      }
    }
    // dựng từng đoạn thẻ rồi nối
    const dsSeg = [];
    for (let k = 0; k < edl.doanKhung.length; k++) {
      const f = edl.doanKhung[k];
      const [x, y, w, h, r] = f.the;
      const W2 = chan(w), H2 = chan(h);
      const sw = 2 * Math.round((W2 * f.zoom) / 2), sh = 2 * Math.round((H2 * f.zoom) / 2);
      const dai = f.ketThuc - f.batDau;
      const tenSeg = `seg-${hauTo}-${k}.mp4`;
      const locVideo = [
        `scale=${sw}:${sh}:force_original_aspect_ratio=increase`,
        `crop=${W2}:${H2}:x=(iw-${W2})/2:y=(ih-${H2})*${f.panY.toFixed(2)}`,
        ...(mau ? [mau] : []), 'setsar=1',
      ].join(',');
      await ffmpeg([
        '-loop', '1', '-i', `canvas-${hauTo}.png`,
        '-ss', String(f.batDau.toFixed(3)), '-t', String(dai.toFixed(3)), '-i', tepB1,
        '-loop', '1', '-i', dsMask.get(`${w}x${h}r${r}`),
        '-filter_complex',
        `[1:v]${locVideo}[cv];[2:v]format=gray[mk];[cv][mk]alphamerge[cm];` +
        `[0:v][cm]overlay=${Math.round(x * TI_LE_NET)}:${Math.round(y * TI_LE_NET)},format=yuv420p[v]`,
        '-map', '[v]', '-t', String(dai.toFixed(3)), '-r', '30', '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', tenSeg,
      ], thuMuc);
      dsSeg.push(tenSeg);
      if (ganChiTiet && k % 3 === 2) ganChiTiet(`Dựng thẻ video ${k + 1}/${edl.doanKhung.length}…`);
    }
    // chuyển cảnh xfade GIỮ NGUYÊN thời lượng: đóng băng khung cuối cảnh trước,
    // quét (wipe/fade) sang 0.45s đầu của cảnh sau — tiếng không bị đụng
    let danhSachNoi = [...dsSeg];
    if (style.chuyenCanh?.length && dsSeg.length > 1) {
      danhSachNoi = [dsSeg[0]];
      for (let k = 1; k < dsSeg.length; k++) {
        const daiSeg = edl.doanKhung[k].ketThuc - edl.doanKhung[k].batDau;
        if (daiSeg < 1.2) { danhSachNoi.push(dsSeg[k]); continue; }
        const kieu = style.chuyenCanh[(k - 1) % style.chuyenCanh.length];
        const dong = `dong-${hauTo}-${k}.png`;
        await ffmpeg(['-sseof', '-0.05', '-i', dsSeg[k - 1], '-frames:v', '1', dong], thuMuc);
        const trans = `trans-${hauTo}-${k}.mp4`;
        await ffmpeg([
          '-loop', '1', '-t', '0.45', '-i', dong, '-i', dsSeg[k],
          '-filter_complex',
          `[0:v]scale=${kichThuoc.rong}:${kichThuoc.cao},setsar=1,fps=30[a];` +
          `[1:v]trim=0:0.45,setpts=PTS-STARTPTS,fps=30[b];` +
          `[a][b]xfade=transition=${kieu}:duration=0.45:offset=0,format=yuv420p[v]`,
          '-map', '[v]', '-r', '30', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', trans,
        ], thuMuc);
        const cut = `segc-${hauTo}-${k}.mp4`;
        await ffmpeg(['-ss', '0.45', '-i', dsSeg[k], '-an',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', cut], thuMuc);
        danhSachNoi.push(trans, cut);
      }
    }
    await writeFile(path.join(thuMuc, `noi-${hauTo}.txt`), danhSachNoi.map((s) => `file '${s}'`).join('\n'));
    tepNen = `nen-${hauTo}.mp4`;
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', `noi-${hauTo}.txt`, '-c', 'copy', tepNen], thuMuc);
  } else {
    // toàn khung: dùng đường camera ảo hiện có làm nền (không chữ, không trộn tiếng)
    const tepB1 = `buoc1-${hauTo}.mp4`;
    const p1 = xayDoLocPass1({ doanGiu, khung, loudnorm: style.loudnorm !== false, ramp: edl.rampDoan, loudnormThongSo: edl.loudnormThongSo });
    await ffmpeg(['-i', tepGoc, '-filter_complex', p1.filterComplex,
      '-map', p1.mapVideo, '-map', p1.mapAudio, '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', tepB1], thuMuc);
    tepTieng = tepB1;
    const thoiLuongNen = (await doThongTin(tepB1, thuMuc)).thoiLuong;
    const p2 = xayDoLocPass2V2({
      thoiLuong: thoiLuongNen, canh: edl.canh, kichThuoc,
      mauSac: style.mauSac || 'khong', chuoiMauFn: chuoiMau,
      flashGiay: [], anh: [], tepPhuDe: null, tepDoHoa: null, fade: false,
    });
    tepNen = `nen-${hauTo}.mp4`;
    await ffmpeg(['-i', tepB1, '-filter_complex', p2.filterComplex,
      '-map', p2.mapVideo, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', tepNen], thuMuc);
  }
  const sau = await doThongTin(tepTieng, thuMuc);

  // ── Lớp đồ hoạ + phụ đề HTML ────────────────────────────────────────
  if (ganChiTiet) ganChiTiet(`Chụp lớp đồ hoạ qua Chromium (~${Math.round(sau.thoiLuong * 30)} khung)…`);
  const storyboard = {
    els: edl.els, caps: edl.caps, dur: sau.thoiLuong,
    song: edl.song, hzSong: edl.hzSong, phach: edl.phach,
  };
  await luuTrangOverlay({ storyboard, skin: style.skin || {}, khongGian, thuMuc });
  const overlay = await chupOverlay({ storyboard, skin: style.skin || {}, khongGian, thuMuc });

  // tiêu đề + watermark vẫn đi lớp ASS (đã canh theo độ phân giải thật)
  let tepAss = null;
  if (CO_LIBASS) {
    tepAss = `do-hoa-${hauTo}.ass`;
    const coManIntro = (edl.motion || []).some((m) => m.loai === 'intro');
    await writeFile(path.join(thuMuc, tepAss), taoAssDoHoa({
      ...kichThuoc, thoiLuong: sau.thoiLuong,
      tieuDe: style.chuTieuDe !== false && !coManIntro ? (tuyChon.tieuDe || edl.tieuDe[0] || '') : '',
      tenKenh: style.watermark !== false ? (tuyChon.tenKenh || '') : '',
      tuKhoa: [], chuong: [], suKienThem: [],
    }));
  }

  // ── Âm thanh + ghép cuối ────────────────────────────────────────────
  const suKienSfx = style.sfx !== false ? suKienSfxV3({ doanKhung: dungThe ? edl.doanKhung : [], els: edl.els }) : [];
  const dsMotion = edl.motion || [];
  if (style.sfx !== false && dsMotion.length) {
    for (const m of dsMotion) suKienSfx.push({ giay: m.t, sfx: m.loai === 'intro' ? 'riser' : 'ding' });
    suKienSfx.sort((a, b) => a.giay - b.giay);
  }
  const tepNhac = style.nhacMood
    ? [`${style.nhacMood}.mp3`, `${style.nhacMood}.wav`, `${style.nhacMood}.m4a`]
        .map((t) => path.join(GOC, 'nhac', t)).find((t) => existsSync(t)) || null
    : null;
  const inputs = ['-i', tepNen];
  inputs.push('-framerate', '30', '-i', path.join('overlay-frames', '%05d.png'));
  inputs.push('-i', tepTieng);
  const viTriSfx = {};
  let viTri = 3;
  for (const ten of SFX_CO_SAN) {
    if (!suKienSfx.some((sk) => sk.sfx === ten)) continue;
    const tep = path.join(GOC, 'sfx', `${ten}.wav`);
    if (!existsSync(tep)) continue;
    inputs.push('-i', tep);
    viTriSfx[ten] = viTri++;
  }
  let viTriNhac = null;
  if (tepNhac) { inputs.push('-i', tepNhac); viTriNhac = viTri++; }

  // màn motion Remotion: render webm alpha rồi thêm làm input phủ lên trên
  const viTriMotion = [];
  for (let i = 0; i < dsMotion.length; i++) {
    const m = dsMotion[i];
    const tepMo = path.join(thuMuc, `motion-${hauTo}-${i}.webm`);
    try {
      if (ganChiTiet) ganChiTiet(`Render màn motion "${m.loai}" (Remotion)…`);
      await renderMotion({
        loai: m.loai, duLieu: m.duLieu, skin: style.skin || {},
        kichThuoc, giay: m.giay, tepRa: tepMo,
      });
      inputs.push('-c:v', 'libvpx', '-i', tepMo);
      viTriMotion.push({ idx: viTri++, m });
    } catch { /* màn motion lỗi thì bỏ qua, không phá video */ }
  }

  const amThanh = xayLocAmThanh({
    suKien: suKienSfx, viTriSfx, viTriNhac, thoiLuong: sau.thoiLuong, nhanGiong: '2:a',
  });
  const chuoiCuoi = [
    ...(tepAss ? [`ass=${tepAss}`] : []),
    'fade=t=in:d=0.4', `fade=t=out:st=${Math.max(0, sau.thoiLuong - 0.45).toFixed(3)}:d=0.45`,
  ].join(',');
  const phanV = ['[0:v][1:v]overlay=0:0:shortest=1[vo0]'];
  let nhanV = '[vo0]';
  viTriMotion.forEach(({ idx, m }, i) => {
    // đệm khúc đầu bằng khung trong suốt để màn motion vào đúng mốc t
    phanV.push(`[${idx}:v]format=yuva420p,tpad=start_duration=${m.t.toFixed(3)}:start_mode=add:color=black@0.0[mo${i}]`);
    phanV.push(`${nhanV}[mo${i}]overlay=0:0:eof_action=pass:repeatlast=0[vo${i + 1}]`);
    nhanV = `[vo${i + 1}]`;
  });
  phanV.push(`${nhanV}${chuoiCuoi}[vout]`);
  const filter = phanV.join(';') + (amThanh ? `;${amThanh.filterAudio}` : '');
  await ffmpeg([
    ...inputs, '-filter_complex', filter,
    '-map', '[vout]',
    ...(amThanh ? ['-map', amThanh.mapAudio] : ['-map', '2:a']),
    '-c:a', 'aac', '-b:a', '192k',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-movflags', '+faststart',
    tenRa,
  ], thuMuc);
  return {
    thoiLuong: sau.thoiLuong, kichThuoc, soSfx: suKienSfx.length,
    coNhac: Boolean(tepNhac), soFrameOverlay: overlay?.soFrame || 0,
  };
}

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
  const p1 = xayDoLocPass1({ doanGiu, khung, loudnorm: style.loudnorm !== false, ramp: edl.rampDoan, loudnormThongSo: edl.loudnormThongSo });
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

  // ── 1. Thông tin + chọn khung xuất ──────────────────────────────────
  ganBuoc('thongtin', 'dang');
  const goc = await doThongTin(tepGoc, thuMuc);
  baoCao.thoiLuongGoc = goc.thoiLuong;
  const khungChinh = chonKhungXuat(style, goc.doc, tuyChon.khungXuat || 'auto');
  baoCao.khung = khungChinh;
  ganBuoc('thongtin', 'xong', `${goc.rong}×${goc.cao}${goc.doc ? ' (dọc)' : ''}, ${goc.thoiLuong.toFixed(1)}s`
    + (khungChinh !== style.khung ? ` → giữ khung ${khungChinh} thay vì ${style.khung} của style` : ''));

  // ── 2. Dò khoảng lặng — ngưỡng thích ứng theo âm lượng video ────────
  ganBuoc('catlang', 'dang');
  const mucCat = tuyChon.mucCat && tuyChon.mucCat !== 'tat' && style.catImLang !== false
    ? MUC_CAT[tuyChon.mucCat] || MUC_CAT.vua : null;
  let doanGiu = [{ batDau: 0, ketThuc: goc.thoiLuong }];
  let tongCat = 0;
  let nguong = null;
  if (mucCat) {
    const amLuong = await doAmLuong(tepGoc, thuMuc);
    nguong = nguongImLang(amLuong, tuyChon.mucCat);
    const kq = await chayLenh(FFMPEG, [
      '-hide_banner', '-i', tepGoc,
      '-af', `silencedetect=noise=${nguong}:d=${mucCat.d}`, '-f', 'null', '-',
    ], { cwd: thuMuc });
    const imLang = phanTichImLang(kq.err, goc.thoiLuong);
    ({ doanGiu, tongCat } = tinhDoanGiu(imLang, goc.thoiLuong, mucCat));
  }
  // dựng nhanh bản đã-cắt tạm để whisper + đạo diễn làm việc trên timeline cuối
  const p1tam = xayDoLocPass1({ doanGiu, khung: khungChinh, loudnorm: false });
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
    ? `Cắt ${tongCat.toFixed(1)}s im lặng (${baoCao.soDoanCat} chỗ, ngưỡng ${nguong}), còn ${sauCat.thoiLuong.toFixed(1)}s`
    : 'Không cắt im lặng (theo tuỳ chọn/style)');

  // ── 3. Transcript (bóc cả tệp + bóc bù các khoảng whisper nuốt) ─────
  ganBuoc('transcript', 'dang');
  let transcript = null;
  let soKhucBu = 0;
  const lenhWhisper = await timWhisper();
  const bocWav = async (tepWav, tenGoc) => {
    const ngonNgu = process.env.XUONG_NGON_NGU || 'vi';
    const model = process.env.XUONG_WHISPER_MODEL
      || (lenhWhisper === 'mlx_whisper' ? 'mlx-community/whisper-large-v3-turbo' : 'small');
    const args = lenhWhisper === 'mlx_whisper'
      ? [tepWav, '--model', model, '--output-dir', '.', '--output-format', 'json',
         '--word-timestamps', 'True', '--condition-on-previous-text', 'False', '--language', ngonNgu]
      : [tepWav, '--output_dir', '.', '--output_format', 'json', '--word_timestamps', 'True',
         '--condition_on_previous_text', 'False', '--language', ngonNgu, '--model', model];
    const kq = await chayLenh(lenhWhisper, args, {
      cwd: thuMuc, gioiHanGiay: 3600, themPath: path.dirname(FFMPEG),
    });
    const tepJson = path.join(thuMuc, tenGoc + '.json');
    if (kq.ma !== 0 || !existsSync(tepJson)) return null;
    return docTranscriptWhisper(JSON.parse(await readFile(tepJson, 'utf8')));
  };
  if (lenhWhisper && style.phuDe !== 'khong') {
    try {
      await ffmpeg(['-i', 'nhap.mp4', '-vn', '-ar', '16000', '-ac', '1', 'tieng.wav'], thuMuc);
      transcript = await bocWav('tieng.wav', 'tieng');
      if (transcript) {
        // whisper cả-tệp hay nuốt đoạn giữa khi nền ồn → tìm khoảng trống, bóc bù từng khúc
        const { giu, khoangTrong } = tinhKhoangTrong(transcript, sauCat.thoiLuong);
        transcript = { doan: giu };
        for (let i = 0; i < khoangTrong.length; i++) {
          const kt = khoangTrong[i];
          const batDau = Math.max(0, kt.batDau - 0.15);
          ganBuoc('transcript', 'dang', `Bóc bù khúc ${i + 1}/${khoangTrong.length} (${kt.batDau.toFixed(1)}–${kt.ketThuc.toFixed(1)}s)…`);
          await ffmpeg(['-ss', batDau.toFixed(2), '-t', (kt.ketThuc - batDau + 0.15).toFixed(2),
            '-i', 'tieng.wav', `khuc-${i}.wav`], thuMuc);
          const phan = await bocWav(`khuc-${i}.wav`, `khuc-${i}`);
          if (phan?.doan?.length) {
            const doanBu = locKhucBu(transcript.doan, phan.doan.map((d) => ({
              ...d,
              batDau: d.batDau + batDau, ketThuc: d.ketThuc + batDau,
              tu: d.tu?.map((t) => ({ ...t, batDau: t.batDau + batDau, ketThuc: t.ketThuc + batDau })),
            })));
            if (doanBu.length) { soKhucBu++; transcript = gopTranscript(transcript, doanBu); }
          }
        }
        // dò vùng có tiếng để neo nốt các cụm mốc rác còn sót
        const amLuongTieng = await doAmLuong('tieng.wav', thuMuc);
        const kqIm = await chayLenh(FFMPEG, [
          '-hide_banner', '-i', 'tieng.wav',
          '-af', `silencedetect=noise=${nguongImLang(amLuongTieng, 'vua')}:d=0.35`, '-f', 'null', '-',
        ], { cwd: thuMuc });
        const vungNoi = vungNoiTuImLang(phanTichImLang(kqIm.err, sauCat.thoiLuong), sauCat.thoiLuong);
        transcript = lamSachTranscript(transcript, sauCat.thoiLuong, { vungNoi });
        if (!transcript.doan.length) transcript = null;
      }
    } catch { /* thiếu transcript không chặn pipeline */ }
  }
  baoCao.coTranscript = Boolean(transcript);
  baoCao.soKhucBu = soKhucBu;
  ganBuoc('transcript', transcript ? 'xong' : 'boqua', transcript
    ? `${transcript.doan.length} câu (${lenhWhisper}${soKhucBu ? `, bóc bù ${soKhucBu} khúc whisper nuốt` : ''})`
    : (style.phuDe === 'khong' ? 'Style này không dùng phụ đề'
      : 'Máy chưa cài whisper — bỏ qua phụ đề (cài: uv tool install mlx-whisper)'));

  // ── 4. Đạo diễn có mắt ──────────────────────────────────────────────
  ganBuoc('daodien', 'dang');
  const khongGian = tenKhongGian(khungChinh);
  const cheDoHtml = Boolean(style.doHoaHtml) && await coChromium();
  const coMotion = cheDoHtml && style.remotion === true && await coRemotion();
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
      cheDoHtml, khongGian, coMotion,
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
        doHoaTho: tho.do_hoa, framingTho: tho.framing, rampTho: tho.ramp,
        motion: coMotion ? chuanHoaMotion(tho.motion, sauCat.thoiLuong) : [],
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
  // tiêu đề chiếm vùng trên trong ~4.5s đầu → từ khoá (cùng vùng) phải né
  if (style.chuTieuDe !== false && (tuyChon.tieuDe || edl.tieuDe[0])) {
    edl.tuKhoa = edl.tuKhoa.filter((tk) => tk.giay > 4.6);
  }
  transcript = apSuaChu(transcript, edl.suaChu);

  // ── Speed-ramp: đổi nhịp video/tiếng rồi ÁNH XẠ mọi mốc thời gian theo ──
  edl.ramp = style.speedRamp === true ? chuanHoaRamp(edl.rampTho, sauCat.thoiLuong) : [];
  edl.rampDoan = null;
  if (edl.ramp.length) {
    const ax = taoAnhXaThoiGian(edl.ramp, sauCat.thoiLuong);
    const doiT = ax.doiT;
    edl.rampDoan = ax.doan;
    transcript = doiThoiGianTranscript(transcript, doiT);
    edl.tuKhoa = edl.tuKhoa.map((t) => ({ ...t, giay: doiT(t.giay) }));
    edl.chuong = edl.chuong.map((c) => ({ ...c, giay: doiT(c.giay) }));
    edl.soDem = (edl.soDem || []).map((s) => ({ ...s, giay: doiT(s.giay) }));
    edl.anh = (edl.anh || []).map((a) => ({ ...a, giay: doiT(a.giay) }));
    edl.canh = edl.canh.map((c) => ({ ...c, batDau: doiT(c.batDau), ketThuc: doiT(c.ketThuc) }));
    edl.doHoaTho = (edl.doHoaTho || []).map((e) => ({
      ...e, t: doiT(Number(e.t)),
      out: e.out != null ? doiT(Number(e.out)) : e.out,
      strike_at: e.strike_at != null ? doiT(Number(e.strike_at)) : e.strike_at,
    }));
    edl.framingTho = (edl.framingTho || []).map((f) => ({ ...f, t: doiT(Number(f.t)) }));
    edl.motion = (edl.motion || []).map((m) => ({ ...m, t: doiT(m.t) }));
    sauCat.thoiLuong = ax.thoiLuongMoi;
    baoCao.thoiLuongSauCat = ax.thoiLuongMoi;
    baoCao.soRamp = edl.ramp.length;
  }
  // loudness 2-pass: đo thật một lần, các lượt render chuẩn theo số đo
  edl.loudnormThongSo = style.loudnorm !== false ? await doLoudnorm2Pass(tepGoc, thuMuc) : null;

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

  // Chế độ HTML: dựng storyboard (module + framing + caption theo nhịp)
  if (cheDoHtml) {
    edl.els = chuanHoaDoHoa(edl.doHoaTho, sauCat.thoiLuong, {
      khongGian, choPhep: style.moduleChoPhep?.length ? style.moduleChoPhep : null,
    });
    edl.doanKhung = tinhDoanKhung(
      (edl.framingTho?.length ? edl.framingTho : khungTheDuPhong(sauCat.thoiLuong, {
        khongGian, moc: mocCau, vong: style.vongKhung,
      })), sauCat.thoiLuong, khongGian);
    edl.caps = transcript ? taoCaption(transcript, { tuKhoa: edl.tuKhoa }) : [];
    if (style.progressBar !== false && sauCat.thoiLuong > 20) {
      edl.els.push({ module: 'progress', t: 0, y: KHONG_GIAN[khongGian].cao - 7, x: 0 });
    }
    // sóng âm + phách (bỏ khi có ramp — peaks đo trên nhịp thời gian cũ sẽ lệch)
    const canSong = style.beatSync
      || (style.moduleChoPhep || DS_MODULE).includes('waveform')
      || edl.els.some((e) => e.module === 'waveform');
    if (!edl.ramp.length && canSong && existsSync(path.join(thuMuc, 'tieng.wav'))) {
      try {
        const sa = await docSongAm('tieng.wav', thuMuc);
        edl.song = sa.song; edl.hzSong = sa.hz;
      } catch { /* thiếu sóng âm không chặn */ }
    }
    if (style.beatSync && edl.song) {
      edl.phach = timPhach(edl.song, edl.hzSong);
      edl.els = nepTheoPhach(
        edl.els.map((e) => (e.module === 'progress' ? e : { ...e, batTheoNhip: e.batTheoNhip !== false })),
        edl.phach);
    }
  }

  const soDongTac = new Set(edl.canh.map((c) => c.dongTac)).size;
  baoCao.daoDien = edl.nguon;
  baoCao.soCanh = cheDoHtml && style.khungThe ? edl.doanKhung.length : edl.canh.length;
  baoCao.soTuKhoa = edl.tuKhoa.length;
  baoCao.soAnh = edl.anh.length;
  baoCao.cheDoDoHoa = cheDoHtml ? 'html' : 'ass';
  baoCao.soModule = edl.els?.length || 0;
  ganBuoc('daodien', 'xong', edl.nguon === 'claude'
    ? `Claude${khungMau.length ? ' (đã xem ' + khungMau.length + ' khung hình)' : ''}: ${cheDoHtml ? `${edl.doanKhung?.length || 0} khung thẻ, ${edl.els.length} module đồ hoạ, ` : `${edl.canh.length} cảnh/${soDongTac} động tác, `}${edl.tuKhoa.length} từ khoá, ${edl.chuong.length} chương, ${edl.anh.length} ảnh, ${edl.suaChu.length} sửa chữ`
    : `Nhịp dự phòng: ${edl.canh.length} cảnh/${soDongTac} động tác${edl.loiClaude ? ' — claude lỗi: ' + edl.loiClaude : ''}`);

  // ── 4b. Soi bố cục (chỉ chế độ HTML) ────────────────────────────────
  ganBuoc('bocuc', 'dang');
  if (cheDoHtml && edl.els.length) {
    const doMotLan = async () => {
      const dsDo = await doDacOverlay({
        storyboard: { els: edl.els, caps: edl.caps, dur: sauCat.thoiLuong },
        skin: style.skin || {}, khongGian, thuMuc,
      });
      return dsDo ? timLoiBoCuc({
        dsDo, doanKhung: style.khungThe ? edl.doanKhung : [],
        caps: edl.caps, khongGian, thoiLuong: sauCat.thoiLuong,
      }) : [];
    };
    let loi = await doMotLan();
    if (loi.length && edl.nguon === 'claude' && process.env.XUONG_BO_QUA_CLAUDE !== '1') {
      try { // một lượt nhờ đạo diễn tự sửa toạ độ
        const ra = await goiClaude(
          `Storyboard đồ hoạ bị ${loi.length} lỗi bố cục:\n${loi.map((l) => '- ' + l.moTa).join('\n')}\n` +
          `Đây là do_hoa hiện tại: ${JSON.stringify(edl.els)}\nframing: ${JSON.stringify(edl.doanKhung.map((f) => ({ t: f.batDau, preset: f.preset })))}\n` +
          `Sửa toạ độ/thời gian cho hết lỗi (giữ nguyên nội dung chữ). Trả về DUY NHẤT JSON {"do_hoa":[...], "framing":[...]}.`,
          { gioiHanGiay: 180 });
        const sua = trichJson(ra);
        if (sua?.do_hoa) {
          edl.els = chuanHoaDoHoa(sua.do_hoa, sauCat.thoiLuong, { khongGian });
          if (sua.framing?.length) edl.doanKhung = tinhDoanKhung(sua.framing, sauCat.thoiLuong, khongGian);
          loi = await doMotLan();
        }
      } catch { /* sửa không được thì gỡ phần tử lỗi */ }
    }
    if (loi.length) {
      edl.els = goPhanTuLoi(edl.els, loi);
      ganBuoc('bocuc', 'xong', `Còn ${loi.length} lỗi sau lượt sửa — đã gỡ phần tử vi phạm, còn ${edl.els.length} module`);
    } else {
      ganBuoc('bocuc', 'xong', `0 lỗi — ${edl.els.length} module, ${edl.caps.length} dòng phụ đề đã đo đạc sạch`);
    }
  } else {
    ganBuoc('bocuc', 'boqua', cheDoHtml ? 'Không có module đồ hoạ' : 'Chế độ ASS không cần soi');
  }

  // ── 5. Render khung chính ───────────────────────────────────────────
  ganBuoc('render', 'dang');
  const nenSang = (await doDoSang('nhap.mp4', thuMuc)) > 170;
  const renderChinh = (tenRa) => cheDoHtml
    ? renderKhungHtml({
        thuMuc, tepGoc, khung: khungChinh, doanGiu, style, edl, transcript, tuyChon, tenRa,
        ganChiTiet: (ct) => ganBuoc('render', 'dang', ct),
      })
    : renderKhung({
        thuMuc, tepGoc, khung: khungChinh, doanGiu, style, edl, transcript, tuyChon, tenRa, nenSang,
      });
  const kq = await renderChinh('ra.mp4');
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
      if (ketSoat.tat_tu_khoa) {
        edl.tuKhoa = [];
        if (cheDoHtml) edl.els = edl.els.filter((e) => !['bigtype', 'note'].includes(e.module));
      }
      if (ketSoat.giam_dong_tac) {
        edl.canh = edl.canh.map((c, i) => (i % 2 ? { ...c, dongTac: 'tinh' } : c));
        if (cheDoHtml) edl.els = edl.els.filter((_, i) => i % 2 === 0 || edl.els[i]?.module === 'progress');
      }
      await renderChinh('ra.mp4');
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
  const themKhung = (tuyChon.xuatThem || []).filter((k) => TEN_KHUNG[k] && k !== khungChinh);
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
