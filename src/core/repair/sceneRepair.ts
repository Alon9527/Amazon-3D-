import { parseGlb } from '@core/glb/parser'
import { writeGlbWithJsonText } from '@core/glb/writer'
import { validateSceneRules } from '@core/validator/sceneRules'

function injectSceneZero(jsonText: string): string {
  if (!jsonText.endsWith('}')) {
    throw new Error('GLB JSON root is not an object')
  }
  return `${jsonText.slice(0, -1)},"scene":0}`
}

export function repairMissingDefaultScene(source: Uint8Array): Uint8Array {
  const parsed = parseGlb(source)
  const issues = validateSceneRules(parsed.json)

  if (issues.some((issue) => issue.id === 'GLTF-SCENE-ROOT-001')) {
    throw new Error('Safe Fix requires scene 0 to reference root nodes only')
  }

  const missingSceneIssue = issues.find((issue) => issue.id === 'AMZ-VIYR-SCENE-001')
  if (!missingSceneIssue || Object.hasOwn(parsed.json, 'scene')) {
    throw new Error('Safe Fix requires a missing scene and an existing valid scenes[0]')
  }

  return writeGlbWithJsonText(parsed, injectSceneZero(parsed.jsonText))
}
