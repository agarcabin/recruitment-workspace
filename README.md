# 招聘综合工作台

在线地址：https://kanban.agar-cabin.site/

顶部包含三个入口：招聘过程看板、AI 开发进度、岗位信息收集。

- 招聘过程看板：在 iframe 中显示由企微在线表格实时快照生成的看板，口径与月度日报同源。
- AI 开发进度：展示国内滴答清单「AI 开发进度」文件夹的只读快照。上方月历按周一至周日每行 7 天展示完整月份，仅展示已排期任务；跨周任务分段延续，重叠任务自动分层。可切换月份、返回本月，项目色彩与下方看板一致。下方看板默认同时展示未完成和已完成任务，保留优先级和父子任务关系。已完成任务以勾选标记、划线和“已完成”文字标明，详情显示完成时间；已排期的完成任务也展示在月历中。搜索同时作用于两部分；点击任务可查看详情，点击详情窗外侧空白或按 Esc 可关闭。

## 视觉规范

使用 Google Material Design 2 的网格、字体层级、表面阴影和交互状态规则，以靛蓝为主色，采用底部指示线导航、白色日历表面与一致的项目色。参考：[布局](https://m2.material.io/design/layout/understanding-layout.html)、[间距](https://m2.material.io/design/layout/spacing-methods.html)、[层级](https://m2.material.io/go/design-elevation)。检索到的 [Material Design skill](https://github.com/izynu/ochrelle/blob/main/skills/ochrelle-material-design/SKILL.md) 主要面向 M3，因此本项目以官方 MD2 文档为版本依据。
- 岗位信息收集：集中打开温州天超电器、温州泰昌铁塔、合达电子的招聘信息采集清单，以及「创新招聘组数据」。文档权限由原文档的分享设置决定。

## 开发任务数据

页面从 `data/ai-development.json` 加载指定文件夹的数据快照，并显示读取时间。它不会直接从浏览器调用滴答 MCP，也不会自动修改真实任务。需要更新时，通过已授权的国内滴答 MCP 重新读取该文件夹的未完成任务，同时调用 list_completed_tasks_by_date 按文件夹内全部项目查询已完成任务（不限制日期），按任务 ID 合并去重并保留 status 和 completedTime，再更新快照并发布。网站前端不包含 OAuth 凭据。

`private-preview/` 中的旧本地原型与其他任务快照由 Git 忽略，不随网站发布。

## 嵌入方案对照

打开 [方案对照测试页](https://kanban.agar-cabin.site/embed-tests.html) 可以切换以下五种加载方式。本地浏览器实测结果（2026-10-27）：

| 方式 | 结果 |
| --- | --- |
| 原始 WorkBuddy 分享链接 | 分享外壳加载，内部看板被拦截 |
| 无参数、带 www 的标准分享链接 | 内部看板被拦截 |
| 实际看板文件直达地址 | 被拦截 |
| 实际文件地址 + no-referrer | 被拦截 |
| 同站独立部署副本 | 显示成功，日期筛选和图表正常 |

原站 Content-Security-Policy 响应头的 frame-ancestors 限制了允许嵌入的上层域名。修改分享参数、直接加载内部文件或不发送 Referer 都不能改变该限制。这里采用独立部署用户看板文件的方式，不需要修改浏览器设置。

## 数据来源与更新

- 招聘数据取自企业微信在线表格《创新招聘组数据》，由 `recruit-daily-pipeline` 技能抓快照后重建，不再依赖 WorkBuddy 分享页（`embeds/source.json` 记录来源与生成时间）。
- 当前快照：2026-11-11 生成，覆盖 2026-10-09 ~ 2026-11-11 共 34 天；最新日报日 2026-11-10；9 名招聘专员；发出邀约 128 条；面试通过 40 人；核实入职 14 人；客户 16 家。
- 各表覆盖：BOSS 数据、收到简历截至 2026-11-10；企微添加截至 2026-11-11；邀约与入职登记截至 2026-11-08（登记滞后，非抓取缺失）。页面顶部会逐日标注实际有几人上传数据。
- 口径与企微「26年X月日报」完全同源（同一份 `report_merged.collect()`）：核实入职按「是否入职=是」计、后续离职不追溯；邀约按行登记日期归日；企微添加按「明细 > 看板日表 > 线上表行数」三级回退，逐日来源写在 `meta.wecom_source`。
- 按用户要求保留候选人原名；所有统计与记录字段与源数据一致。本仓库为公开仓库，姓名可见于「批次追踪」。
- 保留原有漏斗、日报、趋势图、岗位分布和日期筛选；移除原平台的编辑器集成脚本。
- ECharts 5.5.0 随站点部署，许可证在 assets/ECHARTS-LICENSE.txt。

### 重新生成

```bash
# 1. 拉最新快照
python ~/.workbuddy/skills/recruit-daily-pipeline/scripts/wecom_snapshot.py --date <日期> --out-dir outputs/wecom_snapshot

# 2. 重建站点（外壳 + 看板 + source.json）
python ~/.workbuddy/skills/recruit-daily-pipeline/scripts/build_workbench.py \
  --site-dir <本仓库> --snapshot outputs/wecom_snapshot/<日期> --to <日期>
```

一条命令完成「拉快照 → 重建 → 静态校验 → 提交 → 推送」：

```bash
python ~/.workbuddy/skills/recruit-daily-pipeline/scripts/publish_site.py \
  --site-dir <本仓库> --rebuild --branch codex/github-pages
```

旧版 `scripts/import-workbuddy.py` 保留，仅用于对照历史分享页版本，不再用于日常更新。

## 验证记录

2026-11-11 重建后（2026-11-11 快照）：

- 区间 2026-10-09 ~ 2026-11-11：触达 78,352 → 沟通 23,878 → 收获简历 1,860 → 企微添加 1,456 → 发出邀约 128 → 实际到面 72 → 面试通过 40 → 核实入职 14。
- 发出邀约 128 = 实际到面 72 + 未到面 31 + 待面试/待定 25；面试通过 40 = 到面 72 中的通过项。
- 客户分布 16 家，TOP3：秋水 33/24/10/5、达尔 21/11/7/4、泰昌铁塔 14/10/8/2（发布/邀约/到面/入职）。
- `check_site.py` 静态校验通过：7 个项目、26 未完成、20 已完成，任务快照 2026-11-07；JS 语法通过。

此前基于 WorkBuddy 分享页副本的验证记录（2026-10-27~11-07，已过时，仅存档）：

- 单日漏斗显示触达曝光 1,079；选择“近 7 日”后变为 9,041，沟通量变为 3,642。
- 自选 2026-10-09 至 2026-10-23 后，覆盖 15 天，触达曝光 21,986。
- 折线趋势图和岗位分布柱状图正常渲染，控制台未发现脚本错误。
- 综合工作台可读取同站 iframe 的日期控件和漏斗元素，确认实际内容已显示。
- JavaScript 语法检查通过，迁移前后完整数据比对通过。

加载事件本身不作为跨域页面显示成功的依据；测试结果以 iframe 内的实际内容和交互为准。

## 本地预览

运行 `node server.cjs`，打开 http://127.0.0.1:4173 。对照页为 http://127.0.0.1:4173/embed-tests.html 。使用完毕按 Ctrl+C 关闭。

GitHub Pages 从 `codex/github-pages` 分支根目录发布，无需构建。

自定义域名为 `kanban.agar-cabin.site`，由根目录 CNAME 文件和 GitHub Pages 设置维护。
