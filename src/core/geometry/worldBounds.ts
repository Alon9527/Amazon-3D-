import { Box3, Vector3, type Object3D } from 'three'
import type { WorldBounds } from '@shared/analysis'

function value(vector: Vector3): { x: number; y: number; z: number } {
  return { x: vector.x, y: vector.y, z: vector.z }
}

export function computeWorldBounds(object: Object3D): WorldBounds {
  object.updateMatrixWorld(true)
  const box = new Box3().setFromObject(object, true)
  if (box.isEmpty()) throw new Error('Model has no renderable geometry')

  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  return {
    min: value(box.min),
    max: value(box.max),
    size: value(size),
    center: value(center),
  }
}
