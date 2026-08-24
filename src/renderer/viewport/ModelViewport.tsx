import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import {
  AxesHelper,
  Box3,
  Box3Helper,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { metresToUnit } from '@core/units/convert'
import { summarizeSceneTextures, type TextureLoadSummary } from '@core/geometry/modelTextures'
import type { ModelAnalysis, Unit, WorldBounds } from '@shared/analysis'
import type { DisplaySettings } from '../store/inspectorStore'
import { disposeScene, loadSceneFromGlb } from './modelLoader'

export type ViewKind = 'fit' | 'front' | 'right' | 'top'
export interface ViewRequest {
  kind: ViewKind
  token: number
}

interface ModelViewportProps {
  bytes: Uint8Array | null
  analysis: ModelAnalysis | null
  bounds: WorldBounds | null
  unit: Unit
  display: DisplaySettings
  textureSummary: TextureLoadSummary | null
  viewRequest: ViewRequest
  onBounds(bounds: WorldBounds): void
  onTextures(summary: TextureLoadSummary): void
  onLoadError(message: string): void
  onView(kind: ViewKind): void
}

function fitCamera(camera: PerspectiveCamera, controls: OrbitControls, bounds: WorldBounds, view: ViewKind): void {
  const center = new Vector3(bounds.center.x, bounds.center.y, bounds.center.z)
  const maxSize = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 0.001)
  const distance = (maxSize / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.45
  const direction =
    view === 'front'
      ? new Vector3(0, 0, 1)
      : view === 'right'
        ? new Vector3(1, 0, 0)
        : view === 'top'
          ? new Vector3(0, 1, 0.0001)
          : new Vector3(1, 0.7, 1).normalize()
  camera.position.copy(center).addScaledVector(direction, distance)
  camera.near = Math.max(distance / 1000, 0.0001)
  camera.far = Math.max(distance * 100, 100)
  camera.updateProjectionMatrix()
  controls.target.copy(center)
  controls.update()
}

function CameraControls({ bounds, request }: { bounds: WorldBounds | null; request: ViewRequest }) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => {
    const next = new OrbitControls(camera, gl.domElement)
    next.enableDamping = true
    next.dampingFactor = 0.08
    next.screenSpacePanning = true
    next.minDistance = 0.001
    return next
  }, [camera, gl.domElement])

  useEffect(() => {
    return () => controls.dispose()
  }, [controls])

  useEffect(() => {
    if (bounds && camera instanceof PerspectiveCamera) fitCamera(camera, controls, bounds, request.kind)
  }, [bounds, camera, controls, request])

  useFrame(() => controls.update())
  return null
}

function applyWireframe(root: Object3D, enabled: boolean): void {
  root.traverse((child) => {
    const material = (child as Object3D & { material?: unknown }).material
    const materials = Array.isArray(material) ? material : [material]
    for (const candidate of materials) {
      if (candidate && typeof candidate === 'object' && 'wireframe' in candidate) {
        ;(candidate as { wireframe: boolean; needsUpdate?: boolean }).wireframe = enabled
        ;(candidate as { needsUpdate?: boolean }).needsUpdate = true
      }
    }
  })
}

function LoadedModel({
  bytes,
  wireframe,
  onBounds,
  onError,
  onTextures,
}: {
  bytes: Uint8Array
  wireframe: boolean
  onBounds(bounds: WorldBounds): void
  onError(message: string): void
  onTextures(summary: TextureLoadSummary): void
}) {
  const [scene, setScene] = useState<Object3D | null>(null)

  useEffect(() => {
    let active = true
    let loaded: Object3D | null = null
    void loadSceneFromGlb(bytes)
      .then((nextScene) => {
        loaded = nextScene
        if (!active) {
          disposeScene(nextScene)
          return
        }
        nextScene.updateMatrixWorld(true)
        const box = new Box3().setFromObject(nextScene, true)
        if (box.isEmpty()) throw new Error('模型中没有可渲染的几何体')
        const size = box.getSize(new Vector3())
        const center = box.getCenter(new Vector3())
        onBounds({
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
          size: { x: size.x, y: size.y, z: size.z },
          center: { x: center.x, y: center.y, z: center.z },
        })
        onTextures(summarizeSceneTextures(nextScene))
        setScene(nextScene)
      })
      .catch((error) => {
        if (active) onError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      active = false
      if (loaded) disposeScene(loaded)
    }
  }, [bytes, onBounds, onError, onTextures])

  useEffect(() => {
    if (scene) applyWireframe(scene, wireframe)
  }, [scene, wireframe])

  return scene ? <primitive object={scene} /> : null
}

function makeLabel(text: string, color: string, position: Vector3, scale: number): Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建 Canvas 2D 上下文')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(13,15,16,0.84)'
  context.fillRect(4, 12, 504, 104)
  context.strokeStyle = color
  context.lineWidth = 3
  context.strokeRect(4, 12, 504, 104)
  context.font = '600 44px Bahnschrift, Segoe UI, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#f1f3f4'
  context.fillText(text, 256, 64)
  const texture = new CanvasTexture(canvas)
  const material = new SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  const sprite = new Sprite(material)
  sprite.position.copy(position)
  sprite.scale.set(scale * 2.8, scale * 0.7, 1)
  sprite.renderOrder = 10
  return sprite
}

function line(from: Vector3, to: Vector3, color: string): Line {
  return new Line(
    new BufferGeometry().setFromPoints([from, to]),
    new LineBasicMaterial({ color: new Color(color), depthTest: false }),
  )
}

function DimensionAnnotations({ bounds, unit }: { bounds: WorldBounds; unit: Unit }) {
  const group = useMemo(() => {
    const result = new Group()
    const min = new Vector3(bounds.min.x, bounds.min.y, bounds.min.z)
    const max = new Vector3(bounds.max.x, bounds.max.y, bounds.max.z)
    const center = new Vector3(bounds.center.x, bounds.center.y, bounds.center.z)
    const scale = Math.max(bounds.size.x, bounds.size.y, bounds.size.z) * 0.16
    const pad = scale * 0.8
    const suffix = unit === 'inch' ? 'in' : unit
    const format = (metres: number) => `${metresToUnit(metres, unit).toFixed(2)} ${suffix}`

    result.add(
      line(new Vector3(min.x, min.y - pad, max.z), new Vector3(max.x, min.y - pad, max.z), '#f25f5c'),
      line(new Vector3(max.x + pad, min.y, max.z), new Vector3(max.x + pad, max.y, max.z), '#66c27c'),
      line(new Vector3(max.x, min.y - pad, min.z), new Vector3(max.x, min.y - pad, max.z), '#4d9de0'),
      makeLabel(format(bounds.size.x), '#f25f5c', new Vector3(center.x, min.y - pad, max.z), scale),
      makeLabel(format(bounds.size.y), '#66c27c', new Vector3(max.x + pad, center.y, max.z), scale),
      makeLabel(format(bounds.size.z), '#4d9de0', new Vector3(max.x, min.y - pad, center.z), scale),
    )
    return result
  }, [bounds, unit])

  useEffect(
    () => () => {
      group.traverse((child) => {
        const disposable = child as Object3D & {
          geometry?: { dispose(): void }
          material?: { map?: { dispose(): void }; dispose(): void }
        }
        disposable.geometry?.dispose()
        disposable.material?.map?.dispose()
        disposable.material?.dispose()
      })
    },
    [group],
  )

  return <primitive object={group} />
}

function SceneHelpers({ bounds, display, unit }: { bounds: WorldBounds | null; display: DisplaySettings; unit: Unit }) {
  const helper = useMemo(() => {
    if (!bounds) return null
    return new Box3Helper(
      new Box3(
        new Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
        new Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
      ),
      new Color('#ffad32'),
    )
  }, [bounds])
  const maxSize = bounds ? Math.max(bounds.size.x, bounds.size.y, bounds.size.z) : 1

  return (
    <>
      {display.grid && <gridHelper args={[Math.max(2, maxSize * 4), 20, '#30363b', '#202529']} />}
      {display.ground && <gridHelper args={[Math.max(2, maxSize * 4), 1, '#4a5157', '#4a5157']} />}
      {display.axis && <primitive object={new AxesHelper(Math.max(maxSize * 0.8, 0.25))} />}
      {display.bounds && helper && <primitive object={helper} />}
      {display.dimensions && bounds && <DimensionAnnotations bounds={bounds} unit={unit} />}
    </>
  )
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`
}

export function ModelViewport(props: ModelViewportProps) {
  const {
    bytes,
    analysis,
    bounds,
    unit,
    display,
    textureSummary,
    viewRequest,
    onBounds,
    onTextures,
    onLoadError,
    onView,
  } = props
  return (
    <section className="viewport-shell" aria-label="3D 工作区">
      <div className="measure-corner measure-corner--tl" />
      <div className="measure-corner measure-corner--tr" />
      <div className="measure-corner measure-corner--bl" />
      <div className="measure-corner measure-corner--br" />
      <Canvas camera={{ fov: 42, position: [1.4, 1, 1.4], near: 0.001, far: 1000 }} dpr={[1, 2]}>
        <color attach="background" args={['#101315']} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#dfe8ee', '#25282a', 1.35]} />
        <directionalLight position={[4, 7, 5]} intensity={2.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.8} />
        {bytes && (
          <LoadedModel
            bytes={bytes}
            wireframe={display.wireframe}
            onBounds={onBounds}
            onTextures={onTextures}
            onError={onLoadError}
          />
        )}
        <SceneHelpers bounds={bounds} display={display} unit={unit} />
        <CameraControls bounds={bounds} request={viewRequest} />
      </Canvas>

      {!bytes && (
        <div className="viewport-empty">
          <span className="viewport-empty__mark">GLB</span>
          <strong>拖入 Cinema 4D 导出的模型</strong>
          <span>文件仅在本机分析，不会上传</span>
        </div>
      )}

      {analysis && (
        <div className="viewport-hud viewport-hud--file">
          <strong>{analysis.file.name}</strong>
          <span>GLB {analysis.file.glbVersion}.0</span>
          <span>{formatFileSize(analysis.file.size)}</span>
          <span>{analysis.stats.triangleCount.toLocaleString()} 个三角面</span>
          {textureSummary && (
            <span data-testid="texture-status">
              {textureSummary.uniqueTextures === 0
                ? '未检测到贴图'
                : textureSummary.readyTextures === textureSummary.uniqueTextures
                  ? `贴图已就绪：${textureSummary.readyTextures} 张`
                  : `贴图未完全加载：${textureSummary.readyTextures}/${textureSummary.uniqueTextures} 张`}
            </span>
          )}
        </div>
      )}

      <div className="orientation-gizmo" aria-label="方向控制器">
        <button className="axis-x" onClick={() => onView('right')} title="右视图">X</button>
        <button className="axis-y" onClick={() => onView('top')} title="顶视图">Y</button>
        <button className="axis-z" onClick={() => onView('front')} title="正视图">Z</button>
      </div>

      {bounds && (
        <div className="viewport-hud viewport-hud--dimensions">
          <span className="axis-x">X {metresToUnit(bounds.size.x, unit).toFixed(2)}</span>
          <span className="axis-y">Y {metresToUnit(bounds.size.y, unit).toFixed(2)}</span>
          <span className="axis-z">Z {metresToUnit(bounds.size.z, unit).toFixed(2)}</span>
          <small>{unit === 'inch' ? '十进制英寸' : unit}</small>
        </div>
      )}
    </section>
  )
}
