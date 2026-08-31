import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { NenFont, TamMo, Skin, SKIN_MAC_DINH } from './chung';

/** Màn hình cuối kiểu YouTube: nút đăng ký nhấp nháy + 2 ô "video tiếp theo". */
export const ManHinhCuoi: React.FC<{ kenh?: string; loiKeu?: string; skin?: Skin }> = ({
  kenh = '@kenh', loiKeu = 'ĐĂNG KÝ', skin = SKIN_MAC_DINH,
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const doc = height > width;
  const ra = interpolate(f, [durationInFrames - 10, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const co = Math.round(width * 0.036);
  const oVideo = (i: number) => {
    const k = spring({ frame: f - 6 - i * 7, fps, config: { damping: 14 } });
    return (
      <div key={i} style={{
        width: doc ? '72%' : '38%', aspectRatio: '16/9', borderRadius: 22,
        background: skin.card, border: `1.5px dashed ${skin.gold}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: `${skin.white}99`, fontWeight: 600, fontSize: co * 0.7,
        transform: `scale(${0.85 + k * 0.15})`, opacity: k,
      }}>▶ Video tiếp theo</div>
    );
  };
  const kNut = spring({ frame: f - 20, fps, config: { damping: 10, stiffness: 150 } });
  const nhip = 1 + Math.sin(f / 6) * 0.03;
  return (
    <NenFont>
      <AbsoluteFill style={{ opacity: ra }}>
        <TamMo doDam={0.78} />
        <AbsoluteFill style={{
          alignItems: 'center', justifyContent: 'center', gap: 30,
          flexDirection: doc ? 'column' : 'row', flexWrap: 'wrap', padding: 40,
        }}>
          {oVideo(0)}{oVideo(1)}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: skin.gold, color: '#0B0A08', fontWeight: 800, fontSize: co,
              padding: `${co * 0.55}px ${co * 1.3}px`, borderRadius: 999,
              transform: `scale(${kNut * nhip})`, boxShadow: `0 0 54px ${skin.gold}88`,
            }}>🔔 {loiKeu}</div>
            <div style={{ color: skin.goldBright, fontWeight: 700, fontSize: co * 0.55, opacity: kNut }}>{kenh}</div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </NenFont>
  );
};
