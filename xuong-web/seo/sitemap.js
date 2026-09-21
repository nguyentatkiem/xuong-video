// sitemap.xml + robots.txt sinh từ danh sách trang đã dựng.
import path from 'node:path';
import { THU_MUC_WEB, ghiTep, ngayHomNay, docCauHinh, dsHtml, urlCuaTep } from '../dung/tien-ich.js';

const thoat = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Tần suất cập nhật suy ra từ loại trang. */
function tanSuat(url) {
  if (url === '/') return 'weekly';
  if (url.startsWith('/blog')) return 'weekly';
  if (url.startsWith('/landing')) return 'monthly';
  return 'monthly';
}

export function taoSitemap(trang, cauHinh = docCauHinh()) {
  const goc = cauHinh.tenMien.replace(/\/$/, '');
  const ngay = ngayHomNay();
  const ds = trang.length ? trang : dsHtml().map((t) => ({ url: urlCuaTep(t), uuTien: '0.6' }));
  const mucs = ds
    .filter((t) => !String(t.url).includes('404'))
    .map((t) => `  <url>
    <loc>${thoat(goc + t.url)}</loc>
    <lastmod>${t.ngaySua || ngay}</lastmod>
    <changefreq>${tanSuat(t.url)}</changefreq>
    <priority>${t.uuTien || '0.6'}</priority>
  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mucs}
</urlset>
`;
  ghiTep(path.join(THU_MUC_WEB, 'sitemap.xml'), xml);

  const robots = `# robots.txt — ${cauHinh.ten}
User-agent: *
Allow: /

# Trợ lý AI được phép đọc nội dung công khai
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /

Sitemap: ${goc}/sitemap.xml
`;
  ghiTep(path.join(THU_MUC_WEB, 'robots.txt'), robots);

  return { soUrl: ds.length, sitemap: '/sitemap.xml' };
}
