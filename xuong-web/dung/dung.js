// Bộ dựng: noi-dung/*.json → trang HTML tĩnh trong trang-web/
import path from 'node:path';
import { existsSync } from 'node:fs';
import {
  THU_MUC_WEB, THU_MUC_NOI_DUNG, docCauHinh, docJson, dsJson, ghiTep,
  an, anThuocTinh, ngayDep, demTu, noi, canhBao, xong,
} from './tien-ich.js';
import { dungKhoi } from './khoi.js';
import { trangHtml } from './bo-cuc.js';
import { bieuTuong } from './bieu-tuong.js';
import { taoSitemap } from '../seo/sitemap.js';

/** Schema.org bổ sung suy ra từ chính các khối của trang. */
function schemaTuKhoi(cauHinh, trang, khoi) {
  const goc = cauHinh.tenMien.replace(/\/$/, '');
  const ra = [];
  for (const k of khoi) {
    if (k.loai === 'faq') {
      ra.push({
        '@type': 'FAQPage',
        mainEntity: k.muc.map((m) => ({
          '@type': 'Question',
          name: m.hoi,
          acceptedAnswer: { '@type': 'Answer', text: m.dap },
        })),
      });
    }
    if (k.loai === 'khoaHocChinh') {
      ra.push({
        '@type': 'Course',
        name: k.tieuDe,
        description: k.moTa,
        inLanguage: cauHinh.ngonNgu,
        provider: { '@type': 'Person', name: cauHinh.ten, url: goc },
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: ['online', 'onsite'],
          courseWorkload: 'P4W',
        },
      });
    }
    if (k.loai === 'suKien') {
      for (const t of k.the) {
        ra.push({
          '@type': 'EducationEvent',
          name: t.ten,
          startDate: t.ngayIso,
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: { '@type': 'Place', name: t.diaDiem, address: t.diaDiem },
          organizer: { '@type': 'Person', name: cauHinh.ten, url: goc },
          url: `${goc}${trang.url}`,
        });
      }
    }
  }
  return ra;
}

/** Một tệp JSON trong noi-dung/trang → một trang HTML. */
export function dungMotTrang(tepJson, cauHinh) {
  const dl = docJson(tepJson);
  const tep = dl.tep || `${dl.slug || path.basename(tepJson, '.json')}.html`;
  const url = `/${tep}`.replace(/\/index\.html$/, '/');
  const { html, bo } = dungKhoi(dl.khoi || []);
  if (bo.length) canhBao(`${tep}: bỏ qua khối không rõ loại — ${[...new Set(bo)].join(', ')}`);
  const trang = { ...dl, url };
  const noiDung = trangHtml({
    cauHinh,
    trang,
    than: html,
    schema: schemaTuKhoi(cauHinh, trang, dl.khoi || []),
    lopThan: dl.lopThan || '',
  });
  const raTep = ghiTep(path.join(THU_MUC_WEB, tep), noiDung);
  return { tep: raTep, url, tieuDe: dl.tieuDe, uuTien: dl.uuTien || '0.8', tu: demTu(html) };
}

/** Bài blog: JSON có `html` (thân bài) → trang bài viết + thẻ cho trang danh sách. */
export function dungMotBai(tepJson, cauHinh) {
  const b = docJson(tepJson);
  const slug = b.slug || path.basename(tepJson, '.json');
  const url = `/blog/${slug}.html`;
  const goc = cauHinh.tenMien.replace(/\/$/, '');
  const than = `<article class="bai-viet">
  <div class="bao bao--hep">
    <nav class="duong-dan" aria-label="Đường dẫn"><a href="/">Trang chủ</a> ${bieuTuong('mui-ten', 'bt bt--nho')} <a href="/blog/">Blog</a> ${bieuTuong('mui-ten', 'bt bt--nho')} <span>${an(b.tieuDe)}</span></nav>
    <header class="bai-viet__dau">
      ${b.chuyenMuc ? `<span class="nhan nhan--sang">${an(b.chuyenMuc)}</span>` : ''}
      <h1>${an(b.tieuDe)}</h1>
      <p class="bai-viet__tom-tat">${an(b.moTa)}</p>
      <p class="bai-viet__meta">
        <span>${an(b.tacGia || cauHinh.ten)}</span>
        <time datetime="${anThuocTinh(b.ngay)}">${an(ngayDep(b.ngay))}</time>
        ${b.phutDoc ? `<span>${an(b.phutDoc)} phút đọc</span>` : ''}
      </p>
    </header>
    <div class="bai-viet__than">${b.html}</div>
    <footer class="bai-viet__chan">
      <p>${an(b.keuGoi || 'Bạn muốn áp dụng những điều này vào doanh nghiệp của mình?')}</p>
      <a class="nut nut--chinh" href="#form-tu-van">Đăng ký tư vấn ${bieuTuong('mui-ten', 'bt bt--nho')}</a>
    </footer>
  </div>
</article>`;
  const trang = {
    tieuDe: b.tieuDeSeo || `${b.tieuDe} | ${cauHinh.ten}`,
    moTa: b.moTa,
    tuKhoa: b.tuKhoa || [],
    url,
    loaiNoiDung: 'article',
    anhChiaSe: b.anh || cauHinh.seo.anhChiaSe,
  };
  const schema = [{
    '@type': 'BlogPosting',
    headline: b.tieuDe,
    description: b.moTa,
    datePublished: b.ngay,
    dateModified: b.capNhat || b.ngay,
    inLanguage: cauHinh.ngonNgu,
    author: { '@type': 'Person', name: b.tacGia || cauHinh.ten, url: goc },
    publisher: { '@type': 'Person', name: cauHinh.ten, url: goc },
    mainEntityOfPage: `${goc}${url}`,
    keywords: (b.tuKhoa || []).join(', '),
  }];
  ghiTep(path.join(THU_MUC_WEB, 'blog', `${slug}.html`), trangHtml({ cauHinh, trang, than, schema }));
  return { slug, url, ...b, tu: demTu(b.html) };
}

/** Trang danh sách blog. */
function dungDanhSachBlog(bai, cauHinh) {
  const the = bai.map((b) => `<article class="the the--bai">
    <a href="${anThuocTinh(b.url)}">
      ${b.chuyenMuc ? `<span class="nhan nhan--sang">${an(b.chuyenMuc)}</span>` : ''}
      <h2>${an(b.tieuDe)}</h2>
      <p>${an(b.moTa)}</p>
      <p class="the--bai__meta"><time datetime="${anThuocTinh(b.ngay)}">${an(ngayDep(b.ngay))}</time>${b.phutDoc ? ` · ${an(b.phutDoc)} phút đọc` : ''}</p>
    </a>
  </article>`).join('');
  const than = `<section class="trang-blog">
  <div class="bao">
    <div class="muc-dau"><div>
      <span class="nhan nhan--sang">Blog</span>
      <h1>Góc nhìn về AI và công ty 1 người</h1>
      <p class="muc-dau__mo-ta">Bài viết, hướng dẫn và câu chuyện thực chiến về ứng dụng AI vào vận hành doanh nghiệp: dựng AI Agent cho marketing, sales, content và chăm sóc khách hàng; thiết kế quy trình tự động hóa; đo lường hiệu quả để biết chỗ nào nên mở rộng. Mỗi bài đi kèm các bước làm được ngay trên chính doanh nghiệp của bạn, thay vì dừng ở giới thiệu công cụ.</p>
    </div></div>
    <div class="luoi-the luoi-the--3">${the || '<p>Chưa có bài viết nào.</p>'}</div>
  </div>
</section>`;
  const trang = {
    tieuDe: `Blog AI cho công ty 1 người | ${cauHinh.ten}`,
    moTa: 'Bài viết và hướng dẫn thực chiến về ứng dụng AI vào marketing, sales, content và vận hành doanh nghiệp cho mô hình công ty 1 người.',
    url: '/blog/',
    tuKhoa: ['công ty 1 người', ...cauHinh.seo.tuKhoaGoc],
  };
  const schema = [{
    '@type': 'Blog',
    name: `Blog ${cauHinh.ten}`,
    url: `${cauHinh.tenMien.replace(/\/$/, '')}/blog/`,
    blogPost: bai.map((b) => ({
      '@type': 'BlogPosting',
      headline: b.tieuDe,
      datePublished: b.ngay,
      url: `${cauHinh.tenMien.replace(/\/$/, '')}${b.url}`,
    })),
  }];
  ghiTep(path.join(THU_MUC_WEB, 'blog', 'index.html'), trangHtml({ cauHinh, trang, than, schema }));
  return { url: '/blog/', uuTien: '0.7' };
}

/** Dựng toàn bộ site. Trả về danh sách trang đã dựng. */
export function dungTatCa({ imLang = false } = {}) {
  const cauHinh = docCauHinh();
  const raTrang = [];

  for (const tep of dsJson(path.join(THU_MUC_NOI_DUNG, 'trang'))) {
    const kq = dungMotTrang(tep, cauHinh);
    raTrang.push(kq);
    if (!imLang) noi(`  · ${kq.tep.padEnd(34)} ${String(kq.tu).padStart(5)} từ`);
  }

  const thuMucBlog = path.join(THU_MUC_NOI_DUNG, 'blog');
  const bai = dsJson(thuMucBlog).map((t) => dungMotBai(t, cauHinh))
    .sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)));
  for (const b of bai) {
    raTrang.push({ tep: `blog/${b.slug}.html`, url: b.url, tieuDe: b.tieuDe, uuTien: '0.6', tu: b.tu });
    if (!imLang) noi(`  · ${`blog/${b.slug}.html`.padEnd(34)} ${String(b.tu).padStart(5)} từ`);
  }
  if (existsSync(thuMucBlog)) {
    const ds = dungDanhSachBlog(bai, cauHinh);
    raTrang.push({ tep: 'blog/index.html', url: ds.url, tieuDe: 'Blog', uuTien: ds.uuTien, tu: 0 });
  }

  const sm = taoSitemap(raTrang, cauHinh);
  if (!imLang) {
    noi(`  · ${'sitemap.xml'.padEnd(34)} ${String(sm.soUrl).padStart(5)} URL`);
    xong(`Dựng xong ${raTrang.length} trang vào ${path.relative(process.cwd(), THU_MUC_WEB) || 'trang-web'}/`);
  }
  return raTrang;
}
