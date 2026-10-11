import React from 'react';
import {Composition} from 'remotion';
import {Opening, OPENING_FRAMES} from './Opening';

/* durationInFrames 直接引用 Opening 的时间表 ——
   改了镜头长度不会两边对不上，也不会和 opening-audio.wav（25.00 秒）错位。 */
export const RemotionRoot:React.FC=()=> <>
  <Composition
    id="Opening"
    component={Opening}
    durationInFrames={OPENING_FRAMES}
    fps={24}
    width={1280}
    height={720}
  />
</>;
