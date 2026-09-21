import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { an, taoSlug, demTu, urlCuaTep, THU_MUC_WEB } from '../xuong-web/dung/tien-ich.js';
import { bieuTuong, coBieuTuong } from '../xuong-web/dung/bieu-tuong.js';
import { dungKhoi, cacLoaiKhoi } from '../xuong-web/dung/khoi.js';
import { trichJson } from '../xuong-web/seo/claude.js';
import { locHtml } from '../xuong-web/seo/bai-viet.js';
import { dungTatCa } from '../xuong-web/dung/dung.js';
import { soatSeo } from '../xuong-web/seo/soat.js';

// ── Tiện ích ───────────────────────────────────────────────────────────
test('an() thoát ký tự HTML để nội dung JSON không chèn được thẻ', () => {
  assert.equal(an('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('taoSlug bỏ dấu tiếng Việt và ký tự lạ', () => {
  assert.equal(taoSlug('Xây công ty 1 người với AI!'), 'xay-cong-ty-1-nguoi-voi-ai');
  assert.equal(taoSlug('  Đào tạo — AI  '), 'dao-tao-ai');
});

test('demTu bỏ thẻ, script và style trước khi đếm', () => {
  assert.equal(demTu('<p>một hai ba</p><script>var a = 1;</script>'), 3);
});

test('urlCuaTep bỏ index.html khỏi URL', () => {
  assert.equal(urlCuaTep(path.join(THU_MUC_WEB, 'blog', 'index.html')), '/blog/');
  assert.equal(urlCuaTep(path.join(THU_MUC_WEB, 'index.html')), '/');
});

// ── Biểu tượng ─────────────────────────────────────────────────────────
test('bieuTuong trả SVG hợp lệ, tên lạ vẫn có hình dự phòng', () => {
  assert.match(bieuTuong('agent'), /^<svg class="bt"/);
  assert.match(bieuTuong('khong-co-ten-nay'), /<circle/);
  assert.equal(coBieuTuong('sales'), true);
  assert.equal(coBieuTuong('khong-co-ten-nay'), false);
});

// ── Dựng khối ──────────────────────────────────────────────────────────
test('dungKhoi bỏ qua khối lạ và báo lại tên, không ném lỗi', () => {
  const { html, bo } = dungKhoi([
    { loai: 'khoiKhongTonTai' },
    { loai: 'noiDungTho', tieuDe: 'Thử', html: '<p>xin chào</p>' },
  ]);
  assert.deepEqual(bo, ['khoiKhongTonTai']);
  assert.match(html, /<h1>Thử<\/h1>/);
  assert.match(html, /<p>xin chào<\/p>/);
});

test('noiDungTho dùng h2 khi khai báo capDo', () => {
  const { html } = dungKhoi([{ loai: 'noiDungTho', tieuDe: 'Phụ', capDo: 'h2', html: '' }]);
  assert.match(html, /<h2>Phụ<\/h2>/);
});

test('mọi loại khối đều dựng được từ dữ liệu trang chủ', () => {
  const trangChu = JSON.parse(readFileSync(
    path.join(THU_MUC_WEB, 'noi-dung', 'trang', 'trang-chu.json'), 'utf8'));
  const { bo } = dungKhoi(trangChu.khoi);
  assert.deepEqual(bo, []);
  for (const k of trangChu.khoi) assert.ok(cacLoaiKhoi.includes(k.loai), `thiếu khối ${k.loai}`);
});

// ── Đọc JSON từ câu trả lời của claude ─────────────────────────────────
test('trichJson bóc được JSON trong khối ```json và bỏ lời dẫn', () => {
  const ra = trichJson('Đây là kết quả:\n```json\n{"a": 1, "b": [2, 3]}\n```\nHết.');
  assert.deepEqual(ra, { a: 1, b: [2, 3] });
});

test('trichJson không bị ngoặc trong chuỗi đánh lừa', () => {
  assert.deepEqual(trichJson('{"chu": "có } trong chuỗi", "so": 2}'),
    { chu: 'có } trong chuỗi', so: 2 });
});

test('trichJson trả null khi không có JSON', () => {
  assert.equal(trichJson('không có gì ở đây'), null);
});

// ── Lọc HTML do AI sinh ────────────────────────────────────────────────
test('locHtml gỡ script, iframe, thuộc tính on* và style', () => {
  const ra = locHtml('<p onclick="x()" style="color:red">an toàn</p><script>hack()</script><iframe src="x"></iframe>');
  assert.equal(ra.includes('<script'), false);
  assert.equal(ra.includes('iframe'), false);
  assert.equal(ra.includes('onclick'), false);
  assert.equal(ra.includes('style='), false);
  assert.match(ra, /an toàn/);
});

test('locHtml giữ thẻ nội dung hợp lệ và liên kết', () => {
  const ra = locHtml('<h2>Tiêu đề</h2><ul><li><a href="/blog/">bài viết</a></li></ul>');
  assert.match(ra, /<h2>Tiêu đề<\/h2>/);
  assert.match(ra, /<a href="\/blog\/">bài viết<\/a>/);
});

test('locHtml chặn href javascript:', () => {
  assert.match(locHtml('<a href="javascript:alert(1)">x</a>'), /href="#"/);
});

// ── Dựng site thật + soát SEO ──────────────────────────────────────────
test('dựng toàn bộ site rồi soát: không còn lỗi SEO nghiêm trọng', () => {
  const trang = dungTatCa({ imLang: true });
  assert.ok(trang.length >= 4, 'phải dựng được ít nhất 4 trang');
  assert.ok(existsSync(path.join(THU_MUC_WEB, 'index.html')));
  assert.ok(existsSync(path.join(THU_MUC_WEB, 'sitemap.xml')));
  assert.ok(existsSync(path.join(THU_MUC_WEB, 'robots.txt')));

  const bc = soatSeo();
  assert.equal(bc.soLoi, 0, `còn lỗi SEO: ${JSON.stringify(bc.trang.flatMap((t) => t.loi))}`);
  assert.ok(bc.diem >= 90, `điểm SEO thấp: ${bc.diem}`);
});

test('trang chủ có đủ thẻ SEO và dữ liệu có cấu trúc', () => {
  const html = readFileSync(path.join(THU_MUC_WEB, 'index.html'), 'utf8');
  for (const mau of [
    /<link rel="canonical" href="https?:\/\//,
    /<meta property="og:image"/,
    /<meta name="twitter:card"/,
    /<script type="application\/ld\+json">/,
    /"@type":"FAQPage"/,
    /"@type":"Course"/,
  ]) assert.match(html, mau);
});

test('sitemap chứa mọi trang và trỏ đúng tên miền', () => {
  const xml = readFileSync(path.join(THU_MUC_WEB, 'sitemap.xml'), 'utf8');
  const cauHinh = JSON.parse(readFileSync(path.join(THU_MUC_WEB, 'noi-dung', 'cau-hinh.json'), 'utf8'));
  assert.match(xml, new RegExp(`<loc>${cauHinh.tenMien.replace(/\//g, '\\/')}\\/<\\/loc>`));
  assert.match(xml, /landing\/solo-ai-ceo\.html/);
  const soUrl = (xml.match(/<loc>/g) || []).length;
  assert.ok(soUrl >= 4, `sitemap chỉ có ${soUrl} URL`);
});
