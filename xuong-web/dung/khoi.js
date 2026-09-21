// Mỗi khối nội dung trong JSON → một mảng HTML. Thêm khối mới = thêm một hàm ở đây.
import { an, anThuocTinh, nhieuDong } from './tien-ich.js';
import { bieuTuong } from './bieu-tuong.js';

const id = (k) => (k.id ? ` id="${anThuocTinh(k.id)}"` : '');

function nut(n, macDinh = 'chinh') {
  if (!n) return '';
  const kieu = n.kieu || macDinh;
  const icon = n.bieuTuong ? bieuTuong(n.bieuTuong, 'bt bt--nho') : bieuTuong('mui-ten', 'bt bt--nho');
  return `<a class="nut nut--${anThuocTinh(kieu)}" href="${anThuocTinh(n.lien)}">${n.bieuTuong ? icon : ''}${an(n.ten)}${n.bieuTuong ? '' : icon}</a>`;
}

const dsNut = (ds = []) => ds.map((n) => nut(n)).join('');

function tieuDeMuc(k, { giua = false } = {}) {
  return `<div class="muc-dau${giua ? ' muc-dau--giua' : ''}">
    <div>
      ${k.nhan ? `<span class="nhan">${an(k.nhan)}</span>` : ''}
      <h2>${an(k.tieuDe)}</h2>
      ${k.moTa ? `<p class="muc-dau__mo-ta">${an(k.moTa)}</p>` : ''}
    </div>
    ${k.nut ? `<div class="muc-dau__nut">${nut(k.nut, 'vien')}</div>` : ''}
  </div>`;
}

const sao = (n = 5) => `<span class="sao" aria-label="${n}/5 sao">${'★'.repeat(n)}</span>`;

const anhTrang = (src, chu, lop = '') =>
  `<img class="${lop}" src="${anThuocTinh(src)}" alt="${anThuocTinh(chu)}" loading="lazy" decoding="async">`;

// ── Các khối ───────────────────────────────────────────────────────────
const khoi = {
  hero(k) {
    const he = k.heSinhThai;
    return `<section class="hero"${id(k)}>
  <div class="bao hero__trong">
    <div class="hero__chu">
      <span class="nhan nhan--sang">${an(k.nhan)}</span>
      <h1>${an(k.tieuDe)}<br><span class="tô">${an(k.tieuDeNhan)}</span></h1>
      <p class="hero__mo-ta">${an(k.moTa)}</p>
      <div class="hang-nut">${dsNut(k.nut)}</div>
      <blockquote class="hero__trich viet-tay">
        <p>“${an(k.trichDan)}”</p>
        <cite>${an(k.kyTen)}</cite>
      </blockquote>
    </div>
    <div class="hero__hinh">
      <p class="viet-tay hero__viet-tay">${nhieuDong(k.vietTay)}</p>
      <figure class="hero__chan-dung">
        <img src="${anThuocTinh(k.anh)}" alt="${anThuocTinh(k.anhChu)}" width="520" height="640" fetchpriority="high" decoding="async">
      </figure>
      <div class="he-sinh-thai">
        <h2 class="he-sinh-thai__ten">${an(he.ten)}</h2>
        <ul>
          ${he.muc.map((m) => `<li>
            <span class="he-sinh-thai__bt">${bieuTuong(m.bieuTuong)}</span>
            <strong>${an(m.ten)}</strong>
            <em>${bieuTuong('check', 'bt bt--nho')}${an(m.moTa)}</em>
          </li>`).join('')}
        </ul>
      </div>
      <p class="he-sinh-thai__ket">${an(he.ketLuan)}</p>
    </div>
  </div>
</section>`;
  },

  thongSo(k) {
    return `<section class="thong-so"${id(k)}>
  <div class="bao thong-so__trong">
    ${k.muc.map((m) => `<div class="thong-so__muc">
      <span class="thong-so__bt">${bieuTuong(m.bieuTuong)}</span>
      <div><strong>${an(m.so)}</strong><span>${an(m.ten)}</span></div>
    </div>`).join('')}
  </div>
</section>`;
  },

  noiDau(k) {
    return `<section class="noi-dau"${id(k)}>
  <div class="bao noi-dau__trong">
    <div class="noi-dau__chu">
      <h2>${an(k.tieuDe)}</h2>
      <p class="muc-dau__mo-ta">${an(k.moTa)}</p>
      <div class="luoi-the luoi-the--4">
        ${k.the.map((t) => `<article class="the the--noi-dau">
          <span class="the__bt">${bieuTuong(t.bieuTuong)}</span>
          <h3>${an(t.ten)}</h3>
          <p>${an(t.moTa)}</p>
        </article>`).join('')}
      </div>
    </div>
    <figure class="noi-dau__trich">
      ${anhTrang(k.anh, k.anhChu, 'noi-dau__anh')}
      <blockquote class="viet-tay">
        <p>“${an(k.trichDan)}”</p>
        <cite>${an(k.kyTen)}</cite>
      </blockquote>
    </figure>
  </div>
</section>`;
  },

  soDo(k) {
    const nhanh = (t, ben) => `<li class="so-do__nhanh so-do__nhanh--${ben}">
      <span class="so-do__bt">${bieuTuong(t.bieuTuong)}</span>
      <div><strong>${an(t.ten)}</strong><span>${an(t.moTa)}</span></div>
    </li>`;
    return `<section class="so-do"${id(k)}>
  <div class="bao so-do__trong">
    <div class="so-do__chu">
      <h2>${an(k.tieuDe)}</h2>
      <p class="muc-dau__mo-ta">${an(k.moTa)}</p>
      <blockquote class="the-trich viet-tay">
        <p>“${an(k.trichDan)}”</p>
      </blockquote>
    </div>
    <div class="so-do__hinh">
      <ul class="so-do__cot so-do__cot--trai">${k.trai.map((t) => nhanh(t, 'trai')).join('')}</ul>
      <div class="so-do__trung">
        <span class="so-do__vong" aria-hidden="true"></span>
        ${anhTrang(k.trung.anh, `${k.trung.ten} — trung tâm hệ thống`, 'so-do__anh')}
        <strong>${an(k.trung.ten)}</strong>
      </div>
      <ul class="so-do__cot so-do__cot--phai">${k.phai.map((t) => nhanh(t, 'phai')).join('')}</ul>
      <ul class="so-do__cot so-do__cot--duoi">${(k.duoi || []).map((t) => nhanh(t, 'duoi')).join('')}</ul>
    </div>
    <p class="so-do__cong-thuc viet-tay">${k.congThuc.map((d) => `<span>${an(d)}</span>`).join('')}</p>
  </div>
</section>`;
  },

  gioiThieu(k) {
    return `<section class="gioi-thieu"${id(k)}>
  <div class="bao gioi-thieu__trong">
    <figure class="gioi-thieu__anh">
      ${anhTrang(k.anh, k.anhChu)}
      <figcaption><span class="viet-tay">“${an(k.anhTrichDan)}”</span><cite>${an(k.kyTen)}</cite></figcaption>
    </figure>
    <div class="gioi-thieu__chu">
      <h2>${an(k.tieuDe)}</h2>
      <p class="muc-dau__mo-ta">${an(k.moTa)}</p>
      <div class="luoi-the luoi-the--3">
        ${k.the.map((t) => `<article class="the the--vien">
          <span class="the__bt the__bt--tron">${bieuTuong(t.bieuTuong)}</span>
          <h3>${an(t.ten)}</h3>
          <p>${an(t.moTa)}</p>
        </article>`).join('')}
      </div>
    </div>
    <blockquote class="gioi-thieu__trich viet-tay">
      <p>“${an(k.trichDan)}”</p>
      <cite>${an(k.kyTen)}</cite>
    </blockquote>
  </div>
</section>`;
  },

  khoaHocChinh(k) {
    return `<section class="khoa-hoc-chinh"${id(k)}>
  <div class="bao khoa-hoc-chinh__trong">
    <div class="khoa-hoc-chinh__dau">
      <span class="nhan nhan--dam">${an(k.nhan)}</span>
      <h2>${an(k.tieuDe)}</h2>
      <p class="muc-dau__mo-ta">${an(k.moTa)}</p>
    </div>
    <div class="luoi-the luoi-the--4 khoa-hoc-chinh__tru">
      ${k.tru.map((t) => `<article class="the the--tru">
        <span class="the__bt">${bieuTuong(t.bieuTuong)}</span>
        <h3>${an(t.ten)}</h3>
        <p>${an(t.moTa)}</p>
      </article>`).join('')}
    </div>
    <div class="khoa-hoc-chinh__loi-ich">
      <div class="hop-loi-ich">
        <h3>${an(k.loiIch.ten)}</h3>
        <ul>${k.loiIch.muc.map((m) => `<li>${bieuTuong('check', 'bt bt--nho')}${an(m)}</li>`).join('')}</ul>
        ${nut(k.loiIch.nut)}
      </div>
      <figure class="hop-san-pham">${anhTrang(k.hop.anh, k.hop.anhChu)}</figure>
    </div>
  </div>
</section>`;
  },

  camNhan(k) {
    const v = k.video;
    return `<section class="cam-nhan"${id(k)}>
  <div class="bao">
    ${tieuDeMuc(k)}
    <div class="cam-nhan__trong">
      <div class="luoi-the luoi-the--4">
        ${k.the.map((t) => `<article class="the the--cam-nhan">
          <span class="the__nhay" aria-hidden="true">“</span>
          <p>${an(t.noiDung)}</p>
          <footer>
            ${anhTrang(t.anh, t.ten, 'the__avatar')}
            <span><strong>${an(t.ten)}</strong><em>${an(t.chucDanh)}</em>${sao(t.sao)}</span>
          </footer>
        </article>`).join('')}
      </div>
      <div class="video-cam-nhan">
        <h3>${an(v.ten)}</h3>
        <div class="video-cam-nhan__luoi">
          <a class="video-the video-the--lon" href="${anThuocTinh(v.chinh.lien)}" target="_blank" rel="noopener">
            ${anhTrang(v.chinh.anh, v.chinh.ten)}
            <span class="video-the__play">${bieuTuong('play')}</span>
            <span class="video-the__gio">${an(v.chinh.thoiLuong)}</span>
            <strong>${an(v.chinh.ten)}</strong>
          </a>
          <div class="video-cam-nhan__phu">
            ${v.phu.map((p) => `<a class="video-the" href="${anThuocTinh(p.lien)}" target="_blank" rel="noopener">
              ${anhTrang(p.anh, p.ten)}
              <span class="video-the__gio">${an(p.thoiLuong)}</span>
              <strong>${an(p.ten)}</strong>
            </a>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
  },

  khoaHocKhac(k) {
    return `<section class="khoa-hoc-khac"${id(k)}>
  <div class="bao">
    ${tieuDeMuc(k)}
    <div class="luoi-the luoi-the--6">
      ${k.the.map((t) => `<article class="the the--khoa-hoc">
        <figure>${anhTrang(t.anh, t.ten)}</figure>
        <div class="the--khoa-hoc__chu">
          <h3>${an(t.ten)}</h3>
          <p>${an(t.moTa)}</p>
          <a class="nut nut--chinh nut--nho" href="${anThuocTinh(t.lien)}">Xem chi tiết ${bieuTuong('mui-ten', 'bt bt--nho')}</a>
        </div>
      </article>`).join('')}
    </div>
  </div>
</section>`;
  },

  suKien(k) {
    return `<section class="su-kien"${id(k)}>
  <div class="bao">
    ${tieuDeMuc(k)}
    <div class="luoi-the luoi-the--3">
      ${k.the.map((t) => `<article class="the the--su-kien">
        <figure>${anhTrang(t.anh, `${t.ten} — ${t.diaDiem}`)}</figure>
        <div class="the--su-kien__chu">
          <h3>${an(t.ten)}</h3>
          <p class="the--su-kien__dong">${bieuTuong('lich', 'bt bt--nho')}<time datetime="${anThuocTinh(t.ngayIso)}">${an(t.ngay)}</time></p>
          <p class="the--su-kien__dong">${bieuTuong('dia-diem', 'bt bt--nho')}${an(t.diaDiem)}</p>
          ${nut(t.nut)}
        </div>
      </article>`).join('')}
    </div>
  </div>
</section>`;
  },

  keuGoi(k) {
    return `<section class="keu-goi"${id(k)}>
  <div class="bao keu-goi__trong">
    <figure class="keu-goi__anh">${anhTrang(k.anh, `${k.tieuDe} — ${an('Nguyễn Tất Kiểm')}`)}</figure>
    <div class="keu-goi__chu">
      <h2>${an(k.tieuDe)}</h2>
      <p>${an(k.moTa)}</p>
      <div class="hang-nut">${dsNut(k.nut)}</div>
    </div>
    <ul class="keu-goi__loi-ich">
      ${k.loiIch.map((m) => `<li>${bieuTuong('check', 'bt bt--nho')}${an(m)}</li>`).join('')}
    </ul>
    <p class="keu-goi__viet-tay viet-tay">${nhieuDong(k.vietTay)}<cite>${an(k.kyTen)}</cite></p>
  </div>
</section>`;
  },

  faq(k) {
    const cot = [[], []];
    k.muc.forEach((m, i) => cot[i % 2].push(m));
    const veCot = (ds) => `<div class="faq__cot">${ds.map((m) => `<details class="faq__muc">
      <summary><span>${an(m.hoi)}</span>${bieuTuong('xuong', 'bt bt--nho')}</summary>
      <div class="faq__dap"><p>${an(m.dap)}</p></div>
    </details>`).join('')}</div>`;
    return `<section class="faq"${id(k)}>
  <div class="bao">
    <div class="muc-dau"><div><h2>${an(k.tieuDe)}</h2><p class="muc-dau__mo-ta">${an(k.moTa)}</p></div></div>
    <div class="faq__trong">
      ${veCot(cot[0])}${veCot(cot[1])}
      <aside class="faq__ho-tro">
        <span class="the__bt the__bt--tron">${bieuTuong('headphone')}</span>
        <h3>${an(k.hoTro.ten)}</h3>
        <p>${an(k.hoTro.moTa)}</p>
        ${nut(k.hoTro.nut)}
      </aside>
    </div>
  </div>
</section>`;
  },

  // Khối cho landing page / bài viết
  loTrinh(k) {
    return `<section class="lo-trinh"${id(k)}>
  <div class="bao">
    ${tieuDeMuc(k)}
    <ol class="lo-trinh__ds">
      ${k.buoc.map((b, i) => `<li>
        <span class="lo-trinh__so">${String(i + 1).padStart(2, '0')}</span>
        <div><h3>${an(b.ten)}</h3><p>${an(b.moTa)}</p></div>
      </li>`).join('')}
    </ol>
  </div>
</section>`;
  },

  // `capDo: "h2"` khi trang đã có tiêu đề chính ở khối khác; mặc định đây là h1 của trang.
  noiDungTho(k) {
    const the = k.capDo === 'h2' ? 'h2' : 'h1';
    return `<section class="bai-viet-than"${id(k)}>
  <div class="bao bao--hep">
    ${k.tieuDe ? `<${the}>${an(k.tieuDe)}</${the}>` : ''}
    ${k.html}
  </div>
</section>`;
  },
};

/** Dựng thân trang từ mảng khối. Khối lạ → bỏ qua kèm cảnh báo, không làm hỏng build. */
export function dungKhoi(ds = []) {
  const bo = [];
  const html = ds.map((k) => {
    const ve = khoi[k.loai];
    if (!ve) { bo.push(k.loai); return ''; }
    return ve(k);
  }).join('\n');
  return { html, bo };
}

export const cacLoaiKhoi = Object.keys(khoi);
