# GLB 贴图预览与简体中文界面设计

## 目标

修复 GLB 内嵌贴图在 Electron 生产环境中可能显示为白模的问题，并将 Amazon 3D Asset Inspector 的应用自有界面完整本地化为简体中文。模型仍只在本机解析，不改变或重新编码原始材质与贴图。

## 已有证据与根因假设

Viewer 使用 Three.js `GLTFLoader.parse()` 直接解析 GLB 字节。GLB 内嵌图片会被转换为 `blob:` URL，Three.js 在支持 `createImageBitmap` 的 Electron 中可能通过 `fetch(blob:)` 解码。当前生产 CSP 的 `img-src` 允许 `blob:`，但 `connect-src` 仅允许 `'self'`，因此贴图解码请求可能被 CSP 拦截，而几何仍可正常显示。

实施前先用包含 UV、内嵌 PNG 和 `baseColorTexture` 的程序生成 GLB 在 Electron E2E 中复现。只有测试捕获到 CSP/贴图加载失败后，才修改生产配置。

## 方案选择

采用“最小 CSP 修复 + Viewer 贴图诊断 + 完整应用文案中文化”。

- CSP 仅为 `connect-src` 增加 `blob:`，不开放网络域名、`data:` 连接或任意文件访问。
- 不强制使用替代材质、不从 GLB 提取后重建纹理、不改变色彩空间或模型字节。
- Viewer 在模型加载完成后遍历材质，统计引用贴图的材质槽与已就绪贴图数，并在 HUD 中显示结果。
- 贴图解码失败必须显示独立的“贴图加载失败”信息，不能用笼统的模型加载错误掩盖。

未采用的方案：

1. 强制 Three.js 放弃 `ImageBitmapLoader`：浏览器兼容性和性能风险更高，且没有解决 CSP 根因。
2. 在应用中重建或烘焙材质：会改变模型视觉语义，不符合检查器保持原始资产的原则。

## 界面与文案

保留现有深色三栏桌面工具布局、颜色、间距和控件位置，避免用户重新学习操作路径。所有应用自有可见文案改为简体中文，包括：

- 顶栏操作、兼容性摘要和单位标签。
- 模型摘要、尺寸输入、容差、轴向映射和诊断。
- Viewer 工具栏、方向视图、空状态、HUD、拖放提示和贴图状态。
- 验证摘要、Safe Fix、Before/After 一致性结果、通知和错误。
- Electron 打开/另存对话框及应用自有错误。

保留标准或品牌名称：`GLB`、`glTF 2.0`、`Amazon 3D`、`VIYR`、`X/Y/Z`、规则 ID、文件名、JSON 字段名和哈希算法名。Khronos Validator 返回的不可控原始技术消息不机器翻译，但以中文标签明确标记为“标准验证器原文”。状态统一显示为“通过 / 警告 / 错误 / 未检查”。

## 数据流与组件边界

1. `GLTFLoader` 继续从不可变 GLB 字节创建 Three.js Scene。
2. Viewer 加载完成后计算 world-space Bounding Box，并独立汇总 `TextureLoadSummary`。
3. `ModelViewport` 通过回调把贴图摘要交给 `App`；贴图诊断只属于当前 Viewer 会话，不进入核心模型分析或 Safe Fix 字节一致性判断。
4. UI 使用集中式中文文案和状态映射，避免同一状态在不同面板出现不同译法。
5. 切换 Wireframe 后关闭时必须恢复原材质贴图显示。

## 错误处理

- 几何解析失败：显示“3D 模型解析失败”及原始原因。
- 贴图引用存在但解码失败：显示“贴图加载失败”，模型若可用则继续显示几何。
- 模型不含贴图：显示“未检测到贴图”，不是错误。
- CSP 不得因为修复贴图而允许 `http:`、`https:` 或任意本地文件访问。

## 测试与验收

- 程序生成一个带 UV 和内嵌 PNG 的最小 GLB；不依赖私有资产。
- 修复前 Electron E2E 必须复现贴图未就绪或 CSP 拦截。
- 修复后 E2E 验证贴图就绪、无 CSP violation、材质仍引用贴图。
- E2E 验证关闭 Wireframe 后贴图仍恢复。
- UI E2E 检查关键页面不存在原有英文操作文案，并验证核心中文按钮、状态和提示。
- 重新运行 lint、typecheck、单元/集成测试、Electron E2E、Windows NSIS 打包和安装后启动测试。
- 真实 C4D GLB 与 Seller Central 接受仍是独立外部验收门禁。
