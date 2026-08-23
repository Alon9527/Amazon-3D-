import type { ModelAnalysis, VerifiedSceneRepair } from '@shared/analysis'
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from '@shared/bridge'

const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
let nextId = 1
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>()

worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
  const response = event.data
  const request = pending.get(response.id)
  if (!request) return
  pending.delete(response.id)
  if (response.ok) request.resolve(response.result)
  else request.reject(new Error(response.error))
}

worker.onerror = (event) => {
  const error = new Error(event.message || 'Analysis worker failed')
  for (const request of pending.values()) request.reject(error)
  pending.clear()
}

function request<T>(payload: Omit<AnalysisWorkerRequest, 'id'>): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: (value) => resolve(value as T), reject })
    const message = { ...payload, id } as AnalysisWorkerRequest
    worker.postMessage(message)
  })
}

export function analyzeInWorker(bytes: Uint8Array, fileName: string): Promise<ModelAnalysis> {
  return request({ type: 'analyze', bytes: bytes.slice(), fileName })
}

export function repairInWorker(bytes: Uint8Array, fileName: string): Promise<VerifiedSceneRepair> {
  return request({ type: 'repair', bytes: bytes.slice(), fileName })
}
