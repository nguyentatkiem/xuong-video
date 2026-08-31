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
const { lamSachTranscript, nguongImLang, chonKhungXuat, vungNoiTuImLang, tinhKhoangTrong, gopTranscript, locKhucBu, chuanHoaRamp, taoAnhXaThoiGian, doiThoiGianTranscript, phanTichDungHinh, locImLangTheoDongCu, phanTichDoiCanh, taoAnhXaCat } = await import('../loi/core.js');

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

test('vungNoiTuImLang lấy phần bù khoảng lặng và gộp kẽ hở nhỏ', () => {
  const vung = vungNoiTuImLang([
    { batDau: 0, ketThuc: 8.1 }, { batDau: 15.2, ketThuc: 28.3 },
  ], 31);
  assert.equal(vung.length, 2);
  assert.ok(Math.abs(vung[0].batDau - 8.1) < 1e-9);
  assert.ok(Math.abs(vung[0].ketThuc - 15.2) < 1e-9);
  assert.ok(Math.abs(vung[1].batDau - 28.3) < 1e-9);
});

test('lamSachTranscript neo cụm suy biến vào vùng có tiếng nói thay vì dàn mù', () => {
  // 14 từ bị whisper nhồi vào 30.0–31.0; tiếng nói thật ở 28.3–31.0
  const tu = Array.from({ length: 14 }, (_, i) => ({ batDau: 30 + i * 0.06, ketThuc: 30 + i * 0.06 + 0.02, chu: 'w' + i }));
  const vungNoi = [{ batDau: 8.1, ketThuc: 15.2 }, { batDau: 28.3, ketThuc: 31 }];
  const kq = lamSachTranscript({ doan: [{ batDau: 30, ketThuc: 31, chu: 'x', tu }] }, 31, { vungNoi });
  const d = kq.doan[0];
  assert.ok(d.batDau >= 28.2, 'phải bắt đầu trong vùng nói (28.3+), không trôi về 25s: ' + d.batDau);
  assert.ok(d.ketThuc <= 31.01, 'không vượt cuối video');
  const buoc = (d.tu[1].batDau - d.tu[0].batDau);
  assert.ok(buoc >= 0.15 && buoc <= 0.25, 'nói nhanh thật → nén nhịp theo vùng: ' + buoc);
});

test('lamSachTranscript không có vungNoi vẫn dàn lùi như cũ', () => {
  const tu = Array.from({ length: 10 }, (_, i) => ({ batDau: 30 + i * 0.05, ketThuc: 30 + i * 0.05 + 0.02, chu: 't' + i }));
  const kq = lamSachTranscript({ doan: [{ batDau: 30, ketThuc: 31, chu: 'x', tu }] }, 31);
  assert.ok(kq.doan[0].batDau < 28);
});

test('tinhKhoangTrong tìm đoạn whisper nuốt và loại đoạn mốc rác', () => {
  const { giu, khoangTrong } = tinhKhoangTrong({ doan: [
    { batDau: 8.2, ketThuc: 28.3, chu: 'chào', tu: [
      { batDau: 8.2, ketThuc: 9.6, chu: 'Xin' }, { batDau: 14.6, ketThuc: 15.2, chu: 'học' }] },
    { batDau: 30, ketThuc: 31, chu: 'x', tu: Array.from({ length: 14 }, (_, i) => ({ batDau: 30 + i * 0.06, ketThuc: 30.06 + i * 0.06, chu: 'w' + i })) },
  ] }, 31);
  assert.equal(giu.length, 1, 'đoạn mốc rác 14 từ/1s phải bị loại');
  // trống: 0–8.2 (đầu) và 15.6–31 (giữa+cuối, gồm cả vùng đoạn rác)
  assert.equal(khoangTrong.length, 2);
  assert.ok(khoangTrong[0].ketThuc <= 8.3);
  assert.ok(khoangTrong[1].batDau < 16 && khoangTrong[1].ketThuc === 31);
});

test('gopTranscript trộn các khúc bù theo thời gian', () => {
  const kq = gopTranscript({ doan: [{ batDau: 8, ketThuc: 12, chu: 'a' }] }, [
    { batDau: 16, ketThuc: 19, chu: 'c' }, { batDau: 13, ketThuc: 15, chu: 'b' },
  ]);
  assert.deepEqual(kq.doan.map((d) => d.chu), ['a', 'b', 'c']);
});

test('locKhucBu bỏ ảo giác lặp câu đã có và 1-từ cực ngắn, giữ câu thật', () => {
  const goc = [{ batDau: 8.2, ketThuc: 15, chu: 'Xin chào tất cả thành viên lớp học' }];
  const bu = locKhucBu(goc, [
    { batDau: 0, ketThuc: 2.5, chu: 'Xin chào tất cả thành viên lớp học' }, // lặp → bỏ
    { batDau: 2.6, ketThuc: 3.1, chu: 'Branding' },                          // 1 từ 0.5s → bỏ
    { batDau: 22.1, ketThuc: 24.9, chu: 'Điều thứ hai, xây dựng hệ thống nội dung' }, // thật → giữ
    { batDau: 30.1, ketThuc: 30.9, chu: 'bạn nhé' },                          // 2 từ → giữ
  ]);
  assert.deepEqual(bu.map((d) => d.chu), ['Điều thứ hai, xây dựng hệ thống nội dung', 'bạn nhé']);
});

test('chuanHoaRamp kẹp tốc độ, loại chồng lấn/quá ngắn, tối đa 4', () => {
  const ds = chuanHoaRamp([
    { batDau: 2, ketThuc: 6, tocDo: 1.4 },
    { batDau: 5, ketThuc: 9, tocDo: 1.3 },   // chồng lấn → loại
    { batDau: 10, ketThuc: 10.8, tocDo: 2 }, // <1.5s → loại
    { batDau: 12, ketThuc: 15, tocDo: 5 },   // kẹp về 2
    { batDau: 16, ketThuc: 19, tocDo: 0.98 },// ~1 → loại
  ], 30);
  assert.equal(ds.length, 2);
  assert.equal(ds[1].tocDo, 2);
});

test('taoAnhXaThoiGian đổi mốc đúng và tính thời lượng mới', () => {
  const ramp = chuanHoaRamp([{ batDau: 10, ketThuc: 20, tocDo: 2 }], 30);
  const { doiT, thoiLuongMoi, doan } = taoAnhXaThoiGian(ramp, 30);
  assert.equal(thoiLuongMoi, 25);            // 10 + 10/2 + 10
  assert.equal(doiT(5), 5);                  // trước ramp giữ nguyên
  assert.equal(doiT(15), 12.5);              // giữa ramp co lại
  assert.equal(doiT(25), 20);                // sau ramp dịch về trước 5s
  assert.equal(doan.length, 3);
  assert.ok(Math.abs(doan[2].moiKetThuc - 25) < 1e-9);
});

test('xayDoLocPass1 với ramp có split + atempo + minterpolate khi cham', () => {
  const ramp = taoAnhXaThoiGian(chuanHoaRamp([{ batDau: 2, ketThuc: 5, tocDo: 0.6, cham: true }], 10), 10).doan;
  const { filterComplex } = xayDoLocPass1({ doanGiu: [{ batDau: 0, ketThuc: 10 }], khung: 'ngang', ramp });
  assert.ok(filterComplex.includes('atempo=0.6000'));
  assert.ok(filterComplex.includes('minterpolate'));
  assert.ok(filterComplex.includes('split='));
});

test('doiThoiGianTranscript áp ánh xạ vào đoạn và từng từ', () => {
  const { doiT } = taoAnhXaThoiGian(chuanHoaRamp([{ batDau: 0, ketThuc: 10, tocDo: 2 }], 20), 20);
  const kq = doiThoiGianTranscript({ doan: [{ batDau: 4, ketThuc: 12, chu: 'a', tu: [{ batDau: 4, ketThuc: 6, chu: 'a' }] }] }, doiT);
  assert.equal(kq.doan[0].batDau, 2);
  assert.equal(kq.doan[0].ketThuc, 7);
  assert.equal(kq.doan[0].tu[0].ketThuc, 3);
});

test('phanTichDungHinh + locImLangTheoDongCu: im lặng có cử động thì giữ', () => {
  const dung = phanTichDungHinh('lavfi.freezedetect.freeze_start: 5.0\nlavfi.freezedetect.freeze_end: 9.0\n', 30);
  assert.deepEqual(dung, [{ batDau: 5, ketThuc: 9 }]);
  const cat = locImLangTheoDongCu([
    { batDau: 5.5, ketThuc: 8.5 },   // nằm trọn trong đứng hình → cắt
    { batDau: 15, ketThuc: 18 },     // im lặng nhưng hình đang động → giữ
  ], dung);
  assert.equal(cat.length, 1);
  assert.equal(cat[0].batDau, 5.5);
});

test('phanTichDoiCanh + taoAnhXaCat: mốc gốc ánh xạ sang timeline đã cắt', () => {
  const moc = phanTichDoiCanh('n:1 pts_time:4.2 x\nn:2 pts_time:12.0 x\nn:3 pts_time:12.0 x');
  assert.deepEqual(moc, [4.2, 12]);
  const anhXa = taoAnhXaCat([{ batDau: 0, ketThuc: 5 }, { batDau: 10, ketThuc: 20 }]);
  assert.equal(anhXa(4.2), 4.2);
  assert.equal(anhXa(7), null);        // mốc rơi vào đoạn bị cắt
  assert.equal(anhXa(12), 7);          // 5 + (12-10)
});
