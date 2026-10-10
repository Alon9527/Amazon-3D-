import { describe, expect, it } from 'vitest'
import { useInspectorStore } from '../../src/renderer/store/inspectorStore'

describe('session state locks', () => {
  it('clearing an error message does not unlock a running operation', () => {
    const state = useInspectorStore.getState()
    state.setError('old failure')
    state.setPhase('repairing')
    state.setError(null)
    expect(useInspectorStore.getState().phase).toBe('repairing')
    state.setPhase('loading')
    state.setError(null)
    expect(useInspectorStore.getState().phase).toBe('loading')
    state.setError('actual failure')
    expect(useInspectorStore.getState().phase).toBe('error')
    state.setError(null)
    expect(useInspectorStore.getState().phase).toBe('ready')
  })
})
