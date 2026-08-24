import { LoadingManager, Material, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { computeWorldBounds } from '@core/geometry/worldBounds'
import { sceneTextures } from '@core/geometry/modelTextures'
import type { WorldBounds } from '@shared/analysis'

export function loadSceneFromGlb(bytes: Uint8Array): Promise<Object3D> {
  const buffer = bytes.slice().buffer
  return new Promise((resolve, reject) => {
    const manager = new LoadingManager()
    let failedResource: string | null = null
    manager.onError = (url) => {
      failedResource = url
    }
    new GLTFLoader(manager).parse(
      buffer,
      '',
      (gltf) => resolve(gltf.scene),
      (error) => {
        if (failedResource?.startsWith('blob:')) {
          reject(new Error('贴图加载失败：无法解码 GLB 中的内嵌图片'))
          return
        }
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

export async function loadWorldBounds(bytes: Uint8Array): Promise<WorldBounds> {
  const scene = await loadSceneFromGlb(bytes)
  try {
    return computeWorldBounds(scene)
  } finally {
    disposeScene(scene)
  }
}

export function boundsEqual(left: WorldBounds, right: WorldBounds, epsilon = 1e-8): boolean {
  const vectors = ['min', 'max', 'size'] as const
  return vectors.every((vector) =>
    (['x', 'y', 'z'] as const).every(
      (axis) => Math.abs(left[vector][axis] - right[vector][axis]) <= epsilon,
    ),
  )
}

export function disposeScene(object: Object3D): void {
  const textures = new Map(sceneTextures(object).map((texture) => [texture.uuid, texture]))
  object.traverse((child) => {
    const renderable = child as Object3D & {
      geometry?: { dispose(): void }
      material?: Material | Material[]
    }
    renderable.geometry?.dispose()
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material]
    for (const material of materials) material?.dispose()
  })
  for (const texture of textures.values()) texture.dispose()
}
