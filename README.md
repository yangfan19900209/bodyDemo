# BodyDemo V2 · 多系统人体解剖

Vite + TypeScript + Three.js 静态 H5。保留 V1 的 640 个真实 BodyParts3D 全身结构，在此基础上增加按需加载的肌肉、神经和连接组织。使用 GLTFLoader、OrbitControls 和 Raycaster，模型、名称及 SVG 图标均随静态站点发布，不需要后端或在线 CDN。

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

Vite 使用 `base: './'`，所有 GLB 地址使用 `import.meta.env.BASE_URL`，适配 `/bodyDemo/` 项目路径。发布时保留整个 `dist/` 中的核心与新增 GLB、元数据和模型许可文件；原始 OBJ、依赖、测试报告和截图不进入站点。**经用户确认后**再推送 `main`，等待 **Deploy anatomy demo to GitHub Pages** 工作流成功；本轮本地开发不会自动推送或更新在线站点。

## 使用方式

| 操作 | 效果 |
| --- | --- |
| 鼠标左键拖动 / 单指拖动 | 360° 旋转；拖动不会误触选取 |
| 滚轮 / 双指捏合 | 缩放；鼠标右键 / 双指移动可平移 |
| 点击结构 | 对实际三维表面射线选取并高亮；重叠命中列表可切换到其他真实命中对象；空白点击取消选择 |
| 搜索 | 中英文名称检索及系统筛选；未载入的真实结构会先加载，再选中和聚焦 |
| 解剖系统 | 骨骼、肌肉、动脉、静脉、神经、肌腱与韧带、内脏、皮肤八个入口，可滚动管理显隐和不透明度 |
| 优先拾取图层 | 优先选择指定的可见系统，低透明皮肤/肌肉不抢占内部结构 |
| 全层透视 | 恢复 V1 初始透视组合：器官 80%、皮肤 12%，新增组织默认隐藏，不强制下载所有图层 |
| 骨骼 / 肌肉 / 神经模式 | 仅看骨骼，或看真实肌肉/神经并以 20% 不透明骨骼作参照 |
| 骨骼血管 / 内脏 / 外观 | 观察骨骼与动静脉，或独立查看内脏，或查看完整皮肤外表 |
| 视图 / 居中 | 前、后、左、右预设视角；按选中结构或当前可见内容自动居中 |
| 透明度 | 调整选中结构或指定系统，范围 5%–100% 不透明度 |
| 隔离 | 只显示已选结构；再次点击退出隔离并恢复此前可见状态 |
| 多选 / 隐藏 | 点击或搜索选择多个结构，然后统一隐藏 |
| 撤销 | 恢复最近的隐藏、系统显隐、隔离或观察预设，最多保留 30 次 |
| 重置 | 恢复初始相机及“全层透视”默认图层状态，清空选择、隔离和撤销历史 |
| 设置 | 自动旋转与高清渲染开关；低性能设备可关闭高清渲染 |
| 结构详情 | 查看双语名称、系统、部位、组织类型及真实来源 ID，并聚焦、隔离、隐藏、透明或恢复该结构 |

顶部默认“脾动脉 / Splenic artery”仍明确标记为 **演示信息 · 未选择结构**。资源状态区分未载入、载入中、已载入、失败及不可用，失败图层可单独重试。撤销针对显隐、隔离和观察模式，不包含独立的相机、透明度或选择变化。

## 模型与许可

原有 `anatomy.glb` 保持逐字节不变：**640 个结构、553,914 个三角形、10.94 MiB**（11,469,808 字节），SHA-256 为 `1732bb2d918ef48c49498cc2fb5d9ab388a3bf7200e1dc83bc2fdbf0e98f4463`。少量原归骨骼的连接组织在元数据中更正分类，原 ID 和真实几何保留。

新增真实网格分别导出 `muscles.glb`、`nerves.glb`、`connective.glb`，首次启用对应图层或搜索其结构时加载并缓存。每个资产的数量、三角面、顶点、体积及 SHA 记录在 `public/models/anatomy.json`；具体来源、覆盖与排除理由见 [ASSETS.md](ASSETS.md)、`public/models/asset-audit.json` 和 [V2 验收记录](doc/V2_REPORT.md)。不存在以随机几何代替肌肉或以眼球/血管冒充神经的降级资产。

| GLB | 真实可选结构 | 三角面 | 体积 |
| --- | --- | --- | --- |
| 核心 `anatomy.glb` | 保留 640 | 553,914 | 10.94 MiB |
| `muscles.glb` | 新增 413 | 295,488 | 6.83 MiB |
| `nerves.glb` | 新增 65 | 98,146 | 1.90 MiB |
| `connective.glb` | 新增 26 | 25,004 | 0.56 MiB |
| 全部资产 | 1,144 | 972,552 | 20.23 MiB |

默认只下载核心 10.94 MiB。当前分类为骨骼 273、肌肉 413、动脉 230、静脉 116、神经 65、连接组织 30、内脏 16、皮肤 1；连接组织 30 包含原核心 4 个确证韧带。

**统一坐标：**所有 GLB 按同一源坐标框架导出，核心模型和附加资源共用一个运行时父变换。新增资源不单独居中或归一化，避免肌肉与骨骼错位。不同 BodyParts3D 版本的补充部件需先核对原始坐标；版本差异与未采用原因记录在资产审计中。

内脏包括脑、心脏、左右肺、肝脏、胃、脾、胰腺、胆囊、左右肾、膀胱及主要肠道。皮肤为完整外形网格，可透明观察内部，也可切换“外观”独立查看。

原作者为 **DBCLS / BodyParts3D**，主要 OBJ 下载镜像为 **jixiangying / Human Anatomy Explorer**，肺段补充来源为 **olivercase/body_parts_3d_api**。取得的 4.0 镜像 OBJ 文件头随附历史 **CC BY-SA 2.1 Japan** 声明，本包模型保留其署名与相同方式共享要求；当前官方页面已声明 **CC BY 4.0**，历史文件声明、当前官方声明与新增肺段的许可证据分别记录。完整来源、署名、改编内容，以及中文索引独立许可未确认的范围见 [ASSETS.md](ASSETS.md) 和 [模型许可文件](public/models/LICENSE.txt)。

V2 补充的 4.3 神经/连接部件及 3.0 重点肌肉分别核对镜像许可。3.0 数据来自 **Kevin Mattheus Moerman / BodyParts3D**，其 `LICENSE_content` 明确几何采用历史 CC BY-SA 2.1 Japan；本项目没有使用该镜像的软件代码。两个独立骨性锚点及逐部件的部位/左右证据通过后，才把 10 个咬肌、颞肌、腹直肌和背阔肌部件纳入统一源坐标。

神经层含真实脊髓、脑神经、部分左臂丛及左正中/尺/桡神经等；**65 是可选结构或分段数，不是 65 条完整周围神经**。当前缺少坐骨、股神经、完整右上肢神经及双侧脊神经，也缺独立髌韧带、主要膝交叉/侧副韧带及完整手足肌腱；审计未找到可可靠导入的独立网格，没有反射左侧或用曲线伪造缺失结构。淋巴系统与中医经络不属于本轮已实现功能。

源 OBJ 在本机 `scripts/source/` 缓存，不提交到 Git，也不进入部署产物；目录索引和转换脚本保留。正常启动或构建直接使用已生成 GLB。需要重建时先按 [ASSETS.md](ASSETS.md) 获取对应原始部件，再运行：

```powershell
node scripts/generate-model.mjs --frame-only
node scripts/select-v2-systems.mjs
pwsh -NoProfile -File scripts/download-v2.ps1
node scripts/generate-v2.mjs
node scripts/validate-v2.mjs
```

模型覆盖全身外形及主要解剖结构，不包含完整毛细血管网络，也不是所有组织与器官的完整医学数据库。减面与源数据分段可能造成局部缺口；中文名称及分类未经医学专家审校。透明图层的重叠存在实时渲染限制，本 Demo 用于三维交互展示，不提供医学级准确性承诺。

## 代码职责与 WebView

- `src/scene/AnatomyViewer.ts`：渲染、灯光、手势、Raycaster、生命周期与 UI 动作入口。
- `src/scene/ModelLoader.ts`：目录注册、按需加载与缓存、独立材质、共享坐标变换及资源释放。
- `src/scene/CameraController.ts`：OrbitControls、包围盒聚焦、预设视角与相机过渡。
- `src/scene/SelectionManager.ts`：预注册结构状态、八层显隐、透明度、观察预设、隔离与撤销；几何到达不覆盖最新操作。
- `src/ui/AnatomyUI.ts` 及 `LayerPanel`、`SearchResults`、`StructureDetails`、`PerformancePanel`：响应式图层、检索、重叠命中与性能界面。
- `src/data/anatomy.ts`：模型目录、组织类型、异步状态及动作接口；`scripts/generate-v2.mjs`：独立真实资产生成与审计。

渲染像素比上限为手机 1.5、桌面 2，关闭高清后为 1；静止时按需绘制，隐藏网格不参与拾取，销毁时释放模型、材质和监听。设置面板展示 FPS、Draw Calls、实际绘制三角面、资产加载耗时及 CPU 提交耗时；这些是当前浏览器读数，不代表 Android 真机帧率或 GPU 基准。

移植 Android WebView 时，可将 `dist/` 放入应用资产，并通过 **WebViewAssetLoader** 提供本地 HTTPS 资源路径；保持 `assets/`、`models/` 与入口文件的相对目录一致，启用 JavaScript，并使用支持 WebGL 的 WebView。模型加载和 UI 状态分离，后续原生桥接可复用 `ViewerActions`，无需改动模型资产。

## 验证

使用本机安装的 Google Chrome 验收，先构建再测试：

```powershell
npm run build
node scripts/validate-v2.mjs
npm test
```

保留原 5 项集成验收，增加 V2 首屏只加载核心、缓存、肌肉搜索与真实点选、GLB 原生包围盒/统一父变换、八层与模式、重叠命中、异步撤销/重置、失败重试及不可用清单、手机肌肉触摸等测试。第三个测试服务器在 `http://127.0.0.1:4174/bodyDemo/` 提供真实 `dist/`，验证 Pages 子路径及按需资产加载，不用开发路由模拟部署。

**V2 已验证：生产构建成功，资产验证全部通过，15 项集成测试全部通过（约 2.4 分钟，失败 0、跳过 0）。**覆盖桌面 Chrome、390×844 手机模拟触摸及真实生产 `/bodyDemo/` 子路径。测试不写入应用调试状态；截图为 `outputs/v2-muscles.png`、`v2-muscle-selected.png`、`v2-mobile-fullbody.png`（手机全身肌肉）、`v2-mobile-muscle.png`（手机单块肌肉点选）、`v2-overlap.png`、`v2-pages.png`，V1 对照在 `outputs/v1-baseline/`。

本地无头 Chrome 的一次浏览器计数样本为 1,053 Draw Calls、849,402 个三角面、核心与肌肉累计加载 463.7 ms；该样本包含测试与统计负载，不能换算为 Android 真机帧率。完整样本、版本差异与缺失覆盖见 [V2_REPORT.md](doc/V2_REPORT.md)。

开发环境提供只读 `window.__anatomyDebug` 供验收读取，生产构建不暴露该接口。尚未进行 Android 真机、iOS Safari 或实际 WebView 的兼容性与帧率测量。
