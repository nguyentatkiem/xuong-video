import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { NenFont, TamMo, Skin, SKIN_MAC_DINH } from './chung';

type Hang = { ten: string; trai: string; phai: string };

export const SoSanh: React.FC<{ traiTen?: string; phaiTen?: string; hang?: Hang[]; skin?: Skin }> = ({
  traiTen = 'A', phaiTen = 'B', hang = [], skin = SKIN_MAC_DINH,
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const ds = hang.slice(0, 5);
  const ra = interpolate(f, [durationInFrames - 12, durationInFrames - 2], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const co = Math.round(width * 0.024);
  const kTrai = spring({ frame: f, fps, config: { damping: 14 } });
  const kPhai = spring({ frame: f - 5, fps, config: { damping: 14 } });
  const o = (nd: React.ReactNode, dam = false, mau = skin.white): React.ReactNode => (
    <span style={{ color: mau, fontWeight: dam ? 800 : 600, fontSize: co, flex: 1, textAlign: 'center' }}>{nd}</span>
  );
  return (
    <NenFont>
      <AbsoluteFill style={{ opacity: ra, alignItems: 'center', justifyContent: 'center' }}>
        <TamMo doDam={0.62} />
        <div style={{
          position: 'relative', width: '86%', background: skin.card, borderRadius: 30,
          border: `1px solid ${skin.gold}44`, padding: '34px 30px',
          boxShadow: `0 0 80px ${skin.gold}22, 0 24px 70px rgba(0,0,0,.6)`,
        }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {o('', false)}
            <span style={{ flex: 1, textAlign: 'center', color: skin.gold, fontWeight: 800, fontSize: co * 1.15, transform: `translateX(${(kTrai - 1) * 90}px)`, opacity: kTrai }}>{traiTen}</span>
            <span style={{ flex: 1, textAlign: 'center', color: skin.goldBright, fontWeight: 800, fontSize: co * 1.15, transform: `translateX(${(1 - kPhai) * 90}px)`, opacity: kPhai }}>{phaiTen}</span>
          </div>
          {ds.map((h, i) => {
            const k = spring({ frame: f - 12 - i * 8, fps, config: { damping: 15 } });
            return (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '14px 10px', borderRadius: 14,
                background: i % 2 ? 'transparent' : 'rgba(255,255,255,.045)',
                opacity: Math.min(1, k * 1.4), transform: `translateY(${(1 - k) * 14}px)`,
              }}>
                {o(h.ten, false, `${skin.white}CC`)}
                {o(h.trai, true)}
                {o(h.phai, true)}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </NenFont>
  );
};
