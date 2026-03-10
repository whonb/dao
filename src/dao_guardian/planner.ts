import path from "path";
import { promises as fs } from "fs";
import { spawnSync } from "child_process";
import { readJson, writeJson, appendJsonl, nowIso } from "../common/fs.js";
import chalk from "chalk";

export type PlanResult = {
  thought: string;
  next_objective: string;
  next_actions: string[];
  roadmap_update?: string;
};

export class DaoPlanner {
  root: string;
  agentsPath: string;
  roadmapPath: string;
  logsDir: string;
  stateDir: string;

  constructor(root: string) {
    this.root = root;
    this.agentsPath = path.join(root, "AGENTS.md");
    this.roadmapPath = path.join(root, "ROADMAP.md");
    this.logsDir = path.join(root, "logs");
    this.stateDir = path.join(root, "state");
  }

  async plan(tool: { name: string; run_cmd: string }): Promise<PlanResult | null> {
    const agents = await this._safeRead(this.agentsPath);
    const roadmap = await this._safeRead(this.roadmapPath);
    const events = await this._getRecentEvents(10);

    const prompt = `
你是本项目的“大脑” (Planner Agent)。你的任务是分析当前进化状态，并规划接下来的具体目标。

### 1. 宪法 (AGENTS.md)
${agents}

### 2. 当前路线图 (ROADMAP.md)
${roadmap}

### 3. 最近执行记录 (Recent Events)
${events.join("\n")}

### 你的任务：
1. **反思**：为什么之前的尝试成功或失败了？有没有死循环？
2. **规划**：基于路线图和反思，确定下一轮进化的“具体目标” (next_objective) 和“优先动作” (next_actions)。
3. **更新路线图**：如果需要，建议对 ROADMAP.md 的修改。

### 输出格式：
必须返回合法的 JSON 对象，包含以下字段：
- thought: 你的深度思考过程。
- next_objective: 下一轮的具体目标（字符串）。
- next_actions: 优先级排序的动作列表（字符串数组）。
- roadmap_update: (可选) 对 ROADMAP.md 的最新观察或待办建议。
`;

    const tmpPromptFile = path.join(this.stateDir, "last_planner_prompt.txt");
    await fs.writeFile(tmpPromptFile, prompt, "utf-8");

    // 调用工具进行推断 (Inquiry Call)
    let cmd = tool.run_cmd;
    const replacements: Record<string, string> = {
      prompt_file: JSON.stringify(tmpPromptFile).slice(1, -1)
    };
    for (const [k, v] of Object.entries(replacements)) cmd = cmd.split(`{${k}}`).join(v);

    const cp = spawnSync("sh", ["-c", cmd], { cwd: this.root, encoding: "utf-8" });
    if (cp.status !== 0) return null;

    try {
      // 提取 JSON
      const output = cp.stdout;
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const res = JSON.parse(jsonMatch[0]) as PlanResult;
        
        // 如果有路线图更新，尝试同步写回 ROADMAP.md
        if (res.roadmap_update) {
          await this._updateRoadmap(res.roadmap_update);
        }
        
        return res;
      }
    } catch (e) {
      console.error(chalk.red("[Planner] Failed to parse LLM response:"), e);
    }
    return null;
  }

  private async _safeRead(p: string): Promise<string> {
    try {
      return await fs.readFile(p, "utf-8");
    } catch {
      return "";
    }
  }

  private async _getRecentEvents(n: number): Promise<string[]> {
    const p = path.join(this.logsDir, "evolution_events.jsonl");
    try {
      const data = await fs.readFile(p, "utf-8");
      return data.split("\n").filter(Boolean).slice(-n);
    } catch {
      return [];
    }
  }

  private async _updateRoadmap(newObservation: string): Promise<void> {
    let current = await this._safeRead(this.roadmapPath);
    if (!current) return;

    // 自动在“观察”或“历史反思”部分追加（这只是一个简单的策略，未来可进化）
    const now = new Date().toISOString().split("T")[0];
    const update = `\n- [ ] [Auto-Obs ${now}] ${newObservation}`;
    
    // 寻找“核心观察”部分并插入
    if (current.includes("## 1. 核心观察")) {
      current = current.replace("## 1. 核心观察", `## 1. 核心观察${update}`);
      await fs.writeFile(this.roadmapPath, current, "utf-8");
    }
  }
}
