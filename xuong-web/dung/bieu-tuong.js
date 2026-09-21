// Bộ biểu tượng SVG nội tuyến (24×24, nét 1.7) — không phụ thuộc thư viện ngoài.
const NET = {
  agent: '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="M8 10h.01M16 10h.01M9 14h6M12 4V2"/>',
  auto: '<path d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 7 4"/><path d="M20 12a8 8 0 0 1-8 8 8 8 0 0 1-7-4"/><path d="M19 4v4h-4M5 20v-4h4"/>',
  content: '<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
  sales: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="M13 8l4-4 3 3"/>',
  analytics: '<path d="M4 20V10M10 20V4M16 20v-6M21 20H3"/>',
  growth: '<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/>',
  nguoi: '<path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.2"/><path d="M19 19v-2a4 4 0 0 0-3-3.8"/>',
  'huy-chuong': '<circle cx="12" cy="9" r="5.2"/><path d="M8.5 13.5L7 22l5-2.6L17 22l-1.5-8.5"/>',
  micro: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/>',
  'toa-nha': '<path d="M3 21V6l7-3v18M10 21h11V10l-11-4"/><path d="M14 13h3M14 17h3M6 10h1M6 14h1"/>',
  tim: '<path d="M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6c0 5-7 9.4-7 9.4z"/>',
  'chi-phi': '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v10M14.6 9.4c-.6-.9-1.6-1.2-2.6-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2.1 2.7.8 2.7 2.1-1.2 2.1-2.7 2.1c-1.1 0-2.2-.4-2.7-1.3"/>',
  'qua-tai': '<circle cx="9" cy="7" r="3.2"/><path d="M3 19v-1.6A4.4 4.4 0 0 1 7.4 13h3.2"/><path d="M15 13h6M15 17h6M15 21h4"/>',
  marketing: '<path d="M4 10v4h3l6 4V6L7 10H4z"/><path d="M17.5 9a4.5 4.5 0 0 1 0 6"/><path d="M20 6.5a8 8 0 0 1 0 11"/>',
  'tang-truong': '<path d="M3 20h18"/><rect x="5" y="12" width="3.6" height="6" rx="1"/><rect x="10.2" y="8" width="3.6" height="10" rx="1"/><rect x="15.4" y="4" width="3.6" height="14" rx="1"/>',
  cskh: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4" height="6" rx="2"/><rect x="17.5" y="13" width="4" height="6" rx="2"/><path d="M19.5 19a3.5 3.5 0 0 1-3.5 3h-2"/>',
  mindset: '<path d="M12 3a5 5 0 0 0-5 5c0 1.4.6 2.6 1.5 3.5V15a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3.5A4.9 4.9 0 0 0 17 8a5 5 0 0 0-5-5z"/><path d="M10 21h4M12 3v14"/>',
  workflow: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2.2 2.2M16.8 16.8L19 19M19 5l-2.2 2.2M7.2 16.8L5 19"/>',
  scale: '<path d="M3 21V3"/><path d="M7 17l4-4 3 2 6-7"/><path d="M16 11h4V7"/><path d="M3 21h18"/>',
  'thuc-chien': '<path d="M12 2l2.6 5.6 6 .9-4.4 4.2 1.1 6.1L12 16l-5.3 2.8 1.1-6.1L3.4 8.5l6-.9z"/>',
  'he-thong': '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7M17.5 14v7"/>',
  'trien-khai': '<path d="M5 19c2-6 6-10 14-11-1 8-5 12-11 14"/><path d="M8.5 15.5l-3.2.7.7-3.2"/><path d="M4 20l2.5-2.5"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  play: '<path d="M8 5.5l11 6.5-11 6.5z"/>',
  'mui-ten': '<path d="M4 12h15M13 6l6 6-6 6"/>',
  lich: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'dia-diem': '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  tim_kiem: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M3 7.5l9 6 9-6"/>',
  phone: '<path d="M6 3h3l2 5-2.4 1.4a12 12 0 0 0 5.6 5.6L16 12.6l5 2v3a2.4 2.4 0 0 1-2.6 2.4C10.9 17.6 5.9 12.6 3.6 5.6A2.4 2.4 0 0 1 6 3z"/>',
  the_gioi: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.2 2.4 3.4 5.4 3.4 8.6S14.2 18.2 12 20.6c-2.2-2.4-3.4-5.4-3.4-8.6S9.8 5.8 12 3.4z"/>',
  headphone: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="13" width="4.5" height="7" rx="2.2"/><rect x="17" y="13" width="4.5" height="7" rx="2.2"/>',
  cong: '<path d="M12 5v14M5 12h14"/>',
  xuong: '<path d="M6 9.5l6 6 6-6"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.5 9.5l5 2.5-5 2.5z"/>',
  facebook: '<path d="M14 8.5V7c0-.9.6-1.5 1.5-1.5H17V2.5h-2.5A4.2 4.2 0 0 0 10.2 7v1.5H8v3.2h2.2V21.5h3.8V11.7h2.5l.5-3.2z"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7.5 10.5V17M7.5 7.3v.1M11.5 17v-3.6a2.2 2.2 0 0 1 4.4 0V17"/>',
  tiktok: '<path d="M14 3.5v11a3.6 3.6 0 1 1-3.6-3.6h.6"/><path d="M14 6.4c.8 1.6 2.3 2.6 4.2 2.7"/>',
};

/**
 * Trả SVG nội tuyến cho một tên biểu tượng.
 * Tên lạ → khối tròn trung tính, trang vẫn dựng được.
 */
export function bieuTuong(ten, lop = 'bt') {
  const net = NET[ten] || '<circle cx="12" cy="12" r="8"/>';
  return `<svg class="${lop}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${net}</svg>`;
}

export const coBieuTuong = (ten) => Object.hasOwn(NET, ten);
