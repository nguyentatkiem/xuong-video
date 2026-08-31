import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { NenFont, TamMo, Skin, SKIN_MAC_DINH } from './chung';

type TieuChi = { ten: string; diem: number };

export const Scorecard: React.FC<{ tieuChi?: TieuChi[]; tong?: number; skin?: Skin }> = ({
  tieuChi = [], tong, skin = SKIN_MAC_DINH,
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const ds = tieuChi.slice(0, 5);
  const ra = interpolate(f, [durationInFrames - 12, durationInFrames - 2], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const co = Math.round(width * 0.026);
  return (
    <NenFont>
      <AbsoluteFill style={{ opacity: ra, alignItems: 'center', justifyContent: 'center' }}>
        <TamMo doDam={0.62} />
        <div style={{
          position: 'relative', width: '82%', background: skin.card, borderRadius: 30,
          border: `1px solid ${skin.gold}44`, padding: '38px 42px',
          boxShadow: `0 0 80px ${skin.gold}22, 0 24px 70px rgba(0,0,0,.6)`,
        }}>
          <div style={{ color: skin.gold, fontWeight: 800, fontSize: co * 0.8, letterSpacing: '.2em', marginBottom: 22 }}>BẢNG CHẤM ĐIỂM</div>
          {ds.map((tc, i) => {
            const k = spring({ frame: f - 8 - i * 9, fps, config: { damping: 15 } });
            const diem = Math.max(0, Math.min(10, tc.diem));
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18, opacity: Math.min(1, k * 1.4) }}>
                <span style={{ color: skin.white, fontWeight: 600, fontSize: co, width: '38%' }}>{tc.ten}</span>
                <span style={{ flex: 1, height: 16, borderRadius: 8, background: 'rgba(255,255,255,.09)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 8, width: `${k * diem * 10}%`, background: skin.gold, boxShadow: `0 0 14px ${skin.gold}` }} />
                </span>
                <b style={{ color: skin.gold, fontWeight: 800, fontSize: co, width: 64, textAlign: 'right' }}>{(k * diem).toFixed(1)}</b>
              </div>
            );
          })}
          {tong !== undefined ? (() => {
            const k = spring({ frame: f - 8 - ds.length * 9, fps, config: { damping: 12 } });
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, paddingTop: 22, borderTop: `1px solid ${skin.gold}33`, transform: `scale(${0.8 + k * 0.2})`, opacity: k }}>
                <span style={{ color: skin.white, fontWeight: 700, fontSize: co * 1.1 }}>TỔNG</span>
                <b style={{ color: skin.gold, fontWeight: 800, fontSize: co * 2, textShadow: `0 0 30px ${skin.gold}` }}>{(k * tong).toFixed(1)}</b>
              </div>
            );
          })() : null}
        </div>
      </AbsoluteFill>
    </NenFont>
  );
};
