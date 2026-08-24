import type { Material, Object3D, Texture } from 'three'

export interface TextureLoadSummary {
  referencedSlots: number
  uniqueTextures: number
  readyTextures: number
}

const textureSlots = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'lightMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularMap',
  'specularColorMap',
  'specularIntensityMap',
  'transmissionMap',
  'thicknessMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
] as const

function materialTextures(material: Material): Texture[] {
  const record = material as unknown as Record<string, unknown>
  return textureSlots.flatMap((slot) => {
    const candidate = record[slot] as { isTexture?: boolean } | undefined
    return candidate?.isTexture ? [candidate as Texture] : []
  })
}

export function sceneTextures(root: Object3D): Texture[] {
  const result: Texture[] = []
  root.traverse((child) => {
    const material = (child as Object3D & { material?: Material | Material[] }).material
    const materials = Array.isArray(material) ? material : material ? [material] : []
    for (const candidate of materials) result.push(...materialTextures(candidate))
  })
  return result
}

export function summarizeSceneTextures(root: Object3D): TextureLoadSummary {
  const references = sceneTextures(root)
  const unique = new Map(references.map((texture) => [texture.uuid, texture]))
  const readyTextures = [...unique.values()].filter(
    (texture) => texture.image != null || texture.source?.data != null,
  ).length
  return {
    referencedSlots: references.length,
    uniqueTextures: unique.size,
    readyTextures,
  }
}
