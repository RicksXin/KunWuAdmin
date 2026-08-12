"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  Boxes,
  Check,
  ChevronDown,
  CircleUserRound,
  Cloud,
  Database,
  FileCode2,
  Gauge,
  LoaderCircle,
  Play,
  Save,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type {
  StoryGraphNode,
  StoryNodeData,
  StoryNodeKind,
  StoryProject,
  StoryScene,
  ValidationIssue,
} from "@/lib/story-types";
import { validateStory } from "@/lib/story-validation";
import { InspectorPanel } from "./InspectorPanel";
import { PreviewDialog } from "./PreviewDialog";
import { StoryCanvas } from "./StoryCanvas";
import { StorySidebar } from "./StorySidebar";

const railItems = [
  { icon: BookOpenText, label: "剧情", active: true },
  { icon: FileCode2, label: "任务" },
  { icon: Users, label: "角色" },
  { icon: Boxes, label: "物品" },
  { icon: Database, label: "数据", href: "/config" },
];

export function StoryEditor() {
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [project, setProject] = useState<StoryProject | null>(null);
  const [activeSceneId, setActiveSceneId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"inspector" | "issues">("inspector");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("正在载入剧情配置…");

  useEffect(() => {
    fetch("/api/stories", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("LOAD_FAILED");
        return response.json() as Promise<StoryProject[]>;
      })
      .then((items) => {
        setProjects(items);
        setProject(items[0] ?? null);
        setActiveSceneId(items[0]?.scenes[0]?.id ?? "");
        setNotice(items.length ? "配置已从本地数据源载入" : "剧情库为空，请新建剧情");
      })
      .catch(() => setNotice("剧情载入失败，请确认开发服务已启动"));
  }, []);

  const activeScene = project?.scenes.find((scene) => scene.id === activeSceneId) ?? project?.scenes[0];
  const selectedNode = activeScene?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const issues = useMemo(() => project ? validateStory(project) : [], [project]);

  const mutateProject = useCallback((recipe: (current: StoryProject) => StoryProject) => {
    setProject((current) => current ? recipe(current) : current);
    setDirty(true);
  }, []);

  const updateScene = useCallback((scene: StoryScene) => {
    mutateProject((current) => ({
      ...current,
      scenes: current.scenes.map((item) => item.id === scene.id
        ? { ...scene, updatedAt: new Date().toISOString() }
        : item),
    }));
  }, [mutateProject]);

  async function save(candidate = project, successMessage = "草稿已保存到本地配置") {
    if (!candidate) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/stories/${candidate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidate),
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      const saved = await response.json() as StoryProject;
      setProject(saved);
      setProjects((items) => items.map((item) => item.id === saved.id ? saved : item));
      setDirty(false);
      setNotice(successMessage);
    } catch {
      setNotice("保存失败，请检查终端日志后重试");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!project) return;
    const errors = issues.filter((issue) => issue.level === "error");
    if (errors.length) {
      setInspectorTab("issues");
      setNotice(`发布被阻止：还有 ${errors.length} 个结构错误`);
      return;
    }
    const published: StoryProject = { ...project, status: "published", version: nextPublishedVersion(project.version) };
    setProject(published);
    await save(published, "剧情版本已发布并写入配置");
  }

  async function selectProject(id: string) {
    if (id === project?.id) return;
    if (dirty && !window.confirm("当前修改尚未保存，确定切换剧情吗？")) return;
    const response = await fetch(`/api/stories/${id}`, { cache: "no-store" });
    if (!response.ok) return setNotice("切换剧情失败");
    const selected = await response.json() as StoryProject;
    setProject(selected);
    setActiveSceneId(selected.scenes[0]?.id ?? "");
    setSelectedNodeId(null);
    setDirty(false);
  }

  async function createProject() {
    const title = window.prompt("新剧情名称", "未命名剧情")?.trim();
    if (!title) return;
    const id = `story_${Date.now()}`;
    const response = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
    if (!response.ok) return setNotice("新建剧情失败");
    const created = await response.json() as StoryProject;
    setProjects((items) => [created, ...items]);
    setProject(created);
    setActiveSceneId(created.scenes[0].id);
    setSelectedNodeId(null);
    setDirty(false);
    setNotice("已创建剧情草稿");
  }

  function createScene() {
    if (!project) return;
    const chapter = project.chapters.find((item) => item.id === activeScene?.chapterId) ?? project.chapters[0];
    if (!chapter) return;
    const sceneCount = project.scenes.filter((item) => item.chapterId === chapter.id).length + 1;
    const suffix = crypto.randomUUID().slice(0, 8);
    const sceneId = `${chapter.code.toLowerCase()}_${String(sceneCount).padStart(2, "0")}_${suffix}`;
    const entryId = `${sceneId}_entry`;
    const endId = `${sceneId}_end`;
    const scene: StoryScene = {
      id: sceneId,
      chapterId: chapter.id,
      code: `${chapter.code}-${String(sceneCount).padStart(2, "0")}`,
      title: "未命名场景",
      trigger: "待配置",
      location: "待配置",
      locationContext: {
        kind: "unknown",
        mapIds: [],
        mapNames: [],
        areaName: "待配置",
        timeline: "待配置",
        explorationMode: "unknown",
        certainty: "inferred",
        sourceText: "待配置",
      },
      characters: [],
      description: "",
      entryNodeId: entryId,
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: entryId, type: "entry", position: { x: 100, y: 220 }, data: { title: "场景入口", description: "待配置触发条件" } },
        { id: endId, type: "ending", position: { x: 520, y: 220 }, data: { title: "场景结束", description: "待配置结算" } },
      ],
      edges: [{ id: `edge_${entryId}_${endId}`, source: entryId, target: endId }],
    };
    mutateProject((current) => ({ ...current, scenes: [...current.scenes, scene] }));
    setActiveSceneId(scene.id);
    setSelectedNodeId(null);
    setNotice(`已在${chapter.title}中新建场景`);
  }

  function addNode(kind: StoryNodeKind) {
    if (!activeScene) return;
    const id = `${kind}_${crypto.randomUUID().slice(0, 8)}`;
    const defaults: Record<StoryNodeKind, StoryNodeData> = {
      entry: { title: "场景入口" },
      dialogue: { title: "新对话", lines: [{ id: `line_${Date.now()}`, speakerId: "", speakerName: "角色", text: "" }] },
      choice: {
        title: "新选项",
        optionText: "输入玩家选项",
        choiceCategory: "method",
        outcomeText: "待配置选择结果",
        followUpNote: "尚未配置专属后续对白。",
        branchBehavior: "unknown",
        effects: [],
        rewards: [],
        costs: [],
      },
      check: { title: "新检定", checkAttribute: "", checkOperator: ">=", checkValue: 0, effects: [] },
      action: { title: "新结算", description: "", effects: [] },
      combat: { title: "新战斗", combatId: "combat_" },
      ending: { title: "场景结束" },
    };
    const node: StoryGraphNode = {
      id,
      type: kind,
      position: { x: 400 + (activeScene.nodes.length % 4) * 300, y: 130 + (activeScene.nodes.length % 3) * 190 },
      data: defaults[kind],
    };
    updateScene({ ...activeScene, nodes: [...activeScene.nodes, node] });
    setSelectedNodeId(id);
    setInspectorTab("inspector");
  }

  function updateSelectedNode(data: StoryNodeData) {
    if (!activeScene || !selectedNodeId) return;
    updateScene({ ...activeScene, nodes: activeScene.nodes.map((node) => node.id === selectedNodeId ? { ...node, data } : node) });
  }

  function deleteSelectedNode() {
    if (!activeScene || !selectedNodeId || selectedNodeId === activeScene.entryNodeId) return;
    updateScene({
      ...activeScene,
      nodes: activeScene.nodes.filter((node) => node.id !== selectedNodeId),
      edges: activeScene.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    });
    setSelectedNodeId(null);
  }

  function jumpToIssue(issue: ValidationIssue) {
    setActiveSceneId(issue.sceneId);
    setSelectedNodeId(issue.nodeId ?? null);
    if (issue.nodeId) setInspectorTab("inspector");
  }

  if (!project) {
    return <div className="loading-screen"><div className="seal-loader">昆</div><LoaderCircle className="spin" /><p>{notice}</p></div>;
  }

  return (
    <div className="admin-shell">
      <header className="app-header">
        <div className="brand-lockup"><div className="brand-seal">昆</div><div><strong>昆吾司典</strong><span>KUNWU CONFIG CONSOLE</span></div></div>
        <div className="header-context">
          <span>剧情编辑器</span><i />
          <strong>{project.title}</strong>
          <small className={`status-badge status-badge--${project.status}`}>{project.status === "published" ? "已发布" : project.status === "review" ? "审核中" : "草稿"}</small>
        </div>
        <div className="header-actions">
          <div className="save-state">{saving ? <LoaderCircle className="spin" size={14} /> : dirty ? <span className="dirty-dot" /> : <Check size={14} />} {saving ? "写入中" : dirty ? "有未保存修改" : "全部已保存"}</div>
          <button className="secondary-button" onClick={() => setPreviewOpen(true)}><Play size={15} /> 运行预览</button>
          <button className="secondary-button" onClick={() => save()} disabled={saving || !dirty}><Save size={15} /> 保存</button>
          <button className="primary-button" onClick={publish} disabled={saving}><Send size={15} /> 发布 <ChevronDown size={13} /></button>
          <button className="avatar-button"><CircleUserRound size={21} /></button>
        </div>
      </header>

      <div className="workspace">
        <nav className="app-rail">
          <div className="rail-main">
            {railItems.map(({ icon: Icon, label, active, href }) => href
              ? <Link key={label} href={href} className={active ? "is-active" : ""} title={label}><Icon size={20} /><span>{label}</span></Link>
              : <button key={label} className={active ? "is-active" : ""} title={label}><Icon size={20} /><span>{label}</span></button>)}
          </div>
          <div className="rail-bottom"><button title="运行状态"><Gauge size={20} /></button><button title="设置"><Settings size={20} /></button></div>
        </nav>

        <StorySidebar projects={projects} project={project} activeSceneId={activeScene?.id ?? ""} onSelectProject={selectProject} onSelectScene={(id) => { setActiveSceneId(id); setSelectedNodeId(null); }} onNewProject={createProject} onNewScene={createScene} />

        {activeScene ? <StoryCanvas scene={activeScene} selectedNodeId={selectedNodeId} onSelectNode={(id) => { setSelectedNodeId(id); if (id) setInspectorTab("inspector"); }} onChange={updateScene} onAddNode={addNode} /> : <div className="empty-canvas">当前剧情还没有场景</div>}

        {activeScene && <InspectorPanel scene={activeScene} node={selectedNode} issues={issues} tab={inspectorTab} onTabChange={setInspectorTab} onUpdateNode={updateSelectedNode} onDeleteNode={deleteSelectedNode} onJumpToIssue={jumpToIssue} />}
      </div>

      <footer className="status-bar">
        <span><Cloud size={13} /> 本地配置源</span>
        <p><Sparkles size={13} /> {notice}</p>
        <div><b>{project.scenes.length}</b> 场景 <i /> <b>{project.scenes.reduce((sum, scene) => sum + scene.nodes.length, 0)}</b> 节点 <i /> <b className={issues.length ? "has-issues" : ""}>{issues.length}</b> 项校验</div>
      </footer>

      {activeScene && <PreviewDialog scene={activeScene} open={previewOpen} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function nextPublishedVersion(version: string) {
  return version.replace(/-draft\.\d+$/, "").replace(/-review\.\d+$/, "");
}
