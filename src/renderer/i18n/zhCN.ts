import type { FixType, ValidationSeverity, ValidationSource } from '@shared/types'

export const severityLabels: Record<ValidationSeverity | 'idle', string> = {
  idle: '未检查',
  pass: '通过',
  info: '信息',
  warning: '警告',
  error: '错误',
}

export const sourceLabels: Record<ValidationSource, string> = {
  'amazon-confirmed': 'Amazon 已确认',
  'amazon-validator-observed': 'Amazon 验证器观察结果',
  'gltf-standard': 'glTF 标准验证器原文',
  'best-practice': '最佳实践',
  diagnostic: '本地诊断',
}

export const fixTypeLabels: Record<FixType, string> = {
  safe: '安全修复',
  advanced: '高级修复',
  manual: '手动处理',
}
