import React from 'react';
import { Composition } from 'remotion';
import { IntroBrand } from './comps/IntroBrand';
import { Scorecard } from './comps/Scorecard';
import { SoSanh } from './comps/SoSanh';
import { OutroCta } from './comps/OutroCta';
import { SKIN_MAC_DINH } from './comps/chung';

// Kích thước/thời lượng lấy từ inputProps lúc render (calculateMetadata)
const đo = ({ props }: { props: any }) => ({
  width: Number(props.rong) || 1080,
  height: Number(props.cao) || 1920,
  fps: 30,
  durationInFrames: Math.max(30, Math.round((Number(props.giay) || 3) * 30)),
});

export const Root: React.FC = () => (
  <>
    <Composition id="intro" component={IntroBrand} width={1080} height={1920} fps={30}
      durationInFrames={90} calculateMetadata={đo}
      defaultProps={{ tieuDe: 'Tiêu đề', kenh: '@kenh', skin: SKIN_MAC_DINH, rong: 1080, cao: 1920, giay: 3 }} />
    <Composition id="scorecard" component={Scorecard} width={1080} height={1920} fps={30}
      durationInFrames={150} calculateMetadata={đo}
      defaultProps={{ tieuChi: [{ ten: 'Thiết kế', diem: 9 }], tong: 8.6, skin: SKIN_MAC_DINH, rong: 1080, cao: 1920, giay: 5 }} />
    <Composition id="sosanh" component={SoSanh} width={1080} height={1920} fps={30}
      durationInFrames={150} calculateMetadata={đo}
      defaultProps={{ traiTen: 'A', phaiTen: 'B', hang: [{ ten: 'Pin', trai: '10h', phai: '8h' }], skin: SKIN_MAC_DINH, rong: 1080, cao: 1920, giay: 5 }} />
    <Composition id="outro" component={OutroCta} width={1080} height={1920} fps={30}
      durationInFrames={105} calculateMetadata={đo}
      defaultProps={{ loiKeu: 'ĐĂNG KÝ KÊNH', kenh: '@kenh', skin: SKIN_MAC_DINH, rong: 1080, cao: 1920, giay: 3.5 }} />
  </>
);
