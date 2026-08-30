import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  locDongTac, xayDoLocPass2V2, xayLocAmThanh, taoSuKienSfx,
  canhDuPhong, chuanHoaCanh, suKienChuongDong, suKienProgressBar,
  suKienCounter, suKienCta, CAC_DONG_TAC,
} from '../loi/dong-tac.js';
import { chuoiMau, taoAssPhuDe, tapTuNoiBat, kichThuocKhung } from '../loi/core.js';

const KICH = { rong: 1080, cao: 1920 };

// ── Động tác camera ────────────────────────────────────────────────────
test('locDongTac sinh filter cho mọi động tác, tinh trả null', () => {
  for (const dt of CAC_DONG_TAC) {
    const loc = locDongTac(dt, { daiGiay: 4, cuongDo: 0.7, ...KICH });
    if (dt === 'tinh') assert.equal(loc, null);
    else assert.ok(loc.length > 10, dt + ' phải có filter');
  }
  assert.ok(locDongTac('push-in', { daiGiay: 4, ...KICH }).includes('zoompan'));
  assert.ok(locDongTac('punch-in', { daiGiay: 2, ...KICH }).includes('crop=1080:1920'));
  assert.ok(locDongTac('pan-trai', { daiGiay: 3, ...KICH }).includes("x='(iw-iw/zoom)*(1-on/"));
});

test('canhDuPhong phủ kín thời lượng và xoay vòng động tác cho phép', () => {
  const canh = canhDuPhong(30, { matDo: 'vua', dongTacChoPhep: ['push-in', 'punch-in'] });
  assert.ok(Math.abs(canh[0].batDau) < 1e-9);
  assert.ok(Math.abs(canh[canh.length - 1].ketThuc - 30) < 1e-9);
  for (let i = 1; i < canh.length; i++) {
    assert.ok(Math.abs(canh[i].batDau - canh[i - 1].ketThuc) < 1e-9);
  }
  assert.ok(canh.every((c) => ['push-in', 'punch-in'].includes(c.dongTac)));
});

test('canhDuPhong ưu tiên ranh giới câu nói khi có mốc', () => {
  const canh = canhDuPhong(20, { moc: [4.5, 9.2, 15.1] });
  assert.deepEqual(canh.map((c) => c.ketThuc.toFixed(1)), ['4.5', '9.2', '15.1', '20.0']);
});

test('chuanHoaCanh vá kín khoảng trống và ép động tác lạ về tinh', () => {
  const { canh, anh, suaChu, soDem } = chuanHoaCanh({
    canh: [
      { batDau: 2, ketThuc: 6, dongTac: 'punch-in' },
      { batDau: 8, ketThuc: 12, dongTac: 'bay-luon' }, // động tác không tồn tại → loại
    ],
    anh: [{ giay: 3, tep: 'x.jpg', kieu: 'pop' }, { giay: 99, tep: 'y.jpg' }],
    sua_chu: [{ sai: 'sường', dung: 'Xưởng' }],
    so_dem: [{ giay: 5, tu: 0, den: 347, hau_to: '%' }],
  }, 20, {});
  assert.ok(Math.abs(canh[0].batDau) < 1e-9, 'phải vá từ 0');
  assert.ok(Math.abs(canh[canh.length - 1].ketThuc - 20) < 1e-9, 'phải vá tới hết');
  assert.equal(anh.length, 1, 'ảnh ngoài thời lượng bị loại');
  assert.equal(suaChu.length, 1);
  assert.equal(soDem[0].den, 347);
});

test('chuanHoaCanh giới hạn động tác theo danh sách cho phép của style', () => {
  const { canh } = chuanHoaCanh({
    canh: [{ batDau: 0, ketThuc: 10, dongTac: 'rung' }],
  }, 10, { dongTacChoPhep: ['push-in', 'tinh'] });
  assert.equal(canh[0].dongTac, 'tinh');
});

// ── Filtergraph pass 2 v2 ─────────────────────────────────────────────
test('xayDoLocPass2V2 ghép cảnh + flash + ảnh overlay + ass', () => {
  const canh = [
    { batDau: 0, ketThuc: 4, dongTac: 'push-in', cuongDo: 0.7 },
    { batDau: 4, ketThuc: 8, dongTac: 'tinh' },
  ];
  const { filterComplex, mapVideo } = xayDoLocPass2V2({
    thoiLuong: 8, canh, kichThuoc: KICH, mauSac: 'am', chuoiMauFn: chuoiMau,
    flashGiay: [4], anh: [{ giay: 2, kieu: 'pop', dai: 3 }],
    tepPhuDe: 'phu-de.ass', tepDoHoa: 'do-hoa.ass',
  });
  assert.ok(filterComplex.includes('zoompan'));
  assert.ok(filterComplex.includes('concat=n=2'));
  assert.ok(filterComplex.includes("eq=brightness=0.28:enable='between(t,4.000,4.120)'"));
  assert.ok(filterComplex.includes('overlay'));
  assert.ok(filterComplex.includes('[1:v]'), 'ảnh là input 1');
  assert.ok(filterComplex.includes('ass=phu-de.ass'));
  assert.equal(mapVideo, '[vout]');
});

test('xayDoLocPass2V2 toàn cảnh tinh → passthrough không concat', () => {
  const { filterComplex } = xayDoLocPass2V2({
    thoiLuong: 8, canh: [{ batDau: 0, ketThuc: 8, dongTac: 'tinh' }],
    kichThuoc: KICH, tepDoHoa: 'do-hoa.ass',
  });
  assert.ok(filterComplex.includes('[0:v]null[vz]'));
});

// ── Âm thanh ───────────────────────────────────────────────────────────
test('taoSuKienSfx gắn đúng tệp theo loại sự kiện và chống dội', () => {
  const suKien = taoSuKienSfx({
    canh: [{ batDau: 1, dongTac: 'punch-in' }, { batDau: 1.1, dongTac: 'rung' }],
    tuKhoa: [{ giay: 5 }], chuong: [{ giay: 10 }], anh: [{ giay: 15 }],
  });
  assert.equal(suKien[0].sfx, 'whoosh');
  assert.ok(!suKien.some((s, i) => i > 0 && s.giay - suKien[i - 1].giay < 0.35), 'không có 2 SFX sát nhau');
  assert.ok(suKien.some((s) => s.sfx === 'ding'));
  assert.equal(taoSuKienSfx({ tuKhoa: [{ giay: 1 }] }, { batSfx: false }).length, 0);
});

test('xayLocAmThanh trộn SFX + nhạc ducking + loudnorm -14', () => {
  const kq = xayLocAmThanh({
    suKien: [{ giay: 2.5, sfx: 'pop' }], viTriSfx: { pop: 3 }, viTriNhac: 4, thoiLuong: 30,
  });
  assert.ok(kq.filterAudio.includes('adelay=2500|2500'));
  assert.ok(kq.filterAudio.includes('sidechaincompress'));
  assert.ok(kq.filterAudio.includes('loudnorm=I=-14'));
  assert.equal(kq.mapAudio, '[aout]');
  assert.equal(xayLocAmThanh({ suKien: [], viTriSfx: {}, viTriNhac: null, thoiLuong: 30 }), null);
});

// ── Đồ hoạ động ────────────────────────────────────────────────────────
test('suKienChuongDong dùng \\move, progress bar dùng \\p1 + \\t', () => {
  const chuong = suKienChuongDong([{ giay: 5, ten: 'Phần 2' }], { ...KICH, thoiLuong: 30 });
  assert.ok(chuong[0].includes('\\move('));
  const bar = suKienProgressBar({ ...KICH, thoiLuong: 30 });
  assert.ok(bar[0].includes('\\p1'));
  assert.ok(bar[0].includes('\\t(0,30000,\\fscx100)'));
});

test('suKienCounter sinh chuỗi giá trị tăng dần, suKienCta cần tên kênh', () => {
  const dem = suKienCounter([{ giay: 3, tu: 0, den: 100, hauTo: '%' }], { thoiLuong: 30 });
  assert.ok(dem.length > 10);
  assert.ok(dem[0].includes(',0%'));
  assert.ok(dem[dem.length - 1].includes('100%'));
  assert.equal(suKienCta('', { thoiLuong: 30 }).length, 0);
  assert.ok(suKienCta('@kenh', { thoiLuong: 30 })[0].includes('Theo dõi @kenh'));
});

// ── Phụ đề pro ─────────────────────────────────────────────────────────
test('taoAssPhuDe tô nổi từ khoá trong dòng karaoke', () => {
  const transcript = { doan: [{ batDau: 0, ketThuc: 2, chu: 'tự động hóa rất hay', tu: [
    { batDau: 0, ketThuc: 0.5, chu: 'tự' }, { batDau: 0.5, ketThuc: 1, chu: 'động' },
    { batDau: 1, ketThuc: 1.5, chu: 'hóa' }, { batDau: 1.5, ketThuc: 2, chu: 'rất' },
  ] }] };
  const ass = taoAssPhuDe(transcript, {
    ...KICH, cheDo: 'tu', tuKhoaNoiBat: tapTuNoiBat([{ chu: 'tự động' }]),
  });
  assert.ok(ass.includes('{\\1c&H000A7CFF&}TỰ'), 'từ khoá phải đổi màu');
  assert.ok(ass.includes('RẤT'), 'từ thường vẫn in hoa bình thường');
});

test('taoAssPhuDe chế độ dòng nền sáng → chữ tối viền trắng', () => {
  const transcript = { doan: [{ batDau: 0, ketThuc: 2, chu: 'xin chào' }] };
  const ass = taoAssPhuDe(transcript, { rong: 1920, cao: 1080, cheDo: 'dong', nenSang: true });
  assert.ok(ass.includes('&H00151515,&H00151515,&H00FFFFFF'));
});

test('kichThuocKhung vuong trả 1080×1080', () => {
  assert.deepEqual(kichThuocKhung('vuong'), { rong: 1080, cao: 1080 });
});
