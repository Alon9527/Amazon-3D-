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
      title: 'No scene definition found',
      description: 'No valid scenes[0] exists. Creating a scene is an Advanced Fix.',
      actual: detectRootNodes(json),
      expected: 'A valid scenes[0] definition',
      source: 'diagnostic',
      autoFixable: false,
      fixType: 'advanced',
    })
  } else if (!hasDefaultScene) {
    issues.push({
      id: 'AMZ-VIYR-SCENE-001',
      category: 'scene',
      severity: 'error',
      title: 'Default Scene Missing',
      description: 'Amazon View in Your Room may reject a GLB without an explicit default scene.',
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
      title: 'Default Scene Is Not Scene 0',
      description: 'Changing the selected scene may change the visible product and is not a Safe Fix.',
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
      title: 'Scene References Non-root Node',
      description: 'A scene node must not also be the child of another node.',
      actual: nonRootNodes,
      expected: 'Root node indexes only',
      source: 'gltf-standard',
      autoFixable: false,
      fixType: 'manual',
    })
  }

  return issues
}
