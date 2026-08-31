#!/usr/bin/env node
// Tự sinh 4 LUT .cube điện ảnh (25 điểm) — sạch bản quyền vì là toán, không phải tệp tải về.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
mkdirSync(path.join(GOC, 'lut'), { recursive: true });

const kep = (x) => Math.min(1, Math.max(0, x));
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const sCong = (x, luc) => kep(0.5 + (x - 0.5) * (1 + luc) + 0.06 * luc * Math.sin((x - 0.5) * Math.PI));

const CAC_LUT = {
  // teal–orange kinh điển: bóng ngả xanh lục lam, sáng ngả cam
  'phim-xanh-cam': (r, g, b) => {
    const l = luma(r, g, b), sang = kep((l - 0.5) * 2), toi = kep((0.5 - l) * 2);
    return [
      sCong(kep(r + 0.06 * sang - 0.03 * toi), 0.10),
      sCong(kep(g + 0.01 * sang + 0.015 * toi), 0.10),
      sCong(kep(b - 0.05 * sang + 0.06 * toi), 0.10),
    ];
  },
  // phim Kodak ấm: nâng nhẹ vùng tối (fade), trung ấm
  'kodak-am': (r, g, b) => {
    const nangToi = (x) => kep(0.03 + x * 0.97);
    return [
      sCong(kep(nangToi(r) * 1.045 + 0.012), 0.05),
      sCong(kep(nangToi(g) * 1.005), 0.05),
      sCong(kep(nangToi(b) * 0.965 - 0.008), 0.05),
    ];
  },
  // noir tương phản: khử màu mạnh + s-curve gắt
  'noir-tuong-phan': (r, g, b) => {
    const l = luma(r, g, b);
    const tron = (x) => kep(l + (x - l) * 0.35);
    return [sCong(tron(r), 0.22), sCong(tron(g), 0.22), sCong(tron(b), 0.22)];
  },
  // sáng bay bổng: nâng sáng, hạ bão hoà, phớt bạc hà
  'mint-sang': (r, g, b) => {
    const l = luma(r, g, b);
    const diu = (x) => kep(l + (x - l) * 0.86);
    return [
      kep(diu(r) * 0.985 + 0.03),
      kep(diu(g) * 1.0 + 0.035),
      kep(diu(b) * 1.005 + 0.032),
    ];
  },
};

const N = 25;
for (const [ten, ham] of Object.entries(CAC_LUT)) {
  const dong = [`# ${ten} — LUT tự sinh của Xưởng Video`, `LUT_3D_SIZE ${N}`, ''];
  for (let bi = 0; bi < N; bi++) {
    for (let gi = 0; gi < N; gi++) {
      for (let ri = 0; ri < N; ri++) {
        const [r, g, b] = ham(ri / (N - 1), gi / (N - 1), bi / (N - 1));
        dong.push(`${r.toFixed(6)} ${g.toFixed(6)} ${b.toFixed(6)}`);
      }
    }
  }
  writeFileSync(path.join(GOC, 'lut', `${ten}.cube`), dong.join('\n') + '\n');
  console.log('Đã sinh lut/' + ten + '.cube');
}
