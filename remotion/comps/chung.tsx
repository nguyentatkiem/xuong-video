import React from 'react';
import { staticFile } from 'remotion';

export const SKIN_MAC_DINH = {
  gold: '#F7D33B', goldBright: '#FFF160', card: '#1F1C13',
  ink: '#0F0E0C', white: '#F4F2E5',
};

export type Skin = typeof SKIN_MAC_DINH;

/** Nạp font Be Vietnam Pro + đặt font mặc định cho mọi composition. */
export const NenFont: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <style>{`
      @font-face { font-family: BVP; src: url('${staticFile('fonts/BeVietnamPro-SemiBold.ttf')}'); font-weight: 600; }
      @font-face { font-family: BVP; src: url('${staticFile('fonts/BeVietnamPro-Bold.ttf')}'); font-weight: 700; }
      @font-face { font-family: BVP; src: url('${staticFile('fonts/BeVietnamPro-ExtraBold.ttf')}'); font-weight: 800; }
      * { font-family: BVP, sans-serif; box-sizing: border-box; }
    `}</style>
    {children}
  </>
);

/** Tấm nền tối mờ phủ toàn khung — để chữ nổi trên video đang chạy phía dưới. */
export const TamMo: React.FC<{ doDam?: number }> = ({ doDam = 0.55 }) => (
  <div style={{ position: 'absolute', inset: 0, background: `rgba(8,8,10,${doDam})` }} />
);
