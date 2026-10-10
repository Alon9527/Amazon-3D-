# Amazon 3D Asset Inspector

<p align="center">
  <img src="build/icon-preview.png" alt="Amazon 3D Asset Inspector Logo" width="180">
</p>

Amazon 3D Asset Inspector 是一款面向 3D 设计师的 Windows 桌面检查工具，用于在向 Amazon 3D、View in 3D 或 View in Your Room 提交模型前，在本地预览、分析和修复 GLB 2.0 文件。

软件界面采用简体中文，所有模型处理均在本机完成，不会上传模型或贴图。

## 核心功能

- 打开或拖入单个 `.glb` 文件并进行 3D 预览。
- 显示 GLB 内嵌的 PNG/JPEG 贴图。
- 5 个离线 HDR 环境、本地 HDR 导入、环境强度/曝光/旋转调节。
- 计算世界空间 Bounding Box 和 X/Y/Z 实际尺寸。
- 统计顶点、三角形、网格、材质和纹理数量。
- 调用 Khronos glTF Validator 检查 glTF 2.0 标准问题。
- 检查与 Amazon View in 3D、VIYR 工作流相关的本地规则。
- 输入商品宽、高、深，自动比较六种轴向映射。
- 识别可能的 X/Z 轴互换和尺寸误差。
- 在满足安全条件时修复缺失的顶层 `scene: 0`。
- 一键处理可证明安全的未用 UV 引用和图片元数据，展示已处理/跳过及原因。
- 修复后复检 BIN、几何统计、Bounding Box 和 Validator 结果。
- 通过“另存为”导出新 GLB，始终保留原始文件。

## 使用流程

1. 点击“打开 GLB”或把 `.glb` 文件拖入窗口。
2. 在中央视图检查模型、贴图、网格、坐标轴和包围盒。
3. 在左侧输入商品真实的宽度、高度和深度。
4. 选择尺寸单位和允许误差，查看轴向映射诊断。
5. 在右侧查看 glTF 与 Amazon 相关检查结果。
6. 如果检测到可安全修复的 `scene: 0` 问题，执行 Safe Fix。
7. 可选点击“一键处理可修复项”，查看警告/信息前后数量和逐项记录。
8. 对比修复前后结果，复检通过后另存为新的 GLB 文件；也可“撤销修复候选”。

场景修复导出名为 `原文件名_Amazon-fixed.glb`，清理导出名为 `原文件名_Amazon-cleaned.glb`。软件只创建新文件，不覆盖原始模型或其他已有文件。

## 贴图支持

### HDR 环境与照明

工作区右上角点击“环境与照明”，可选择电商中性参考、柔光摄影棚、对比摄影棚、室内自然光和室外阴天，或加载自己的 Radiance `.hdr` 文件（最多 32 MB、4096 × 2048 像素量）。不支持 EXR。可调整环境强度、曝光 EV、水平旋转、显示 HDR 背景，并一键恢复默认。

所有 HDR 随软件打包或从本地读取，运行时不下载、不上传。调整仅影响预览，不改变 GLB 材质、分析结果或导出数据。默认“电商中性参考”不是 Amazon 官方指定的 HDR，不能据此保证 Seller Central 实际渲染或验收结果。内置资产来源及 CC0 授权见 [HDR 说明](src/renderer/assets/hdr/README.md)。

### GLB 内嵌贴图

当前版本支持 GLB 内嵌的静态 PNG 和 JPEG 贴图。贴图在本地通过受限的 `blob:` URL 解码，不会发送到网络。

当前不支持：

- 外部纹理文件；
- 远程纹理 URL；
- 多文件 `.gltf + .bin + textures` 资产；
- 动画图片或部分特殊图像编码。

### 一键处理可修复项

右侧检查面板提供“一键处理可修复项（数量）”。只针对 Validator 明确报告的目标生成候选，不隐藏提示、不降低原始严重程度。

- `UNUSED_OBJECT`：仅清理能证明材质未使用的 TEXCOORD UV 引用及失去引用的相关 accessor/bufferView，不改顶点、三角形或材质。
- `IMAGE_FEATURES_UNSUPPORTED`：可解析的静态 PNG/JPEG 只清理安全元数据，保留原宽高和压缩像素载荷，不重新压缩。PNG 的 ICC/gamma、像素比例等遵循 glTF 的颜色解释，不保证非 glTF 图片软件的色彩显示相同。
- 动画、非默认/无法确认的 EXIF 方向、未知扩展、共享或重叠图片数据、特殊编码等会跳过并说明原因。不能安全处理的图片需在原工具重新导出为 8 位 RGB/RGBA、方形像素、静态 PNG/JPEG。

场景修复和清理可按任意顺序组合。图片清理可能改变 BIN 中的图片区域；该区域以外的 BIN、图片压缩载荷、材质定义、几何统计和世界包围盒必须一致，glTF errors 必须为 0，目标提示必须消失，否则不能导出。只有 UV 清理时 BIN 全部字节不变。剩余警告导出前需要确认。

`UNUSED_OBJECT` 是信息，`IMAGE_FEATURES_UNSUPPORTED` 是警告，不等同于 Amazon 拒收。当前 Validator 版本未必报告所有 JPEG 元数据；未报告的图片不会被额外清理。实际 Amazon 接受仍由用户验收。

## MVP 范围限制

当前版本仅正式支持单文件 GLB 2.0。以下功能暂未包含：

- 多文件 `.gltf`；
- 批量检查；
- 高级模型修复；
- 完整 Scene Graph；
- 纹理缩略图和 Raw glTF 浏览器；
- PDF/HTML 检查报告；
- Seller Central 自动上传。

## 本地开发

环境要求：

- Windows 10/11 x64；
- Node.js 24 或更高版本；
- pnpm 11 或更高版本。

安装依赖并启动开发版：

```powershell
pnpm install --ignore-scripts
pnpm setup:electron
pnpm dev
```

项目级 `.npmrc` 固定使用 npm 官方源。依赖覆盖用于修复已知构建链问题，不改变应用的运行时功能。

## 测试与构建

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm package:win
```

Windows x64 NSIS 安装包输出到 `release` 目录。

安装完成后，可以指定实际安装路径运行安装版冒烟测试：

```powershell
$env:INSPECTOR_EXE = 'C:\path\to\Amazon 3D Asset Inspector.exe'
pnpm test:installed
```

## 技术栈

- Electron、electron-vite；
- React、TypeScript、Zustand；
- Three.js、React Three Fiber；
- Khronos glTF Validator；
- Tailwind CSS；
- Vitest、Playwright；
- electron-builder。

## 验收边界

- `AMZ-VIYR-SCENE-001` 标记为 `amazon-validator-observed`，依据已提供的 Amazon Validator 反馈和实际修复经验。
- 诊断建议和行业最佳实践不会被描述为 Amazon 官方强制要求。
- 本地检查通过不代表 Seller Central 一定接受，真实 Amazon 上传仍需单独验收。
- Cinema 4D 真实回归模型应放入已被 Git 忽略的 `tests/fixtures/private`，不得提交到仓库。
