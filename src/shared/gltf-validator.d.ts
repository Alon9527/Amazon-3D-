declare module 'gltf-validator' {
  export interface ValidatorOptions {
    uri?: string
    maxIssues?: number
    ignoredIssues?: string[]
    severityOverrides?: Record<string, number>
    externalResourceFunction?: (uri: string) => Promise<Uint8Array>
  }

  export function version(): string
  export function supportedExtensions(): string[]
  export function validateBytes(data: Uint8Array, options?: ValidatorOptions): Promise<unknown>
}
