import { Color, Scene, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { attachStudioEnvironment } from '@core/geometry/studioEnvironment'

describe('studio environment', () => {
  it('adds image-based lighting without replacing the dark viewport background', () => {
    const scene = new Scene()
    const background = new Color('#101315')
    const previousEnvironment = new Texture()
    const studioEnvironment = new Texture()
    scene.background = background
    scene.environment = previousEnvironment

    const restore = attachStudioEnvironment(scene, studioEnvironment)

    expect(scene.environment).toBe(studioEnvironment)
    expect(scene.background).toBe(background)

    restore()

    expect(scene.environment).toBe(previousEnvironment)
    expect(scene.background).toBe(background)
  })
})
