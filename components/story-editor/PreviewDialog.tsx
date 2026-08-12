"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Gift, Merge, MessageSquareText, PackageMinus, RotateCcw, X } from "lucide-react";
import type { StoryGraphNode, StoryScene } from "@/lib/story-types";

interface PreviewDialogProps {
  scene: StoryScene;
  open: boolean;
  onClose: () => void;
}

export function PreviewDialog({ scene, open, onClose }: PreviewDialogProps) {
  const [currentId, setCurrentId] = useState(scene.entryNodeId);
  const [lineIndex, setLineIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setCurrentId(scene.entryNodeId);
      setLineIndex(0);
      setHistory([]);
    }
  }, [open, scene.entryNodeId]);

  const node = scene.nodes.find((item) => item.id === currentId) ?? scene.nodes[0];
  const outgoing = useMemo(
    () => scene.edges.filter((edge) => edge.source === node?.id)
      .map((edge) => scene.nodes.find((item) => item.id === edge.target))
      .filter((item): item is StoryGraphNode => Boolean(item)),
    [node?.id, scene.edges, scene.nodes],
  );
  const lines = node?.data.lines ?? [];
  const currentLine = lines[lineIndex];
  const choices = outgoing.filter((item) => item.type === "choice" || item.type === "check");
  const atDialogueEnd = node?.type !== "dialogue" || lineIndex >= lines.length - 1;

  if (!open || !node) return null;

  function goTo(nextId: string) {
    setHistory((items) => [...items, node.id]);
    setCurrentId(nextId);
    setLineIndex(0);
  }

  function next() {
    if (node.type === "dialogue" && lineIndex < lines.length - 1) {
      setLineIndex((index) => index + 1);
      return;
    }
    if (outgoing.length === 1) goTo(outgoing[0].id);
  }

  function back() {
    const previous = history.at(-1);
    if (!previous) return;
    setCurrentId(previous);
    setLineIndex(0);
    setHistory((items) => items.slice(0, -1));
  }

  return (
    <div className="preview-backdrop" role="dialog" aria-modal="true">
      <div className="preview-window">
        <header className="preview-header">
          <div><span>运行预览</span><strong>{scene.code} · {scene.title}</strong></div>
          <div className="preview-progress"><i style={{ width: `${Math.min(100, ((history.length + 1) / Math.max(scene.nodes.length, 1)) * 100)}%` }} /></div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="preview-stage">
          <div className="preview-art">
            <div className="mountain mountain--back" />
            <div className="mountain mountain--front" />
            <div className="seal-mark">昆<br />吾</div>
            <div className="preview-location">
              <span>{scene.locationContext.kind === "camp" ? "营地事件" : scene.locationContext.kind === "cross-map" ? "跨地图任务链" : "场景地点"}</span>
              <strong>{scene.locationContext.mapNames.join(" → ") || "不对应单一地图"}</strong>
              <small>{scene.locationContext.mapIds.join(" / ") || scene.locationContext.timeline} · {scene.locationContext.areaName}</small>
            </div>
          </div>

          <section className={`dialogue-preview dialogue-preview--${node.type}`}>
            <div className="dialogue-preview__meta">
              <span>{node.type?.toUpperCase()}</span>
              <code>{node.id}</code>
            </div>

            {node.type === "dialogue" && currentLine ? <>
              <div className="speaker-row">
                <div className="speaker-avatar">{currentLine.speakerName.slice(0, 1)}</div>
                <div><strong>{currentLine.speakerName}</strong><span>{currentLine.emotion || "默认表情"}</span></div>
              </div>
              <p className="preview-line">{currentLine.text}</p>
              <div className="line-dots">{lines.map((line, index) => <i key={line.id} className={index === lineIndex ? "is-active" : index < lineIndex ? "is-past" : ""} />)}</div>
            </> : node.type === "choice" || node.type === "check" ? <>
              <h3>{node.data.title}</h3>
              <p className="preview-description">{node.data.optionText || node.data.title}</p>
              <div className="preview-semantic-grid">
                <section><span>点击后发生</span><p>{node.data.outcomeText || "原文没有单独写明即时结果。"}</p></section>
                <section><span><MessageSquareText size={12} />专属后续对白</span>
                  {(node.data.followUpLines ?? []).length > 0
                    ? <div className="preview-follow-up-lines">{node.data.followUpLines!.map((line) => <p key={line.id}><strong>{line.speakerName}</strong>：{line.text}</p>)}</div>
                    : <p>{node.data.followUpNote || "原文未配置专属后续对白。"}</p>}
                </section>
              </div>
              <div className="preview-branch-note"><Merge size={13} />{node.data.branchBehavior === "merge" ? "上述结果保存并播放后，回到公共后续剧情。" : node.data.branchBehavior === "continue-branch" ? "选择后进入专属分支。" : node.data.branchBehavior === "terminal" ? "选择后在此结束。" : "后续是否汇流尚未冻结。"}</div>
              <PreviewRewardSummary rewards={node.data.rewards ?? []} costs={node.data.costs ?? []} />
              {Boolean(node.data.effects?.length) && <div className="preview-effects">{node.data.effects!.map((effect) => <code key={effect}>{effect}</code>)}</div>}
            </> : <>
              <h3>{node.data.title}</h3>
              <p className="preview-description">{node.data.description || "此节点没有展示文案。"}</p>
              <PreviewRewardSummary rewards={node.data.rewards ?? []} costs={node.data.costs ?? []} />
              {Boolean(node.data.effects?.length) && <div className="preview-effects">{node.data.effects!.map((effect) => <code key={effect}>{effect}</code>)}</div>}
            </>}

            {atDialogueEnd && choices.length > 0 ? (
              <div className="preview-choices">
                {choices.map((choice, index) => (
                  <button key={choice.id} onClick={() => goTo(choice.id)}>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <span><strong>{choice.data.optionText || choice.data.title}</strong><small>{choiceCategoryLabel[choice.data.choiceCategory ?? "method"]} · {choice.data.followUpLines?.length ? `${choice.data.followUpLines.length}句专属对白` : "无逐字专属对白"}{choice.data.rewards?.length ? ` · ${choice.data.rewards.length}项奖励` : ""}</small></span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="preview-actions">
                <button className="preview-back" disabled={!history.length} onClick={back}><ArrowLeft size={15} /> 回退</button>
                {node.type === "ending" ? (
                  <button className="preview-next" onClick={onClose}><Check size={16} /> 完成预览</button>
                ) : outgoing.length === 1 || (node.type === "dialogue" && !atDialogueEnd) ? (
                  <button className="preview-next" onClick={next}>{node.type === "choice" ? "确认选择" : "继续"}<ChevronRight size={16} /></button>
                ) : outgoing.length > 1 ? (
                  <div className="preview-choices preview-choices--inline">{outgoing.map((item) => <button key={item.id} onClick={() => goTo(item.id)}><span>{item.data.title}</span><ChevronRight size={15} /></button>)}</div>
                ) : (
                  <button className="preview-next" onClick={() => { setCurrentId(scene.entryNodeId); setHistory([]); }}><RotateCcw size={15} /> 重新开始</button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const choiceCategoryLabel = { attitude: "态度", method: "方法", irreversible: "不可逆" } as const;

function PreviewRewardSummary({ rewards, costs }: { rewards: NonNullable<StoryGraphNode["data"]["rewards"]>; costs: NonNullable<StoryGraphNode["data"]["costs"]> }) {
  if (!rewards.length && !costs.length) return <div className="preview-no-reward">当前节点没有明确的道具或资源奖励。</div>;
  return <div className="preview-rewards">
    {rewards.map((reward) => <span key={reward.id} className="is-gain"><Gift size={11} />得到：{reward.label}{reward.quantity ? ` ×${reward.quantity}` : ""}<small>{reward.timing === "delayed" ? "延迟领取" : reward.timing === "conditional" ? "满足条件时" : "立即"}</small></span>)}
    {costs.map((cost) => <span key={cost.id} className="is-cost"><PackageMinus size={11} />消耗：{cost.label}{cost.quantity ? ` ×${cost.quantity}` : ""}</span>)}
  </div>;
}
