import type { Edge, Node } from "@xyflow/react";

export type StoryStatus = "draft" | "review" | "published";
export type StoryCategory = "main" | "side";
export type StoryNodeKind =
  | "entry"
  | "dialogue"
  | "choice"
  | "check"
  | "action"
  | "combat"
  | "ending";

export interface DialogueLine {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  emotion?: string;
}

export type StoryRewardKind =
  | "item"
  | "currency"
  | "recipe"
  | "equipment"
  | "feature"
  | "narrative";

export interface StoryReward {
  id: string;
  kind: StoryRewardKind;
  label: string;
  quantity?: number;
  timing: "immediate" | "delayed" | "conditional";
  sourceText: string;
}

export interface StoryLocationContext {
  kind: "camp" | "field-map" | "instance" | "memory" | "cross-map" | "unknown";
  mapIds: string[];
  mapNames: string[];
  areaName: string;
  timeline: string;
  explorationMode: "camp" | "expedition" | "projection" | "memory" | "performance" | "cross-map" | "unknown";
  certainty: "explicit" | "inferred" | "cross-map";
  sourceText: string;
}

export interface StoryNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  lines?: DialogueLine[];
  optionText?: string;
  choiceCategory?: "attitude" | "method" | "irreversible";
  requiresConfirmation?: boolean;
  condition?: string;
  effects?: string[];
  outcomeText?: string;
  followUpLines?: DialogueLine[];
  followUpNote?: string;
  branchBehavior?: "merge" | "continue-branch" | "terminal" | "unknown";
  rewards?: StoryReward[];
  costs?: StoryReward[];
  checkAttribute?: string;
  checkOperator?: ">=" | ">" | "==" | "<=" | "<";
  checkValue?: number;
  combatId?: string;
  notes?: string;
}

export type StoryGraphNode = Node<StoryNodeData, StoryNodeKind>;
export type StoryGraphEdge = Edge<{ label?: string }>;

export interface StoryScene {
  id: string;
  chapterId: string;
  code: string;
  title: string;
  trigger: string;
  location: string;
  locationContext: StoryLocationContext;
  characters: string[];
  description: string;
  rewards?: StoryReward[];
  costs?: StoryReward[];
  entryNodeId: string;
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  source?: StorySourceReference;
  updatedAt: string;
}

export interface StorySourceReference {
  document: string;
  heading: string;
  markdown: string;
  importedAt: string;
}

export interface StoryChapter {
  id: string;
  code: string;
  title: string;
  summary: string;
  order: number;
}

export interface StoryProject {
  schemaVersion: 2;
  id: string;
  category: StoryCategory;
  title: string;
  subtitle: string;
  synopsis: string;
  version: string;
  status: StoryStatus;
  chapters: StoryChapter[];
  scenes: StoryScene[];
  variables: StoryVariable[];
  sourceDocuments: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface StoryVariable {
  id: string;
  label: string;
  type: "boolean" | "counter" | "enum";
  range?: string;
  description: string;
}

export interface ValidationIssue {
  id: string;
  level: "error" | "warning";
  sceneId: string;
  nodeId?: string;
  message: string;
}
