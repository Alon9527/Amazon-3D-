import type { ValidationIssue } from '@shared/types'

interface GltfNode {
  children?: unknown
}

function nodesFrom(json: Record<string, unknown>): GltfNode[] {
  return Array.isArray(json.nodes)
    ? json.nodes.map((node) => (node !== null && typeof node === 'object' ? node : {}))
    : []
}

function childIndexes(nodes: GltfNode[]): Set<number> {
  const children = new Set<number>()
  for (const node of nodes) {
    if (!Array.isArray(node.children)) continue
    for (const child of node.children) {
      if (Number.isInteger(child) && (child as number) >= 0) children.add(child as number)
    }
  }
  return children
}

export function detectRootNodes(json: Record<string, unknown>): number[] {
  const nodes = nodesFrom(json)
  const children = childIndexes(nodes)
  return nodes.map((_, index) => index).filter((index) => !children.has(index))
}

function referencedNonRootNodes(json: Record<string, unknown>): number[] {
  if (!Array.isArray(json.scenes)) return []
  const children = childIndexes(nodesFrom(json))
  const invalid = new Set<number>()
  for (const scene of json.scenes) {
    if (scene === null || typeof scene !== 'object') continue
    const sceneNodes = (scene as { nodes?: unknown }).nodes
    if (!Array.isArray(sceneNodes)) continue
    for (const index of sceneNodes) {
      if (Number.isInteger(index) && children.has(index as number)) invalid.add(index as number)
    }
  }
  return [...invalid].sort((a, b) => a - b)
}

export function validateSceneRules(json: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const scenes = Array.isArray(json.scenes) ? json.scenes : []
  const hasSceneZero = scenes.length > 0 && scenes[0] !== null && typeof scenes[0] === 'object'
  const hasDefaultScene = Object.hasOwn(json, 'scene')

  if (!hasSceneZero) {
    issues.push({
      id: 'AMZ-VIYR-SCENE-003',
      category: 'scene',
      severity: 'error',
      title: '未找到场景定义',
      description: '不存在有效的 scenes[0]；创建场景属于高级修复。',
      actual: detectRootNodes(json),
      expected: '有效的 scenes[0] 定义',
      source: 'diagnostic',
      autoFixable: false,
      fixType: 'advanced',
    })
  } else if (!hasDefaultScene) {
    issues.push({
      id: 'AMZ-VIYR-SCENE-001',
      category: 'scene',
      severity: 'error',
      title: '缺少默认场景',
      description: '未显式指定默认场景的 GLB 可能被 Amazon View in Your Room 拒绝。',
      actual: undefined,
      expected: 0,
      source: 'amazon-validator-observed',
      autoFixable: true,
      fixType: 'safe',
    })
  } else if (json.scene !== 0) {
    issues.push({
      id: 'AMZ-VIYR-SCENE-002',
      category: 'scene',
      severity: 'error',
      title: '默认场景不是 scene 0',
      description: '更改已选择的场景可能改变可见商品，因此不能自动安全修复。',
      actual: json.scene,
      expected: 0,
      source: 'amazon-validator-observed',
      autoFixable: false,
      fixType: 'manual',
    })
  }

  const nonRootNodes = referencedNonRootNodes(json)
  if (nonRootNodes.length > 0) {
    issues.push({
      id: 'GLTF-SCENE-ROOT-001',
      category: 'scene',
      severity: 'error',
      title: '场景引用了非根节点',
      description: '场景节点不能同时是其他节点的子节点。',
      actual: nonRootNodes,
      expected: '仅包含根节点索引',
      source: 'gltf-standard',
      autoFixable: false,
      fixType: 'manual',
    })
  }

  return issues
}
