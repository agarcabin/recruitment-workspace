# 招聘综合工作台

在线地址：https://kanban.agar-cabin.site/

顶部包含三个入口：招聘过程看板、AI 开发进度、岗位信息收集。

- 招聘过程看板：在 iframe 中显示独立部署的招聘过程看板副本。
- AI 开发进度：展示国内滴答清单「AI 开发进度」文件夹的只读快照。上方月历按周一至周日每行 7 天展示完整月份，仅展示已排期任务；跨周任务分段延续，重叠任务自动分层。可切换月份、返回本月，项目色彩与下方看板一致。下方看板展示全部任务，保留优先级和父子任务关系。搜索同时作用于两部分；点击任务可查看详情，点击详情窗外侧空白或按 Esc 可关闭。

## 视觉规范

使用 Google Material Design 2 的网格、字体层级、表面阴影和交互状态规则，以靛蓝为主色，采用底部指示线导航、白色日历表面与一致的项目色。参考：[布局](https://m2.material.io/design/layout/understanding-layout.html)、[间距](https://m2.material.io/design/layout/spacing-methods.html)、[层级](https://m2.material.io/go/design-elevation)。检索到的 [Material Design skill](https://github.com/izynu/ochrelle/blob/main/skills/ochrelle-material-design/SKILL.md) 主要面向 M3，因此本项目以官方 MD2 文档为版本依据。
- 岗位信息收集：集中打开温州天超电器、温州泰昌铁塔、合达电子的招聘信息采集清单，以及「创新招聘组数据」。文档权限由原文档的分享设置决定。

## 开发任务数据

页面从 `data/ai-development.json` 加载指定文件夹的数据快照，并显示读取时间。它不会直接从浏览器调用滴答 MCP，也不会自动修改真实任务。需要更新时，通过已授权的国内滴答 MCP 重新读取该文件夹，再更新快照并发布。网站前端不包含 OAuth 凭据。

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

## 副本内容与更新

- 招聘数据截至 2026-10-31，源页面生成于 2026-11-01 21:47，已于 2026-11-04 核对仍为当前发布版本；滴答快照更新于 2026-11-04，包含 7 个项目、23 项未完成任务。
- 按用户要求保留候选人原名；所有统计和记录字段与源数据保持一致。
- 保留原有漏斗、日报、趋势图、岗位分布和日期筛选；移除原平台的编辑器集成脚本。
- ECharts 5.5.0 随站点部署，许可证在 assets/ECHARTS-LICENSE.txt。
- 副本不会自动跟随 WorkBuddy 更新。需要更新时，可运行 `python scripts/import-workbuddy.py`，脚本从分享页识别当前发布版本，检查页面后再提交发布。

## 验证记录

已在本地浏览器中确认：

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
