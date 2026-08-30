// Động cơ chuyển động khung hình v2 + lớp âm thanh + đồ hoạ động.
// Toàn bộ là hàm thuần (như core.js) để test được.
import { s3, giaySangAss, escapeAss, beDong } from './core.js';

export const CAC_DONG_TAC = ['tinh', 'push-in', 'pull-out', 'pan-trai', 'pan-phai', 'punch-in', 'rung'];

/**
 * Sinh chuỗi filter cho MỘT cảnh theo động tác.
 * Cảnh đã được trim + setpts trước đó; đầu vào đúng kích thước rong×cao, fps 30.
 * cuongDo 0..1 điều tỉ lệ zoom / biên độ.
 */
export function locDongTac(dongTac, { daiGiay, cuongDo = 0.7, rong, cao, fps = 30 }) {
  const soFrame = Math.max(2, Math.round(daiGiay * fps));
  const zMax = (1 + 0.06 + 0.12 * cuongDo).toFixed(4); // 1.06 → 1.18
  const kich = `s=${rong}x${cao}`;
  const giua = `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;

  switch (dongTac) {
    case 'push-in':
      return `zoompan=z='min(1+${((zMax - 1) / soFrame).toFixed(6)}*on,${zMax})':${giua}:d=1:${kich}:fps=${fps}`;
    case 'pull-out':
      return `zoompan=z='max(${zMax}-${((zMax - 1) / soFrame).toFixed(6)}*on,1.001)':${giua}:d=1:${kich}:fps=${fps}`;
    case 'pan-trai': // khung trượt từ phải sang trái
      return `zoompan=z=1.10:x='(iw-iw/zoom)*(1-on/${soFrame})':y='ih/2-(ih/zoom/2)':d=1:${kich}:fps=${fps}`;
    case 'pan-phai':
      return `zoompan=z=1.10:x='(iw-iw/zoom)*(on/${soFrame})':y='ih/2-(ih/zoom/2)':d=1:${kich}:fps=${fps}`;
    case 'punch-in': { // cắt phóng đột ngột — scale tĩnh, KHÔNG mượt (chủ đích)
      const ti = (1 + 0.10 + 0.08 * cuongDo).toFixed(3);
      return `scale=trunc(iw*${ti}/2)*2:trunc(ih*${ti}/2)*2,crop=${rong}:${cao}:(iw-${rong})/2:(ih-${cao})/2`;
    }
    case 'rung': { // giật tắt dần trong ~12 frame đầu
      const bienDo = Math.round(4 + 8 * cuongDo);
      return `zoompan=z=1.07:x='iw/2-(iw/zoom/2)+${bienDo}*(1-min(on/12,1))*sin(on*2.4)':y='ih/2-(ih/zoom/2)+${bienDo}*(1-min(on/12,1))*cos(on*3.1)':d=1:${kich}:fps=${fps}`;
    }
    default:
      return null; // 'tinh' — không thêm filter
  }
}

/**
 * Filtergraph LƯỢT 2 v2: mỗi cảnh một động tác → concat → flash chuyển chương
 * → màu → ảnh chèn (overlay theo thời gian) → phụ đề → đồ hoạ → fade.
 * Ảnh chèn là các input 1..n (input 0 là video); trả về nhãn map cuối cùng.
 */
export function xayDoLocPass2V2({
  thoiLuong, canh, kichThuoc, fps = 30,
  mauSac = 'khong', chuoiMauFn,
  flashGiay = [], anh = [],
  tepPhuDe = null, tepDoHoa = null, fade = true,
}) {
  const { rong, cao } = kichThuoc;
  const phan = [];

  // ── Các cảnh với động tác riêng ─────────────────────────────────────
  const coDongTac = canh.some((c) => c.dongTac && c.dongTac !== 'tinh');
  if (coDongTac) {
    const nhan = [];
    canh.forEach((c, i) => {
      const loc = [`trim=start=${s3(c.batDau)}:end=${s3(c.ketThuc)}`, 'setpts=PTS-STARTPTS'];
      const dt = locDongTac(c.dongTac, {
        daiGiay: c.ketThuc - c.batDau, cuongDo: c.cuongDo ?? 0.7, rong, cao, fps,
      });
      if (dt) loc.push(dt);
      loc.push('setsar=1');
      phan.push(`[0:v]${loc.join(',')}[c${i}]`);
      nhan.push(`[c${i}]`);
    });
    phan.push(`${nhan.join('')}concat=n=${canh.length}:v=1:a=0[vz]`);
  } else {
    phan.push('[0:v]null[vz]');
  }

  // ── Chuỗi tuyến tính sau concat ─────────────────────────────────────
  const chuoi = [];
  for (const f of flashGiay.slice(0, 12)) {
    chuoi.push(`eq=brightness=0.28:enable='between(t,${s3(f)},${s3(f + 0.12)})'`);
  }
  const mau = chuoiMauFn ? chuoiMauFn(mauSac) : '';
  if (mau) chuoi.push(mau);
  let nhanHienTai = '[vz]';
  if (chuoi.length) {
    phan.push(`${nhanHienTai}${chuoi.join(',')}[vm]`);
    nhanHienTai = '[vm]';
  }

  // ── Ảnh chèn: mỗi ảnh một overlay có enable + fade alpha ───────────
  anh.slice(0, 12).forEach((a, i) => {
    const inIdx = i + 1; // input 0 là video
    const batDau = a.giay;
    const ketThuc = a.giay + (a.dai || 3.5);
    if (a.kieu === 'kenburns') {
      const nFr = Math.max(2, Math.round((ketThuc - batDau) * fps));
      phan.push(
        `[${inIdx}:v]scale=${rong}:${cao}:force_original_aspect_ratio=increase,crop=${rong}:${cao},` +
        `zoompan=z='min(1+${(0.12 / nFr).toFixed(6)}*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${nFr}:s=${rong}x${cao}:fps=${fps},` +
        `format=yuva420p,fade=t=in:d=0.3:alpha=1,fade=t=out:st=${s3(ketThuc - batDau - 0.3)}:d=0.3:alpha=1,setpts=PTS-STARTPTS+${s3(batDau)}/TB[a${i}]`);
      phan.push(`${nhanHienTai}[a${i}]overlay=0:0:enable='between(t,${s3(batDau)},${s3(ketThuc)})'[va${i}]`);
    } else { // pop: ảnh nhỏ giữa-phải, viền trắng, lắc nhẹ khi vào
      const rongAnh = Math.round(rong * 0.46);
      phan.push(
        `[${inIdx}:v]scale=${rongAnh}:-2,pad=iw+24:ih+24:12:12:color=white,rotate=2.5*PI/180:c=none,` +
        `format=yuva420p,fade=t=in:d=0.18:alpha=1,fade=t=out:st=${s3(ketThuc - batDau - 0.25)}:d=0.25:alpha=1,setpts=PTS-STARTPTS+${s3(batDau)}/TB[a${i}]`);
      phan.push(`${nhanHienTai}[a${i}]overlay=W-w-${Math.round(rong * 0.05)}:(H-h)/2:enable='between(t,${s3(batDau)},${s3(ketThuc)})'[va${i}]`);
    }
    nhanHienTai = `[va${i}]`;
  });

  // ── Phụ đề + đồ hoạ + fade ─────────────────────────────────────────
  const cuoi = [];
  if (tepPhuDe) cuoi.push(`ass=${tepPhuDe}`);
  if (tepDoHoa) cuoi.push(`ass=${tepDoHoa}`);
  if (fade) {
    cuoi.push('fade=t=in:d=0.4');
    cuoi.push(`fade=t=out:st=${s3(Math.max(0, thoiLuong - 0.45))}:d=0.45`);
  }
  phan.push(cuoi.length ? `${nhanHienTai}${cuoi.join(',')}[vout]` : `${nhanHienTai}null[vout]`);

  return { filterComplex: phan.join(';'), mapVideo: '[vout]' };
}

/**
 * Đồ lọc ÂM THANH lượt 2: giọng nói + SFX bám sự kiện + nhạc nền ducking → −14 LUFS.
 * viTriSfx: chỉ số input của từng tệp sfx; suKien: [{giay, sfx}].
 * Trả null nếu không có gì để trộn (giữ -c:a copy).
 */
export function xayLocAmThanh({ suKien = [], viTriSfx = {}, viTriNhac = null, thoiLuong }) {
  const coSfx = suKien.length > 0 && Object.keys(viTriSfx).length > 0;
  if (!coSfx && viTriNhac === null) return null;

  const phan = [];
  const nhanTron = [];
  phan.push('[0:a]anull[giong]');

  suKien.slice(0, 40).forEach((sk, i) => {
    const idx = viTriSfx[sk.sfx];
    if (idx === undefined) return;
    const ms = Math.max(0, Math.round(sk.giay * 1000));
    phan.push(`[${idx}:a]adelay=${ms}|${ms},volume=0.55[sfx${i}]`);
    nhanTron.push(`[sfx${i}]`);
  });

  if (viTriNhac !== null) {
    // nhạc lặp đủ dài, giảm âm, nén sidechain theo giọng nói
    phan.push(`[${viTriNhac}:a]aloop=loop=-1:size=2e9,atrim=0:${s3(thoiLuong)},volume=0.35[nhacTho]`);
    phan.push('[giong]asplit=2[giong1][giongKey]');
    phan.push('[nhacTho][giongKey]sidechaincompress=threshold=0.06:ratio=8:attack=80:release=600[nhacNen]');
    const tatCa = ['[giong1]', '[nhacNen]', ...nhanTron];
    phan.push(`${tatCa.join('')}amix=inputs=${tatCa.length}:duration=first:normalize=0[tron]`);
  } else {
    const tatCa = ['[giong]', ...nhanTron];
    phan.push(`${tatCa.join('')}amix=inputs=${tatCa.length}:duration=first:normalize=0[tron]`);
  }
  phan.push('[tron]loudnorm=I=-14:TP=-1.2:LRA=11[aout]');
  return { filterAudio: phan.join(';'), mapAudio: '[aout]' };
}

/** Từ EDL v2 → danh sách sự kiện SFX (giây, tên tệp). */
export function taoSuKienSfx(edl, { batSfx = true } = {}) {
  if (!batSfx) return [];
  const suKien = [];
  for (const c of edl.canh || []) {
    if (c.dongTac === 'punch-in') suKien.push({ giay: c.batDau, sfx: 'whoosh' });
    if (c.dongTac === 'rung') suKien.push({ giay: c.batDau, sfx: 'pop' });
  }
  for (const tk of edl.tuKhoa || []) suKien.push({ giay: tk.giay, sfx: 'pop' });
  for (const ch of edl.chuong || []) suKien.push({ giay: ch.giay, sfx: 'ding' });
  for (const a of edl.anh || []) suKien.push({ giay: a.giay, sfx: 'pop' });
  suKien.sort((x, y) => x.giay - y.giay);
  // tránh dội: bỏ sự kiện cách sự kiện trước < 0.35s
  const loc = [];
  for (const sk of suKien) {
    if (!loc.length || sk.giay - loc[loc.length - 1].giay >= 0.35) loc.push(sk);
  }
  return loc.slice(0, 40);
}

/**
 * Chia video thành CẢNH theo ranh giới câu nói (transcript) hoặc nhịp đều.
 * Dùng cho fallback + làm khung cho đạo diễn gán động tác.
 */
export function canhDuPhong(thoiLuong, { matDo = 'vua', dongTacChoPhep = null, moc = [] } = {}) {
  const buoc = matDo === 'day' ? 3.5 : matDo === 'thua' ? 8 : 5.5;
  const ranhGioi = moc.length
    ? [...new Set(moc.filter((m) => m > 0.8 && m < thoiLuong - 0.8))].sort((a, b) => a - b)
    : Array.from({ length: Math.floor(thoiLuong / buoc) }, (_, i) => (i + 1) * buoc)
        .filter((t) => t < thoiLuong - 1);

  const vong = (dongTacChoPhep && dongTacChoPhep.length
    ? dongTacChoPhep : ['push-in', 'tinh', 'pan-phai', 'punch-in', 'pull-out', 'rung']);
  const canh = [];
  let truoc = 0;
  ranhGioi.slice(0, 199).forEach((r, i) => {
    if (r - truoc < 0.6) return;
    canh.push({ batDau: truoc, ketThuc: r, dongTac: vong[i % vong.length], cuongDo: 0.7 });
    truoc = r;
  });
  if (thoiLuong - truoc > 0.05) {
    canh.push({ batDau: truoc, ketThuc: thoiLuong, dongTac: vong[canh.length % vong.length], cuongDo: 0.7 });
  }
  if (!canh.length) canh.push({ batDau: 0, ketThuc: thoiLuong, dongTac: 'push-in', cuongDo: 0.5 });
  return canh;
}

/** Chuẩn hoá EDL v2 từ claude: cảnh + ảnh + số đếm + sửa chữ (mở rộng bản v1). */
export function chuanHoaCanh(tho, thoiLuong, { dongTacChoPhep = null } = {}) {
  const so = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : parseFloat(x));
  const hopLe = (t) => Number.isFinite(t) && t >= 0 && t <= thoiLuong;

  let canh = (Array.isArray(tho.canh) ? tho.canh : [])
    .map((c) => ({
      batDau: so(c.batDau ?? c.bat_dau), ketThuc: so(c.ketThuc ?? c.ket_thuc),
      dongTac: String(c.dongTac ?? c.dong_tac ?? 'tinh'),
      cuongDo: Math.min(1, Math.max(0, so(c.cuongDo ?? c.cuong_do) || 0.7)),
    }))
    .filter((c) => hopLe(c.batDau) && hopLe(c.ketThuc) && c.ketThuc - c.batDau >= 0.4)
    .filter((c) => CAC_DONG_TAC.includes(c.dongTac))
    .sort((a, b) => a.batDau - b.batDau)
    .slice(0, 199);
  if (dongTacChoPhep && dongTacChoPhep.length) {
    canh = canh.map((c) => (dongTacChoPhep.includes(c.dongTac) ? c : { ...c, dongTac: 'tinh' }));
  }

  // Vá kín: cảnh phải phủ [0, thoiLuong] liên tục, không chồng lấn
  const kin = [];
  let conTro = 0;
  for (const c of canh) {
    if (c.batDau > conTro + 0.05) kin.push({ batDau: conTro, ketThuc: c.batDau, dongTac: 'tinh', cuongDo: 0.5 });
    if (c.batDau < conTro - 0.05) continue; // chồng lấn — bỏ
    kin.push({ ...c, batDau: Math.max(c.batDau, conTro) });
    conTro = c.ketThuc;
  }
  if (thoiLuong - conTro > 0.05) kin.push({ batDau: conTro, ketThuc: thoiLuong, dongTac: 'tinh', cuongDo: 0.5 });

  const anh = (Array.isArray(tho.anh) ? tho.anh : [])
    .map((a) => ({
      giay: so(a.giay), tep: String(a.tep || ''),
      kieu: a.kieu === 'kenburns' ? 'kenburns' : 'pop',
      dai: Math.min(6, Math.max(1.5, so(a.dai) || 3.5)),
    }))
    .filter((a) => hopLe(a.giay) && a.tep)
    .slice(0, 12);

  const suaChu = (Array.isArray(tho.sua_chu) ? tho.sua_chu : [])
    .map((sc) => ({ sai: String(sc.sai || ''), dung: String(sc.dung || '') }))
    .filter((sc) => sc.sai && sc.dung && sc.sai !== sc.dung)
    .slice(0, 30);

  const soDem = (Array.isArray(tho.so_dem) ? tho.so_dem : [])
    .map((sd) => ({ giay: so(sd.giay), tu: so(sd.tu) || 0, den: so(sd.den), hauTo: String(sd.hau_to || sd.hauTo || '') }))
    .filter((sd) => hopLe(sd.giay) && Number.isFinite(sd.den))
    .slice(0, 6);

  return { canh: kin.length ? kin : null, anh, suaChu, soDem };
}

// ── Đồ hoạ động v2 (bổ sung vào ASS đồ hoạ) ──────────────────────────

/** Thẻ chương động: trượt từ trái vào giữa, đứng 1.6s, trượt tiếp ra phải. */
export function suKienChuongDong(chuong, { rong, cao, thoiLuong }) {
  const suKien = [];
  for (const ch of chuong) {
    const batDau = Math.max(0, Math.min(ch.giay, thoiLuong - 1.2));
    const giua = { x: Math.round(rong / 2), y: Math.round(cao / 2) };
    suKien.push(
      `Dialogue: 3,${giaySangAss(batDau)},${giaySangAss(Math.min(batDau + 2.2, thoiLuong))},Chuong,,0,0,0,,` +
      `{\\move(${-Math.round(rong * 0.4)},${giua.y},${giua.x},${giua.y},0,260)\\fad(0,180)\\t(1800,2200,\\alpha&HFF&)}${escapeAss(ch.ten)}`
    );
  }
  return suKien;
}

/** Progress bar chạy suốt video bằng ASS \p1 + \t(fscx). */
export function suKienProgressBar({ rong, cao, thoiLuong }) {
  const cao1 = Math.max(8, Math.round(cao * 0.006));
  const y = cao - cao1;
  return [
    `Dialogue: 4,${giaySangAss(0)},${giaySangAss(thoiLuong)},Bar,,0,0,0,,` +
    `{\\an7\\pos(0,${y})\\fscx0\\fscy100\\t(0,${Math.round(thoiLuong * 1000)},\\fscx100)\\p1}` +
    `m 0 0 l ${rong} 0 l ${rong} ${cao1} l 0 ${cao1}{\\p0}`,
  ];
}

/** Counter số chạy: chuỗi Dialogue 80ms cho mỗi giá trị. */
export function suKienCounter(soDem, { thoiLuong }) {
  const suKien = [];
  for (const sd of (soDem || []).slice(0, 6)) {
    const batDau = Math.max(0, Math.min(sd.giay, thoiLuong - 1.5));
    const tu = Math.round(sd.tu ?? 0);
    const den = Math.round(sd.den ?? 100);
    const dai = 1.2;
    const buocSo = 14;
    for (let i = 0; i <= buocSo; i++) {
      const t1 = batDau + (dai * i) / buocSo;
      const t2 = i === buocSo ? Math.min(batDau + dai + 1.2, thoiLuong) : batDau + (dai * (i + 1)) / buocSo;
      const giaTri = Math.round(tu + ((den - tu) * i) / buocSo);
      suKien.push(
        `Dialogue: 4,${giaySangAss(t1)},${giaySangAss(t2)},TuKhoa,,0,0,0,,` +
        `${i === buocSo ? '{\\fad(0,150)}' : ''}${escapeAss(String(giaTri) + (sd.hauTo || ''))}`
      );
    }
  }
  return suKien;
}

/** CTA cuối video: card "Theo dõi <kênh>" phóng nhẹ + fade. */
export function suKienCta(tenKenh, { thoiLuong }) {
  if (!tenKenh || thoiLuong < 6) return [];
  const batDau = thoiLuong - 2.6;
  return [
    `Dialogue: 3,${giaySangAss(batDau)},${giaySangAss(thoiLuong - 0.2)},Chuong,,0,0,0,,` +
    `{\\fad(200,150)\\fscx88\\fscy88\\t(0,350,\\fscx100\\fscy100)}${escapeAss('Theo dõi ' + tenKenh)}`,
  ];
}
