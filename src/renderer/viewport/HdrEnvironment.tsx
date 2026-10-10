import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useLightingStore } from '../store/lightingStore'
import { parseHdrTexture } from './hdrTexture'
import { createHdrLightingController } from './hdrLightingController'

/** Lighting belongs to the viewer only. Never changes a GLB material or export bytes. */
export function HdrEnvironment() {
  const { gl, scene } = useThree()
  const source = useLightingStore((state) => state.source)
  const settings = useLightingStore((state) => state.settings)
  const setStatus = useLightingStore((state) => state.setStatus)
  const lighting = useRef<ReturnType<typeof createHdrLightingController> | null>(null)

  useEffect(() => {
    const controller = createHdrLightingController(gl, scene)
    lighting.current = controller
    controller.applySettings(useLightingStore.getState().settings)
    return () => {
      controller.dispose()
      lighting.current = null
    }
  }, [gl, scene])

  useEffect(() => {
    const controller = new AbortController()
    setStatus({ phase: 'loading', activeName: lighting.current?.activeName ?? '备用中性照明' })
    const load = async () => {
      const bytes = source.bytes ?? new Uint8Array(await (async () => {
        const response = await fetch(source.url!, { signal: controller.signal })
        if (!response.ok) throw new Error(`读取内置 HDR 失败（${response.status}）`)
        return response.arrayBuffer()
      })())
      if (controller.signal.aborted) return
      const texture = parseHdrTexture(bytes)
      const currentLighting = lighting.current
      if (!currentLighting) {
        texture.dispose()
        return
      }
      currentLighting.install(texture, source.name, useLightingStore.getState().settings)
      setStatus({ phase: 'ready', activeName: source.name, width: texture.image.width, height: texture.image.height })
    }
    void load().catch((error: unknown) => {
      if (!controller.signal.aborted) setStatus({ phase: 'error', activeName: lighting.current?.activeName ?? '备用中性照明', error: error instanceof Error ? error.message : String(error) })
    })
    return () => controller.abort()
  }, [gl, scene, source, setStatus])

  useEffect(() => {
    lighting.current?.applySettings(settings)
  }, [gl, scene, settings])

  return null
}
