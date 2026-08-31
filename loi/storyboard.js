// Storyboard v3 — học từ skill "AI Dark Keynote":
// caption theo nhịp 0,8–1,3s/dòng có |bôi vàng|, hệ toạ độ thiết kế theo khung,
// khung thẻ video, chuẩn hoá module đồ hoạ, và soi bố cục thuần trước render.
// Toàn bộ là hàm thuần để test được.
import { tapTuNoiBat } from './core.js';

/** 23 module đồ hoạ hợp lệ (14 của skill + 9 của Xưởng Video, v4 thêm 5). */
export const DS_MODULE = [
  'tag', 'chips', 'qchips', 'iconrow', 'rows', 'pill', 'flow', 'bigtype',
  'lockup', 'steps', 'chart', 'gridfill', 'myth', 'cta', 'note',
  'counter', 'progress', 'lower3',
  'waveform', 'sticker', 'lottie', 'databar', 'datapie',
];

/**
 * Dò phách từ mảng biên độ (peaks, hz mẫu/giây): điểm năng lượng bật vọt
 * so với nền cục bộ và là đỉnh cục bộ → mốc phách cho beat-reveal.
 */
export function timPhach(peaks, hz, { toiThieuCach = 0.28 } = {}) {
  if (!peaks?.length || !hz) return [];
  const cuaSo = Math.max(2, Math.round(hz * 0.35));
  const phach = [];
  let truoc = -10;
  for (let i = cuaSo; i < peaks.length - 1; i++) {
    let nen = 0;
    for (let j = i - cuaSo; j < i; j++) nen += peaks[j];
    nen /= cuaSo;
    if (peaks[i] > nen * 1.6 + 0.04 && peaks[i] >= peaks[i - 1] && peaks[i] >= peaks[i + 1]) {
      const t = i / hz;
      if (t - truoc >= toiThieuCach) { phach.push(Math.round(t * 100) / 100); truoc = t; }
    }
  }
  return phach.slice(0, 400);
}

/** Chuẩn hoá danh sách màn motion Remotion từ đạo diễn: 4 loại, ≤3 màn, kẹp mốc. */
export function chuanHoaMotion(tho, thoiLuong) {
  const so = (x) => (Number.isFinite(x) ? x : parseFloat(x));
  const DS = ['intro', 'scorecard', 'sosanh', 'outro'];
  const DAI = { intro: 3, scorecard: 5, sosanh: 5, outro: 3.5 };
  return (Array.isArray(tho) ? tho : [])
    .map((m) => ({
      loai: String(m.loai || ''),
      t: Math.max(0, so(m.t) || 0),
      giay: Math.min(7, Math.max(2, so(m.giay) || DAI[m.loai] || 3)),
      duLieu: (typeof m.duLieu === 'object' && m.duLieu) || {},
    }))
    .filter((m) => DS.includes(m.loai) && m.t < thoiLuong - 1)
    .map((m) => ({ ...m, giay: Math.min(m.giay, thoiLuong - m.t) }))
    .sort((a, b) => a.t - b.t)
    .slice(0, 3);
}

/** Nẹp các module có batTheoNhip vào mốc phách gần nhất phía sau (lệch ≤1s). */
export function nepTheoPhach(els, phach, { toiDaLech = 1.0 } = {}) {
  if (!phach?.length) return els;
  return els.map((e) => {
    if (!e.batTheoNhip) return e;
    const p = phach.find((x) => x >= e.t && x - e.t <= toiDaLech);
    return p ? { ...e, t: p } : e;
  });
}

/** Hệ toạ độ thiết kế theo khung xuất (render nhân 1.5 → nét). */
export const KHONG_GIAN = {
  doc:   { rong: 720,  cao: 1280, capBottom: 190, capSize: 44, capMax: 610,
           capDai: [1010, 1105], anToan: [24, 1180], le: 68, rongNoiDung: 584 },
  ngang: { rong: 1280, cao: 720,  capBottom: 52,  capSize: 38, capMax: 880,
           capDai: [560, 668],  anToan: [20, 700],  le: 48, rongNoiDung: 520 },
  vuong: { rong: 720,  cao: 720,  capBottom: 70,  capSize: 36, capMax: 560,
           capDai: [555, 650],  anToan: [20, 700],  le: 48, rongNoiDung: 624 },
};
export const TI_LE_NET = 1.5;

export function tenKhongGian(khung) {
  if (khung === 'ngang') return 'ngang';
  if (khung === 'vuong') return 'vuong';
  return 'doc';
}

/** Khung thẻ video dựng sẵn theo không gian: [x, y, w, h, bo góc]. */
export const KHUNG_THE = {
  doc: {
    full: [0, 0, 720, 1280, 0],
    hero: [68, 80, 584, 584, 40], 'hero-low': [68, 330, 584, 584, 40],
    tall: [68, 150, 584, 880, 44], 'tall-low': [68, 300, 584, 760, 44],
    mid: [170, 430, 380, 470, 34],
    'mini-left': [68, 560, 210, 280, 26], 'mini-center': [255, 560, 210, 280, 26],
    'mini-right': [442, 560, 210, 280, 26],
  },
  ngang: {
    full: [0, 0, 1280, 720, 0],
    'hero-left': [48, 52, 560, 560, 40], 'hero-right': [672, 52, 560, 560, 40],
    mid: [440, 120, 400, 440, 34],
  },
  vuong: {
    full: [0, 0, 720, 720, 0],
    hero: [60, 36, 600, 420, 36],
  },
};

/**
 * Caption theo nhịp từ transcript word-level: 3–6 từ/dòng, nhắm 0,8–1,3s,
 * bôi vàng |cụm từ khoá| (tối đa một cụm mỗi dòng).
 */
export function taoCaption(transcript, { tuKhoa = [], toiDaTu = 6, toiThieuTu = 3 } = {}) {
  if (!transcript?.doan?.length) return [];
  const noiBat = tapTuNoiBat(tuKhoa);
  const sach = (chu) => String(chu).replace(/\|/g, '').trim();
  const laNoiBat = (chu) => noiBat.has(sach(chu).toLowerCase().replace(/[.,!?;:"'()]/g, ''));

  const caps = [];
  for (const d of transcript.doan) {
    const tu = (d.tu?.length ? d.tu : [{ batDau: d.batDau, ketThuc: d.ketThuc, chu: d.chu }])
      .map((t) => ({ ...t, chu: sach(t.chu) })).filter((t) => t.chu);
    let nhom = [];
    const chot = () => {
      if (!nhom.length) return;
      let daVang = false;
      const text = nhom.map((t) => {
        if (!daVang && laNoiBat(t.chu)) { daVang = true; return `|${t.chu}|`; }
        return t.chu;
      }).join(' ');
      const t0 = nhom[0].batDau;
      const dai = Math.min(2.2, Math.max(0.5, nhom[nhom.length - 1].ketThuc - t0));
      const truoc = caps[caps.length - 1];
      const t = truoc ? Math.max(t0, truoc.t + truoc.d) : t0;
      caps.push({ t: Math.round(t * 100) / 100, d: Math.round(dai * 100) / 100, text });
      nhom = [];
    };
    for (let i = 0; i < tu.length; i++) {
      nhom.push(tu[i]);
      const dai = tu[i].ketThuc - nhom[0].batDau;
      const cachSau = i + 1 < tu.length ? tu[i + 1].batDau - tu[i].ketThuc : 99;
      if (nhom.length >= toiDaTu || cachSau > 0.6 || (nhom.length >= toiThieuTu && dai >= 0.9)) chot();
    }
    chot();
  }
  return caps;
}

/** Chia video thành các đoạn khung thẻ từ danh sách framing của đạo diễn. */
export function tinhDoanKhung(framing, thoiLuong, khongGian) {
  const bang = KHUNG_THE[khongGian] || KHUNG_THE.doc;
  const hopLe = (framing || [])
    .map((f) => ({
      t: Number(f.t) || 0,
      the: f.preset && bang[f.preset] ? bang[f.preset]
        : (Number.isFinite(f.x) && Number.isFinite(f.w) ? [f.x, f.y, f.w, f.h, f.r || 0] : null),
      preset: f.preset || 'tuy-chinh',
      panY: Math.min(0.8, Math.max(0.1, Number(f.pan_y ?? f.panY) || 0.42)),
      zoom: Math.min(1.6, Math.max(1, Number(f.zoom) || 1)),
    }))
    .filter((f) => f.the && f.t >= 0 && f.t < thoiLuong)
    .sort((a, b) => a.t - b.t);
  if (!hopLe.length || hopLe[0].t > 0.05) {
    hopLe.unshift({ t: 0, the: bang.full || Object.values(bang)[0], preset: 'full', panY: 0.42, zoom: 1 });
  }
  return hopLe.map((f, i) => ({
    ...f,
    batDau: f.t,
    ketThuc: i + 1 < hopLe.length ? hopLe[i + 1].t : thoiLuong,
  })).filter((f) => f.ketThuc - f.batDau > 0.2);
}

/** Framing dự phòng: đổi khung 5–8s tại ranh giới câu, xoay vòng preset cho phép. */
export function khungTheDuPhong(thoiLuong, { khongGian = 'doc', moc = [], vong = null } = {}) {
  const bang = KHUNG_THE[khongGian] || KHUNG_THE.doc;
  // vòng preset của style có thể thuộc không gian khác (style ngang chạy video dọc) → lọc rồi mới dùng
  let dsPreset = (vong || Object.keys(bang)).filter((p) => bang[p]);
  if (!dsPreset.length) dsPreset = Object.keys(bang);
  const ranhGioi = [0];
  let truoc = 0;
  for (const m of moc) {
    if (m - truoc >= 5 && m < thoiLuong - 3) { ranhGioi.push(m); truoc = m; }
  }
  while (thoiLuong - truoc > 9) { truoc += 6.5; ranhGioi.push(Math.round(truoc * 10) / 10); }
  return ranhGioi.map((t, i) => ({ t, preset: dsPreset[i % dsPreset.length] }));
}

/** Chuẩn hoá danh sách module đồ hoạ do đạo diễn trả về. */
export function chuanHoaDoHoa(tho, thoiLuong, { khongGian = 'doc', choPhep = null } = {}) {
  const kg = KHONG_GIAN[khongGian];
  const so = (x) => (Number.isFinite(x) ? x : parseFloat(x));
  return (Array.isArray(tho) ? tho : [])
    .map((e) => {
      const m = { ...e, module: String(e.module || '') };
      m.t = so(m.t);
      m.out = m.out === undefined || m.out === null ? undefined : so(m.out);
      m.y = so(m.y);
      if (m.x !== 'center') m.x = Number.isFinite(so(m.x)) ? so(m.x) : 'center';
      if (m.w !== 'auto') m.w = Number.isFinite(so(m.w)) ? so(m.w) : undefined;
      if (Array.isArray(m.items)) m.items = m.items.slice(0, 6);
      return m;
    })
    .filter((m) => DS_MODULE.includes(m.module))
    .filter((m) => !choPhep || choPhep.includes(m.module))
    .filter((m) => Number.isFinite(m.t) && m.t >= 0 && m.t < thoiLuong)
    .filter((m) => Number.isFinite(m.y) && m.y >= 0 && m.y <= kg.cao)
    .map((m) => ({ ...m, out: m.out !== undefined && Number.isFinite(m.out) ? Math.min(m.out, thoiLuong) : undefined }))
    .slice(0, 40);
}

const giaoNhau = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const trungGio = (a1, a2, b1, b2) => a1 < b2 - 0.15 && b1 < a2 - 0.15;

/**
 * Soi bố cục THUẦN trên số liệu đã đo: trả danh sách lỗi.
 * dsDo: kết quả window.doDac() — [{module, t, out, x, y, w, h}]
 */
export function timLoiBoCuc({ dsDo = [], doanKhung = [], caps = [], khongGian = 'doc', thoiLuong = 60 }) {
  const kg = KHONG_GIAN[khongGian];
  const loi = [];
  const cuaSo = (e) => [e.t, e.out ?? thoiLuong];

  for (const e of dsDo) {
    if (e.module === 'progress') continue; // thanh mảnh sát mép, miễn soi
    const [b1, k1] = cuaSo(e);
    for (const f of doanKhung) {
      if (f.preset === 'full') continue;
      const [x, y, w, h] = f.the;
      if (trungGio(b1, k1, f.batDau, f.ketThuc) && giaoNhau(e, { x, y, w, h })) {
        loi.push({ loai: 'de-the', moTa: `${e.module}@${e.t}s đè lên thẻ video (${f.preset}, ${f.batDau.toFixed(1)}–${f.ketThuc.toFixed(1)}s)` });
        break;
      }
    }
    const coCapTrongCuaSo = caps.some((c) => trungGio(b1, k1, c.t, c.t + c.d));
    if (coCapTrongCuaSo && e.y < kg.capDai[1] && e.y + e.h > kg.capDai[0]) {
      loi.push({ loai: 'de-phu-de', moTa: `${e.module}@${e.t}s lấn dải phụ đề (y ${kg.capDai[0]}–${kg.capDai[1]})` });
    }
    if (e.y + e.h > kg.anToan[1] || e.y < kg.anToan[0]) {
      loi.push({ loai: 'ngoai-vung', moTa: `${e.module}@${e.t}s ra ngoài vùng an toàn dọc` });
    }
  }
  for (let i = 0; i < dsDo.length; i++) {
    for (let j = i + 1; j < dsDo.length; j++) {
      const a = dsDo[i], b = dsDo[j];
      if (a.module === 'progress' || b.module === 'progress') continue;
      const [a1, a2] = cuaSo(a), [b1, b2] = cuaSo(b);
      if (trungGio(a1, a2, b1, b2) && giaoNhau(a, b)) {
        loi.push({ loai: 'de-nhau', moTa: `${a.module}@${a.t}s đè ${b.module}@${b.t}s` });
      }
    }
  }
  return loi;
}

/** Gỡ các module gây lỗi (giữ module xuất hiện trước) — phương án cứu khi đạo diễn sửa không xong. */
export function goPhanTuLoi(els, loi) {
  const xoa = new Set();
  for (const l of loi) {
    const m = l.moTa.match(/^(\w+)@([\d.]+)s/);
    if (m) xoa.add(`${m[1]}@${m[2]}`);
  }
  return els.filter((e) => !xoa.has(`${e.module}@${e.t}`));
}

/** Sự kiện SFX từ storyboard: đổi khung → whoosh, module hiện → pop, cta → ding. */
export function suKienSfxV3({ doanKhung = [], els = [], caps = [] }) {
  const suKien = [];
  for (const f of doanKhung.slice(1)) suKien.push({ giay: f.batDau, sfx: 'whoosh' });
  for (const e of els) {
    if (e.module === 'cta') suKien.push({ giay: e.t, sfx: 'ding' });
    else if (e.module !== 'progress') suKien.push({ giay: e.t, sfx: 'pop' });
  }
  suKien.sort((a, b) => a.giay - b.giay);
  const loc = [];
  for (const sk of suKien) {
    if (!loc.length || sk.giay - loc[loc.length - 1].giay >= 0.35) loc.push(sk);
  }
  return loc.slice(0, 40);
}

/** CSS skin từ token của style. */
export function cssSkin(skin = {}, khongGian = 'doc') {
  const kg = KHONG_GIAN[khongGian];
  const dong = [];
  if (skin.gold) dong.push(`--gold:${skin.gold};`);
  if (skin.goldBright) dong.push(`--gold-bright:${skin.goldBright};`);
  if (skin.card) dong.push(`--card:${skin.card};`);
  if (skin.ink) dong.push(`--ink:${skin.ink};`);
  if (skin.line) dong.push(`--line:${skin.line};`);
  if (skin.white) dong.push(`--white:${skin.white};`);
  dong.push(`--cap-bottom:${kg.capBottom}px;`);
  dong.push(`--cap-size:${kg.capSize}px;`);
  dong.push(`--cap-max:${kg.capMax}px;`);
  return dong.join('');
}
