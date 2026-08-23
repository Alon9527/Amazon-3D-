import type { ModelStats } from '@shared/analysis'

type JsonObject = Record<string, unknown>

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function accessorCount(accessors: unknown[], index: unknown): number {
  if (!Number.isInteger(index) || (index as number) < 0) return 0
  const count = object(accessors[index as number]).count
  return typeof count === 'number' && Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0
}

function primitiveElementCount(primitive: JsonObject, accessors: unknown[]): number {
  if (Number.isInteger(primitive.indices)) return accessorCount(accessors, primitive.indices)
  return accessorCount(accessors, object(primitive.attributes).POSITION)
}

function primitiveTriangleCount(primitive: JsonObject, accessors: unknown[]): number {
  const count = primitiveElementCount(primitive, accessors)
  const mode = typeof primitive.mode === 'number' ? primitive.mode : 4
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

export function analyzeGltfJson(json: Record<string, unknown>): ModelStats {
  const asset = object(json.asset)
  const accessors = array(json.accessors)
  const meshes = array(json.meshes)
  const primitives = meshes.flatMap((mesh) => array(object(mesh).primitives).map(object))
  const punctual = object(object(json.extensions).KHR_lights_punctual)
  const generator = typeof asset.generator === 'string' ? asset.generator : undefined

  return {
    gltfVersion: typeof asset.version === 'string' ? asset.version : 'unknown',
    ...(generator ? { generator } : {}),
    sceneCount: array(json.scenes).length,
    defaultScene: Number.isInteger(json.scene) ? (json.scene as number) : null,
    nodeCount: array(json.nodes).length,
    meshCount: meshes.length,
    primitiveCount: primitives.length,
    vertexCount: primitives.reduce(
      (sum, primitive) => sum + accessorCount(accessors, object(primitive.attributes).POSITION),
      0,
    ),
    triangleCount: primitives.reduce(
      (sum, primitive) => sum + primitiveTriangleCount(primitive, accessors),
      0,
    ),
    drawCallEstimate: primitives.length,
    materialCount: array(json.materials).length,
    textureCount: array(json.textures).length,
    imageCount: array(json.images).length,
    animationCount: array(json.animations).length,
    cameraCount: array(json.cameras).length,
    lightCount: array(punctual.lights).length,
    skinCount: array(json.skins).length,
  }
}
