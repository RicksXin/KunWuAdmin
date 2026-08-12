"use client";

import { AlertTriangle, Gift, MapPinned, Merge, MessageSquareText, PackageMinus, Plus, Trash2, XCircle } from "lucide-react";
import type {
  DialogueLine,
  StoryGraphNode,
  StoryNodeData,
  StoryReward,
  StoryScene,
  ValidationIssue,
} from "@/lib/story-types";

interface InspectorPanelProps {
  scene: StoryScene;
  node: StoryGraphNode | null;
  issues: ValidationIssue[];
  tab: "inspector" | "issues";
  onTabChange: (tab: "inspector" | "issues") => void;
  onUpdateNode: (data: StoryNodeData) => void;
  onDeleteNode: () => void;
  onJumpToIssue: (issue: ValidationIssue) => void;
}

export function InspectorPanel({
  scene,
  node,
  issues,
  tab,
  onTabChange,
  onUpdateNode,
  onDeleteNode,
  onJumpToIssue,
}: InspectorPanelProps) {
  const sceneIssues = issues.filter((issue) => issue.sceneId === scene.id);

  return (
    <aside className="inspector-panel">
      <div className="inspector-tabs">
        <button className={tab === "inspector" ? "is-active" : ""} onClick={() => onTabChange("inspector")}>属性</button>
        <button className={tab === "issues" ? "is-active" : ""} onClick={() => onTabChange("issues")}>
          校验 <span>{issues.length}</span>
        </button>
      </div>

      {tab === "issues" ? (
        <ValidationList issues={issues} onJump={onJumpToIssue} />
      ) : node ? (
        <NodeInspector node={node} onUpdate={onUpdateNode} onDelete={onDeleteNode} />
      ) : (
        <SceneInspector scene={scene} issueCount={sceneIssues.length} />
      )}
    </aside>
  );
}

function SceneInspector({ scene, issueCount }: { scene: StoryScene; issueCount: number }) {
  const location = scene.locationContext;
  return (
    <div className="inspector-scroll">
      <div className="inspector-title-block">
        <span className="section-kicker">SCENE</span>
        <h3>{scene.code} · {scene.title}</h3>
        <p>{scene.description || "尚未填写场景说明。"}</p>
      </div>
      <section className="location-card">
        <div className="semantic-section-title"><MapPinned size={15} /><strong>事件发生在哪里</strong><span className={`certainty-badge certainty-badge--${location.certainty}`}>{location.certainty === "explicit" ? "原文明示" : location.certainty === "cross-map" ? "跨地图" : "地图推断"}</span></div>
        <strong className="location-card__map">{location.mapNames.join(" → ") || "策划尚未冻结地图"}</strong>
        {location.mapIds.length > 0 && <div className="location-map-ids">{location.mapIds.map((id) => <code key={id}>{id}</code>)}</div>}
        <dl>
          <div><dt>区域 / 坐标</dt><dd>{location.areaName}</dd></div>
          <div><dt>时态 / 玩法</dt><dd>{location.timeline} · {explorationModeLabel[location.explorationMode]}</dd></div>
          <div><dt>判断依据</dt><dd>{location.sourceText}</dd></div>
        </dl>
      </section>
      <dl className="scene-facts">
        <div><dt>触发条件</dt><dd>{scene.trigger}</dd></div>
        <div><dt>登场角色</dt><dd>{scene.characters.join("、") || "未配置"}</dd></div>
        <div><dt>节点规模</dt><dd>{scene.nodes.length} 节点 / {scene.edges.length} 连线</dd></div>
        {scene.source && <div><dt>草案来源</dt><dd>{scene.source.document}<br />{scene.source.heading}</dd></div>}
      </dl>
      <RewardSection rewards={scene.rewards ?? []} costs={scene.costs ?? []} emptyText="这整个场景的原文没有识别到明确的道具、资源、配方或功能奖励。" />
      <div className={`scene-health${issueCount ? " has-issues" : ""}`}>
        {issueCount ? <AlertTriangle size={18} /> : <span className="health-check">✓</span>}
        <div><strong>{issueCount ? `${issueCount} 项待检查` : "场景结构健康"}</strong><p>{issueCount ? "切换到校验页查看详情" : "入口、连线与台词长度均符合规则"}</p></div>
      </div>
      <p className="inspector-empty-hint">在画布中选择节点以编辑内容。</p>
    </div>
  );
}

function NodeInspector({ node, onUpdate, onDelete }: {
  node: StoryGraphNode;
  onUpdate: (data: StoryNodeData) => void;
  onDelete: () => void;
}) {
  const data = node.data;
  const update = (patch: Partial<StoryNodeData>) => onUpdate({ ...data, ...patch });

  function updateLine(id: string, patch: Partial<DialogueLine>) {
    update({ lines: (data.lines ?? []).map((line) => line.id === id ? { ...line, ...patch } : line) });
  }

  function addLine() {
    update({
      lines: [...(data.lines ?? []), {
        id: `line_${Date.now()}`,
        speakerId: "",
        speakerName: "角色",
        text: "",
      }],
    });
  }

  function removeLine(id: string) {
    update({ lines: (data.lines ?? []).filter((line) => line.id !== id) });
  }

  function updateFollowUpLine(id: string, patch: Partial<DialogueLine>) {
    update({ followUpLines: (data.followUpLines ?? []).map((line) => line.id === id ? { ...line, ...patch } : line) });
  }

  return (
    <div className="inspector-scroll">
      <div className="inspector-title-block inspector-title-block--node">
        <span className={`node-kind-badge node-kind-badge--${node.type}`}>{node.type}</span>
        <small>NODE ID</small>
        <code>{node.id}</code>
      </div>

      <Field label="节点名称">
        <input value={data.title} onChange={(event) => update({ title: event.target.value })} />
      </Field>
      <Field label="说明 / 表现备注">
        <textarea rows={3} value={data.description ?? ""} onChange={(event) => update({ description: event.target.value })} placeholder="节点的策划说明…" />
      </Field>

      {node.type === "dialogue" && (
        <section className="line-editor-section">
          <div className="field-section-heading"><span>台词序列</span><b>{data.lines?.length ?? 0}</b></div>
          {(data.lines ?? []).map((line, index) => (
            <div className="line-editor" key={line.id}>
              <div className="line-editor__head"><span>{String(index + 1).padStart(2, "0")}</span><button onClick={() => removeLine(line.id)} title="删除台词"><Trash2 size={13} /></button></div>
              <div className="two-columns">
                <Field label="说话人"><input value={line.speakerName} onChange={(event) => updateLine(line.id, { speakerName: event.target.value })} /></Field>
                <Field label="表情"><input value={line.emotion ?? ""} onChange={(event) => updateLine(line.id, { emotion: event.target.value })} placeholder="默认" /></Field>
              </div>
              <Field label={`台词 · ${Array.from(line.text.replace(/\s/g, "")).length}/36`}>
                <textarea className={Array.from(line.text.replace(/\s/g, "")).length > 36 ? "is-invalid" : ""} rows={3} value={line.text} onChange={(event) => updateLine(line.id, { text: event.target.value })} />
              </Field>
            </div>
          ))}
          <button className="add-line-button" onClick={addLine}><Plus size={14} /> 添加一句台词</button>
        </section>
      )}

      {(node.type === "choice" || node.type === "check") && <>
        <div className="choice-meaning-card">
          <strong>{choiceCategoryCopy[data.choiceCategory ?? "method"].title}</strong>
          <p>{choiceCategoryCopy[data.choiceCategory ?? "method"].description}</p>
        </div>
        <Field label="玩家选项文案"><textarea rows={2} value={data.optionText ?? ""} onChange={(event) => update({ optionText: event.target.value })} /></Field>
        <Field label="选择类型">
          <select value={data.choiceCategory ?? "method"} onChange={(event) => update({ choiceCategory: event.target.value as StoryNodeData["choiceCategory"] })}>
            <option value="attitude">态度 · 只改关系与风味</option>
            <option value="method">方法 · 改变过程并汇流</option>
            <option value="irreversible">不可逆 · 必须二次确认</option>
          </select>
        </Field>
        <label className="checkbox-field"><input type="checkbox" checked={data.requiresConfirmation ?? data.choiceCategory === "irreversible"} onChange={(event) => update({ requiresConfirmation: event.target.checked })} />选择前二次确认</label>
        <Field label="点击后立即发生什么">
          <textarea rows={4} value={data.outcomeText ?? ""} onChange={(event) => update({ outcomeText: event.target.value })} placeholder="原文没有写明时请明确保留‘未写明’，不要补写对白。" />
        </Field>
        <section className="follow-up-section">
          <div className="semantic-section-title"><MessageSquareText size={14} /><strong>这个选项有专属后续对白吗</strong><span>{data.followUpLines?.length ?? 0} 句</span></div>
          {(data.followUpLines ?? []).map((line) => (
            <div className="follow-up-line" key={line.id}>
              <input value={line.speakerName} onChange={(event) => updateFollowUpLine(line.id, { speakerName: event.target.value })} />
              <textarea rows={2} value={line.text} onChange={(event) => updateFollowUpLine(line.id, { text: event.target.value })} />
            </div>
          ))}
          <p>{data.followUpNote || "尚未说明是否有专属后续对白。"}</p>
        </section>
        <Field label="之后怎么走">
          <select value={data.branchBehavior ?? "unknown"} onChange={(event) => update({ branchBehavior: event.target.value as StoryNodeData["branchBehavior"] })}>
            <option value="merge">保存结果后汇流到公共剧情</option>
            <option value="continue-branch">进入该选项的专属分支</option>
            <option value="terminal">在此结束</option>
            <option value="unknown">原文尚未冻结</option>
          </select>
        </Field>
        <div className="branch-explanation"><Merge size={14} /><span>{branchBehaviorCopy[data.branchBehavior ?? "unknown"]}</span></div>
      </>}

      {node.type === "check" && <div className="check-grid">
        <Field label="检定属性"><input value={data.checkAttribute ?? ""} onChange={(event) => update({ checkAttribute: event.target.value })} placeholder="magic.max" /></Field>
        <Field label="关系"><select value={data.checkOperator ?? ">="} onChange={(event) => update({ checkOperator: event.target.value as StoryNodeData["checkOperator"] })}><option>&gt;=</option><option>&gt;</option><option>==</option><option>&lt;=</option><option>&lt;</option></select></Field>
        <Field label="阈值"><input type="number" value={data.checkValue ?? 0} onChange={(event) => update({ checkValue: Number(event.target.value) })} /></Field>
      </div>}

      {node.type === "combat" && <Field label="战斗配置 ID"><input value={data.combatId ?? ""} onChange={(event) => update({ combatId: event.target.value })} placeholder="combat_..." /></Field>}

      {["choice", "check", "action"].includes(node.type ?? "") && (
        <Field label="状态与资源变更（每行一项）">
          <textarea className="code-textarea" rows={Math.max(4, data.effects?.length ?? 0)} value={(data.effects ?? []).join("\n")} onChange={(event) => update({ effects: event.target.value.split("\n").filter(Boolean) })} placeholder="story_flag = true" />
        </Field>
      )}

      {["choice", "check", "action", "combat", "ending"].includes(node.type ?? "") && (
        <RewardSection rewards={data.rewards ?? []} costs={data.costs ?? []} emptyText="当前节点原文没有识别到明确奖励或消耗；场景级结算仍可能有统一奖励。" />
      )}

      {node.type !== "entry" && (
        <button className="danger-button" onClick={onDelete}><Trash2 size={14} /> 删除此节点</button>
      )}
    </div>
  );
}

function ValidationList({ issues, onJump }: { issues: ValidationIssue[]; onJump: (issue: ValidationIssue) => void }) {
  const errors = issues.filter((issue) => issue.level === "error").length;
  return (
    <div className="inspector-scroll validation-list">
      <div className="validation-summary">
        <span className={errors ? "is-error" : ""}>{errors}</span>
        <div><strong>阻断问题</strong><p>{issues.length - errors} 条建议，可继续保存草稿</p></div>
      </div>
      {issues.length === 0 && <div className="validation-empty"><span>✓</span><strong>全部检查通过</strong><p>当前剧情没有发现结构或文案问题。</p></div>}
      {issues.map((issue) => (
        <button className={`issue-card issue-card--${issue.level}`} key={issue.id} onClick={() => onJump(issue)}>
          {issue.level === "error" ? <XCircle size={17} /> : <AlertTriangle size={17} />}
          <span><strong>{issue.level === "error" ? "错误" : "建议"}</strong><p>{issue.message}</p></span>
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

const explorationModeLabel = {
  camp: "营地交互",
  expedition: "当世肉身远征",
  projection: "上古命灯投影",
  memory: "神魂／记忆探索",
  performance: "演出／状态结算",
  "cross-map": "跨地图任务链",
  unknown: "玩法未冻结",
} as const;

const choiceCategoryCopy = {
  attitude: { title: "态度选项", description: "主要改变关系、风味台词或结局评价，通常不会改变主线去向。" },
  method: { title: "方法选项", description: "改变资源、战斗或检定过程；完成自己的结果后通常回到公共剧情。" },
  irreversible: { title: "不可逆选项", description: "会永久改变人物、证据、任务物或结局资格，选择前必须展示后果并二次确认。" },
} as const;

const branchBehaviorCopy = {
  merge: "这个选项不会生成一条长期独立对话链：先执行上面的专属结果和对白，再回到公共后续节点。",
  "continue-branch": "这个选项会继续进入专属分支，直到后续节点另行汇流或结束。",
  terminal: "选择完成后该场景或任务在此结束。",
  unknown: "策划原文尚未说明后续拓扑，需要补充后才能判断是否汇流。",
} as const;

function RewardSection({ rewards, costs, emptyText }: { rewards: StoryReward[]; costs: StoryReward[]; emptyText: string }) {
  return (
    <section className="reward-section">
      <div className="semantic-section-title"><Gift size={14} /><strong>奖励与消耗</strong><span>{rewards.length + costs.length} 项</span></div>
      {rewards.length === 0 && costs.length === 0 ? <p className="semantic-empty">{emptyText}</p> : <>
        {rewards.length > 0 && <RewardList title="得到" icon={<Gift size={13} />} items={rewards} tone="gain" />}
        {costs.length > 0 && <RewardList title="消耗 / 交付" icon={<PackageMinus size={13} />} items={costs} tone="cost" />}
      </>}
    </section>
  );
}

function RewardList({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: StoryReward[]; tone: "gain" | "cost" }) {
  return <div className={`reward-list reward-list--${tone}`}><h4>{icon}{title}</h4>{items.map((item) => (
    <div className="reward-row" key={item.id}>
      <div><strong>{item.label}{item.quantity ? ` ×${item.quantity}` : ""}</strong><span>{rewardKindLabel[item.kind]} · {rewardTimingLabel[item.timing]}</span></div>
      <p>{item.sourceText}</p>
    </div>
  ))}</div>;
}

const rewardKindLabel = { item: "道具", currency: "资源", recipe: "配方", equipment: "装备", feature: "功能／状态", narrative: "叙事结果" } as const;
const rewardTimingLabel = { immediate: "立即", delayed: "延迟领取", conditional: "满足条件时" } as const;
