# 本地模型与许可

检查与下载日期：2026-10-08。运行时所有模型、元数据、字体回退和图标都使用本地资源；无在线模型或 CDN 请求。

## 实际交付的模型

`public/models/anatomy.glb` 是从 **BodyParts3D 4.0** 人体解剖数据的 OBJ99 子集及同源 **4.3 肺实质分段**转换而来，是真实三维网格，不是截图贴图，也不是程序化球体替代。现包含完整头部、双臂/手、躯干、骨盆、双腿/足骨架、主要全身动静脉、16 个独立可选内脏结构，以及完整真实皮肤外表网格。

| 项目 | 实际产物 |
| --- | --- |
| 原始作者/权利方 | The Database Center for Life Science（DBCLS）/ BodyParts3D |
| 原始格式 | Wavefront OBJ，骨骼/血管/大部分器官/皮肤文件头标注 4.0；新增肺实质文件头标注 4.3 |
| 本地格式 | GLB 2.0，普通索引网格；不需要 Draco/Meshopt 运行时解码器 |
| 原始组件 | 770 个 OBJ，168,147,254 字节（160.36 MiB），仅离线源码目录保留 |
| 可选择结构 | 640 个：骨骼 277、动脉 230、静脉 116、内脏 16、皮肤 1 |
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

模型现在覆盖全身外形与骨架，但没有覆盖所有器官、肌肉、神经和毛细血管。分段网格、不同数据版本及简化可能带来局部缺口或不连续；皮肤保留源数据的真实外表网格，含部分内侧面和开口。只用于三维交互与教育展示，不作医学级准确性承诺。UI 中的默认“脾动脉”介绍是演示信息；只有点击结构或搜索选择后才是实际选中状态。

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

生成逻辑在 `scripts/generate-model.mjs`，全身来源列表由 `scripts/select-full-body.mjs` 生成。每个输出 Mesh 的 glTF `extras.structureId` 与 manifest ID 一致，供 GLTFLoader 加载后选取；不含图像贴图或联网依赖。可运行 `node scripts/validate-model.mjs` 验证实际 GLB 缓冲区、有限顶点/法线、索引、系统和头/腿/足/内脏/皮肤覆盖。

如果需要重新获取已记录的全身源部件，可在安装 PowerShell 7 的环境运行 `pwsh -File scripts/download-full-body.ps1`。脚本优先复用缓存，4.0 部件使用 raw URL；4.3 肺路径优先使用已缓存真实路径，否则读取公开 tree-list JSON，最后才回退到仅元数据的 Git clone，避开 GitHub REST API 配额。`download-source.ps1` 保留为首版躯干来源获取脚本。这些获取步骤会联网，不属于页面运行流程。

Three.js、Vite、TypeScript 和离线网格简化工具 meshoptimizer 是 npm 依赖，依赖自身许可文件保留在 `node_modules` 中；没有复制医学应用的商标或 Logo。UI 图标由项目本地 SVG 描绘，使用系统字体。
