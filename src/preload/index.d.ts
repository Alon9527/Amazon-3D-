import type { InspectorBridge } from '@shared/bridge'

declare global {
  interface Window {
    inspector: InspectorBridge
  }
}

export {}
