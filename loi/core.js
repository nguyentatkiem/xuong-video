// Lõi xử lý của Xưởng Video — toàn bộ là hàm thuần, không đụng fs/tiến trình
// để test được trong test/core.test.js.

/** Làm tròn giây còn 3 chữ số thập phân, trả về chuỗi dùng trong filter ffmpeg. */
export function s3(x) {
  return (Math.round(x * 1000) / 1000).toFixed(3);
}

/** Kích thước khung xuất theo kiểu khung của style. */
export function kichThuocKhung(khung) {
  if (khung === 'doc-crop' || khung === 'doc-blur') return { rong: 1080, cao: 1920 };
  if (khung === 'vuong') return { rong: 1080, cao: 1080 };
  return { rong: 1920, cao: 1080 };
}

/**
 * Đọc stderr của ffmpeg silencedetect, trả về danh sách khoảng lặng.
 * @returns {{batDau:number, ketThuc:number}[]}
 */
export function phanTichImLang(vanBan, tongThoiLuong = Infinity) {
  const ketQua = [];
  let dangMo = null;
  for (const dong of vanBan.split('\n')) {
    const mo = dong.match(/silence_start:\s*(-?[\d.]+)/);
    if (mo) { dangMo = Math.max(0, parseFloat(mo[1])); continue; }
    const dong2 = dong.match(/silence_end:\s*([\d.]+)/);
    if (dong2 && dangMo !== null) {
      ketQua.push({ batDau: dangMo, ketThuc: parseFloat(dong2[1]) });
      dangMo = null;
    }
  }
  // Khoảng lặng kéo dài tới hết video (không có silence_end cuối)
  if (dangMo !== null && Number.isFinite(tongThoiLuong) && tongThoiLuong - dangMo > 0.05) {
    ketQua.push({ batDau: dangMo, ketThuc: tongThoiLuong });
  }
  return ketQua;
}

/**
 * Từ danh sách khoảng lặng → danh sách đoạn GIỮ LẠI.
 * Mỗi khoảng lặng được chừa đệm `dem` giây hai đầu (để không cắt cụt tiếng);
 * khoảng lặng sau khi trừ đệm mà ngắn hơn `imToiThieu` thì bỏ qua (không cắt).
 * @returns {{doanGiu:{batDau:number,ketThuc:number}[], tongCat:number}}
 */
export function tinhDoanGiu(imLang, tongThoiLuong, { dem = 0.2, imToiThieu = 0.4 } = {}) {
  const catThat = [];
  for (const kl of imLang) {
    const b = kl.batDau + dem;
    const k = kl.ketThuc - dem;
    if (k - b >= imToiThieu) catThat.push({ batDau: Math.max(0, b), ketThuc: Math.min(tongThoiLuong, k) });
  }
  catThat.sort((a, b) => a.batDau - b.batDau);

  const doanGiu = [];
  let conTro = 0;
  for (const c of catThat) {
    if (c.batDau > conTro + 0.05) doanGiu.push({ batDau: conTro, ketThuc: c.batDau });
    conTro = Math.max(conTro, c.ketThuc);
  }
  if (tongThoiLuong - conTro > 0.05) doanGiu.push({ batDau: conTro, ketThuc: tongThoiLuong });
  if (doanGiu.length === 0) doanGiu.push({ batDau: 0, ketThuc: tongThoiLuong });

  const tongGiu = doanGiu.reduce((s, d) => s + (d.ketThuc - d.batDau), 0);
  return { doanGiu, tongCat: Math.max(0, tongThoiLuong - tongGiu) };
}

/** Chuỗi filter đổi khung hình (trừ doc-blur là chuỗi nhiều nhánh, xử lý riêng). */
function chuoiKhung(khung) {
  if (khung === 'goc') return 'null'; // giữ nguyên khung gốc — dùng khi lồng video vào thẻ
  if (khung === 'doc-crop') {
    return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1';
  }
  if (khung === 'vuong') {
    return 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,setsar=1';
  }
  return 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1';
}

/**
 * Filtergraph LƯỢT 1: cắt khoảng lặng + đổi khung + chuẩn hoá âm lượng.
 * Luôn dùng đường trim/concat (n=1 vẫn hợp lệ) cho đồng nhất.
 * @returns {{filterComplex:string, mapVideo:string, mapAudio:string}}
 */
export function xayDoLocPass1({ doanGiu, khung = 'ngang', loudnorm = true }) {
  const phan = [];
  const nhan = [];
  doanGiu.forEach((d, i) => {
    phan.push(`[0:v]trim=start=${s3(d.batDau)}:end=${s3(d.ketThuc)},setpts=PTS-STARTPTS[v${i}]`);
    phan.push(`[0:a]atrim=start=${s3(d.batDau)}:end=${s3(d.ketThuc)},asetpts=PTS-STARTPTS[a${i}]`);
    nhan.push(`[v${i}][a${i}]`);
  });
  phan.push(`${nhan.join('')}concat=n=${doanGiu.length}:v=1:a=1[vc][ac]`);

  if (khung === 'doc-blur') {
    phan.push('[vc]split=2[nen][chinh]');
    phan.push('[nen]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[nenmo]');
    phan.push('[chinh]scale=1080:1920:force_original_aspect_ratio=decrease[chinhto]');
    phan.push('[nenmo][chinhto]overlay=(W-w)/2:(H-h)/2,setsar=1[vout]');
  } else {
    phan.push(`[vc]${chuoiKhung(khung)}[vout]`);
  }
  phan.push(loudnorm ? '[ac]loudnorm=I=-16:TP=-1.5:LRA=11[aout]' : '[ac]anull[aout]');

  return { filterComplex: phan.join(';'), mapVideo: '[vout]', mapAudio: '[aout]' };
}

/**
 * Chia video thành các đoạn zoom/không-zoom từ danh sách "giây cần nhấn".
 * Trả về dãy đoạn phủ kín [0, thoiLuong], liên tục, không chồng lấn.
 */
export function chiaDoanZoom(thoiLuong, diemZoom, { daiZoom = 3, cachToiThieu = 1.2 } = {}) {
  const diem = [...new Set(diemZoom)]
    .filter((z) => z > 0.3 && z < thoiLuong - 0.5)
    .sort((a, b) => a - b);

  const doan = [];
  let conTro = 0;
  for (let i = 0; i < diem.length; i++) {
    const z = diem[i];
    if (z < conTro + cachToiThieu) continue; // quá sát đoạn zoom trước → bỏ
    if (z > conTro + 0.05) doan.push({ batDau: conTro, ketThuc: z, zoom: false });
    const sau = diem.slice(i + 1).find((d) => d > z);
    const ketThuc = Math.min(z + daiZoom, sau ?? thoiLuong, thoiLuong);
    if (ketThuc - z > 0.05) doan.push({ batDau: z, ketThuc, zoom: true });
    conTro = ketThuc;
  }
  if (thoiLuong - conTro > 0.05) doan.push({ batDau: conTro, ketThuc: thoiLuong, zoom: false });
  if (doan.length === 0) doan.push({ batDau: 0, ketThuc: thoiLuong, zoom: false });
  return doan;
}

/** Bộ lọc màu theo tên preset. Trả về '' nếu không chỉnh màu. */
export function chuoiMau(mauSac) {
  switch (mauSac) {
    case 'toi': return 'eq=contrast=1.07:brightness=-0.03:saturation=1.05';
    case 'pastel': return 'eq=contrast=0.94:brightness=0.05:saturation=0.8,colortemperature=temperature=7200';
    case 'am': return 'eq=contrast=1.04:saturation=1.1,colortemperature=temperature=4800';
    case 'phim': return 'eq=contrast=1.08:saturation=0.88,vignette=PI/5';
    default: return '';
  }
}

/**
 * Filtergraph LƯỢT 2: zoom nhấn nhá + màu + phụ đề + đồ hoạ chữ + fade.
 * Tên tệp .ass là đường dẫn TƯƠNG ĐỐI (ffmpeg chạy với cwd = thư mục việc).
 */
export function xayDoLocPass2({
  thoiLuong, doanZoom, tiLeZoom = 1.12, kichThuoc,
  mauSac = 'khong', tepPhuDe = null, tepDoHoa = null, fade = true,
}) {
  const { rong, cao } = kichThuoc;
  const phan = [];
  const coZoom = doanZoom.some((d) => d.zoom);

  if (coZoom) {
    const nhan = [];
    doanZoom.forEach((d, i) => {
      const loc = [`trim=start=${s3(d.batDau)}:end=${s3(d.ketThuc)}`, 'setpts=PTS-STARTPTS'];
      if (d.zoom) {
        loc.push(`scale=trunc(iw*${tiLeZoom}/2)*2:trunc(ih*${tiLeZoom}/2)*2`);
        loc.push(`crop=${rong}:${cao}:(iw-${rong})/2:(ih-${cao})/2`);
      }
      loc.push('setsar=1'); // scale làm lệch SAR nhẹ → ép về 1:1 cho concat không từ chối
      phan.push(`[0:v]${loc.join(',')}[z${i}]`);
      nhan.push(`[z${i}]`);
    });
    phan.push(`${nhan.join('')}concat=n=${doanZoom.length}:v=1:a=0[vz]`);
  } else {
    phan.push('[0:v]null[vz]');
  }

  const chuoi = [];
  const mau = chuoiMau(mauSac);
  if (mau) chuoi.push(mau);
  if (tepPhuDe) chuoi.push(`ass=${tepPhuDe}`);
  if (tepDoHoa) chuoi.push(`ass=${tepDoHoa}`);
  if (fade) {
    chuoi.push('fade=t=in:d=0.4');
    chuoi.push(`fade=t=out:st=${s3(Math.max(0, thoiLuong - 0.45))}:d=0.45`);
  }
  phan.push(chuoi.length ? `[vz]${chuoi.join(',')}[vout]` : '[vz]null[vout]');

  return { filterComplex: phan.join(';'), mapVideo: '[vout]' };
}

/** Giây → mốc thời gian ASS "H:MM:SS.CC". */
export function giaySangAss(t) {
  const tt = Math.max(0, t);
  const h = Math.floor(tt / 3600);
  const m = Math.floor((tt % 3600) / 60);
  const giay = Math.floor(tt % 60);
  const phanTram = Math.floor((tt - Math.floor(tt)) * 100);
  const dem2 = (x) => String(x).padStart(2, '0');
  return `${h}:${dem2(m)}:${dem2(giay)}.${dem2(phanTram)}`;
}

/** Giây → mốc thời gian SRT "HH:MM:SS,mmm". */
export function giaySangSrt(t) {
  const tt = Math.max(0, t);
  const h = Math.floor(tt / 3600);
  const m = Math.floor((tt % 3600) / 60);
  const giay = Math.floor(tt % 60);
  const ms = Math.round((tt - Math.floor(tt)) * 1000);
  const dem2 = (x) => String(x).padStart(2, '0');
  return `${dem2(h)}:${dem2(m)}:${dem2(giay)},${String(ms).padStart(3, '0')}`;
}

/** Escape chữ hiển thị trong ASS. */
export function escapeAss(chu) {
  return String(chu).replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N');
}

const DAU_ASS = (rong, cao) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${rong}
PlayResY: ${cao}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

const DINH_DANG_SU_KIEN = `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

/**
 * Làm sạch transcript whisper trên video thật — whisper hay trả 2 loại rác:
 * (1) đoạn kéo dài qua cả quãng nhạc/im lặng dù lời đã dứt từ lâu;
 * (2) cả câu bị nhồi mốc thời gian vào <1 giây (thường ở cuối tệp).
 * Cách xử lý: tin MỐC TỪNG TỪ, tách đoạn tại khoảng nghỉ giữa từ, và dàn đều
 * lại các cụm từ suy biến (thời lượng trung bình mỗi từ < 0.12s) lùi từ cuối.
 */
export function lamSachTranscript(transcript, thoiLuong, { khoangTach = 1.1, daiTu = 0.38 } = {}) {
  if (!transcript?.doan?.length) return transcript;
  const doanMoi = [];

  const ghiDoan = (nhom) => {
    if (!nhom.length) return;
    let batDau = nhom[0].batDau;
    let ketThuc = Math.min(nhom[nhom.length - 1].ketThuc + 0.15, thoiLuong);
    const truoc = doanMoi[doanMoi.length - 1];
    if (truoc && batDau < truoc.ketThuc) {
      batDau = Math.min(truoc.ketThuc + 0.05, ketThuc - 0.2);
      const buoc = (ketThuc - batDau) / nhom.length;
      nhom = nhom.map((t, i) => ({ ...t, batDau: batDau + i * buoc, ketThuc: batDau + (i + 1) * buoc - 0.03 }));
    }
    doanMoi.push({ batDau, ketThuc, chu: nhom.map((t) => t.chu).join(' '), tu: nhom });
  };

  for (const d of transcript.doan) {
    if (!d.tu || !d.tu.length) { doanMoi.push({ ...d, ketThuc: Math.min(d.ketThuc, thoiLuong) }); continue; }
    let tu = d.tu
      .map((t) => ({ ...t, batDau: Math.max(0, Math.min(t.batDau, thoiLuong)), ketThuc: Math.max(0, Math.min(t.ketThuc, thoiLuong)) }))
      .map((t) => (t.ketThuc > t.batDau ? t : { ...t, ketThuc: t.batDau + 0.05 }))
      // whisper hay kéo giãn mốc kết thúc của từ qua cả quãng nhạc → kẹp 1s/từ
      .map((t) => ({ ...t, ketThuc: Math.min(t.ketThuc, t.batDau + 1.0) }));

    // cụm suy biến → dàn đều lùi từ mốc cuối
    const bề = tu[tu.length - 1].ketThuc - tu[0].batDau;
    if (bề / tu.length < 0.12) {
      const cuoi = Math.min(Math.max(tu[tu.length - 1].ketThuc, 0.5), thoiLuong);
      const dau = Math.max(0, cuoi - daiTu * tu.length);
      tu = tu.map((t, i) => ({ ...t, batDau: dau + i * daiTu, ketThuc: dau + (i + 1) * daiTu - 0.04 }));
    }

    // tách đoạn tại khoảng nghỉ dài giữa từ
    let nhom = [tu[0]];
    for (let i = 1; i < tu.length; i++) {
      if (tu[i].batDau - nhom[nhom.length - 1].ketThuc > khoangTach) { ghiDoan(nhom); nhom = []; }
      nhom.push(tu[i]);
    }
    ghiDoan(nhom);
  }
  return { doan: doanMoi };
}

/**
 * Ngưỡng im lặng THÍCH ỨNG theo âm lượng trung bình của video (volumedetect).
 * Video có nhạc nền/tiếng ồn → mean cao → ngưỡng cao theo, không bắt hụt;
 * video thu phòng yên tĩnh → mean thấp → ngưỡng hạ theo, không cắt oan.
 */
export function nguongImLang(meanVolumeDb, muc = 'vua') {
  const lech = { nhe: 14, vua: 10, manh: 7 }[muc] ?? 10;
  const nguong = Math.max(-60, Math.min(-20, meanVolumeDb - lech));
  return `${nguong.toFixed(1)}dB`;
}

/**
 * Chọn khung xuất: người dùng ép thì theo người dùng; còn "tự động" thì
 * video gốc DỌC không bao giờ bị ép sang khung ngang (giữ doc-crop).
 */
export function chonKhungXuat(style, gocDoc, yeuCau = 'auto') {
  if (yeuCau && yeuCau !== 'auto') return yeuCau;
  if (gocDoc && style.khung === 'ngang') return 'doc-crop';
  return style.khung;
}

/** Tách các từ khoá thành tập từ đơn (thường, bỏ dấu câu) để tô nổi trong phụ đề. */
export function tapTuNoiBat(tuKhoa) {
  const tap = new Set();
  for (const tk of tuKhoa || []) {
    for (const tu of String(tk.chu || tk).toLowerCase().split(/\s+/)) {
      const sach = tu.replace(/[.,!?;:"'()]/g, '');
      if (sach.length >= 2) tap.add(sach);
    }
  }
  return tap;
}

/**
 * Tạo tệp ASS phụ đề từ transcript.
 * transcript = { doan: [{batDau, ketThuc, chu, tu?: [{batDau, ketThuc, chu}]}] }
 * cheDo 'tu'  → karaoke từng-từ (Hormozi); 'dong' → phụ đề dòng.
 * chuKieu (từ style preset): { font, co, mauDaDoc, mauChoDoc, mauNoiBat, viTri, nhomTu }
 * tuKhoaNoiBat: các từ được tô màu nổi ngay trong dòng phụ đề.
 * nenSang: video nền sáng → chế độ dòng chuyển chữ tối viền trắng cho khỏi chìm.
 */
export function taoAssPhuDe(transcript, {
  rong, cao, cheDo = 'dong', chuKieu = {}, tuKhoaNoiBat = null, nenSang = false,
} = {}) {
  const doc = cao > rong;
  const suKien = [];
  const font = chuKieu.font || 'Arial';
  const tapNoiBat = tuKhoaNoiBat instanceof Set ? tuKhoaNoiBat : tapTuNoiBat(tuKhoaNoiBat);
  const laNoiBat = (chu) => tapNoiBat.has(String(chu).toLowerCase().replace(/[.,!?;:"'()]/g, ''));
  const mauNoiBat = chuKieu.mauNoiBat || '&H000A7CFF';

  if (cheDo === 'tu') {
    const co = chuKieu.co || (doc ? 92 : 68);
    const nhomTu = chuKieu.nhomTu || 4;
    const mauDaDoc = chuKieu.mauDaDoc || '&H0000E9FF';
    const mauChoDoc = chuKieu.mauChoDoc || '&H00FFFFFF';
    // mặc định đặt DƯỚI CẰM (talking-head dọc mặt chiếm gần hết khung) — 'giua' phải xin rõ
    const canGiua = chuKieu.viTri === 'giua';
    const marginV = canGiua ? 0 : Math.round(cao * (doc ? 0.35 : 0.22));
    const style = `Style: PhuDe,${font},${co},${mauDaDoc},${mauChoDoc},&H00101010,&H96000000,-1,0,0,0,100,100,0,0,1,5,2,${canGiua ? 5 : 2},60,60,${marginV},1\n`;
    for (const d of transcript.doan) {
      const tu = d.tu && d.tu.length ? d.tu : null;
      if (tu) {
        for (let i = 0; i < tu.length; i += nhomTu) {
          const nhom = tu.slice(i, i + nhomTu);
          const chu = nhom
            .map((t) => {
              const k = `{\\k${Math.max(1, Math.round((t.ketThuc - t.batDau) * 100))}}`;
              const noiDung = escapeAss(t.chu.toUpperCase());
              return laNoiBat(t.chu)
                ? `${k}{\\1c${mauNoiBat}&}${noiDung}{\\1c${mauDaDoc}&}`
                : `${k}${noiDung}`;
            })
            .join(' ');
          suKien.push(`Dialogue: 0,${giaySangAss(nhom[0].batDau)},${giaySangAss(nhom[nhom.length - 1].ketThuc)},PhuDe,,0,0,0,,${chu}`);
        }
      } else {
        suKien.push(`Dialogue: 0,${giaySangAss(d.batDau)},${giaySangAss(d.ketThuc)},PhuDe,,0,0,0,,${escapeAss(beDong(d.chu.toUpperCase(), 20))}`);
      }
    }
    return DAU_ASS(rong, cao) + style + DINH_DANG_SU_KIEN + suKien.join('\n') + '\n';
  }

  const co = chuKieu.co || (doc ? 60 : 48);
  const marginV = (chuKieu.viTri === 'giua') ? 0 : (doc ? 260 : 80);
  const canh = (chuKieu.viTri === 'giua') ? 5 : 2;
  const mauChinh = nenSang ? '&H00151515' : (chuKieu.mauDaDoc || '&H00FFFFFF');
  const mauVien = nenSang ? '&H00FFFFFF' : '&H00151515';
  const style = `Style: PhuDe,${font},${co},${mauChinh},${mauChinh},${mauVien},&H7D000000,-1,0,0,0,100,100,0,0,1,3,1,${canh},60,60,${marginV},1\n`;
  for (const d of transcript.doan) {
    let noiDung = escapeAss(beDong(d.chu, doc ? 24 : 42));
    if (tapNoiBat.size) {
      noiDung = noiDung.split(' ').map((tu) =>
        laNoiBat(tu) ? `{\\c${mauNoiBat}&\\b1}${tu}{\\c${mauChinh}&\\b0}` : tu).join(' ');
    }
    suKien.push(`Dialogue: 0,${giaySangAss(d.batDau)},${giaySangAss(d.ketThuc)},PhuDe,,0,0,0,,${noiDung}`);
  }
  return DAU_ASS(rong, cao) + style + DINH_DANG_SU_KIEN + suKien.join('\n') + '\n';
}

/** Bẻ chuỗi dài thành tối đa 2 dòng tại khoảng trắng gần giữa. */
export function beDong(chu, gioiHan) {
  const s = String(chu).trim();
  if (s.length <= gioiHan) return s;
  const giua = Math.floor(s.length / 2);
  let viTri = -1;
  for (let lech = 0; lech < giua; lech++) {
    if (s[giua - lech] === ' ') { viTri = giua - lech; break; }
    if (s[giua + lech] === ' ') { viTri = giua + lech; break; }
  }
  if (viTri < 0) return s;
  return s.slice(0, viTri) + '\n' + s.slice(viTri + 1);
}

/**
 * Tạo tệp ASS "đồ hoạ chữ": tiêu đề mở đầu, từ khoá bật giữa màn hình,
 * thẻ chương, watermark tên kênh.
 */
export function taoAssDoHoa({ rong, cao, thoiLuong, tieuDe = '', tenKenh = '', tuKhoa = [], chuong = [], suKienThem = [], mauAccent = '&H00EB6325' }) {
  const doc = cao > rong;
  const styles = [
    `Style: TieuDe,Arial,${doc ? 72 : 60},&H00FFFFFF,&H00FFFFFF,&H00202020,&H8C000000,-1,0,0,0,100,100,0,0,1,4,2,8,60,60,${doc ? 180 : 70},1`,
    `Style: TuKhoa,Arial,${doc ? 100 : 78},&H00FFFFFF,&H00FFFFFF,${mauAccent},&H96000000,-1,0,0,0,100,100,2,0,1,6,3,2,40,40,${Math.round(cao * (doc ? 0.46 : 0.38))},1`,
    `Style: Chuong,Arial,${doc ? 78 : 66},&H00FFFFFF,&H00FFFFFF,${mauAccent},${mauAccent},-1,0,0,0,100,100,1,0,3,14,0,5,60,60,0,1`,
    `Style: Kenh,Arial,${doc ? 40 : 34},&H5AFFFFFF,&H5AFFFFFF,&H5A101010,&H96000000,0,0,0,0,100,100,0,0,1,2,0,3,40,40,${doc ? 60 : 40},1`,
    `Style: Bar,Arial,20,${mauAccent},${mauAccent},${mauAccent},${mauAccent},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
  ].join('\n') + '\n';

  const suKien = [];
  if (tieuDe) {
    suKien.push(`Dialogue: 1,${giaySangAss(0.6)},${giaySangAss(Math.min(4.4, thoiLuong))},TieuDe,,0,0,0,,{\\fad(300,300)}${escapeAss(beDong(tieuDe, doc ? 22 : 34))}`);
  }
  if (tenKenh) {
    suKien.push(`Dialogue: 0,${giaySangAss(0)},${giaySangAss(thoiLuong)},Kenh,,0,0,0,,${escapeAss(tenKenh)}`);
  }
  for (const tk of tuKhoa) {
    const batDau = Math.max(0, Math.min(tk.giay, thoiLuong - 0.5));
    suKien.push(`Dialogue: 2,${giaySangAss(batDau)},${giaySangAss(Math.min(batDau + 1.6, thoiLuong))},TuKhoa,,0,0,0,,{\\fad(70,90)\\t(0,110,\\fscx112\\fscy112)}${escapeAss(String(tk.chu).toUpperCase())}`);
  }
  for (const ch of chuong) {
    const batDau = Math.max(0, Math.min(ch.giay, thoiLuong - 1));
    suKien.push(`Dialogue: 2,${giaySangAss(batDau)},${giaySangAss(Math.min(batDau + 2.2, thoiLuong))},Chuong,,0,0,0,,{\\fad(150,150)}${escapeAss(ch.ten)}`);
  }
  suKien.push(...suKienThem);

  return DAU_ASS(rong, cao) + styles + DINH_DANG_SU_KIEN + suKien.join('\n') + '\n';
}

/** Tạo nội dung SRT từ transcript (đã khớp thời gian video sau cắt). */
export function taoSrt(transcript) {
  return transcript.doan
    .map((d, i) => `${i + 1}\n${giaySangSrt(d.batDau)} --> ${giaySangSrt(d.ketThuc)}\n${d.chu.trim()}\n`)
    .join('\n');
}

/**
 * EDL dự phòng khi không gọi được claude / không có transcript:
 * zoom đều đặn theo mật độ style, không từ khoá, không chương.
 */
export function edlDuPhong(thoiLuong, style, { tieuDe = '' } = {}) {
  const zoomGiay = [];
  if (style.zoom?.batTat) {
    const buoc = style.zoom.matDo === 'day' ? 5 : 9;
    for (let t = 2.5; t < thoiLuong - 2 && zoomGiay.length < 150; t += buoc) zoomGiay.push(Math.round(t * 10) / 10);
  }
  return {
    nguon: 'du-phong',
    tieuDe: tieuDe ? [tieuDe] : [],
    moTa: '',
    tags: [],
    zoomGiay,
    tuKhoa: [],
    chuong: [],
  };
}

/** Rút khối JSON đầu tiên từ câu trả lời của claude (chấp nhận có ```json ... ```). */
export function trichJson(vanBan) {
  if (!vanBan) return null;
  let s = String(vanBan).replace(/```json/gi, '```');
  const khoi = s.match(/```([\s\S]*?)```/);
  if (khoi) s = khoi[1];
  const dau = s.indexOf('{');
  const cuoi = s.lastIndexOf('}');
  if (dau < 0 || cuoi <= dau) return null;
  try {
    return JSON.parse(s.slice(dau, cuoi + 1));
  } catch {
    return null;
  }
}

/**
 * Chuẩn hoá EDL từ claude: ép kiểu, kẹp mốc thời gian trong [0, thoiLuong],
 * giới hạn số lượng để filtergraph không phình.
 */
export function chuanHoaEdl(tho, thoiLuong, style) {
  const so = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : parseFloat(x));
  const trongKhoang = (t) => Number.isFinite(t) && t >= 0 && t <= thoiLuong;

  const zoomGiay = (Array.isArray(tho.zoom_giay) ? tho.zoom_giay : [])
    .map(so).filter(trongKhoang).slice(0, 150);
  const tuKhoa = (Array.isArray(tho.tu_khoa) ? tho.tu_khoa : [])
    .map((t) => ({ giay: so(t.giay), chu: String(t.chu || '').trim() }))
    .filter((t) => trongKhoang(t.giay) && t.chu && t.chu.length <= 30)
    .slice(0, 60);
  const chuong = (Array.isArray(tho.chuong) ? tho.chuong : [])
    .map((c) => ({ giay: so(c.giay), ten: String(c.ten || '').trim() }))
    .filter((c) => trongKhoang(c.giay) && c.ten)
    .slice(0, 20);

  return {
    nguon: 'claude',
    tieuDe: (Array.isArray(tho.tieu_de) ? tho.tieu_de : [tho.tieu_de]).filter(Boolean).map(String).slice(0, 3),
    moTa: String(tho.mo_ta || ''),
    tags: (Array.isArray(tho.tags) ? tho.tags : []).map(String).slice(0, 15),
    zoomGiay: style.zoom?.batTat ? zoomGiay : [],
    tuKhoa: style.tuKhoa ? tuKhoa : [],
    chuong,
  };
}

/** Ghép tệp mô tả SEO (markdown) từ EDL + thông tin người dùng. */
export function ghepMoTaSeo(edl, { tieuDe = '', tenKenh = '' } = {}) {
  const dong = ['# Gói SEO cho video', ''];
  const tatCaTieuDe = [...new Set([tieuDe, ...edl.tieuDe].filter(Boolean))];
  if (tatCaTieuDe.length) {
    dong.push('## Phương án tiêu đề');
    tatCaTieuDe.forEach((t, i) => dong.push(`${i + 1}. ${t}`));
    dong.push('');
  }
  if (edl.moTa) {
    dong.push('## Mô tả', edl.moTa, '');
  }
  if (edl.chuong.length) {
    dong.push('## Chapters (dán vào mô tả YouTube)');
    for (const c of edl.chuong) {
      const phut = Math.floor(c.giay / 60);
      const giay = Math.floor(c.giay % 60);
      dong.push(`${String(phut).padStart(2, '0')}:${String(giay).padStart(2, '0')} ${c.ten}`);
    }
    dong.push('');
  }
  if (edl.tags.length) {
    dong.push('## Tags', edl.tags.join(', '), '');
  }
  if (tenKenh) dong.push(`— Kênh: ${tenKenh}`);
  return dong.join('\n');
}
