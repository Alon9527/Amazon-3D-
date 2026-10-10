import { writeGlbWithJsonText } from '@core/glb/writer'
import type { ParsedGlb } from '@core/glb/parser'
import type { WarningCleanupItem, WarningCleanupPlan } from '@shared/analysis'
import type { ValidationIssue } from '@shared/types'
import { cleanupImageMetadata } from './imageMetadata'

type Json = Record<string, unknown>
function object(value: unknown): Json { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {} }
function array(value: unknown): Json[] { return Array.isArray(value) ? value.map(object) : [] }
const BIN = 0x004e4942
const UV_EXTENSIONS = new Set(['KHR_texture_transform', 'KHR_materials_unlit', 'KHR_materials_variants', 'KHR_lights_punctual'])

export function embeddedImage(parsed: ParsedGlb, imageIndex: number) {
  const image = array(parsed.json.images)[imageIndex]
  if (!image || typeof image.bufferView !== 'number' || image.uri !== undefined) throw new Error('仅支持 BIN 中的内嵌图片')
  const view = array(parsed.json.bufferViews)[image.bufferView]
  const bins = parsed.chunks.filter((chunk) => chunk.type === BIN)
  if (!view || view.buffer !== 0 || bins.length !== 1 || object(array(parsed.json.buffers)[0]).uri !== undefined) throw new Error('图片不是单一 GLB BIN buffer')
  const offset = Number(view.byteOffset ?? 0), length = Number(view.byteLength)
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 1 || offset + length > bins[0].data.length) throw new Error('图片范围越界')
  return { image, view, offset, length, bufferView: image.bufferView, bytes: bins[0].data.subarray(offset, offset + length), mime: String(image.mimeType) }
}

function referenceCount(value: unknown, bufferView: number): number {
  if (Array.isArray(value)) return value.reduce((sum, child) => sum + referenceCount(child, bufferView), 0)
  if (!value || typeof value !== 'object') return 0
  return Object.entries(value).reduce((sum, [key, child]) => sum + (key === 'bufferView' && child === bufferView ? 1 : referenceCount(child, bufferView)), 0)
}

function imageEligibility(parsed: ParsedGlb, index: number): string {
  if (Array.isArray(parsed.json.extensionsUsed) && parsed.json.extensionsUsed.some((name) => !UV_EXTENSIONS.has(String(name)))) throw new Error('存在未覆盖的扩展，无法证明图片范围独占，保留原图')
  const image = embeddedImage(parsed, index)
  if (referenceCount(parsed.json, image.bufferView) !== 1) throw new Error('图片 bufferView 被共享或被其他数据引用，保留原图')
  const overlaps = array(parsed.json.bufferViews).some((view, viewIndex) => {
    if (viewIndex === image.bufferView || view.buffer !== 0) return false
    const offset = Number(view.byteOffset ?? 0), length = Number(view.byteLength)
    return offset < image.offset + image.length && offset + length > image.offset
  })
  if (overlaps) throw new Error('图片数据与其他 bufferView 重叠，保留原图')
  const result = cleanupImageMetadata(image.bytes, image.mime)
  if (result.status !== 'cleaned') throw new Error(result.reason ?? '没有可安全清理的元数据；可能需要人工重新编码')
  return `清理 ${result.removed.join('、')}；不重新编码像素`
}

function materialUsesUv(material: Json, uv: number): boolean {
  const pbr = object(material.pbrMetallicRoughness)
  const textures = [pbr.baseColorTexture, pbr.metallicRoughnessTexture, material.normalTexture, material.occlusionTexture, material.emissiveTexture]
  return textures.some((value) => {
    const info = object(value)
    if (typeof info.index !== 'number') return false
    const transform = object(object(info.extensions).KHR_texture_transform)
    return (transform.texCoord ?? info.texCoord ?? 0) === uv
  })
}

function uvPrimitive(json: Json, pointer: string) {
  const match = /^\/meshes\/(\d+)\/primitives\/(\d+)\/attributes\/(TEXCOORD_(\d+))$/.exec(pointer)
  if (!match) throw new Error('此信息提示不在自动清理范围，可保留')
  const primitive = array(array(json.meshes)[Number(match[1])]?.primitives)[Number(match[2])]
  if (!primitive || !Object.hasOwn(object(primitive.attributes), match[3])) throw new Error('找不到目标 UV 属性')
  return { primitive, semantic: match[3], uv: Number(match[4]) }
}

function uvEligibility(parsed: ParsedGlb, pointer: string): string {
  const { primitive, uv } = uvPrimitive(parsed.json, pointer)
  const extensions = Array.isArray(parsed.json.extensionsUsed) ? parsed.json.extensionsUsed : []
  if (extensions.some((name) => !UV_EXTENSIONS.has(String(name))) || Object.keys(object(primitive.extensions)).some((name) => name !== 'KHR_materials_variants')) throw new Error('存在未覆盖的扩展，无法确认 UV 用途')
  const materials = array(parsed.json.materials)
  const materialIds = [primitive.material, ...array(object(object(primitive.extensions).KHR_materials_variants).mappings).map((mapping) => mapping.material)]
  if (materialIds.some((index) => typeof index === 'number' && materialUsesUv(materials[index] ?? {}, uv))) throw new Error('材质或材质变体仍使用此 UV，不删除')
  return '移除未使用的 UV 引用；保留原始几何字节'
}

export function planWarningCleanup(parsed: ParsedGlb, issues: ValidationIssue[]): WarningCleanupPlan {
  const hasErrors = issues.some((issue) => issue.severity === 'error')
  const items: WarningCleanupItem[] = issues.filter((issue) => ['GLTF-UNUSED_OBJECT', 'GLTF-IMAGE_FEATURES_UNSUPPORTED'].includes(issue.id)).map((issue) => {
    const pointer = typeof issue.actual === 'string' ? issue.actual : ''
    const kind = issue.id === 'GLTF-IMAGE_FEATURES_UNSUPPORTED' ? 'image' : /\/attributes\/TEXCOORD_\d+$/.test(pointer) ? 'uv' : 'other'
    try {
      if (hasErrors) throw new Error('先处理 glTF 错误，再生成安全清理候选')
      let message: string
      if (kind === 'image') {
        const match = /^\/images\/(\d+)$/.exec(pointer)
        if (!match) throw new Error('图片索引无法确认')
        message = imageEligibility(parsed, Number(match[1]))
      } else message = uvEligibility(parsed, pointer)
      return { issueId: issue.id, pointer, kind, status: 'eligible' as const, message }
    } catch (error) {
      return { issueId: issue.id, pointer, kind, status: 'skipped' as const, message: error instanceof Error ? error.message : '无法安全自动处理' }
    }
  })
  return { items, fixableCount: items.filter((item) => item.status === 'eligible').length }
}

type Reference = { holder: Json; key: string }
function accessorReferences(json: Json): Reference[] {
  const refs: Reference[] = []
  for (const mesh of array(json.meshes)) for (const primitive of array(mesh.primitives)) {
    if (typeof primitive.indices === 'number') refs.push({ holder: primitive, key: 'indices' })
    for (const attributes of [object(primitive.attributes), ...array(primitive.targets)]) for (const key of Object.keys(attributes)) if (typeof attributes[key] === 'number') refs.push({ holder: attributes, key })
  }
  for (const animation of array(json.animations)) for (const sampler of array(animation.samplers)) for (const key of ['input', 'output']) if (typeof sampler[key] === 'number') refs.push({ holder: sampler, key })
  for (const skin of array(json.skins)) if (typeof skin.inverseBindMatrices === 'number') refs.push({ holder: skin, key: 'inverseBindMatrices' })
  return refs
}

function viewReferences(json: Json): Reference[] {
  const refs: Reference[] = []
  for (const accessor of array(json.accessors)) for (const holder of [accessor, object(object(accessor.sparse).indices), object(object(accessor.sparse).values)]) if (typeof holder.bufferView === 'number') refs.push({ holder, key: 'bufferView' })
  for (const image of array(json.images)) if (typeof image.bufferView === 'number') refs.push({ holder: image, key: 'bufferView' })
  return refs
}

function prune(json: Json, key: 'accessors' | 'bufferViews', candidates: Set<number>, refs: Reference[]): Json[] {
  const used = new Set(refs.map((ref) => Number(ref.holder[ref.key])))
  const mapping = new Map<number, number>()
  const removed: Json[] = []
  const kept = array(json[key]).filter((item, index) => {
    if (candidates.has(index) && !used.has(index)) { removed.push(item); return false }
    mapping.set(index, mapping.size); return true
  })
  for (const ref of refs) {
    const mapped = mapping.get(Number(ref.holder[ref.key]))
    if (mapped === undefined) throw new Error('引用重映射失败；拒绝生成候选')
    ref.holder[ref.key] = mapped
  }
  json[key] = kept
  return removed
}

export function applyWarningCleanup(parsed: ParsedGlb, plan: WarningCleanupPlan) {
  const json = structuredClone(parsed.json)
  const chunks = parsed.chunks.map((chunk) => ({ type: chunk.type, data: chunk.type === BIN ? chunk.data.slice() : chunk.data }))
  const mutable = { ...parsed, json, chunks }
  const bin = chunks.find((chunk) => chunk.type === BIN)
  const regions: { offset: number; length: number; imageIndex: number }[] = []
  const unusedAccessors = new Set<number>()
  const items = plan.items.map((item): WarningCleanupItem => {
    if (item.status !== 'eligible') return item
    if (item.kind === 'image') {
      const imageIndex = Number(item.pointer.split('/')[2])
      const image = embeddedImage(mutable, imageIndex)
      const cleaned = cleanupImageMetadata(image.bytes, image.mime)
      if (!bin || cleaned.status !== 'cleaned' || cleaned.bytes.length > image.length) throw new Error('图片清理候选无效')
      regions.push({ offset: image.offset, length: image.length, imageIndex })
      bin.data.fill(0, image.offset, image.offset + image.length)
      bin.data.set(cleaned.bytes, image.offset)
      image.view.byteLength = cleaned.bytes.length
    } else {
      const { primitive, semantic } = uvPrimitive(json, item.pointer)
      const attributes = object(primitive.attributes)
      unusedAccessors.add(Number(attributes[semantic]))
      delete attributes[semantic]
    }
    return { ...item, status: 'fixed' }
  })
  if (unusedAccessors.size) {
    const removed = prune(json, 'accessors', unusedAccessors, accessorReferences(json))
    const candidates = new Set<number>()
    for (const accessor of removed) for (const holder of [accessor, object(object(accessor.sparse).indices), object(object(accessor.sparse).values)]) if (typeof holder.bufferView === 'number') candidates.add(holder.bufferView)
    prune(json, 'bufferViews', candidates, viewReferences(json))
  }
  return { fixedBytes: writeGlbWithJsonText(mutable, JSON.stringify(json)), items, regions }
}
