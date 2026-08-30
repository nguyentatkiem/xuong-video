// Xưởng Video — logic giao diện
const $ = (id) => document.getElementById(id);

const TEN_NHOM = {
  tatca: 'Tất cả', congnghe: 'Công nghệ', vlog: 'Vlog',
  podcast: 'Podcast', review: 'Review', dadung: 'Đa dụng',
};
const TEN_PHU_DE = { tu: 'Phụ đề từng-từ', dong: 'Phụ đề dòng', khong: 'Không phụ đề' };

let cacStyle = [];
let nhomDangChon = 'tatca';
let styleDangChon = null;
let tepDangChon = null;
let henGioTheoDoi = null;

// ── Nạp style từ server ────────────────────────────────────────────────
async function napStyle() {
  cacStyle = await (await fetch('/api/styles')).json();
  veTab();
  veLuoiStyle();
}

function veTab() {
  const nhomCo = ['tatca', ...new Set(cacStyle.map((s) => s.nhom))];
  $('tab-nhom').innerHTML = nhomCo
    .map((n) => `<button data-nhom="${n}" class="${n === nhomDangChon ? 'chon' : ''}">${TEN_NHOM[n] || n}</button>`)
    .join('');
  $('tab-nhom').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { nhomDangChon = b.dataset.nhom; veTab(); veLuoiStyle(); }));
}

function veLuoiStyle() {
  const hien = cacStyle.filter((s) => nhomDangChon === 'tatca' || s.nhom === nhomDangChon);
  $('luoi-style').innerHTML = hien.map((s) => {
    const nhan = [
      s.khung.startsWith('doc') ? 'Dọc 9:16' : 'Ngang 16:9',
      TEN_PHU_DE[s.phuDe],
      s.zoom?.batTat ? 'Zoom nhấn' : null,
      s.tuKhoa ? 'Từ khoá pop' : null,
      s.theChuong ? 'Thẻ chương' : null,
    ].filter(Boolean);
    return `<div class="the-style ${styleDangChon === s.id ? 'chon' : ''}" data-id="${s.id}">
      <div class="ten">${s.bieuTuong || '🎬'} ${s.ten}</div>
      <div class="mo-ta">${s.moTa}</div>
      <div class="nhan">${nhan.map((n) => `<span>${n}</span>`).join('')}</div>
    </div>`;
  }).join('');
  $('luoi-style').querySelectorAll('.the-style').forEach((o) =>
    o.addEventListener('click', () => {
      styleDangChon = o.dataset.id;
      const s = cacStyle.find((x) => x.id === styleDangChon);
      if (s?.mucCatMacDinh) $('o-muc-cat').value = s.mucCatMacDinh;
      veLuoiStyle();
      capNhatNutChay();
    }));
}

// ── Kéo thả / chọn tệp ─────────────────────────────────────────────────
const vungTha = $('vung-tha');
vungTha.addEventListener('click', () => $('chon-tep').click());
$('chon-tep').addEventListener('change', (e) => { if (e.target.files[0]) nhanTep(e.target.files[0]); });
['dragover', 'dragenter'].forEach((sk) =>
  vungTha.addEventListener(sk, (e) => { e.preventDefault(); vungTha.classList.add('keo-qua'); }));
['dragleave', 'drop'].forEach((sk) =>
  vungTha.addEventListener(sk, (e) => { e.preventDefault(); vungTha.classList.remove('keo-qua'); }));
vungTha.addEventListener('drop', (e) => {
  const tep = e.dataTransfer.files[0];
  if (tep) nhanTep(tep);
});
$('nut-doi-tep').addEventListener('click', () => {
  tepDangChon = null;
  $('tep-da-chon').classList.add('an');
  vungTha.classList.remove('an');
  capNhatNutChay();
});

function nhanTep(tep) {
  if (!/\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(tep.name)) {
    alert('Chỉ nhận tệp video: mp4, mov, mkv, webm, m4v, avi');
    return;
  }
  tepDangChon = tep;
  $('ten-tep').textContent = tep.name;
  $('co-tep').textContent = ` · ${(tep.size / 1024 / 1024).toFixed(1)} MB`;
  $('tep-da-chon').classList.remove('an');
  vungTha.classList.add('an');
  capNhatNutChay();
}

function capNhatNutChay() {
  const du = tepDangChon && styleDangChon;
  $('nut-chay').disabled = !du;
  $('nut-chay').textContent = du
    ? '🎬 Bắt đầu dựng video'
    : (!tepDangChon ? '🎬 Kéo video vào trước đã…' : '🎬 Chọn một style edit…');
}

// ── Gửi việc + theo dõi tiến độ ────────────────────────────────────────
$('nut-chay').addEventListener('click', () => {
  const duLieu = new FormData();
  duLieu.append('video', tepDangChon);
  duLieu.append('style', styleDangChon);
  duLieu.append('tieuDe', $('o-tieu-de').value);
  duLieu.append('tenKenh', $('o-ten-kenh').value);
  duLieu.append('mucCat', $('o-muc-cat').value);

  const tinhChinh = {};
  if ($('o-mat-do').value) tinhChinh.matDo = $('o-mat-do').value;
  if ($('o-phu-de').value) tinhChinh.phuDe = $('o-phu-de').value;
  if ($('o-sfx').value) tinhChinh.sfx = $('o-sfx').value === 'bat';
  duLieu.append('tinhChinh', JSON.stringify(tinhChinh));
  duLieu.append('xuatThem', ['k-ngang', 'k-doc', 'k-vuong']
    .filter((k) => $(k).checked).map((k) => $(k).value).join(','));

  $('nut-chay').disabled = true;
  $('the-ket-qua').classList.add('an');
  $('the-tien-do').classList.remove('an');
  $('chu-loi').classList.add('an');
  $('danh-sach-buoc').innerHTML = '';
  $('thanh-tai').classList.remove('an');

  // Upload bằng XHR để có % tải lên
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/viec');
  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const pt = Math.round((e.loaded / e.total) * 100);
    $('ruot-tai').style.right = (100 - pt) + '%';
    $('chu-tai').textContent = `Đang tải lên… ${pt}%`;
  };
  xhr.onload = () => {
    try {
      const kq = JSON.parse(xhr.responseText);
      if (xhr.status !== 200) throw new Error(kq.loi || 'Upload thất bại');
      $('thanh-tai').classList.add('an');
      theoDoi(kq.id);
    } catch (e) { hienLoi(e.message); }
  };
  xhr.onerror = () => hienLoi('Không kết nối được server.');
  xhr.send(duLieu);
});

function theoDoi(id) {
  clearInterval(henGioTheoDoi);
  henGioTheoDoi = setInterval(async () => {
    try {
      const v = await (await fetch(`/api/viec/${id}`)).json();
      veBuoc(v);
      if (v.trangThai === 'xong') {
        clearInterval(henGioTheoDoi);
        hienKetQua(id, v);
      } else if (v.trangThai === 'loi') {
        clearInterval(henGioTheoDoi);
        hienLoi(v.loi || 'Có lỗi trong lúc dựng.');
      }
    } catch { /* server tạm bận — thử lại lượt sau */ }
  }, 1500);
}

const ICON_BUOC = {
  cho: '·', dang: '<span class="xoay">⏳</span>', xong: '✅', boqua: '⏭️', loi: '❌',
};
function veBuoc(v) {
  $('danh-sach-buoc').innerHTML = v.buoc.map((b) =>
    `<li class="${b.trangThai}">
      <span class="icon">${ICON_BUOC[b.trangThai] || '·'}</span>
      <span>${b.ten}</span>
      <span class="chi-tiet">${b.chiTiet || ''}</span>
    </li>`).join('');
}

function hienLoi(chu) {
  $('chu-loi').textContent = '❌ ' + chu;
  $('chu-loi').classList.remove('an');
  $('nut-chay').disabled = false;
  capNhatNutChay();
}

// ── Kết quả ────────────────────────────────────────────────────────────
const TEN_BAN = { 'ra.mp4': 'Bản chính', 'ra-ngang.mp4': 'Ngang 16:9', 'ra-doc.mp4': 'Dọc 9:16', 'ra-vuong.mp4': 'Vuông 1:1' };

async function hienKetQua(id, v) {
  $('the-tien-do').classList.add('an');
  $('the-ket-qua').classList.remove('an');
  $('video-ra').src = `/api/viec/${id}/video`;
  $('tai-video').href = `/api/viec/${id}/video`;

  // các bản khung hình khác
  const cacBan = ['ra.mp4', ...((v.baoCao && v.baoCao.khungThem) || [])];
  if (cacBan.length > 1) {
    $('tab-ban').classList.remove('an');
    $('tab-ban').innerHTML = cacBan.map((b, i) =>
      `<button data-ban="${b}" class="${i === 0 ? 'chon' : ''}">${TEN_BAN[b] || b}</button>`).join('');
    $('tab-ban').querySelectorAll('button').forEach((nut) =>
      nut.addEventListener('click', () => {
        $('tab-ban').querySelectorAll('button').forEach((n) => n.classList.remove('chon'));
        nut.classList.add('chon');
        $('video-ra').src = `/api/viec/${id}/video?ban=${nut.dataset.ban}`;
        $('tai-video').href = `/api/viec/${id}/video?ban=${nut.dataset.ban}`;
      }));
  } else {
    $('tab-ban').classList.add('an');
  }
  $('tai-seo').href = `/api/viec/${id}/tep/mo-ta-seo.md`;
  $('tai-seo').setAttribute('download', 'mo-ta-seo.md');

  const bc = v.baoCao || {};
  if (bc.coTranscript) {
    $('tai-srt').classList.remove('an');
    $('tai-srt').href = `/api/viec/${id}/tep/phu-de.srt`;
    $('tai-srt').setAttribute('download', 'phu-de.srt');
  } else {
    $('tai-srt').classList.add('an');
  }

  const o = (so, nhan) => `<div class="o"><div class="so">${so}</div><div class="nhan-o">${nhan}</div></div>`;
  $('bao-cao').innerHTML = [
    o(`${(bc.thoiLuongGoc ?? 0).toFixed(0)}s → ${(bc.thoiLuongSauCat ?? 0).toFixed(0)}s`, 'thời lượng gốc → sau cắt'),
    o(`${(bc.giayDaCat ?? 0).toFixed(1)}s`, `im lặng đã cắt (${bc.soDoanCat ?? 0} chỗ)`),
    o(bc.soCanh ?? 0, 'cảnh camera ảo'),
    o(bc.soSfx ?? 0, 'hiệu ứng âm thanh'),
    o(bc.soAnh ?? 0, 'ảnh minh hoạ chèn'),
    o(bc.daoDien === 'claude' ? 'Claude' : 'Nhịp tự động', 'đạo diễn dựng'),
  ].join('');

  try {
    const seo = await (await fetch(`/api/viec/${id}/tep/mo-ta-seo.md`)).text();
    $('noi-dung-seo').textContent = seo;
  } catch { $('noi-dung-seo').textContent = '(chưa có)'; }

  $('nut-chay').disabled = false;
  capNhatNutChay();
  $('the-ket-qua').scrollIntoView({ behavior: 'smooth' });
}

$('nut-lam-lai').addEventListener('click', () => {
  $('the-ket-qua').classList.add('an');
  $('the-tien-do').classList.add('an');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Lịch sử việc ───────────────────────────────────────────────────────
async function napLichSu() {
  try {
    const ds = await (await fetch('/api/lich-su')).json();
    if (!ds.length) return;
    $('the-lich-su').classList.remove('an');
    $('danh-sach-lich-su').innerHTML = ds.map((v) => {
      const luc = v.luc ? new Date(v.luc).toLocaleString('vi-VN') : '';
      return `<li>
        <a href="/api/viec/${v.id}/video" target="_blank">▶ ${v.tieuDe || v.id}</a>
        <span class="luc">${v.style} · ${(v.thoiLuong ?? 0).toFixed(0)}s · ${luc}</span>
        <a href="/api/viec/${v.id}/tep/mo-ta-seo.md" target="_blank">SEO</a>
      </li>`;
    }).join('');
  } catch { /* chưa có lịch sử */ }
}

capNhatNutChay();
napStyle();
napLichSu();
