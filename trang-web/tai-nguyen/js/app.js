// Tương tác của site: menu di động, ô tìm kiếm, form tư vấn, đếm số, lọc blog.
(() => {
  const $ = (s, goc = document) => goc.querySelector(s);
  const $$ = (s, goc = document) => [...goc.querySelectorAll(s)];

  // ── Menu di động ──────────────────────────────────────────────
  const nutMenu = $('[data-mo-menu]');
  const dieuHuong = $('.dieu-huong');
  nutMenu?.addEventListener('click', () => {
    const mo = dieuHuong.hasAttribute('data-mo');
    dieuHuong.toggleAttribute('data-mo', !mo);
    nutMenu.setAttribute('aria-expanded', String(!mo));
  });
  $$('.dieu-huong a').forEach((a) => a.addEventListener('click', () => {
    dieuHuong.removeAttribute('data-mo');
    nutMenu?.setAttribute('aria-expanded', 'false');
  }));

  // ── Ô tìm kiếm ────────────────────────────────────────────────
  const oTim = $('[data-o-tim]');
  $('[data-mo-tim]')?.addEventListener('click', () => {
    oTim.hidden = !oTim.hidden;
    if (!oTim.hidden) $('input[type="search"]', oTim)?.focus();
  });
  $('[data-tim-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const tu = new FormData(e.target).get('q')?.toString().trim();
    if (!tu) return;
    if (location.pathname.startsWith('/blog')) locBai(tu);
    else location.href = `/blog/?q=${encodeURIComponent(tu)}`;
  });

  // ── Lọc bài trên trang blog ───────────────────────────────────
  function locBai(tu) {
    const chuan = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const khoa = chuan(tu);
    let con = 0;
    $$('.the--bai').forEach((the) => {
      const hop = chuan(the.textContent).includes(khoa);
      the.style.display = hop ? '' : 'none';
      if (hop) con++;
    });
    let bao = $('[data-bao-tim]');
    if (!bao) {
      bao = document.createElement('p');
      bao.dataset.baoTim = '';
      bao.style.cssText = 'margin:0 0 18px;color:#55657f';
      $('.trang-blog .luoi-the')?.before(bao);
    }
    bao.textContent = `Tìm “${tu}”: ${con} bài phù hợp.`;
  }
  const tuUrl = new URLSearchParams(location.search).get('q');
  if (tuUrl && $('.the--bai')) {
    locBai(tuUrl);
    const o = $('input[type="search"]');
    if (o) { o.value = tuUrl; oTim.hidden = false; }
  }

  // ── Hộp thoại đăng ký tư vấn ──────────────────────────────────
  const hop = $('[data-hop-thoai]');
  let phanTuTruoc = null;
  const moHop = () => {
    phanTuTruoc = document.activeElement;
    hop.hidden = false;
    document.body.style.overflow = 'hidden';
    $('input', hop)?.focus();
  };
  const dongHop = () => {
    hop.hidden = true;
    document.body.style.overflow = '';
    phanTuTruoc?.focus();
  };
  $$('a[href="#form-tu-van"], a[href$="/#form-tu-van"]').forEach((a) =>
    a.addEventListener('click', (e) => { e.preventDefault(); moHop(); }));
  $$('[data-dong-hop]', hop || document).forEach((n) => n.addEventListener('click', dongHop));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hop && !hop.hidden) dongHop(); });
  if (location.hash === '#form-tu-van' && hop) moHop();

  // ── Gửi form ──────────────────────────────────────────────────
  const form = $('[data-form-tu-van]');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bao = $('[data-bao]', form);
    const dl = Object.fromEntries(new FormData(form));
    if (!dl.ten || !dl.dienThoai) {
      bao.dataset.trangThai = 'loi';
      bao.textContent = 'Vui lòng nhập họ tên và số điện thoại.';
      return;
    }
    const nut = $('button[type="submit"]', form);
    nut.disabled = true;
    bao.dataset.trangThai = '';
    bao.textContent = 'Đang gửi…';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...dl, tuTrang: location.pathname }),
      });
      const kq = await res.json();
      if (!res.ok || kq.ok === false) throw new Error(kq.loi || 'Không gửi được');
      bao.dataset.trangThai = 'xong';
      bao.textContent = kq.thongDiep || 'Đã nhận thông tin, chúng tôi sẽ liên hệ sớm.';
      form.reset();
    } catch (err) {
      bao.dataset.trangThai = 'loi';
      bao.textContent = `Chưa gửi được (${err.message}). Bạn có thể gọi trực tiếp hotline giúp mình nhé.`;
    } finally {
      nut.disabled = false;
    }
  });

  // ── Đếm số ở thanh thông số ───────────────────────────────────
  const soMuc = $$('.thong-so__muc strong');
  if (soMuc.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const chay = (nut) => {
      const goc = nut.textContent.trim();
      const so = Number(goc.replace(/[^\d]/g, ''));
      if (!so) return;
      const truoc = goc.slice(0, goc.search(/\d/));
      const sau = goc.slice(goc.search(/\d/) + String(so).length + (goc.includes('.') ? 1 : 0));
      const batDau = performance.now();
      const ve = (luc) => {
        const t = Math.min(1, (luc - batDau) / 1100);
        const giaTri = Math.round(so * (1 - (1 - t) ** 3));
        nut.textContent = truoc + giaTri.toLocaleString('vi-VN') + sau;
        if (t < 1) requestAnimationFrame(ve);
        else nut.textContent = goc;
      };
      requestAnimationFrame(ve);
    };
    const theoDoi = new IntersectionObserver((muc) => {
      muc.forEach((m) => {
        if (!m.isIntersecting) return;
        chay(m.target);
        theoDoi.unobserve(m.target);
      });
    }, { threshold: 0.6 });
    soMuc.forEach((n) => theoDoi.observe(n));
  }

  // ── FAQ: mở 1 mục thì đóng mục khác trong cùng cột ─────────────
  $$('.faq__muc').forEach((m) => m.addEventListener('toggle', () => {
    if (!m.open) return;
    $$('.faq__muc').forEach((k) => { if (k !== m) k.open = false; });
  }));
})();
