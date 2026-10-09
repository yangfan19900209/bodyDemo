# 本地模型与许可

检查与下载日期：V1 2026-10-08；V2 2026-10-09。运行时所有模型、元数据、字体回退和图标都使用本地资源；无在线模型或 CDN 请求。

## 原有核心模型：保持原始二进制

`public/models/anatomy.glb` 是从 **BodyParts3D 4.0** 人体解剖数据的 OBJ99 子集及同源 **4.3 肺实质分段**转换而来，是真实三维网格，不是截图贴图，也不是程序化球体替代。现包含完整头部、双臂/手、躯干、骨盆、双腿/足骨架、主要全身动静脉、16 个独立可选内脏结构，以及完整真实皮肤外表网格。

| 项目 | 实际产物 |
| --- | --- |
| 原始作者/权利方 | The Database Center for Life Science（DBCLS）/ BodyParts3D |
| 原始格式 | Wavefront OBJ，骨骼/血管/大部分器官/皮肤文件头标注 4.0；新增肺实质文件头标注 4.3 |
| 本地格式 | GLB 2.0，普通索引网格；不需要 Draco/Meshopt 运行时解码器 |
| 原始组件 | 770 个 OBJ，168,147,254 字节（160.36 MiB），仅离线源码目录保留 |
| 核心可选择结构 | 640 个；V1 分类为骨骼 277、动脉 230、静脉 116、内脏 16、皮肤 1。V2 将其中 4 个确证韧带仅在元数据改归连接组织，未删改几何或 ID |
| GLB 大小 | 11,469,808 字节（10.94 MiB） |
| 网格统计 | 553,914 三角形，314,339 顶点，640 个 Mesh |
| 元数据 | `public/models/anatomy.json`，含双语名称、系统、来源部件 ID 和统计 |
| 本包模型采用的许可 | **Creative Commons Attribution-ShareAlike 2.1 Japan（CC BY-SA 2.1 JP）**，依据本次取得的镜像 OBJ 历史文件头 |

本次取得的 4.0 镜像 OBJ 文件头保留历史 **CC BY-SA 2.1 JP** 声明；4.3 肺文件头包含版本、FMA 与英文名，其镜像 README 单独声明同一历史数据许可。本包源 OBJ、衍生 GLB 和本项目对模型所做的改编按该历史许可保留署名及相同方式共享要求。分享或改编这些模型时，请保留以下署名、源链接、许可链接和改编说明，并按相同许可分发改编模型：

> BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan

- 原数据库：[BodyParts3D / Anatomography](https://lifesciencedb.jp/bp3d/)
- 官方归档与说明：[DBCLS / LSDB Archive](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/)
- 官方下载列表：[BodyParts3D Download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
- 许可：[CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/)
- 实际下载的公开 OBJ 镜像：[jixiangying/anatomy — isa_BP3D_4.0_obj_99](https://github.com/jixiangying/anatomy/tree/main/isa_BP3D_4.0_obj_99)
- 实际文件 URL 模板：`https://raw.githubusercontent.com/jixiangying/anatomy/main/isa_BP3D_4.0_obj_99/{FJ_ID}.obj`
- 肺实质实际来源：[olivercase/body_parts_3d_api 的 BodyParts3D 4.3 OBJ 镜像](https://github.com/olivercase/body_parts_3d_api)，从其 `meshes/` 内的 FJ6595–FJ6612 共 18 部件经 Git LFS media URL 取得；该镜像 README 声明原数据为 DBCLS / BodyParts3D、历史 CC BY-SA 2.1 Japan。署名：**olivercase（模型镜像与索引整理）**，原数据作者仍为 DBCLS。
- 肺镜像本次文件路径对应 commit `fd527e6f4daf732fd814314d9257df5877b844bc`；实际路径保存在 `scripts/source/full-body-download-urls.json` 和 `bodyparts43-paths.json`。原镜像 MANIFEST 中的 BP/FMA 字段可能是父概念或与文件名不一致，本项目使用实际仓库路径与 OBJ 文件头核对，不依赖猜测文件名。
- 论文：[Mitsuhashi et al., BodyParts3D: 3D structure database for anatomical concepts](https://doi.org/10.1093/nar/gkn613)

**当前官方声明与历史镜像不同：**2026-10-08 实时核查的 [BodyParts3D 官方许可页面](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) 标注最后更新 2025-02-27，现已声明 **Creative Commons Attribution 4.0 International（CC BY 4.0）**。这不是本次镜像 OBJ 文件头所写的 CC BY-SA 2.1 JP。本包明确保留并遵循取得文件随附的历史许可，没有将历史声明当作官方页面的当前声明。

镜像 OBJ 本身保留了原作者的许可和署名文件头。官方下载目录将 OBJ99 描述为“Polygon reduction rate = 99%”，完整 IS-A ZIP 为 136 MB。本项目下载独立部件，未下载整个数据库。

## 结构名称与分类的来源

- 原始英文解剖术语和 FMA → FJ 对应关系源于 BodyParts3D 的 `isa_parts_list_e.txt` 与 `isa_element_parts.txt`；本地副本保留在 `scripts/source/`。
- 初始双语索引与分类直接取自 **jixiangying** 的 [anatomy/data/anatomy_data_simple_refined.json](https://github.com/jixiangying/anatomy/blob/main/data/anatomy_data_simple_refined.json)。镜像项目 [README 数据说明](https://github.com/jixiangying/anatomy#%EF%B8%8F-%E6%95%B0%E6%8D%AE%E8%AF%B4%E6%98%8E) 说明这些中文翻译及分类由 AI 基于 BodyParts3D 文档处理，英文名称提取也可能欠准确。模型镜像与双语索引整理署名：**jixiangying / Human Anatomy Explorer**。
- 本项目对主要主动脉、脾动脉、腔静脉、头臂干和腹腔干重新核对原始 FMA 映射，并为这些结构编写中文显示名；其余结构沿用镜像索引，未经过医学专家审校。
- 镜像 README 的“数据来源”列明 BodyParts3D 的历史 CC BY-SA 2.1 Japan。仓库当前没有单独 `LICENSE` 文件，也未找到对其新增中文翻译/分类索引的独立明确许可声明。因此本包记录和保留镜像作者及文件来源，**不将中文整理内容的独立许可标为已确认**；模型历史许可与中文索引的来源说明分别列示。

## 本项目做的改编

- 从原始人体数据中筛取全身骨骼（含部分软骨/韧带与牙齿）、主要全身动静脉、脑、心、肺、肝胆、胃、脾、胰、肾、肠道、膀胱、气管及真实皮肤。
- 完整保留源网格的头部、手、下肢、足与皮肤坐标，当前版本不再使用首版躯干裁切。没有程序化补造头、腿、足或皮肤。
- 将原始 Z 向上坐标转换为 Y 向上、Z 向前，整体居中和缩放。
- 使用离线 MeshoptSimplifier 再次减面；骨骼/皮肤绝对几何误差阈值为 0.8 mm，内脏为 0.6 mm，血管为 0.18 mm。未使用删除细小独立组件的 prune 选项。
- 添加象牙色骨骼、红色动脉和蓝色静脉材质。颜色表达系统分类，不代表原始扫描组织颜色。
- 将同一主要血管的若干部件归并为一个可选结构，例如脾动脉的 FJ2562 / FJ3420 / FJ3544 / FJ3640。其对应关系由原始 `isa_element_parts.txt` 的 FMA14773 映射核对。
- 结构双语元数据以镜像的 BodyParts3D 概念数据为初始索引，对主动脉、腔静脉、脾动脉、头臂干和腹腔干进行了原始 FMA 映射核对。其余中文名称、分类及泛称仍可能不准确，来源和许可确认范围见上节。
- 内脏网格按独立器官归并而非把全部内脏合成单个对象。左右肺从 18 个真实肺实质段分别归并，避免将 4.0 镜像中的支气管树误标为肺；皮肤明确由 FJ2810 / FMA7163 取得。胃、脾、胰、肾和膀胱等用原始 FMA → FJ 表核对。器官默认透明度 0.8，完整皮肤默认 0.12，材质不写深度以保持内部可见。

核心模型覆盖全身外形、骨架和主要器官/血管；V2 新增独立肌肉、部分神经及连接组织，具体覆盖与限制见下节。分段网格、不同数据版本及简化可能带来局部缺口或不连续；皮肤保留源数据的真实外表网格，含部分内侧面和开口。只用于三维交互与教育展示，不作医学级准确性承诺。UI 中的默认“脾动脉”介绍是演示信息；只有点击结构或搜索选择后才是实际选中状态。

## V2 实际新增资产与资源审计

| 本地文件 | 实际独立结构 | 三角形 | 顶点 | 字节 / MiB | 默认加载 |
| --- | ---: | ---: | ---: | --- | --- |
| `anatomy.glb` | 原有 640 | 553,914 | 314,339 | 11,469,808 / 10.94 | 是 |
| `muscles.glb` | 413 | 295,488 | 207,191 | 7,160,984 / 6.83 | 否，首次打开按需加载 |
| `nerves.glb` | 65 | 98,146 | 55,825 | 1,993,940 / 1.90 | 否，首次打开按需加载 |
| `connective.glb` | 新增 26 | 25,004 | 17,292 | 591,916 / 0.56 | 否，首次打开按需加载 |
| 全部资产总计 | 1,144 | 972,552 | 594,647 | 21,216,648 / 20.23 | 初始仍只下载核心 |

V2 实际分类数量：骨骼 273、肌肉 413、动脉 230、静脉 116、神经 65、连接组织 30、内脏 16、皮肤 1。连接组织 30 包含原核心 4 个韧带与新资产 26 个结构。原有 640 个 ID、默认显隐和透明度完全保留；新增结构默认 `defaultVisible: false`、`defaultOpacity: 1`。

`public/models/asset-audit.json` 按每个实际结构记录：取得文件 URL、原始 FJ/FMA/BP 与英文文件头、数据版本、下载字节数、源 SHA256、原生毫米包围盒、减面前后统计、组织类型、浏览部位、神经分类与排除理由。只取得真实几何且验证通过的文件才注册进 manifest；候选索引存在不等于已支持。

### 肌肉、肌腱、韧带、筋膜的实际区分

- 原 `muscular` 418 候选包含眼肌节制韧带、跟腱、睑肌腱和髂胫束等，并非全是肌肉。通过实际 OBJ 的英文/FMA 文件头核对，分离连接组织；阔筋膜张肌（tensor fasciae latae）保留为肌肉，不因含 fascia 一词就误分。
- 排除 2 个上斜肌滑车（组织类别不足以认定为肌肉）与 3 个大肠肌层部件；没有用这些内脏肌层凑全身骨骼肌数量。
- 实际肌肉覆盖头颈、胸、腹、背、肩/上肢、手、臀/下肢和足。胸锁乳突肌、胸大/小肌、肋间肌、腹外斜肌、三角肌、肱二/三头肌、斜方肌、竖脊肌分支、臀大肌、股四头肌/腘绳肌、小腿肌群来自已核查的 4.0 OBJ。
- 咬肌浅/深部、颞肌、腹直肌和背阔肌共 10 个独立部件来自同源 3.0 真实 STL，补足 4.0/4.3 镜像缺少的重点部位。具体 FMA13377/13378、FMA13358/13359、FMA49001/49002/49004/49005、FMA49007/49008 与下载 URL 全部记录在审计文件中。
- 连接组织按 `tissueType` 区分：**肌腱 4、韧带 24、筋膜 2**。肌腱实际包括左右跟腱、右上睑提肌腱和右二腹肌中间腱；筋膜为左右髂胫束 FJ1423/FJ1423M。已取得的 3.0 髂胫束与 4.0 名称重复，因此没有重复注册。
- 原核心 FJ1424/FJ1424M 长足底韧带、FJ2763/FJ2764 茎突舌骨韧带的 ID/几何/默认状态保留，只纠正 manifest 分类。22 个椎间盘由 FMA 标为 cartilage；骨间膜源标为 membrane organ，不擅自说成已独立实现的筋膜或肌腱。
- **未支持的独立连接组织：**髌韧带、膝前/后交叉与主要侧副韧带、完整手足屈伸肌腱。当前可核查资源没有这些独立网格；部分肌肉源网格虽包含肌腱延伸，但不会因此宣称有独立可选肌腱。

### 神经的真实覆盖及限制

神经资产包含 1 个真实脊髓组织（FJ4426 / FMA242005，`tissueType: neural`、`neuralType: central`），以及实际脑神经、左侧颈胸神经、左臂丛干/束、左正中/尺/桡/腋/肌皮神经和膈神经等。`neuralType` 分别记录 central / cranial / spinal / peripheral，脊髓没有被说成外周神经。

没有把脑回、眼球、脉络丛或血管当作周围神经；核心脑组织仍是原有器官，不计入新增神经 65。实际视神经和动眼等脑神经有独立真实源网格，可以作为脑神经展示。

**覆盖缺失：**未取得坐骨神经、股神经、完整右上肢臂丛/正中/尺/桡神经及完整双侧脊神经。审查 4.0 候选、4.3 全路径与 3.0 名称表后，没有可靠独立网格；没有通过镜像反射左侧神经或随机曲线伪造右侧/下肢。Z-Anatomy 目前为 Blender 模板，当前转换环境没有 Blender，未将不可验证的模板内容算作支持。

FJ3901 的文件头英名/FMA 声称 left glossopharyngeal，但原生几何全在负 X 的右侧区域；保留几何和原始头，显示中性名称“舌咽神经（源侧别待核）”，单条审计记录矛盾。没有翻转几何、擅自改标为右侧或隐瞒源标签问题。

### 新增来源与各自许可证据

新增 4.0 OBJ 使用原 jixiangying 镜像，实际取得的文件头保留历史 CC BY-SA 2.1 Japan；4.3 神经、部分连接组织使用 olivercase 镜像，依据该镜像 README 的 BodyParts3D 历史许可声明，实际 OBJ 文件头保留版本/FMA/英文名但不带同一许可文本。

3.0 重点肌肉来自 [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)：原始 DBCLS BodyParts3D 20110915 数据经 OBJ → 二进制 STL 转换。该仓库 [README](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D/blob/main/README.md) 与 `LICENSE_content` 明确模型和衍生几何使用历史 **CC BY-SA 2.1 Japan**，其软件代码为 MIT；本项目只使用几何和名称索引，没有复制其软件代码。新增镜像整理署名 **Kevin Mattheus Moerman**，原数据署名仍为 DBCLS / BodyParts3D。

3.0 实际文件 URL 模板：`https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl/{FMA_ID}.stl`。FMA 名称由其原始 `parts_list_e.txt` 对应核对。新增中文主要肌肉名由本项目按已核查术语编写；其余沿用镜像索引的名称来源与独立许可确认范围见前文。当前官方 CC BY 4.0 与各镜像附带历史声明继续分别记录。

### 统一坐标与版本差异的核验

核心 GLB 保持原 SHA256：`1732bb2d918ef48c49498cc2fb5d9ab388a3bf7200e1dc83bc2fdbf0e98f4463`。用原 V1 770 个源部件和相同减面算法 `--frame-only` 精确重算公共 frame，**不写核心二进制**：

```text
p_export = 0.0147 × rotateX(-π/2) × p_source_mm − c
c = [-0.009341955184936523, 11.489496409893036, 1.482323706150055]
```

核心真实导出顶点 Y 范围是 -12.63731956 至 +12.63731956，已共同居中；`shared-frame.json` 的 `bounds` 是减 center 前的源边界，不能再次当成实际 GLB 的包围盒。每个新资产使用同一个 c，不按自身包围盒居中，也不各自归一化。运行时仅对共同父组施加统一人体显示缩放。

3.0 采用相同原生毫米坐标，不另外配准。验证头骨与右髋两个独立锚点的包围盒：头骨中心差 **8.57 mm**、尺寸差 **9.77 mm**；右髋中心差 **16.51 mm**、尺寸差 **14.49 mm**。固定接受阈值为核心原生身高 1719.36 mm 的 **1%（17.19 mm）**，并逐个补充肌肉核对原生身体边界、左右符号与部位。全部 10 个实际新增 3.0 肌肉通过；此检查用于发现坐标/版本错误，**不代表精确临床表面贴合**。版本重塑可带来局部形状和贴合差异，实测数据没有因适配而改动。

### 其他系统的范围

现有 16 个器官增加 `organSystem`：脑 nervous，心 cardiovascular，肺/气管 respiratory，胃肠肝胆胰 digestive，肾/膀胱 urinary，脾 lymphatic。这些是已有真实器官的元数据细分，并非新增完整呼吸、消化、泌尿或淋巴网格层。没有完整淋巴管/淋巴结；meridians 仅作为未来传统中医概念模块预留，当前无几何、无注册结构，也不与真实神经血管混合。

## 已检查但未采用的资源

首先检查了用户建议的 [Z-Anatomy/Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)。它提供 Blender 应用模板而非直接可用的分系统 GLB：

- `Z-Anatomy.zip`：86,734,957 字节（82.7 MiB）。
- `Z-Biomechanics.7z`：21,644,942 字节（20.6 MiB）。
- 仓库整体声明 CC BY-SA 4.0，并要求 BodyParts3D 与 Z-Anatomy 署名；其 README 另列部分包含/参照资产的不同许可。
- 当前机器未发现可调用 Blender。为在 MVP 中交付精简本地资产，改用 BodyParts3D 独立 OBJ 子集直接转换，未引入 Z-Anatomy 模型、代码或其中另列的器官资产。

可复查资料：[Z-Anatomy README](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/Readme.md)、[Z-Anatomy License](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt)、[ZIP 文件体积](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/Z-Anatomy.zip)。

## 离线重建与目录

源模型在本机 `scripts/source/` 缓存，Git 仓库仅保留下载索引和转换脚本；**原始 OBJ 不提交，也不会被 Vite 复制到运行时 dist**。正常启动和构建使用已提交的 GLB，无需再次下载。首次克隆后如需重新生成，请先执行本节的源模型下载命令；已有本地源模型时可离线运行：

```powershell
npm run generate:model
```

V1 核心生成逻辑保留在 `scripts/generate-model.mjs`，全身来源列表由 `scripts/select-full-body.mjs` 生成。V2 使用 `select-v2-systems.mjs` → `download-v2.ps1` → `generate-v2.mjs`，通用几何工具为 `model-utils.mjs`，名称/组织部位工具为 `anatomy-metadata.mjs`。V2 重建应运行 `node scripts/generate-v2.mjs`，核心 frame 初次计算使用 `node scripts/generate-model.mjs --frame-only`；不能用 V1 普通生成覆盖 V2 manifest。

每个输出 Mesh 的 glTF `extras.structureId` 与 manifest ID 一致，且保存 system/sourceIds/sourceComponents/tissueType；不含图像贴图或联网依赖。可运行 `node scripts/validate-v2.mjs` 验证全部实际 GLB 缓冲区、有限顶点/法线、索引、640 原 ID/defaults、无重复源组件、共同身体坐标范围与不可更改的核心 SHA。

如果需要重新获取已记录的全身源部件，可在安装 PowerShell 7 的环境运行 `pwsh -File scripts/download-full-body.ps1`。脚本优先复用缓存，4.0 部件使用 raw URL；4.3 肺路径优先使用已缓存真实路径，否则读取公开 tree-list JSON，最后才回退到仅元数据的 Git clone，避开 GitHub REST API 配额。`download-source.ps1` 保留为首版躯干来源获取脚本。这些获取步骤会联网，不属于页面运行流程。

Three.js、Vite、TypeScript 和离线网格简化工具 meshoptimizer 是 npm 依赖，依赖自身许可文件保留在 `node_modules` 中；没有复制医学应用的商标或 Logo。UI 图标由项目本地 SVG 描绘，使用系统字体。
