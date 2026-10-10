import neutralUrl from '../assets/hdr/studio_small_08_1k.hdr?url'
import softUrl from '../assets/hdr/studio_small_09_1k.hdr?url'
import contrastUrl from '../assets/hdr/studio_small_03_1k.hdr?url'
import roomUrl from '../assets/hdr/small_empty_room_1_1k.hdr?url'
import skyUrl from '../assets/hdr/overcast_soil_puresky_1k.hdr?url'

export const HDR_PRESETS = [
  { id: 'neutral', name: '电商中性参考', url: neutralUrl, description: '中性摄影棚 · 均匀柔光，适合默认材质检查', asset: 'studio_small_08' },
  { id: 'soft', name: '柔光摄影棚', url: softUrl, description: '柔和箱灯 · 检查浅色塑料、陶瓷和表面细节', asset: 'studio_small_09' },
  { id: 'contrast', name: '对比摄影棚', url: contrastUrl, description: '方向性灯光 · 检查金属反射和高光层次', asset: 'studio_small_03' },
  { id: 'room', name: '室内自然光', url: roomUrl, description: '室内窗光 · 检查自然环境中的色彩', asset: 'small_empty_room_1' },
  { id: 'sky', name: '室外阴天', url: skyUrl, description: '阴天天空 · 检查宽广柔和的环境反射', asset: 'overcast_soil_puresky' },
] as const

export type HdrPresetId = typeof HDR_PRESETS[number]['id']
