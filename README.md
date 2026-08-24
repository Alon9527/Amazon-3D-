# Amazon 3D Asset Inspector

Amazon 3D Asset Inspector 是一款面向 3D 设计师的 Windows 桌面检查工具，用于在向 Amazon 3D、View in 3D 或 View in Your Room 提交模型前，在本地预览、分析和修复 GLB 2.0 文件。

软件界面采用简体中文，所有模型处理均在本机完成，不会上传模型或贴图。

## 核心功能

- 打开或拖入单个 `.glb` 文件并进行 3D 预览。
- 显示 GLB 内嵌的 PNG/JPEG 贴图。
- 计算世界空间 Bounding Box 和 X/Y/Z 实际尺寸。
- 统计顶点、三角形、网格、材质和纹理数量。
- 调用 Khronos glTF Validator 检查 glTF 2.0 标准问题。
- 检查与 Amazon View in 3D、VIYR 工作流相关的本地规则。
- 输入商品宽、高、深，自动比较六种轴向映射。
- 识别可能的 X/Z 轴互换和尺寸误差。
- 在满足安全条件时修复缺失的顶层 `scene: 0`。
- 修复后复检 BIN、几何统计、Bounding Box 和 Validator 结果。
- 通过“另存为”导出新 GLB，始终保留原始文件。

## 使用流程

1. 点击“打开 GLB”或把 `.glb` 文件拖入窗口。
2. 在中央视图检查模型、贴图、网格、坐标轴和包围盒。
3. 在左侧输入商品真实的宽度、高度和深度。
4. 选择尺寸单位和允许误差，查看轴向映射诊断。
5. 在右侧查看 glTF 与 Amazon 相关检查结果。
6. 如果检测到可安全修复的 `scene: 0` 问题，执行 Safe Fix。
7. 对比修复前后结果，复检通过后另存为新的 GLB 文件。

默认导出文件名为 `原文件名_Amazon-fixed.glb`。软件不会覆盖原始模型。

## 贴图支持

当前版本支持 GLB 内嵌的静态 PNG 和 JPEG 贴图。贴图在本地通过受限的 `blob:` URL 解码，不会发送到网络。

当前不支持：

- 外部纹理文件；
- 远程纹理 URL；
- 多文件 `.gltf + .bin + textures` 资产；
- 动画图片或部分特殊图像编码。

如果 Validator 报告 `IMAGE_FEATURES_UNSUPPORTED`，建议把贴图重新导出为 8 位 RGB/RGBA、方形像素、静态 PNG/JPEG，并移除 ICC、EXIF、XMP 等额外元数据。

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
