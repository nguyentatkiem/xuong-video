// Bộ khung trang: <head> chuẩn SEO, header, footer, form tư vấn, dữ liệu có cấu trúc.
import { an, anThuocTinh, nhieuDong } from './tien-ich.js';
import { bieuTuong } from './bieu-tuong.js';

const FAVICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="8" fill="%231560d4"/%3E%3Cpath d="M10 23V9l12 14V9" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E';

export function dauTrang(cauHinh, { lop = '' } = {}) {
  const menu = cauHinh.menu.map((m) =>
    `<li><a href="${anThuocTinh(m.lien)}">${an(m.ten)}</a></li>`).join('');
  return `<header class="dau-trang ${lop}" data-dau-trang>
  <div class="bao dau-trang__trong">
    <a class="hieu" href="/" aria-label="${anThuocTinh(cauHinh.ten)} — trang chủ">
      <span class="hieu__dau" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 24V8l14 16V8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="hieu__chu">
        <strong>${an(cauHinh.ten)}</strong>
        <small>${an(cauHinh.khauHieu)}</small>
      </span>
    </a>
    <nav class="dieu-huong" aria-label="Điều hướng chính"><ul>${menu}</ul></nav>
    <div class="dau-trang__phai">
      <button class="nut-tron" type="button" data-mo-tim aria-label="Tìm kiếm">${bieuTuong('tim_kiem')}</button>
      <a class="nut nut--chinh nut--nho" href="${anThuocTinh(cauHinh.nutChinh.lien)}">${an(cauHinh.nutChinh.ten)} ${bieuTuong('mui-ten', 'bt bt--nho')}</a>
      <button class="nut-tron nut-tron--menu" type="button" data-mo-menu aria-label="Mở menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
  <div class="tim-nhanh" data-o-tim hidden>
    <div class="bao">
      <form class="tim-nhanh__form" role="search" data-tim-form>
        ${bieuTuong('tim_kiem')}
        <input type="search" name="q" placeholder="Tìm khóa học, bài viết, sự kiện…" aria-label="Tìm kiếm nội dung">
        <button class="nut nut--chinh nut--nho" type="submit">Tìm</button>
      </form>
    </div>
  </div>
</header>`;
}

export function chanTrang(cauHinh) {
  const cot = (cauHinh.chanTrang.cot || []).map((c) => `<div class="chan__cot">
      <h3>${an(c.ten)}</h3>
      <ul>${c.muc.map((m) => `<li><a href="${anThuocTinh(m.lien)}">${an(m.ten)}</a></li>`).join('')}</ul>
    </div>`).join('');
  const xaHoi = (cauHinh.mangXaHoi || []).map((m) =>
    `<a href="${anThuocTinh(m.lien)}" aria-label="${anThuocTinh(m.ten)}" rel="noopener" target="_blank">${bieuTuong(m.bieuTuong)}</a>`).join('');
  const phapLy = (cauHinh.chanTrang.phapLy || []).map((m) =>
    `<a href="${anThuocTinh(m.lien)}">${an(m.ten)}</a>`).join('');
  return `<footer class="chan" id="chan-trang">
  <div class="bao chan__trong">
    <div class="chan__hieu">
      <span class="hieu__dau hieu__dau--sang" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none"><path d="M9 24V8l14 16V8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <div>
        <strong>${an(cauHinh.ten)}</strong>
        <p>${an(cauHinh.khauHieu)}<br>${an(cauHinh.moTaNgan)}</p>
      </div>
    </div>
    ${cot}
    <div class="chan__cot chan__lien-he">
      <h3>Liên hệ</h3>
      <ul>
        <li>${bieuTuong('mail')}<a href="mailto:${anThuocTinh(cauHinh.lienHe.email)}">${an(cauHinh.lienHe.email)}</a></li>
        <li>${bieuTuong('phone')}<a href="tel:${anThuocTinh(String(cauHinh.lienHe.dienThoai).replace(/[^+\d]/g, ''))}">${an(cauHinh.lienHe.dienThoai)}</a></li>
        <li>${bieuTuong('the_gioi')}<a href="${anThuocTinh(cauHinh.tenMien)}">${an(cauHinh.lienHe.web)}</a></li>
      </ul>
      <div class="chan__xa-hoi">${xaHoi}</div>
    </div>
    <p class="chan__chu-ky viet-tay">${nhieuDong(cauHinh.chanTrang.chuKy)}</p>
  </div>
  <div class="chan__day">
    <div class="bao chan__day-trong">
      <span>${an(cauHinh.chanTrang.banQuyen)}</span>
      <span class="chan__phap-ly">${phapLy}<em>${an(cauHinh.chanTrang.ghiChu)}</em></span>
    </div>
  </div>
</footer>`;
}

/** Form tư vấn dùng chung — mở bằng mọi liên kết trỏ tới #form-tu-van. */
export function formTuVan(cauHinh) {
  return `<div class="hop-thoai" id="form-tu-van" data-hop-thoai hidden>
  <div class="hop-thoai__nen" data-dong-hop></div>
  <div class="hop-thoai__the" role="dialog" aria-modal="true" aria-labelledby="tieu-de-tu-van">
    <button class="hop-thoai__dong" type="button" data-dong-hop aria-label="Đóng">×</button>
    <h2 id="tieu-de-tu-van">Đăng ký tư vấn 1:1</h2>
    <p class="hop-thoai__mo-ta">Để lại thông tin, đội ngũ của ${an(cauHinh.ten)} sẽ liên hệ trong 24 giờ làm việc để gợi ý lộ trình phù hợp.</p>
    <form class="form-tu-van" method="post" action="/api/dang-ky" data-form-tu-van novalidate>
      <label>Họ và tên<input type="text" name="ten" required autocomplete="name" placeholder="Nguyễn Văn A"></label>
      <label>Số điện thoại<input type="tel" name="dienThoai" required autocomplete="tel" placeholder="09xx xxx xxx"></label>
      <label>Email<input type="email" name="email" autocomplete="email" placeholder="ban@congty.com"></label>
      <label>Bạn đang quan tâm điều gì?<textarea name="nhuCau" rows="3" placeholder="Ví dụ: muốn xây hệ thống AI cho marketing và sales"></textarea></label>
      <button class="nut nut--chinh" type="submit">Gửi đăng ký ${bieuTuong('mui-ten', 'bt bt--nho')}</button>
      <p class="form-tu-van__bao" data-bao role="status"></p>
    </form>
  </div>
</div>`;
}

/** Dữ liệu có cấu trúc cho công cụ tìm kiếm + trợ lý AI. */
export function duLieuCoCauTruc(cauHinh, trang, themSchema = []) {
  const goc = cauHinh.tenMien.replace(/\/$/, '');
  const url = `${goc}${trang.url || '/'}`;
  const nguoi = {
    '@type': 'Person',
    name: cauHinh.ten,
    jobTitle: 'Business Strategist, AI Educator',
    description: cauHinh.mucTieu,
    url: goc,
    email: cauHinh.lienHe.email,
    telephone: cauHinh.lienHe.dienThoai,
    sameAs: (cauHinh.mangXaHoi || []).map((m) => m.lien),
  };
  const mucs = [
    {
      '@type': 'WebSite',
      '@id': `${goc}/#website`,
      url: goc,
      name: cauHinh.ten,
      inLanguage: cauHinh.ngonNgu,
      publisher: { '@id': `${goc}/#nguoi` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${goc}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    { ...nguoi, '@id': `${goc}/#nguoi` },
    {
      '@type': 'WebPage',
      '@id': `${url}#trang`,
      url,
      name: trang.tieuDe,
      description: trang.moTa,
      inLanguage: cauHinh.ngonNgu,
      isPartOf: { '@id': `${goc}/#website` },
    },
    ...themSchema,
  ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': mucs })
    .replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

function doDanh(cauHinh) {
  const { ga4, gtm, facebookPixel } = cauHinh.seo?.phanTich || {};
  let ra = '';
  if (gtm) ra += `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${anThuocTinh(gtm)}');</script>`;
  if (ga4) ra += `<script async src="https://www.googletagmanager.com/gtag/js?id=${anThuocTinh(ga4)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${anThuocTinh(ga4)}');</script>`;
  if (facebookPixel) ra += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${anThuocTinh(facebookPixel)}');fbq('track','PageView');</script>`;
  return ra;
}

/** Ghép một trang HTML hoàn chỉnh. */
export function trangHtml({ cauHinh, trang, than, schema = [], lopThan = '' }) {
  const goc = cauHinh.tenMien.replace(/\/$/, '');
  const url = `${goc}${trang.url || '/'}`;
  const anhChiaSe = `${goc}${trang.anhChiaSe || cauHinh.seo.anhChiaSe}`;
  const tuKhoa = (trang.tuKhoa || cauHinh.seo.tuKhoaGoc || []).join(', ');
  return `<!doctype html>
<html lang="${anThuocTinh(cauHinh.ngonNgu)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${an(trang.tieuDe)}</title>
<meta name="description" content="${anThuocTinh(trang.moTa)}">
<meta name="keywords" content="${anThuocTinh(tuKhoa)}">
<meta name="author" content="${anThuocTinh(cauHinh.ten)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${anThuocTinh(url)}">
<meta property="og:type" content="${anThuocTinh(trang.loaiNoiDung || cauHinh.seo.loaiNoiDung)}">
<meta property="og:site_name" content="${anThuocTinh(cauHinh.ten)}">
<meta property="og:locale" content="vi_VN">
<meta property="og:title" content="${anThuocTinh(trang.tieuDe)}">
<meta property="og:description" content="${anThuocTinh(trang.moTa)}">
<meta property="og:url" content="${anThuocTinh(url)}">
<meta property="og:image" content="${anThuocTinh(anhChiaSe)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${anThuocTinh(trang.tieuDe)}">
<meta name="twitter:description" content="${anThuocTinh(trang.moTa)}">
<meta name="twitter:image" content="${anThuocTinh(anhChiaSe)}">
<meta name="theme-color" content="${anThuocTinh(cauHinh.thuongHieu.chinh)}">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Caveat:wght@500;700&display=swap">
<link rel="stylesheet" href="/tai-nguyen/css/style.css">
${duLieuCoCauTruc(cauHinh, { ...trang, url: trang.url || '/' }, schema)}
${doDanh(cauHinh)}
</head>
<body class="${lopThan}">
<a class="bo-qua" href="#noi-dung">Bỏ qua tới nội dung chính</a>
${dauTrang(cauHinh)}
<main id="noi-dung">
${than}
</main>
${chanTrang(cauHinh)}
${formTuVan(cauHinh)}
<script src="/tai-nguyen/js/app.js" defer></script>
</body>
</html>
`;
}
