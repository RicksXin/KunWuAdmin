"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenText,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Database,
  Factory,
  Gauge,
  GitCompareArrows,
  Hammer,
  LoaderCircle,
  Map,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldAlert,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  X,
  Users,
} from "lucide-react";

type ModuleCode = "base" | "progression" | "combat" | "economy" | "expedition";
interface Overview {
  configSet: { code: string; name: string; status: string; schemaVersion: number; currentRevision: number; updatedAt: string };
  availableSets: { code: string; name: string; status: string; currentRevision: number }[];
  latestImport: { status: string; sourceKind: string; sourceRoot: string; summary: unknown; finishedAt: string | null } | null;
  issueSummary: { total: number; errors: number; warnings: number; unresolved: number };
  modules: { code: ModuleCode; name: string; count: number; detail: string }[];
  recentIssues: { severity: string; conflictType: string; entityType: string | null; entityCode: string | null; candidateValues: unknown; resolutionStatus: string }[];
}
interface ModuleEntities { configSet: string; module: ModuleCode; groups: { code: string; name: string; editable?: boolean; rows: Record<string, unknown>[] }[] }
interface SkillDraft {
  code: string; revision: number; nameKey: string; damageKind: "physical" | "magical" | "none"; targetType: string;
  ignoreTaunt: boolean; baseIntervalTicks: number; castTicks: number; cooldownTicks: number;
  primaryAttribute: string | null; primaryPercent: number; secondaryAttribute: string | null; secondaryPercent: number;
  status: "active" | "disabled"; sortOrder: number; notes: string | null;
}
interface ReleaseWorkspace {
  currentRevision: number;
  latestValidation: { sourceRevision: number; status: string; errorCount: number; warningCount: number; infoCount: number; finishedAt: string | null } | null;
  latestRelease: { id: string; version: string; status: string; sequence: number; sourceRevision: number; createdAt: string } | null;
  developmentHeadReleaseId: string | null;
  moduleCodes: string[];
}
interface ChangeRequestWorkspace {
  currentRevision: number;
  current: null | {
    id: string; sourceRevision: number; title: string; description: string | null; status: string; validationRunId: string | null;
    submittedAt: string | null; reviewedAt: string | null; reviewNotes: string | null; stale: boolean;
    warningCount: number; acknowledgedWarningCount: number; errorCount: number;
    issues: { id: string; severity: string; ruleCode: string; message: string; acknowledged: boolean; acknowledgementReason: string | null }[];
  };
}

const railItems = [
  { icon: Gauge, label: "总览", active: true },
  { icon: Boxes, label: "基础" },
  { icon: Users, label: "修士" },
  { icon: Swords, label: "战斗" },
  { icon: Map, label: "地图" },
];
const moduleIcons = { base: Boxes, progression: Users, combat: Swords, economy: Factory, expedition: Map };
const fieldNames: Record<string, string> = {
  code: "稳定 ID", nameKey: "名称键", type: "类型", status: "状态", weight: "重量", level: "等级", maxLevel: "最高等级",
  basePercent: "基础倍率", growthPercent: "成长倍率", minLevel: "最低等级", target: "目标",
  interval: "行动 Tick", cooldown: "冷却 Tick", hp: "生命", escapePercent: "撤离阈值", output: "单工产出", upkeep: "单工维护",
  shutdownPriority: "停工顺序", mapNumber: "地图序号", width: "宽", height: "高", title: "标题", refresh: "刷新", x: "X", y: "Y",
};

export function ConfigDashboard() {
  const [configSetCode, setConfigSetCode] = useState("demo_d0");
  const [activeModule, setActiveModule] = useState<ModuleCode>("base");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [entities, setEntities] = useState<ModuleEntities | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<ReleaseWorkspace | null>(null);
  const [changeWorkspace, setChangeWorkspace] = useState<ChangeRequestWorkspace | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraft | null>(null);
  const [working, setWorking] = useState<"save" | "validate" | "preview" | "publish" | "change" | null>(null);
  const [notice, setNotice] = useState("正在连接 MySQL 配置中心…");

  async function loadWorkspace(code: string) {
    const response = await fetch(`/api/admin/config/releases?configSet=${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("WORKSPACE_FAILED");
    setWorkspace(await response.json() as ReleaseWorkspace);
  }

  async function loadChangeWorkspace(code: string) {
    const response = await fetch(`/api/admin/config/change-requests?configSet=${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("CHANGE_WORKSPACE_FAILED");
    setChangeWorkspace(await response.json() as ChangeRequestWorkspace);
  }

  async function loadEntities(code = configSetCode, module = activeModule) {
    setEntities(null);
    const response = await fetch(`/api/admin/config/entities?configSet=${encodeURIComponent(code)}&module=${module}`, { cache: "no-store" });
    if (!response.ok) throw new Error("ENTITIES_FAILED");
    setEntities(await response.json() as ModuleEntities);
  }

  async function loadOverview(code: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/config/overview?configSet=${encodeURIComponent(code)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("OVERVIEW_FAILED");
      const data = await response.json() as Overview;
      setOverview(data);
      await Promise.all([loadWorkspace(code), loadChangeWorkspace(code)]);
      setNotice(`${data.configSet.name} · 修订 ${data.configSet.currentRevision} · 数据来自 MySQL`);
    } catch {
      setNotice("配置总览加载失败，请确认 MySQL 与迁移状态");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview(configSetCode);
    // Fetch helpers are scoped to the component; the selected code is the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configSetCode]);
  useEffect(() => {
    void loadEntities(configSetCode, activeModule)
      .catch(() => setNotice("配置明细加载失败"));
    setSkillDraft(null);
    // loadEntities deliberately follows the selected set and module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configSetCode, activeModule]);

  async function editSkill(code: string) {
    setNotice(`正在读取技能 ${code}…`);
    const response = await fetch(`/api/admin/config/skills/${encodeURIComponent(code)}?configSet=${encodeURIComponent(configSetCode)}`, { cache: "no-store" });
    if (!response.ok) { setNotice("技能读取失败"); return; }
    const data = await response.json() as { skill: SkillDraft };
    setSkillDraft(data.skill);
    setNotice(`正在编辑技能 ${code} · R${data.skill.revision}`);
  }

  async function saveSkill() {
    if (!skillDraft) return;
    setWorking("save");
    try {
      const { code, ...body } = skillDraft;
      const response = await fetch(`/api/admin/config/skills/${encodeURIComponent(code)}?configSet=${encodeURIComponent(configSetCode)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { skill?: SkillDraft; configSetRevision?: number; error?: { message: string } };
      if (!response.ok || !data.skill) throw new Error(data.error?.message ?? "技能保存失败");
      setSkillDraft(data.skill);
      await Promise.all([loadOverview(configSetCode), loadEntities()]);
      setNotice(`${code} 已保存 · 实体 R${data.skill.revision} · 配置集 R${data.configSetRevision}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "技能保存失败");
    } finally { setWorking(null); }
  }

  async function runValidation() {
    setWorking("validate");
    try {
      const response = await fetch("/api/admin/config/validation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ configSet: configSetCode }) });
      const data = await response.json() as { errorCount?: number; warningCount?: number; error?: { message: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "配置校验失败");
      await loadWorkspace(configSetCode);
      await loadChangeWorkspace(configSetCode);
      setNotice(`全量校验完成 · ${data.errorCount ?? 0} 条阻断 · ${data.warningCount ?? 0} 条警告`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "配置校验失败"); }
    finally { setWorking(null); }
  }

  async function buildRelease(mode: "preview" | "publish") {
    setWorking(mode);
    try {
      const response = await fetch("/api/admin/config/releases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ configSet: configSetCode, mode }) });
      const data = await response.json() as { version?: string; modules?: unknown[]; error?: { message: string; reasons?: string[] } };
      if (!response.ok) throw new Error(data.error?.reasons?.join("；") || data.error?.message || "编译失败");
      await loadWorkspace(configSetCode);
      setNotice(`${mode === "preview" ? "编译预览" : "development 发布"}完成 · ${data.version} · ${data.modules?.length ?? 0} 个模块`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "编译失败"); }
    finally { setWorking(null); }
  }

  async function createChange(title: string, description: string | null) {
    setWorking("change");
    try {
      const response = await fetch("/api/admin/config/change-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ configSet: configSetCode, title, description }) });
      const data = await response.json() as { status?: string; error?: { message: string; reasons?: string[] } };
      if (!response.ok) throw new Error(data.error?.reasons?.join("；") || data.error?.message || "变更单创建失败");
      await loadChangeWorkspace(configSetCode);
      setNotice(`变更单已创建 · R${overview?.configSet.currentRevision ?? changeWorkspace?.currentRevision ?? "—"} · 草稿`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "变更单创建失败"); }
    finally { setWorking(null); }
  }

  async function changeAction(action: "submit" | "acknowledge_warnings" | "approve" | "reject", value?: string) {
    const change = changeWorkspace?.current;
    if (!change) return;
    setWorking("change");
    try {
      const body = action === "acknowledge_warnings" ? { action, reason: value } : action === "approve" || action === "reject" ? { action, reviewNotes: value || null } : { action };
      const response = await fetch(`/api/admin/config/change-requests/${change.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { status?: string; error?: { message: string; reasons?: string[] } };
      if (!response.ok) throw new Error(data.error?.reasons?.join("；") || data.error?.message || "变更单操作失败");
      await Promise.all([loadChangeWorkspace(configSetCode), loadWorkspace(configSetCode)]);
      const labels = { submit: "已提交审核", acknowledge_warnings: "警告已确认", approve: "审核已批准", reject: "审核已驳回" };
      setNotice(labels[action]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "变更单操作失败"); }
    finally { setWorking(null); }
  }

  const activeModuleInfo = overview?.modules.find((item) => item.code === activeModule);
  const importTime = useMemo(() => overview?.latestImport?.finishedAt ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(overview.latestImport.finishedAt)) : "尚未导入", [overview]);

  if (!overview && loading) return <div className="loading-screen"><div className="seal-loader">昆</div><LoaderCircle className="spin" /><p>{notice}</p></div>;
  if (!overview) return <div className="loading-screen"><ShieldAlert /><p>{notice}</p><button className="secondary-button" onClick={() => loadOverview(configSetCode)}>重试</button></div>;

  return (
    <div className="config-shell">
      <header className="app-header">
        <div className="brand-lockup"><div className="brand-seal">昆</div><div><strong>昆吾司典</strong><span>KUNWU CONFIG CONSOLE</span></div></div>
        <div className="header-context">
          <span>配置中心</span><i /><strong>{overview.configSet.name}</strong>
          <small className="status-badge status-badge--review">草稿 · R{overview.configSet.currentRevision}</small>
        </div>
        <div className="header-actions">
          <label className="config-set-picker"><span>配置集</span><select value={configSetCode} onChange={(event) => setConfigSetCode(event.target.value)}>{overview.availableSets.map((set) => <option key={set.code} value={set.code}>{set.name} · R{set.currentRevision}</option>)}</select></label>
          <button className="secondary-button" onClick={() => loadOverview(configSetCode)} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} 刷新</button>
          <button className="secondary-button" onClick={runValidation} disabled={working !== null}>{working === "validate" ? <LoaderCircle className="spin" size={15} /> : <ShieldAlert size={15} />} 全量校验</button>
          <button className="secondary-button" onClick={() => buildRelease("preview")} disabled={working !== null}>{working === "preview" ? <LoaderCircle className="spin" size={15} /> : <Hammer size={15} />} 编译预览</button>
          <Link className="secondary-button" href="/"><BookOpenText size={15} /> 剧情编辑器</Link>
          <button className="avatar-button" aria-label="用户"><CircleUserRound size={21} /></button>
        </div>
      </header>

      <div className="config-workspace">
        <nav className="app-rail">
          <div className="rail-main">{railItems.map(({ icon: Icon, label, active }) => <button key={label} className={active ? "is-active" : ""} title={label}><Icon size={20} /><span>{label}</span></button>)}</div>
          <div className="rail-bottom"><button title="审计"><ScrollText size={20} /></button><button title="设置"><Settings size={20} /></button></div>
        </nav>

        <aside className="config-sidebar">
          <div className="sidebar-heading"><div><span className="section-kicker">CONFIG DOMAINS</span><h2>业务配置</h2></div><Database size={18} /></div>
          <p className="config-sidebar__hint">当前配置集：<b>{overview.configSet.code}</b><br />不同配置集完全隔离。</p>
          <div className="config-module-list">
            {overview.modules.map((module) => {
              const Icon = moduleIcons[module.code];
              return <button key={module.code} className={module.code === activeModule ? "is-active" : ""} onClick={() => setActiveModule(module.code)}>
                <Icon size={17} /><span><strong>{module.name}</strong><small>{module.detail}</small></span><em>{module.count}</em><ChevronRight size={14} />
              </button>;
            })}
          </div>
          <div className="sidebar-divider" />
          <div className="import-brief"><span>最近实际导入</span><strong>{overview.latestImport ? "D0 已进入草稿" : "尚未导入"}</strong><small>{importTime}</small><code>{overview.latestImport?.sourceKind ?? "—"}</code></div>
        </aside>

        <main className="config-main">
          <div className="config-title-row"><div><span className="section-kicker">MYSQL DRAFT SOURCE</span><h1>{activeModuleInfo?.name}</h1><p>{activeModuleInfo?.detail}</p></div><div className="config-revision"><span>SCHEMA</span><b>v{overview.configSet.schemaVersion}</b><small>Revision {overview.configSet.currentRevision}</small></div></div>
          <section className="metric-grid">
            <article><Database /><span>业务实体</span><strong>{overview.modules.reduce((sum, module) => sum + module.count, 0)}</strong><small>已落入关系型业务表</small></article>
            <article className={overview.issueSummary.errors ? "is-danger" : "is-ok"}>{overview.issueSummary.errors ? <ShieldAlert /> : <CheckCircle2 />}<span>阻断冲突</span><strong>{overview.issueSummary.errors}</strong><small>发布前必须消解</small></article>
            <article className={overview.issueSummary.warnings ? "is-warning" : "is-ok"}><AlertTriangle /><span>导入警告</span><strong>{overview.issueSummary.warnings}</strong><small>保留候选值与来源</small></article>
            <article><GitCompareArrows /><span>未解决项</span><strong>{overview.issueSummary.unresolved}</strong><small>不会静默最后文件获胜</small></article>
          </section>

          <section className="entity-section">
            <div className="section-heading"><div><h2>{activeModuleInfo?.name}明细</h2><p>技能已开放乐观锁编辑；其他实体继续按领域逐步开放。</p></div><span>{activeModuleInfo?.count ?? 0} 条</span></div>
            {!entities ? <div className="entity-loading"><LoaderCircle className="spin" /> 正在读取业务表…</div> : entities.groups.map((group) => <EntityGroup key={group.code} group={group} onEdit={group.code === "skills" ? editSkill : undefined} />)}
          </section>
        </main>

        <aside className="issue-panel">
          <div className="release-panel">
            <div><span className="section-kicker">RELEASE PIPELINE</span><h2>校验与发布</h2></div>
            <ReleaseStatus workspace={workspace} currentRevision={overview.configSet.currentRevision} />
            <ChangeRequestPanel workspace={changeWorkspace} disabled={working !== null} onCreate={createChange} onAction={changeAction} />
            <div className="release-actions"><button className="secondary-button" onClick={runValidation} disabled={working !== null}>重新校验</button><button className="primary-button" onClick={() => buildRelease("publish")} disabled={working !== null}>{working === "publish" ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />} 发布 development</button></div>
            <small>正式发布必须：当前修订校验通过、审核通过、警告已确认。</small>
          </div>
          <div className="issue-panel__heading"><div><span className="section-kicker">IMPORT CONFLICTS</span><h2>导入冲突</h2></div><span>{overview.issueSummary.total}</span></div>
          <div className="issue-panel__summary"><ShieldAlert size={17} /><p><strong>{overview.issueSummary.errors} 条阻断</strong><span>{overview.issueSummary.warnings} 条警告 · 均已记录来源</span></p></div>
          <div className="issue-list">{overview.recentIssues.map((issue, index) => <article className={`config-issue config-issue--${issue.severity}`} key={`${issue.conflictType}-${issue.entityCode}-${index}`}>
            <div><span>{issue.severity === "error" ? "阻断" : "警告"}</span><code>{issue.conflictType}</code></div>
            <strong>{issue.entityType ?? "source"} / {issue.entityCode ?? "—"}</strong>
            <p>{issueText(issue.conflictType)}</p>
          </article>)}</div>
        </aside>
      </div>

      <footer className="status-bar"><span><Database size={13} /> MySQL 8.4 · {overview.configSet.code}</span><p><Sparkles size={13} /> {notice}</p><div><b>{overview.modules.length}</b> 配置域 <i /><b>{overview.issueSummary.total}</b> 项冲突</div></footer>
      {skillDraft && <SkillEditor draft={skillDraft} working={working === "save"} onChange={setSkillDraft} onClose={() => setSkillDraft(null)} onSave={saveSkill} />}
    </div>
  );
}

function EntityGroup({ group, onEdit }: { group: ModuleEntities["groups"][number]; onEdit?: (code: string) => void }) {
  const fields = Array.from(new Set(group.rows.flatMap((row) => Object.keys(row))));
  return <div className="entity-group"><div className="entity-group__title"><h3>{group.name}</h3><span>{group.rows.length}</span>{onEdit && <small>点击行编辑</small>}</div>{group.rows.length ? <div className="entity-table-wrap"><table><thead><tr>{fields.map((field) => <th key={field}>{fieldNames[field] ?? field}</th>)}</tr></thead><tbody>{group.rows.map((row, index) => <tr className={onEdit ? "is-editable" : ""} key={`${String(row.code ?? index)}-${index}`} onClick={() => onEdit?.(String(row.code))}>{fields.map((field) => <td key={field}>{renderCell(row[field], field)}</td>)}</tr>)}</tbody></table></div> : <div className="entity-empty">当前配置集暂无数据</div>}</div>;
}

function ReleaseStatus({ workspace, currentRevision }: { workspace: ReleaseWorkspace | null; currentRevision: number }) {
  const validation = workspace?.latestValidation;
  const stale = validation ? validation.sourceRevision !== currentRevision : false;
  return <div className="release-status">
    <div><span>当前修订</span><b>R{currentRevision}</b></div>
    <div className={validation?.errorCount ? "is-danger" : validation && !stale ? "is-ok" : ""}><span>全量校验</span><b>{!validation ? "未执行" : stale ? "已过期" : `${validation.errorCount} 阻断 / ${validation.warningCount} 警告`}</b></div>
    <div><span>最近构建</span><b>{workspace?.latestRelease ? `${workspace.latestRelease.version} · ${workspace.latestRelease.status}` : "暂无"}</b></div>
    <div><span>development</span><b>{workspace?.developmentHeadReleaseId ? "已有活动版本" : "尚未发布"}</b></div>
  </div>;
}

function ChangeRequestPanel({ workspace, disabled, onCreate, onAction }: {
  workspace: ChangeRequestWorkspace | null; disabled: boolean;
  onCreate: (title: string, description: string | null) => void;
  onAction: (action: "submit" | "acknowledge_warnings" | "approve" | "reject", value?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [warningReason, setWarningReason] = useState("已核对候选值与来源，接受当前配置口径");
  const [reviewNotes, setReviewNotes] = useState("");
  const change = workspace?.current;
  const canCreate = !change || change.stale || ["rejected", "released", "superseded"].includes(change.status);
  if (canCreate) return <div className="change-card">
    <div className="change-card__heading"><ClipboardCheck size={15} /><strong>新建变更单</strong><span>R{workspace?.currentRevision ?? "—"}</span></div>
    {change && <small>上一单：{change.title} · {changeStatusName(change.status)}</small>}
    <input aria-label="变更单标题" placeholder="例如：D0 技能倍率调整" value={title} onChange={(event) => setTitle(event.target.value)} />
    <textarea aria-label="变更说明" placeholder="说明本次修改范围和预期影响" value={description} onChange={(event) => setDescription(event.target.value)} />
    <button className="secondary-button" disabled={disabled || title.trim().length < 2} onClick={() => onCreate(title.trim(), description.trim() || null)}>创建草稿</button>
  </div>;

  return <div className="change-card">
    <div className="change-card__heading"><ClipboardCheck size={15} /><strong>{change.title}</strong><span>{changeStatusName(change.status)}</span></div>
    <div className="change-meta"><span>修订 R{change.sourceRevision}</span><span>{change.validationRunId ? "已绑定校验" : "未绑定校验"}</span></div>
    {change.description && <p>{change.description}</p>}
    {change.status === "draft" && <button className="secondary-button" disabled={disabled} onClick={() => onAction("submit")}>提交审核</button>}
    {change.status === "submitted" && <>
      <div className={change.errorCount ? "change-gate is-danger" : "change-gate"}><span>阻断</span><b>{change.errorCount}</b><span>警告确认</span><b>{change.acknowledgedWarningCount}/{change.warningCount}</b></div>
      {change.warningCount > change.acknowledgedWarningCount && <><textarea aria-label="警告确认原因" value={warningReason} onChange={(event) => setWarningReason(event.target.value)} /><button className="secondary-button" disabled={disabled || warningReason.trim().length < 2} onClick={() => onAction("acknowledge_warnings", warningReason.trim())}><CheckCircle2 size={13} /> 确认全部警告</button></>}
      <textarea aria-label="审核意见" placeholder="审核意见；驳回时必填" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
      <div className="change-review-actions"><button className="secondary-button" disabled={disabled || reviewNotes.trim().length < 2} onClick={() => onAction("reject", reviewNotes.trim())}><ThumbsDown size={13} /> 驳回</button><button className="primary-button" disabled={disabled || change.errorCount > 0 || change.warningCount > change.acknowledgedWarningCount} onClick={() => onAction("approve", reviewNotes.trim())}><ThumbsUp size={13} /> 批准</button></div>
    </>}
    {change.status === "approved" && <div className="change-approved"><CheckCircle2 size={14} /> 当前修订已批准，可继续尝试发布。</div>}
  </div>;
}

function changeStatusName(status: string) {
  const labels: Record<string, string> = { draft: "草稿", submitted: "待审核", approved: "已批准", rejected: "已驳回", released: "已发布", superseded: "已过期" };
  return labels[status] ?? status;
}

const attributes = ["strength", "magic", "technique", "speed", "constitution", "armor", "resistance"];
const targets = ["SELF", "ALLY_ALL", "ALLY_LOWEST_HP", "ENEMY_SINGLE", "ENEMY_ALL", "ENEMY_LOWEST_HP", "ENEMY_RANDOM_MULTI"];
function SkillEditor({ draft, working, onChange, onClose, onSave }: { draft: SkillDraft; working: boolean; onChange: (draft: SkillDraft) => void; onClose: () => void; onSave: () => void }) {
  const set = <K extends keyof SkillDraft>(key: K, value: SkillDraft[K]) => onChange({ ...draft, [key]: value });
  return <div className="config-modal-backdrop" onMouseDown={onClose}><section className="skill-editor" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><span className="section-kicker">OPTIMISTIC EDITOR · R{draft.revision}</span><h2>编辑技能 <code>{draft.code}</code></h2></div><button className="icon-button" onClick={onClose}><X size={17} /></button></header>
    <div className="skill-form">
      <label className="span-2"><span>名称键</span><input value={draft.nameKey} onChange={(event) => set("nameKey", event.target.value)} /></label>
      <label><span>伤害类型</span><select value={draft.damageKind} onChange={(event) => set("damageKind", event.target.value as SkillDraft["damageKind"])}><option value="physical">physical</option><option value="magical">magical</option><option value="none">none</option></select></label>
      <label><span>目标类型</span><select value={draft.targetType} onChange={(event) => set("targetType", event.target.value)}>{targets.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      <NumberField label="行动 Tick" value={draft.baseIntervalTicks} onChange={(value) => set("baseIntervalTicks", value)} />
      <NumberField label="施法 Tick" value={draft.castTicks} onChange={(value) => set("castTicks", value)} />
      <NumberField label="冷却 Tick" value={draft.cooldownTicks} onChange={(value) => set("cooldownTicks", value)} />
      <label><span>状态</span><select value={draft.status} onChange={(event) => set("status", event.target.value as SkillDraft["status"])}><option value="active">active</option><option value="disabled">disabled</option></select></label>
      <label><span>主属性</span><select value={draft.primaryAttribute ?? ""} onChange={(event) => set("primaryAttribute", event.target.value || null)}><option value="">无</option>{attributes.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      <NumberField label="主倍率（%）" value={draft.primaryPercent} onChange={(value) => set("primaryPercent", value)} />
      <label><span>副属性</span><select value={draft.secondaryAttribute ?? ""} onChange={(event) => set("secondaryAttribute", event.target.value || null)}><option value="">无</option>{attributes.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      <NumberField label="副倍率（%）" value={draft.secondaryPercent} onChange={(value) => set("secondaryPercent", value)} />
      <NumberField label="排序" value={draft.sortOrder} onChange={(value) => set("sortOrder", value)} />
      <label className="check-field"><input type="checkbox" checked={draft.ignoreTaunt} onChange={(event) => set("ignoreTaunt", event.target.checked)} /><span>忽略嘲讽</span></label>
      <label className="span-2"><span>备注</span><textarea value={draft.notes ?? ""} onChange={(event) => set("notes", event.target.value || null)} /></label>
    </div>
    <footer><span>保存将令实体 revision 和配置集 revision 各 +1，并写入修订快照与审计。</span><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={onSave} disabled={working}>{working && <LoaderCircle className="spin" size={14} />} 保存技能</button></footer>
  </section></div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function renderCell(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return <span className="muted-cell">—</span>;
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return <code>{JSON.stringify(value)}</code>;
  if (field === "status" || field === "type") return <span className={`table-badge table-badge--${String(value)}`}>{String(value)}</span>;
  return String(value);
}

function issueText(type: string) {
  const labels: Record<string, string> = {
    duplicate_skill_definition: "技能在独立文件与 D0 战斗表重复，当前选择运行时版本。",
    combat_parameter_conflict: "D0 固定防御常数与等级曲线候选同时存在。",
    production_runtime_table_mismatch: "生产候选 JSON 未被运行时读取，当前采用 GDScript 实际值。",
    production_candidate_mismatch: "D0 运行生产表与 1.0 候选平衡表不一致。",
    d0_v1_rule_conflict: "D0 与 1.0 策划口径不同，禁止跨配置集静默覆盖。",
    runtime_hardcoded_config: "数值仍在 Godot 代码硬编码，数据库修改尚不能直接生效。",
    runtime_fixed_id_assumption: "运行时依赖固定地图、对象或数组索引，发布接入前需消除。",
  };
  return labels[type] ?? "查看候选值和来源后人工处理。";
}
