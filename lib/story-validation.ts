import type { StoryProject, ValidationIssue } from "./story-types";

export function validateStory(project: StoryProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const scene of project.scenes) {
    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    const entry = scene.nodes.find((node) => node.id === scene.entryNodeId);

    if (scene.locationContext.kind === "unknown") {
      issues.push({
        id: `${scene.id}-location-unknown`,
        level: "warning",
        sceneId: scene.id,
        message: `场景 ${scene.code} 的物理地点尚未冻结，当前只显示原文触发描述`,
      });
    }

    if (!entry) {
      issues.push({
        id: `${scene.id}-missing-entry`,
        level: "error",
        sceneId: scene.id,
        message: `场景 ${scene.code} 缺少有效入口节点`,
      });
    }

    for (const edge of scene.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        issues.push({
          id: `${scene.id}-${edge.id}-dangling`,
          level: "error",
          sceneId: scene.id,
          message: `连线 ${edge.id} 指向不存在的节点`,
        });
      }
    }

    if (entry) {
      const reachable = new Set<string>([entry.id]);
      const queue = [entry.id];
      while (queue.length) {
        const current = queue.shift()!;
        scene.edges
          .filter((edge) => edge.source === current)
          .forEach((edge) => {
            if (!reachable.has(edge.target)) {
              reachable.add(edge.target);
              queue.push(edge.target);
            }
          });
      }
      scene.nodes
        .filter((node) => !reachable.has(node.id))
        .forEach((node) => {
          issues.push({
            id: `${scene.id}-${node.id}-unreachable`,
            level: "warning",
            sceneId: scene.id,
            nodeId: node.id,
            message: `“${node.data.title}” 无法从入口到达`,
          });
        });
    }

    for (const node of scene.nodes) {
      if ((node.type === "choice" || node.type === "check") && !node.data.outcomeText) {
        issues.push({
          id: `${scene.id}-${node.id}-missing-outcome`,
          level: "warning",
          sceneId: scene.id,
          nodeId: node.id,
          message: `“${node.data.title}” 没有说明点击后会发生什么`,
        });
      }
      if ((node.type === "choice" || node.type === "check") && !node.data.branchBehavior) {
        issues.push({
          id: `${scene.id}-${node.id}-missing-branch-behavior`,
          level: "warning",
          sceneId: scene.id,
          nodeId: node.id,
          message: `“${node.data.title}” 没有说明之后汇流、继续分支还是结束`,
        });
      }
      for (const line of node.data.lines ?? []) {
        const length = Array.from(line.text.replace(/\s/g, "")).length;
        if (length > 36) {
          issues.push({
            id: `${scene.id}-${node.id}-${line.id}-long`,
            level: "warning",
            sceneId: scene.id,
            nodeId: node.id,
            message: `${line.speakerName}的台词为 ${length} 字，超过建议的 36 字`,
          });
        }
      }
      if (node.type !== "ending" && !scene.edges.some((edge) => edge.source === node.id)) {
        issues.push({
          id: `${scene.id}-${node.id}-dead-end`,
          level: "warning",
          sceneId: scene.id,
          nodeId: node.id,
          message: `“${node.data.title}” 没有后续连线`,
        });
      }
    }
  }

  return issues;
}
