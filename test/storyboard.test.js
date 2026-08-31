import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DS_MODULE, KHONG_GIAN, taoCaption, tinhDoanKhung, khungTheDuPhong,
  chuanHoaDoHoa, timLoiBoCuc, goPhanTuLoi, suKienSfxV3, cssSkin, tenKhongGian, timPhach, nepTheoPhach,
} from '../loi/storyboard.js';

const transcript = { doan: [{
  batDau: 0.5, ketThuc: 4.2, chu: 'Xin chào các bạn hôm nay học tự động hóa nhé',
  tu: [
    { batDau: 0.5, ketThuc: 0.8, chu: 'Xin' }, { batDau: 0.8, ketThuc: 1.1, chu: 'chào' },
    { batDau: 1.1, ketThuc: 1.4, chu: 'các' }, { batDau: 1.4, ketThuc: 1.7, chu: 'bạn' },
    { batDau: 1.7, ketThuc: 2.0, chu: 'hôm' }, { batDau: 2.0, ketThuc: 2.3, chu: 'nay' },
    { batDau: 2.3, ketThuc: 2.7, chu: 'học' }, { batDau: 2.7, ketThuc: 3.1, chu: 'tự' },
    { batDau: 3.1, ketThuc: 3.5, chu: 'động' }, { batDau: 3.5, ketThuc: 3.9, chu: 'hóa' },
    { batDau: 3.9, ketThuc: 4.2, chu: 'nhé' },
  ],
}] };

test('taoCaption chia dòng 3–6 từ theo nhịp, bôi vàng tối đa một cụm mỗi dòng', () => {
  const caps = taoCaption(transcript, { tuKhoa: [{ chu: 'tự động' }] });
  assert.ok(caps.length >= 2, 'câu 11 từ phải chia ít nhất 2 dòng');
  for (const c of caps) {
    const soTu = c.text.replace(/\|/g, '').split(' ').length;
    assert.ok(soTu <= 6, 'không dòng nào quá 6 từ');
    assert.ok(((c.text.match(/\|/g) || []).length) <= 2, 'tối đa một cụm |vàng| mỗi dòng');
  }
  assert.ok(caps.some((c) => c.text.includes('|tự|') || c.text.includes('|động|')), 'từ khoá phải được bôi');
  for (let i = 1; i < caps.length; i++) {
    assert.ok(caps[i].t >= caps[i - 1].t + caps[i - 1].d - 0.01, 'phụ đề không chồng thời gian');
  }
});

test('tinhDoanKhung vá khung full từ giây 0 và cắt đoạn theo mốc kế tiếp', () => {
  const ds = tinhDoanKhung([{ t: 5, preset: 'hero' }, { t: 12, preset: 'tall' }], 20, 'doc');
  assert.equal(ds[0].preset, 'full');
  assert.equal(ds[0].batDau, 0);
  assert.equal(ds[1].ketThuc, 12);
  assert.equal(ds[2].ketThuc, 20);
});

test('tinhDoanKhung bỏ preset không thuộc không gian hiện tại', () => {
  const ds = tinhDoanKhung([{ t: 3, preset: 'hero-left' }], 10, 'doc'); // preset của ngang
  assert.equal(ds.length, 1);
  assert.equal(ds[0].preset, 'full');
});

test('khungTheDuPhong đổi khung 5–8s và chịu được vòng preset sai không gian', () => {
  const ds = khungTheDuPhong(30, { khongGian: 'doc', vong: ['hero-left', 'hero-right'] });
  assert.ok(ds.length >= 3, 'video 30s phải có vài lần đổi khung');
  assert.ok(ds.every((f) => f.preset), 'preset không được undefined');
});

test('chuanHoaDoHoa lọc module lạ, kẹp thời gian, tôn trọng danh sách cho phép', () => {
  const els = chuanHoaDoHoa([
    { module: 'rows', t: 2, out: 9, y: 700, items: ['a', 'b'] },
    { module: 'hologram3d', t: 3, y: 100 },
    { module: 'cta', t: 99, y: 800 },
    { module: 'chart', t: 4, y: 5000 },
    { module: 'tag', t: 5, y: 60, x: 68 },
  ], 30, { khongGian: 'doc', choPhep: ['rows', 'cta'] });
  assert.equal(els.length, 1);
  assert.equal(els[0].module, 'rows');
});

test('timLoiBoCuc bắt đè thẻ video, lấn dải phụ đề và đè nhau', () => {
  const doanKhung = tinhDoanKhung([{ t: 0, preset: 'hero' }], 30, 'doc'); // thẻ y 80..664
  const caps = [{ t: 0, d: 30, text: 'x' }];
  const loi = timLoiBoCuc({
    dsDo: [
      { module: 'tag', t: 1, out: 5, x: 100, y: 300, w: 200, h: 50 },     // đè thẻ
      { module: 'note', t: 1, out: 5, x: 100, y: 1040, w: 300, h: 40 },   // lấn phụ đề
      { module: 'rows', t: 2, out: 8, x: 68, y: 700, w: 584, h: 130 },
      { module: 'pill', t: 3, out: 7, x: 100, y: 750, w: 300, h: 60 },    // đè rows
    ],
    doanKhung, caps, khongGian: 'doc', thoiLuong: 30,
  });
  const loai = loi.map((l) => l.loai);
  assert.ok(loai.includes('de-the'));
  assert.ok(loai.includes('de-phu-de'));
  assert.ok(loai.includes('de-nhau'));

  const sach = goPhanTuLoi([
    { module: 'tag', t: 1 }, { module: 'rows', t: 2 }, { module: 'note', t: 1 }, { module: 'pill', t: 3 },
  ], loi);
  assert.ok(sach.length < 4, 'phải gỡ được phần tử vi phạm');
});

test('timLoiBoCuc: khung full không tính là thẻ, progress được miễn soi', () => {
  const doanKhung = tinhDoanKhung([], 30, 'doc'); // toàn full
  const loi = timLoiBoCuc({
    dsDo: [{ module: 'progress', t: 0, x: 0, y: 1273, w: 720, h: 7 }],
    doanKhung, caps: [{ t: 0, d: 30, text: 'x' }], khongGian: 'doc', thoiLuong: 30,
  });
  assert.equal(loi.length, 0);
});

test('suKienSfxV3: đổi khung whoosh, module pop, cta ding, chống dội', () => {
  const sk = suKienSfxV3({
    doanKhung: [{ batDau: 0 }, { batDau: 6 }],
    els: [{ module: 'rows', t: 2 }, { module: 'cta', t: 20 }, { module: 'progress', t: 0 }],
  });
  assert.ok(sk.some((s) => s.sfx === 'whoosh' && s.giay === 6));
  assert.ok(sk.some((s) => s.sfx === 'pop' && s.giay === 2));
  assert.ok(sk.some((s) => s.sfx === 'ding' && s.giay === 20));
  assert.ok(!sk.some((s) => s.giay === 0 && s.sfx === 'pop'), 'progress không tạo SFX');
});

test('cssSkin sinh token màu + caption theo không gian; tenKhongGian ánh xạ khung', () => {
  const css = cssSkin({ gold: '#4DA3FF', card: '#121A26' }, 'ngang');
  assert.ok(css.includes('--gold:#4DA3FF;'));
  assert.ok(css.includes(`--cap-size:${KHONG_GIAN.ngang.capSize}px;`));
  assert.equal(tenKhongGian('doc-blur'), 'doc');
  assert.equal(tenKhongGian('vuong'), 'vuong');
  assert.equal(DS_MODULE.length, 23);
});

test('timPhach bắt điểm năng lượng vọt, nepTheoPhach chỉ nẹp module đánh dấu', () => {
  const hz = 30;
  const peaks = Array.from({ length: 300 }, (_, i) => (i % 60 === 45 ? 0.9 : 0.1));
  const phach = timPhach(peaks, hz);
  assert.ok(phach.length >= 4, 'phải bắt được các cú vọt: ' + phach.length);
  const els = nepTheoPhach([
    { module: 'tag', t: 1.2, batTheoNhip: true },
    { module: 'note', t: 1.2 },
  ], phach);
  assert.ok(Math.abs(els[0].t - 1.5) < 0.07, 'tag nẹp vào phách 1.5s: ' + els[0].t);
  assert.equal(els[1].t, 1.2, 'note không đánh dấu thì giữ nguyên');
});

test('chuanHoaMotion lọc loại lạ, kẹp mốc/thời lượng, tối đa 3 màn', async () => {
  const { chuanHoaMotion } = await import('../loi/storyboard.js');
  const ds = chuanHoaMotion([
    { loai: 'intro', t: 0, giay: 3, duLieu: { tieuDe: 'X' } },
    { loai: 'hologram', t: 5 },
    { loai: 'outro', t: 29, giay: 9 },
    { loai: 'scorecard', t: 40, duLieu: {} },
  ], 31);
  assert.equal(ds.length, 2);
  assert.equal(ds[0].loai, 'intro');
  assert.ok(ds[1].giay <= 2.001, 'outro bị kẹp trong thời lượng còn lại: ' + ds[1].giay);
});
