"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  BookOpenText,
  CheckCircle2,
  CirclePlay,
  Gift,
  GitFork,
  MessageSquareMore,
  Merge,
  MessagesSquare,
  ScrollText,
  ShieldAlert,
  Swords,
} from "lucide-react";
import type { StoryGraphNode, StoryNodeKind } from "@/lib/story-types";

const nodeMeta: Record<StoryNodeKind, { label: string; icon: typeof ScrollText }> = {
  entry: { label: "入口", icon: CirclePlay },
  dialogue: { label: "对话", icon: MessagesSquare },
  choice: { label: "选项", icon: GitFork },
  check: { label: "检定", icon: ShieldAlert },
  action: { label: "结算", icon: ScrollText },
  combat: { label: "战斗", icon: Swords },
  ending: { label: "结束", icon: CheckCircle2 },
};

function StoryNodeCard({ data, type, selected }: NodeProps<StoryGraphNode>) {
  const kind = type ?? "dialogue";
  const meta = nodeMeta[kind];
  const Icon = meta.icon;
  const firstLine = data.lines?.[0];
  const detail = kind === "dialogue"
    ? firstLine && `${firstLine.speakerName}：${firstLine.text}`
    : kind === "choice"
      ? data.optionText
      : kind === "check"
        ? `${data.checkAttribute ?? "属性"} ${data.checkOperator ?? ">="} ${data.checkValue ?? 0}`
        : kind === "combat"
          ? data.combatId
          : data.description;

  return (
    <div className={`story-node story-node--${kind}${selected ? " is-selected" : ""}`}>
      {kind !== "entry" && <Handle type="target" position={Position.Left} />}
      <div className="story-node__eyebrow">
        <span className="story-node__icon"><Icon size={13} /></span>
        {meta.label}
        {kind === "dialogue" && data.lines && <b>{data.lines.length}句</b>}
      </div>
      <strong className="story-node__title">{data.title || "未命名节点"}</strong>
      {detail && <p className="story-node__detail">{detail}</p>}
      <div className="story-node__signals">
        {Boolean(data.followUpLines?.length) && <span><MessageSquareMore size={11} />{data.followUpLines!.length}句专属对白</span>}
        {data.branchBehavior === "merge" && <span><Merge size={11} />之后汇流</span>}
        {Boolean(data.rewards?.length) && <span className="is-reward"><Gift size={11} />{data.rewards!.length}项奖励</span>}
        {Boolean(data.effects?.length) && <span><BookOpenText size={11} />{data.effects!.length}项变更</span>}
      </div>
      {kind !== "ending" && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

const MemoStoryNode = memo(StoryNodeCard);

export const storyNodeTypes = {
  entry: MemoStoryNode,
  dialogue: MemoStoryNode,
  choice: MemoStoryNode,
  check: MemoStoryNode,
  action: MemoStoryNode,
  combat: MemoStoryNode,
  ending: MemoStoryNode,
};
