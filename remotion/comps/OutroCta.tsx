import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { NenFont, TamMo, Skin, SKIN_MAC_DINH } from './chung';

export const OutroCta: React.FC<{ loiKeu?: string; kenh?: string; skin?: Skin }> = ({
  loiKeu = 'ĐĂNG KÝ KÊNH', kenh = '', skin = SKIN_MAC_DINH,
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const vao = spring({ frame: f, fps, config: { damping: 11, stiffness: 130 } });
  const nhip = 1 + Math.sin(f / 7) * 0.02; // nút "thở" nhẹ chờ bấm
  const ra = interpolate(f, [durationInFrames - 10, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const co = Math.round(width * 0.045);
  return (
    <NenFont>
      <AbsoluteFill style={{ opacity: ra, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <TamMo doDam={0.6} />
        <div style={{
          position: 'relative', background: skin.gold, color: '#0B0A08', fontWeight: 800,
          fontSize: co, padding: `${co * 0.6}px ${co * 1.4}px`, borderRadius: 999,
          transform: `scale(${vao * nhip})`, boxShadow: `0 0 60px ${skin.gold}88`,
          letterSpacing: '.02em',
        }}>{loiKeu}</div>
        {kenh ? (
          <div style={{
            position: 'relative', color: skin.goldBright, fontWeight: 700, fontSize: co * 0.55,
            opacity: Math.min(1, Math.max(0, (f - 12) / 10)), letterSpacing: '.1em',
          }}>{kenh}</div>
        ) : null}
      </AbsoluteFill>
    </NenFont>
  );
};
