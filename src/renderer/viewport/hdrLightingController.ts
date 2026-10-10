import { Color, NeutralToneMapping, PMREMGenerator, type DataTexture, type Scene, type WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { LightingSettings } from '../store/lightingStore'
import { attachStudioEnvironment } from '@core/geometry/studioEnvironment'

/** Imperative Three.js state is isolated from React state and from GLB material data. */
export function createHdrLightingController(gl: WebGLRenderer, scene: Scene) {
  const original = {
    background: scene.background,
    intensity: scene.environmentIntensity,
    rotation: scene.environmentRotation.clone(),
    backgroundRotation: scene.backgroundRotation.clone(),
    backgroundIntensity: scene.backgroundIntensity,
    toneMapping: gl.toneMapping,
    exposure: gl.toneMappingExposure,
  }
  const darkBackground = new Color('#101315')
  const room = new RoomEnvironment()
  const generator = new PMREMGenerator(gl)
  const fallback = generator.fromScene(room, 0.04)
  room.dispose()
  generator.dispose()
  const restoreEnvironment = attachStudioEnvironment(scene, fallback.texture)
  let active = { target: fallback, texture: null as DataTexture | null, name: '备用中性照明' }
  gl.toneMapping = NeutralToneMapping

  const applySettings = (settings: LightingSettings) => {
    scene.environmentIntensity = settings.intensity
    scene.backgroundIntensity = settings.intensity
    scene.environmentRotation.set(0, settings.rotation * Math.PI / 180, 0)
    scene.backgroundRotation.copy(scene.environmentRotation)
    scene.background = settings.showBackground && active.texture ? active.texture : darkBackground
    gl.toneMappingExposure = Math.pow(2, settings.exposureEV)
  }

  return {
    get activeName() { return active.name },
    applySettings,
    install(texture: DataTexture, name: string, settings: LightingSettings) {
      const nextGenerator = new PMREMGenerator(gl)
      try {
        const target = nextGenerator.fromEquirectangular(texture)
        const previous = active
        active = { target, texture, name }
        scene.environment = target.texture
        applySettings(settings)
        previous.target.dispose()
        previous.texture?.dispose()
      } catch (error) {
        texture.dispose()
        throw error
      } finally {
        nextGenerator.dispose()
      }
    },
    dispose() {
      restoreEnvironment()
      scene.background = original.background
      scene.environmentIntensity = original.intensity
      scene.environmentRotation.copy(original.rotation)
      scene.backgroundRotation.copy(original.backgroundRotation)
      scene.backgroundIntensity = original.backgroundIntensity
      gl.toneMapping = original.toneMapping
      gl.toneMappingExposure = original.exposure
      active.target.dispose()
      active.texture?.dispose()
    },
  }
}
