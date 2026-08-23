import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { computeWorldBounds } from '@core/geometry/worldBounds'

describe('computeWorldBounds', () => {
  it('uses world transforms instead of local geometry dimensions', () => {
    const root = new Group()
    root.position.set(10, 2, -4)
    const mesh = new Mesh(new BoxGeometry(1, 2, 3), new MeshBasicMaterial())
    mesh.scale.set(2, 2, 2)
    root.add(mesh)

    const bounds = computeWorldBounds(root)

    expect(bounds.size).toMatchObject({ x: 2, y: 4, z: 6 })
    expect(bounds.min).toMatchObject({ x: 9, y: 0, z: -7 })
    expect(bounds.max).toMatchObject({ x: 11, y: 4, z: -1 })
  })

  it('rejects a scene without renderable geometry', () => {
    expect(() => computeWorldBounds(new Group())).toThrow('Model has no renderable geometry')
  })
})
