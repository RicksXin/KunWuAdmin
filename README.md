# KunWu Admin

《昆吾禁地》的 PC 配置后台。当前提供剧情图编辑器、MySQL 配置中心、D0 配置导入、全量校验和确定性发布编译，前端与配置 API 位于同一个 Next.js 项目中。

## 配置中心规划

- [配置后台产品方案](Docs/01_配置后台产品方案.md)
- [配置中心技术方案](Docs/02_配置中心技术方案.md)

项目以 MySQL 8 作为后台编辑数据、版本快照和审计事实源；Godot 客户端只读取后台发布的
不可变 JSON 模块包，并保留安装包内置配置作为离线回退。

## 开发

```bash
pnpm install
cp .env.example .env
pnpm db:setup
pnpm dev
```

打开 <http://127.0.0.1:3100> 进入剧情编辑器，打开 <http://127.0.0.1:3100/config> 进入配置中心。
项目固定使用 3100，避免与本机已有的 3000 端口服务冲突。

本地数据库使用 Docker 中的 MySQL 8.4，映射到 `127.0.0.1:3307`，不会占用默认的 3306。首次
`db:setup` 会等待数据库健康、执行 Drizzle migration，并初始化 `demo_d0`、`v1_0`、权限角色和
开发／测试／生产三个发布环境。重复执行迁移和种子是安全的。

常用数据库命令：

```bash
pnpm db:up        # 启动并等待 MySQL 健康
pnpm db:migrate   # 执行尚未应用的迁移
pnpm db:seed      # 幂等初始化系统数据
pnpm db:check     # 检查版本、字符集、配置集与发布环境
pnpm db:import:godot # 只读导入相邻 KunWuGodot 的 D0 配置
pnpm db:studio    # 打开 Drizzle Studio
pnpm db:down      # 停止容器，保留本地数据卷
```

数据库健康接口为 `GET /api/health/database`。`.env.example` 只提供本地开发凭据，部署时必须改用
独立的运行账号与迁移账号。

## 当前能力

- 已接入 MySQL 8.4 + Drizzle，具备可重复执行的 migration、seed 和数据库健康检查。
- 已建立 21 张 M1 系统表和 37 张 M2 业务表；加上 Drizzle migration 表，当前数据库共 59 张表。
- 已初始化 `demo_d0`、`v1_0` 配置集，以及 development／staging／production 发布环境。
- 已把相邻 `KunWuGodot` 的 41 个 D0 来源文件只读导入 `demo_d0`，首轮落库 199 个实体。
- 导入器按来源内容哈希幂等执行；来源未变化时记录 skipped 运行，不增加配置集修订。
- 重复技能、两套防御常数、未接入的生产候选值、D0／1.0 规则差异和 Godot 硬编码均写入冲突表，不静默覆盖。
- `/config` 支持切换配置集并查询基础资源、修士成长、技能战斗、营地经济和出征地图五个配置域。
- 技能支持在后台编辑；保存使用实体 revision 乐观锁，并在同一 MySQL 事务内递增配置集 revision、保存前后快照和审计日志。
- 全量校验覆盖境界连续性、灵根倍率、技能 Tick／倍率／七维、遭遇成员、生产停工顺序、地图边界、新档引用和未解决导入冲突，结果持久化到校验运行及问题表。
- 编译预览按稳定 code 排序并生成 `base`、`progression`、`combat`、`economy`、`expedition`、`maps` 六个 canonical JSON 模块；SHA-256 基于未压缩内容，下载产物使用 gzip。
- development 正式发布强制复核当前 revision、成功全量校验、已批准审核和警告确认；门禁失败不会更新渠道头，预览产物也不会被客户端 API 读取。
- 配置中心已提供变更单草稿、提交审核、警告确认、批准和驳回流程；提交必须绑定当前修订的成功校验，实体再次保存会在同一事务内把草稿、待审核或已批准变更单标记为过期。
- 按剧情、章节、场景管理内容。
- 可视化编辑入口、对话、选项、检定、结算、战斗和结束节点。
- 拖拽布局、创建/删除连线、动态编辑多句台词与状态变更。
- 场景运行预览与分支选择。
- 结构化显示营地／野外地图／记忆或演出实例、地图 ID、区域、时态和判断依据；推断位置不会伪装成策划明示。
- 选项直接显示点击结果、专属后续对白、汇流方式，以及当前节点的奖励与消耗。
- 校验无效入口、断裂连线、不可达节点、死路和超过 36 字的台词。
- 通过同仓库 API 将剧情原子写入 `data/stories/*.json`。
- 发布前阻止存在结构错误的剧情，草稿可保留非阻断建议。
- 已导入《昆吾无名录》P0–C13 完整主线，共 15 章、151 个场景/阶段。
- 已导入 6 条世界支线、4 条个人支线和 2 条结局专属任务，共 12 条任务链、62 个场景/阶段。
- 每个导入场景保留草案原文快照与来源文件，可审计台词、选择和检定是否遗漏。

## 从 KunWu 草案同步剧情

后台通过只读方式解析相邻 `KunWu/Docs/1.0策划案` 中的活动事实源：

- `剧情/20_1.0剧情任务详细剧本_草案.md`：P0–C04 主线与四条 1.0 详细支线。
- `24_完整游戏剧情总纲_草案.md`：宏观规则、事实源边界与结局条件。
- `25_完整游戏主线详细剧情_草案.md`：C04 衔接、C05–C13、终战与三结局。
- `26_完整游戏支线剧情库_草案.md`：完整游戏的十二条支线任务链。
- `剧情/35_乌婆Boss魂魄与魂器馈赠机制_草案.md`：偶数序位 Boss 首杀魂魄与乌婆固定魂器奖励。
- `地图/27_完整游戏野外大地图与内容框架_草案.md`：章节地图网络、地图名称、时态与探索模式。

```bash
pnpm import:stories
pnpm audit:stories
```

导入器会生成完整主线与完整支线两份版本化 JSON；审计器独立核对 213 个场景/阶段、905 句台词、231 个选择/检定或终局结果、原文快照、入口和连线。不会修改 KunWu 项目的策划文档。

## 数据接口

```text
GET  /api/stories       获取剧情库
POST /api/stories       新建剧情
GET  /api/stories/:id   获取单个剧情
PUT  /api/stories/:id   保存或发布剧情
GET  /api/admin/config/overview?configSet=demo_d0
GET  /api/admin/config/entities?configSet=demo_d0&module=base
GET  /api/admin/config/skills/:code?configSet=demo_d0
PUT  /api/admin/config/skills/:code?configSet=demo_d0
GET  /api/admin/config/validation?configSet=demo_d0
POST /api/admin/config/validation
GET  /api/admin/config/change-requests?configSet=demo_d0
POST /api/admin/config/change-requests
POST /api/admin/config/change-requests/:id/actions
GET  /api/admin/config/releases?configSet=demo_d0
POST /api/admin/config/releases
GET  /api/game-config/:channel/manifest
GET  /api/game-config/:channel/releases/:releaseId/modules/:moduleCode
```

管理写接口的失败响应统一包含 `error.code`、中文信息、字段错误和 `requestId`。技能旧 revision 写入返回
`409 REVISION_CONFLICT`；未通过发布门禁返回 `409 RELEASE_BLOCKED` 及具体原因。
变更单状态或校验不满足时返回 `409 INVALID_STATE` 或 `409 CHANGE_REQUEST_BLOCKED`。

客户端清单支持 `If-None-Match`；已发布模块是不可变 gzip JSON，并使用内容 SHA-256 作为 ETag。Godot
客户端通过配置仓库执行远端、缓存、内置三层读取，并在完整性校验后整批激活六个模块；运行时地图、
队伍、遭遇和地图对象均按稳定 ID 查询。导入器会静态审计这两项接入，未满足时重新生成
`runtime_hardcoded_config` / `runtime_fixed_id_assumption` 发布阻断。

剧情 JSON 使用 `schemaVersion: 2`，新增 `locationContext`、选项结果／专属对白／汇流说明，以及结构化奖励与消耗。

## 校验

```bash
pnpm typecheck
pnpm lint
pnpm build
```
