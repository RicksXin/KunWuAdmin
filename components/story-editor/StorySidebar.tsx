"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  FilePlus2,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import type { StoryProject } from "@/lib/story-types";

interface StorySidebarProps {
  projects: StoryProject[];
  project: StoryProject;
  activeSceneId: string;
  onSelectProject: (id: string) => void;
  onSelectScene: (id: string) => void;
  onNewProject: () => void;
  onNewScene: () => void;
}

const statusLabel = { draft: "草稿", review: "审核中", published: "已发布" };

export function StorySidebar({
  projects,
  project,
  activeSceneId,
  onSelectProject,
  onSelectScene,
  onNewProject,
  onNewScene,
}: StorySidebarProps) {
  const [query, setQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(["main", "side"]));
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

  const filteredProjects = useMemo(
    () => projects.filter((item) => `${item.title}${item.subtitle}${item.id}`.toLowerCase().includes(query.toLowerCase())),
    [projects, query],
  );

  function toggleChapter(id: string) {
    setCollapsedChapters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFolder(id: string) {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside className="story-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="section-kicker">CONTENT</span>
          <h2>剧情库</h2>
        </div>
        <button className="icon-button" title="新建剧情" onClick={onNewProject}><FilePlus2 size={17} /></button>
      </div>

      <label className="search-box">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索剧情或 ID" />
        <kbd>⌘K</kbd>
      </label>

      {(["main", "side"] as const).map((category) => {
        const items = filteredProjects.filter((item) => item.category === category);
        const open = openFolders.has(category);
        return <div key={category}>
          <button className="folder-row" onClick={() => toggleFolder(category)}>
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <FolderOpen size={16} /> {category === "main" ? "主线剧情" : "支线剧情"}
            <span>{items.length}</span>
          </button>
          {open && <div className="story-project-list">
            {items.map((item) => (
              <button
                key={item.id}
                className={`story-project-card${item.id === project.id ? " is-active" : ""}`}
                onClick={() => onSelectProject(item.id)}
              >
                <span className={`status-dot status-dot--${item.status}`} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.version} · {statusLabel[item.status]}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>}
        </div>;
      })}

      <div className="sidebar-divider" />
      <div className="scene-tree-heading">
        <span>章节与场景</span>
        <button className="mini-button" onClick={onNewScene}><Plus size={14} /> 场景</button>
      </div>

      <div className="scene-tree">
        {[...project.chapters].sort((a, b) => a.order - b.order).map((chapter) => {
          const collapsed = collapsedChapters.has(chapter.id);
          const scenes = project.scenes.filter((scene) => scene.chapterId === chapter.id);
          return (
            <div className="chapter-group" key={chapter.id}>
              <button className="chapter-row" onClick={() => toggleChapter(chapter.id)}>
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="chapter-code">{chapter.code}</span>
                <strong>{chapter.title.replace(/^.*?·\s*/, "")}</strong>
                <small>{scenes.length}</small>
              </button>
              {!collapsed && scenes.map((scene) => (
                <button
                  key={scene.id}
                  className={`scene-row${scene.id === activeSceneId ? " is-active" : ""}`}
                  onClick={() => onSelectScene(scene.id)}
                >
                  <CircleDot size={12} />
                  <span><b>{scene.code}</b>{scene.title}</span>
                  <em>{scene.nodes.length}</em>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
