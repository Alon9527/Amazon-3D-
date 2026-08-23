/// <reference lib="webworker" />

import { analyzeGlbBytes, createVerifiedSceneRepair } from '@core/validator/analysisPipeline'
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from '@shared/bridge'

self.onmessage = async (event: MessageEvent<AnalysisWorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'analyze') {
      const result = await analyzeGlbBytes(request.bytes, request.fileName)
      const response: AnalysisWorkerResponse = { id: request.id, ok: true, type: 'analyze', result }
      self.postMessage(response)
      return
    }

    const result = await createVerifiedSceneRepair(request.bytes, request.fileName)
    const response: AnalysisWorkerResponse = { id: request.id, ok: true, type: 'repair', result }
    self.postMessage(response)
  } catch (error) {
    const response: AnalysisWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown analysis worker error',
    }
    self.postMessage(response)
  }
}
