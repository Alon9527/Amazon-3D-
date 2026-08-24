import { parseGlb } from '@core/glb/parser'
import { writeGlbWithJsonText } from '@core/glb/writer'
import { validateSceneRules } from '@core/validator/sceneRules'

function injectSceneZero(jsonText: string): string {
  if (!jsonText.endsWith('}')) {
    throw new Error('GLB JSON 根节点不是对象')
  }
  return `${jsonText.slice(0, -1)},"scene":0}`
}

export function repairMissingDefaultScene(source: Uint8Array): Uint8Array {
  const parsed = parseGlb(source)
  const issues = validateSceneRules(parsed.json)

  if (issues.some((issue) => issue.id === 'GLTF-SCENE-ROOT-001')) {
    throw new Error('安全修复要求 scene 0 只能引用根节点')
  }

  const missingSceneIssue = issues.find((issue) => issue.id === 'AMZ-VIYR-SCENE-001')
  if (!missingSceneIssue || Object.hasOwn(parsed.json, 'scene')) {
    throw new Error('安全修复要求顶层 scene 缺失且存在有效的 scenes[0]')
  }

  return writeGlbWithJsonText(parsed, injectSceneZero(parsed.jsonText))
}
