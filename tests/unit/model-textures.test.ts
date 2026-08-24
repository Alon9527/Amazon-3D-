import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { summarizeSceneTextures } from '@core/geometry/modelTextures'

describe('viewer texture summary', () => {
  it('returns zeroes when the scene has no texture references', () => {
    const scene = new Group()
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))

    expect(summarizeSceneTextures(scene)).toEqual({
      referencedSlots: 0,
      uniqueTextures: 0,
      readyTextures: 0,
    })
  })

  it('deduplicates one ready texture referenced by multiple material slots', () => {
    const texture = new Texture()
    texture.image = { width: 1, height: 1 }
    const scene = new Group()
    scene.add(
      new Mesh(
        new BoxGeometry(),
        new MeshStandardMaterial({ map: texture, normalMap: texture }),
      ),
    )

    expect(summarizeSceneTextures(scene)).toEqual({
      referencedSlots: 2,
      uniqueTextures: 1,
      readyTextures: 1,
    })
  })

  it('reports a referenced texture without decoded image data as not ready', () => {
    const scene = new Group()
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new Texture() })))

    expect(summarizeSceneTextures(scene)).toEqual({
      referencedSlots: 1,
      uniqueTextures: 1,
      readyTextures: 0,
    })
  })
})
