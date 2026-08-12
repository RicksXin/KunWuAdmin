"use client";

import { useCallback } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { GitFork, MapPinned, MessageSquareText, ScrollText, ShieldCheck, Swords } from "lucide-react";
import type { StoryGraphEdge, StoryGraphNode, StoryNodeKind, StoryScene } from "@/lib/story-types";
import { storyNodeTypes } from "./StoryNodes";

interface StoryCanvasProps {
  scene: StoryScene;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onChange: (scene: StoryScene) => void;
  onAddNode: (kind: StoryNodeKind) => void;
}

const palette: { kind: StoryNodeKind; label: string; icon: typeof MessageSquareText }[] = [
  { kind: "dialogue", label: "对话", icon: MessageSquareText },
  { kind: "choice", label: "选项", icon: GitFork },
  { kind: "check", label: "检定", icon: ShieldCheck },
  { kind: "action", label: "结算", icon: ScrollText },
  { kind: "combat", label: "战斗", icon: Swords },
];

export function StoryCanvas({ scene, selectedNodeId, onSelectNode, onChange, onAddNode }: StoryCanvasProps) {
  const onNodesChange = useCallback((changes: NodeChange<StoryGraphNode>[]) => {
    onChange({ ...scene, nodes: applyNodeChanges(changes, scene.nodes) });
  }, [onChange, scene]);

  const onEdgesChange = useCallback((changes: EdgeChange<StoryGraphEdge>[]) => {
    onChange({ ...scene, edges: applyEdgeChanges(changes, scene.edges) });
  }, [onChange, scene]);

  const onConnect = useCallback((connection: Connection) => {
    const edge: StoryGraphEdge = {
      ...connection,
      id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
      type: "smoothstep",
    };
    onChange({ ...scene, edges: addEdge(edge, scene.edges) });
  }, [onChange, scene]);

  const nodes = scene.nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId }));

  return (
    <main className="canvas-panel">
      <div className="canvas-scene-bar">
        <div className="canvas-scene-heading">
          <div><span>{scene.code}</span><strong>{scene.title}</strong></div>
          <small><MapPinned size={11} /> {scene.locationContext.mapIds.join(" / ") || (scene.locationContext.kind === "camp" ? "CAMP" : "INSTANCE")} · {scene.locationContext.mapNames.join(" → ") || "地图未冻结"} · {scene.locationContext.areaName} · {scene.locationContext.timeline}</small>
        </div>
        <div className="trigger-pill"><i />触发：{scene.trigger}</div>
      </div>

      <div className="node-palette" aria-label="添加节点">
        <span>添加节点</span>
        {palette.map(({ kind, label, icon: Icon }) => (
          <button key={kind} onClick={() => onAddNode(kind)} title={`添加${label}节点`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <ReactFlow<StoryGraphNode, StoryGraphEdge>
        nodes={nodes}
        edges={scene.edges}
        nodeTypes={storyNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.24, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.6}
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#72837b" },
          style: { stroke: "#72837b", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#2f3a37" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            if (node.type === "choice") return "#b0844f";
            if (node.type === "combat") return "#a95f50";
            if (node.type === "ending") return "#5b8d75";
            return "#526864";
          }}
          maskColor="rgba(13, 18, 17, .76)"
        />
      </ReactFlow>
      <div className="canvas-hint">拖动节点整理布局 · 从节点右侧端点拖出连线 · Delete 删除选中连线</div>
    </main>
  );
}
