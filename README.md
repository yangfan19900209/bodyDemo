# 3D 人体解剖 Demo

Vite + TypeScript + Three.js 静态 H5。使用真实 BodyParts3D 网格展示从头部到腿脚的全身骨骼、红色动脉、蓝色静脉，以及可切换的内脏与皮肤层；场景由 GLTFLoader、OrbitControls 和 Raycaster 驱动。没有后端、账号或数据库，模型、双语名称和 SVG 图标均随项目本地加载。

## 启动与构建

建议使用 Node.js 20.19+ 或 22.12+：

```powershell
npm install
npm run dev
```

打开 **http://localhost:5173/**。开发服务器监听 `0.0.0.0`，同一局域网手机可访问 `http://电脑局域网IP:5173/`。

```powershell
npm run build
npm run preview
```

构建产物在 `dist/`，预览地址为 **http://localhost:4173/**。将 `dist/` 完整部署到任意静态 HTTP/HTTPS 服务器即可，不需要应用服务或在线 CDN。请通过 HTTP/HTTPS 访问；直接双击 `index.html` 的 `file://` 路径不能可靠加载模块、JSON 和 GLB。

## GitHub Pages 部署

在线访问：[3D 人体解剖 Demo](https://yangfan19900209.github.io/bodyDemo/)；代码仓库：[yangfan19900209/bodyDemo](https://github.com/yangfan19900209/bodyDemo)。

仓库的 **Settings → Pages → Build and deployment → Source** 使用 **GitHub Actions**。`.github/workflows/deploy-pages.yml` 会在推送 `main` 时自动部署，也可在 Actions 页面手动运行。工作流使用 Node.js 22，执行 `npm ci` 和 `npm run build`，然后将 `dist/` 发布到 Pages；无需额外 Token 或后端服务。

Vite 使用 `base: './'`，模型地址使用 `import.meta.env.BASE_URL`，可在 `/bodyDemo/` 项目路径加载。发布产物包含完整 GLB、结构名称元数据和模型许可文件；`scripts/source/`、依赖目录、测试报告与截图不进入站点。更新代码后推送 `main`，等待 **Deploy anatomy demo to GitHub Pages** 工作流成功即可看到新版。

## 使用方式

| 操作 | 效果 |
| --- | --- |
| 鼠标左键拖动 / 单指拖动 | 360° 旋转；拖动不会误触选取 |
| 滚轮 / 双指捏合 | 缩放；鼠标右键 / 双指移动可平移 |
| 点击结构 | 对实际三维表面射线选取，高亮并显示双语名称；空白点击取消选择 |
| 搜索 | 本地中文/英文检索，点击结果选中并按结构包围盒聚焦 |
| 解剖系统 | 分别显示/隐藏骨骼、动脉、静脉、内脏与皮肤五个图层；点击图层百分比调整该层透明度 |
| 全层透视 | 显示全部图层，恢复骨骼/血管 100%、内脏 80%、皮肤 12% 的默认不透明度 |
| 骨骼血管 / 内脏 / 外观 | 只看骨骼与血管，或仅看不透明内脏，或仅看不透明皮肤外观 |
| 视图 / 居中 | 前、后、左、右预设视角；按选中结构或当前可见内容自动居中 |
| 透明度 | 调整选中结构或指定系统，范围 5%–100% 不透明度 |
| 隔离 | 只显示已选结构；再次点击退出隔离并恢复此前可见状态 |
| 多选 / 隐藏 | 点击或搜索选择多个结构，然后统一隐藏 |
| 撤销 | 恢复最近的隐藏、系统显隐、隔离或观察预设，最多保留 30 次 |
| 重置 | 恢复初始相机及“全层透视”默认图层状态，清空选择、隔离和撤销历史 |
| 设置 | 自动旋转与高清渲染开关；低性能设备可关闭高清渲染 |

顶部默认“脾动脉 / Splenic artery”明确标记为 **演示信息 · 未选择结构**；点击或搜索后才显示实际选中状态。低透明度皮肤允许点选内部骨骼；要直接选取皮肤，可切换“外观”预设或提高该层不透明度。撤销针对显隐、隔离和图层预设，不包含单独的相机、透明度或选择变化。

## 模型与许可

实际使用 **BodyParts3D 4.0 OBJ99** 部件，并补充同源 **BodyParts3D 4.3 的真实肺段**，离线减面、转换为 `public/models/anatomy.glb`。全身骨骼与血管包含头部、上肢、腿及脚；内脏和皮肤也使用独立真实网格。当前共有 **640 个可选结构**：骨骼 277、动脉 230、静脉 116、内脏 16、皮肤 1；**553,914 个三角形**、314,339 个顶点，GLB **10.94 MiB**（11,469,808 字节）。模型不是截图贴图或程序化球体替代，详细统计见 [ASSETS.md](ASSETS.md) 和 `public/models/anatomy.json`。

内脏包括脑、心脏、左右肺、肝脏、胃、脾、胰腺、胆囊、左右肾、膀胱及主要肠道。皮肤为完整外形网格，可透明观察内部，也可切换“外观”独立查看。

原作者为 **DBCLS / BodyParts3D**，主要 OBJ 下载镜像为 **jixiangying / Human Anatomy Explorer**，肺段补充来源为 **olivercase/body_parts_3d_api**。取得的 4.0 镜像 OBJ 文件头随附历史 **CC BY-SA 2.1 Japan** 声明，本包模型保留其署名与相同方式共享要求；当前官方页面已声明 **CC BY 4.0**，历史文件声明、当前官方声明与新增肺段的许可证据分别记录。完整来源、署名、改编内容，以及中文索引独立许可未确认的范围见 [ASSETS.md](ASSETS.md) 和 [模型许可文件](public/models/LICENSE.txt)。

源 OBJ 在本机 `scripts/source/` 缓存，不提交到 Git；下载索引和转换脚本随仓库保留，原始 OBJ 不进入部署产物。首次克隆后若需要重新生成模型，先执行 `pwsh -NoProfile -File scripts/download-full-body.ps1` 获取源部件；已有本地源文件时可离线重新生成：

```powershell
npm run generate:model
```

模型覆盖全身外形及主要解剖结构，不包含完整毛细血管网络，也不是所有组织与器官的完整医学数据库。减面与源数据分段可能造成局部缺口；中文名称及分类未经医学专家审校。透明图层的重叠存在实时渲染限制，本 Demo 用于三维交互展示，不提供医学级准确性承诺。

## 代码职责与 WebView

- `src/scene/AnatomyViewer.ts`：渲染、灯光、手势、Raycaster、生命周期与 UI 动作入口。
- `src/scene/ModelLoader.ts`：本地 GLB / 元数据加载、材质独立化、坐标归一化与资源释放。
- `src/scene/CameraController.ts`：OrbitControls、包围盒聚焦、预设视角与相机过渡。
- `src/scene/SelectionManager.ts`：选择、五层显隐、透明度、四种观察预设、隔离及撤销状态。
- `src/ui/AnatomyUI.ts`、`src/ui/icons.ts`、`src/styles/main.css`：响应式 DOM 界面与本地图标。
- `src/data/anatomy.ts`：模型、状态和动作接口；`scripts/generate-model.mjs`：离线模型转换。

渲染像素比上限为手机 1.5、桌面 2，关闭高清后为 1；静态视图按需重绘，后台帧调度由浏览器限制，骨架阴影仅在场景状态改变时更新。载入时显示进度，资源/WebGL 失败时显示可见错误与重新加载按钮，并在销毁时释放三维资源。布局适配手机竖屏和桌面，画布禁用页面滚动手势。

移植 Android WebView 时，可将 `dist/` 放入应用资产，并通过 **WebViewAssetLoader** 提供本地 HTTPS 资源路径；保持 `assets/`、`models/` 与入口文件的相对目录一致，启用 JavaScript，并使用支持 WebGL 的 WebView。模型加载和 UI 状态分离，后续原生桥接可复用 `ViewerActions`，无需改动模型资产。

## 验证

已提供 `npm test` 集成验收，使用本机安装的 Google Chrome。5 项测试覆盖实际鼠标/触摸操作、头腿足的三维包围盒与真实射线拾取、五层显隐和透明度、四种可撤销预设、低透明皮肤穿透点选，以及旋转、捏合、隐藏、隔离、搜索、多选、重置、手机布局和模型加载失败重试，不通过写入调试状态绕过操作。

全身版 `npm run build` 成功，`npm test` 的 **5 项集成验收全部通过（约 1.2 分钟）**，运行时外部网络请求为零。额外的 `node scripts/validate-model.mjs` 确认 GLB 缓冲区、有限顶点、合法索引、五系统结构以及完整头/腿/足/皮肤包围盒均通过。测试截图保存在 `outputs/desktop.png`、`outputs/mobile.png`、`outputs/fullbody-desktop.png`、`outputs/organs-layer.png`、`outputs/skin-layer.png` 等文件。

开发环境提供只读 `window.__anatomyDebug` 供验收读取，生产构建不暴露该接口。尚未进行 Android 真机、iOS Safari 或实际 WebView 的兼容性与帧率测量。
