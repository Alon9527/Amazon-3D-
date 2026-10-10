import type { Scene, Texture } from 'three'

export function attachStudioEnvironment(scene: Scene, environment: Texture): () => void {
  const previousEnvironment = scene.environment
  scene.environment = environment

  return () => {
    scene.environment = previousEnvironment
  }
}
