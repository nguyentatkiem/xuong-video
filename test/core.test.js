import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  s3, kichThuocKhung, phanTichImLang, tinhDoanGiu, xayDoLocPass1,
  chiaDoanZoom, xayDoLocPass2, giaySangAss, giaySangSrt, escapeAss, beDong,
  taoAssPhuDe, taoAssDoHoa, taoSrt, edlDuPhong, trichJson, chuanHoaEdl, ghepMoTaSeo,
} from '../loi/core.js';

// ── Khoảng lặng ────────────────────────────────────────────────────────
test('phanTichImLang đọc đúng cặp start/end từ stderr ffmpeg', () => {
  const stderr = `
[silencedetect @ 0x600] silence_start: 5.01769
[silencedetect @ 0x600] silence_end: 7.99332 | silence_duration: 2.97562
[silencedetect @ 0x600] silence_start: 13.02
[silencedetect @ 0x600] silence_end: 15.9 | silence_duration: 2.88
`;
  const kq = phanTichImLang(stderr, 24);
  assert.equal(kq.length, 2);
  assert.ok(Math.abs(kq[0].batDau - 5.01769) < 1e-6);
  assert.ok(Math.abs(kq[1].ketThuc - 15.9) < 1e-6);
});

test('phanTichImLang: khoảng lặng cuối không có silence_end → kéo tới hết video', () => {
  const kq = phanTichImLang('silence_start: 20.5\n', 24);
  assert.equal(kq.length, 1);
  assert.equal(kq[0].ketThuc, 24);
});

test('tinhDoanGiu chừa đệm hai đầu và tính đúng tổng thời gian cắt', () => {
  const { doanGiu, tongCat } = tinhDoanGiu(
    [{ batDau: 2, ketThuc: 5 }], 10, { dem: 0.2, imToiThieu: 0.4 });
  assert.equal(doanGiu.length, 2);
  assert.ok(Math.abs(doanGiu[0].ketThuc - 2.2) < 1e-9);
  assert.ok(Math.abs(doanGiu[1].batDau - 4.8) < 1e-9);
  assert.ok(Math.abs(tongCat - 2.6) < 1e-9);
});

test('tinhDoanGiu bỏ qua khoảng lặng quá ngắn sau khi trừ đệm', () => {
  const { doanGiu, tongCat } = tinhDoanGiu(
    [{ batDau: 2, ketThuc: 2.5 }], 10, { dem: 0.2, imToiThieu: 0.4 });
  assert.equal(doanGiu.length, 1);
  assert.equal(tongCat, 0);
});

test('tinhDoanGiu: không có khoảng lặng → giữ nguyên toàn bộ', () => {
  const { doanGiu } = tinhDoanGiu([], 30, {});
  assert.deepEqual(doanGiu, [{ batDau: 0, ketThuc: 30 }]);
});

// ── Filtergraph lượt 1 ────────────────────────────────────────────────
test('xayDoLocPass1 ghép trim/concat + loudnorm, n=1 vẫn hợp lệ', () => {
  const { filterComplex, mapVideo, mapAudio } = xayDoLocPass1({
    doanGiu: [{ batDau: 0, ketThuc: 24 }], khung: 'ngang',
  });
  assert.ok(filterComplex.includes('concat=n=1:v=1:a=1'));
  assert.ok(filterComplex.includes('loudnorm'));
  assert.ok(filterComplex.includes('scale=1920:1080'));
  assert.equal(mapVideo, '[vout]');
  assert.equal(mapAudio, '[aout]');
});

test('xayDoLocPass1 khung doc-blur có nền mờ boxblur + overlay', () => {
  const { filterComplex } = xayDoLocPass1({
    doanGiu: [{ batDau: 0, ketThuc: 5 }, { batDau: 8, ketThuc: 12 }], khung: 'doc-blur',
  });
  assert.ok(filterComplex.includes('concat=n=2'));
  assert.ok(filterComplex.includes('boxblur'));
  assert.ok(filterComplex.includes('overlay=(W-w)/2:(H-h)/2'));
});

// ── Zoom ───────────────────────────────────────────────────────────────
test('chiaDoanZoom phủ kín thời lượng, liên tục, gộp điểm quá sát', () => {
  const doan = chiaDoanZoom(20, [5, 6, 12], { daiZoom: 3, cachToiThieu: 1.2 });
  assert.ok(Math.abs(doan[0].batDau) < 1e-9);
  assert.ok(Math.abs(doan[doan.length - 1].ketThuc - 20) < 1e-9);
  for (let i = 1; i < doan.length; i++) {
    assert.ok(Math.abs(doan[i].batDau - doan[i - 1].ketThuc) < 1e-9, 'các đoạn phải liền mạch');
  }
  // điểm 6 quá sát đoạn zoom [5..6] nên bị bỏ
  assert.deepEqual(doan.map((d) => d.zoom), [false, true, false, true, false]);
});

test('chiaDoanZoom không có điểm nào → một đoạn không zoom', () => {
  assert.deepEqual(chiaDoanZoom(10, []), [{ batDau: 0, ketThuc: 10, zoom: false }]);
});

test('xayDoLocPass2 có zoom → concat các đoạn; không zoom → null passthrough', () => {
  const kich = kichThuocKhung('doc-crop');
  const co = xayDoLocPass2({
    thoiLuong: 20, doanZoom: chiaDoanZoom(20, [5]), kichThuoc: kich, tepDoHoa: 'do-hoa.ass',
  });
  assert.ok(co.filterComplex.includes('concat=n='));
  assert.ok(co.filterComplex.includes('crop=1080:1920'));
  assert.ok(co.filterComplex.includes('ass=do-hoa.ass'));
  assert.ok(co.filterComplex.includes('fade=t=out'));

  const khong = xayDoLocPass2({
    thoiLuong: 20, doanZoom: chiaDoanZoom(20, []), kichThuoc: kich, fade: false,
  });
  assert.ok(khong.filterComplex.includes('[0:v]null[vz]'));
});

// ── Thời gian + escape ─────────────────────────────────────────────────
test('giaySangAss và giaySangSrt định dạng đúng', () => {
  assert.equal(giaySangAss(3.25), '0:00:03.25');
  assert.equal(giaySangAss(3661.5), '1:01:01.50');
  assert.equal(giaySangSrt(3.256), '00:00:03,256');
  assert.equal(giaySangSrt(0), '00:00:00,000');
});

test('escapeAss vô hiệu hoá ngoặc nhọn và xuống dòng', () => {
  assert.equal(escapeAss('{\\b1}xin chào\nbạn'), '(\\\\b1)xin chào\\Nbạn');
});

test('beDong bẻ câu dài thành 2 dòng tại khoảng trắng gần giữa', () => {
  const kq = beDong('một câu tương đối dài cần bẻ đôi', 20);
  assert.ok(kq.includes('\n'));
  assert.equal(kq.replace('\n', ' '), 'một câu tương đối dài cần bẻ đôi');
});

// ── ASS + SRT ──────────────────────────────────────────────────────────
const transcriptMau = {
  doan: [
    { batDau: 0.5, ketThuc: 2.5, chu: 'Xin chào các bạn', tu: [
      { batDau: 0.5, ketThuc: 1.0, chu: 'Xin' },
      { batDau: 1.0, ketThuc: 1.5, chu: 'chào' },
      { batDau: 1.5, ketThuc: 2.0, chu: 'các' },
      { batDau: 2.0, ketThuc: 2.5, chu: 'bạn' },
    ]},
    { batDau: 3.0, ketThuc: 5.0, chu: 'Hôm nay nói về thuốc bổ' },
  ],
};

test('taoAssPhuDe chế độ từng-từ dùng thẻ karaoke \\k và IN HOA', () => {
  const ass = taoAssPhuDe(transcriptMau, { rong: 1080, cao: 1920, cheDo: 'tu' });
  assert.ok(ass.includes('PlayResX: 1080'));
  assert.ok(ass.includes('{\\k50}XIN'));
  assert.ok(ass.includes('Dialogue:'));
});

test('taoAssPhuDe chế độ dòng: mỗi đoạn một Dialogue', () => {
  const ass = taoAssPhuDe(transcriptMau, { rong: 1920, cao: 1080, cheDo: 'dong' });
  assert.equal((ass.match(/^Dialogue:/gm) || []).length, 2);
});

test('taoAssDoHoa gồm tiêu đề, từ khoá IN HOA, chương và watermark kênh', () => {
  const ass = taoAssDoHoa({
    rong: 1920, cao: 1080, thoiLuong: 60,
    tieuDe: 'Video thử', tenKenh: '@kenh',
    tuKhoa: [{ giay: 10, chu: 'quan trọng' }],
    chuong: [{ giay: 20, ten: 'Phần 2' }],
  });
  assert.ok(ass.includes('Video thử'));
  assert.ok(ass.includes('QUAN TRỌNG'));
  assert.ok(ass.includes('Phần 2'));
  assert.ok(ass.includes('@kenh'));
});

test('taoSrt đánh số và dùng mũi tên chuẩn SRT', () => {
  const srt = taoSrt(transcriptMau);
  assert.ok(srt.startsWith('1\n00:00:00,500 --> 00:00:02,500'));
  assert.ok(srt.includes('\n2\n'));
});

// ── EDL ────────────────────────────────────────────────────────────────
test('edlDuPhong rải zoom theo mật độ style', () => {
  const edl = edlDuPhong(30, { zoom: { batTat: true, matDo: 'day' } });
  assert.equal(edl.zoomGiay.length, 6); // 2.5, 7.5, ..., 27.5
  assert.equal(edlDuPhong(30, { zoom: { batTat: false } }).zoomGiay.length, 0);
});

test('trichJson chịu được ```json```, chữ thừa quanh JSON, và trả null khi hỏng', () => {
  assert.deepEqual(trichJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(trichJson('Đây là kết quả: {"b":[1,2]} — hết.'), { b: [1, 2] });
  assert.equal(trichJson('không có json nào'), null);
  assert.equal(trichJson(''), null);
});

test('chuanHoaEdl kẹp mốc thời gian trong video và tôn trọng công tắc style', () => {
  const style = { zoom: { batTat: true }, tuKhoa: true };
  const edl = chuanHoaEdl({
    tieu_de: ['A', 'B', 'C', 'D'],
    zoom_giay: [5, 99, -1, '12.5'],
    tu_khoa: [{ giay: 10, chu: 'ok' }, { giay: 200, chu: 'ngoài video' }, { giay: 3, chu: '' }],
    chuong: [{ giay: 0, ten: 'Mở đầu' }],
  }, 60, style);
  assert.deepEqual(edl.zoomGiay, [5, 12.5]);
  assert.equal(edl.tuKhoa.length, 1);
  assert.equal(edl.tieuDe.length, 3);
  assert.equal(edl.nguon, 'claude');

  const tatHet = chuanHoaEdl({ zoom_giay: [5], tu_khoa: [{ giay: 1, chu: 'x' }] }, 60,
    { zoom: { batTat: false }, tuKhoa: false });
  assert.equal(tatHet.zoomGiay.length, 0);
  assert.equal(tatHet.tuKhoa.length, 0);
});

test('ghepMoTaSeo ghi chapters dạng mm:ss', () => {
  const md = ghepMoTaSeo({
    tieuDe: ['Tiêu đề hay'], moTa: 'Mô tả.', tags: ['a', 'b'],
    chuong: [{ giay: 75, ten: 'Phần 2' }], zoomGiay: [], tuKhoa: [],
  }, { tieuDe: 'Của người dùng', tenKenh: '@kenh' });
  assert.ok(md.includes('1. Của người dùng'));
  assert.ok(md.includes('01:15 Phần 2'));
  assert.ok(md.includes('a, b'));
  assert.ok(md.includes('@kenh'));
});

// ── Linh tinh ──────────────────────────────────────────────────────────
test('s3 và kichThuocKhung', () => {
  assert.equal(s3(1.23456), '1.235');
  assert.deepEqual(kichThuocKhung('doc-crop'), { rong: 1080, cao: 1920 });
  assert.deepEqual(kichThuocKhung('ngang'), { rong: 1920, cao: 1080 });
});

// ── Vá lỗi từ video thật (31/08) ──────────────────────────────────────
const { lamSachTranscript, nguongImLang, chonKhungXuat } = await import('../loi/core.js');

test('lamSachTranscript tách đoạn kéo lê qua quãng nhạc, kể cả khi whisper kéo giãn mốc cuối của từ', () => {
  // dữ liệu thật từ video LalaSchool: từ "viên" và "học" bị whisper kéo end qua quãng nhạc
  const kq = lamSachTranscript({ doan: [{
    batDau: 8.2, ketThuc: 28.3, chu: 'Xin chào tất cả thành viên lớp học',
    tu: [
      { batDau: 8.2, ketThuc: 9.6, chu: 'Xin' }, { batDau: 9.6, ketThuc: 9.8, chu: 'chào' },
      { batDau: 9.8, ketThuc: 10.2, chu: 'tất' }, { batDau: 10.2, ketThuc: 10.8, chu: 'cả' },
      { batDau: 10.8, ketThuc: 10.9, chu: 'thành' }, { batDau: 10.9, ketThuc: 13.8, chu: 'viên' },
      { batDau: 13.8, ketThuc: 14.6, chu: 'lớp' }, { batDau: 14.6, ketThuc: 28.26, chu: 'học' },
    ],
  }] }, 31);
  assert.equal(kq.doan.length, 2, 'phải tách thành 2 đoạn tại khoảng nghỉ sau "viên"');
  assert.ok(kq.doan[0].ketThuc < 13, 'đoạn 1 phải kết thúc khi lời dứt, không kéo tới 28s');
  assert.equal(kq.doan[1].chu, 'lớp học');
  assert.ok(kq.doan[1].ketThuc < 16.5, 'từ "học" bị kẹp còn tối đa 1 giây');
});

test('lamSachTranscript dàn đều cụm từ bị nhồi vào <1 giây', () => {
  const tu = Array.from({ length: 10 }, (_, i) => ({ batDau: 30 + i * 0.05, ketThuc: 30 + i * 0.05 + 0.02, chu: 'tu' + i }));
  const kq = lamSachTranscript({ doan: [{ batDau: 30, ketThuc: 31, chu: 'x', tu }] }, 31);
  const d = kq.doan[0];
  assert.ok(d.batDau < 28, 'phải dàn lùi về trước vì 10 từ không thể nói trong 1 giây');
  const daiTrungBinh = (d.tu[d.tu.length - 1].ketThuc - d.tu[0].batDau) / d.tu.length;
  assert.ok(daiTrungBinh > 0.25, 'mỗi từ phải có thời lượng tự nhiên');
});

test('lamSachTranscript không cho đoạn sau chồng lên đoạn trước', () => {
  const kq = lamSachTranscript({ doan: [
    { batDau: 5, ketThuc: 9, chu: 'a', tu: [{ batDau: 5, ketThuc: 9, chu: 'a' }] },
    { batDau: 9.2, ketThuc: 10, chu: 'b c d e f g h i j k l m n o',
      tu: Array.from({ length: 14 }, (_, i) => ({ batDau: 9.2, ketThuc: 9.25, chu: 'w' + i })) },
  ] }, 10);
  for (let i = 1; i < kq.doan.length; i++) {
    assert.ok(kq.doan[i].batDau >= kq.doan[i - 1].ketThuc - 0.01, 'không chồng lấn');
  }
});

test('nguongImLang thích ứng theo âm lượng và kẹp trong [-60,-20]', () => {
  assert.equal(nguongImLang(-18.6, 'manh'), '-25.6dB'); // video ồn → ngưỡng cao hơn -33 cũ
  assert.equal(nguongImLang(-50, 'nhe'), '-60.0dB');
  assert.equal(nguongImLang(-5, 'manh'), '-20.0dB');
});

test('chonKhungXuat: video dọc không bao giờ bị ép sang ngang khi auto', () => {
  assert.equal(chonKhungXuat({ khung: 'ngang' }, true, 'auto'), 'doc-crop');
  assert.equal(chonKhungXuat({ khung: 'ngang' }, false, 'auto'), 'ngang');
  assert.equal(chonKhungXuat({ khung: 'doc-blur' }, false, 'auto'), 'doc-blur');
  assert.equal(chonKhungXuat({ khung: 'ngang' }, true, 'vuong'), 'vuong');
});
