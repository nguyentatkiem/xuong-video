import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { NenFont, TamMo, Skin, SKIN_MAC_DINH } from './chung';

export const IntroBrand: React.FC<{ tieuDe?: string; kenh?: string; skin?: Skin }> = ({
  tieuDe = '', kenh = '', skin = SKIN_MAC_DINH,
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const vao = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const gach = spring({ frame: f - 10, fps, config: { damping: 16 } });
  const ra = interpolate(f, [durationInFrames - 12, durationInFrames - 2], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const co = Math.round(width * 0.074);
  return (
    <NenFont>
      <AbsoluteFill style={{ opacity: ra }}>
        <TamMo doDam={0.6} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 18, padding: '0 60px' }}>
          <div style={{
            color: skin.white, fontWeight: 800, fontSize: co, lineHeight: 1.15, textAlign: 'center',
            transform: `translateY(${(1 - vao) * 60}px) scale(${0.9 + vao * 0.1})`, opacity: vao,
            textShadow: '0 6px 30px rgba(0,0,0,.6)',
          }}>{tieuDe}</div>
          <div style={{
            height: 7, width: gach * width * 0.3, borderRadius: 4, background: skin.gold,
            boxShadow: `0 0 34px ${skin.gold}`,
          }} />
          {kenh ? (
            <div style={{
              color: skin.goldBright, fontWeight: 700, fontSize: co * 0.42,
              letterSpacing: '.12em', opacity: Math.min(1, Math.max(0, (f - 16) / 10)),
            }}>{kenh}</div>
          ) : null}
        </AbsoluteFill>
      </AbsoluteFill>
    </NenFont>
  );
};
