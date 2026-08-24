/**
 * Harness Demo：模拟一次 Agent 执行是否具备完成任务所需的环境能力。
 * 每个开关对应可观察的执行阶段，而不是抽象评分。
 */
export function runHarnessDemo(config) {
  const stages = [
    {
      key: "tools",
      phase: "act",
      kind: "action",
      ok: config.tools,
      success: "工具可调用：读取仓库、修改文件并运行命令。",
      failure: "没有工具，Agent 只能描述动作，无法改变外部状态。",
    },
    {
      key: "observability",
      phase: "observe",
      kind: "observation",
      ok: config.observability,
      success: "环境可观察：日志、指标与界面状态都能回到上下文。",
      failure: "日志、指标和界面状态不可见，Agent 无法判断动作结果。",
    },
    {
      key: "constraints",
      phase: "constrain",
      kind: "constraint",
      ok: config.constraints,
      success: "结构约束生效：错误依赖和越界修改会被机械拒绝。",
      failure: "缺少结构约束，局部修改可能通过却造成架构漂移。",
    },
    {
      key: "completionProof",
      phase: "prove",
      kind: "proof",
      ok: config.completionProof,
      success: "完成证据成立：测试、性能门槛和用户路径均通过。",
      failure: "没有可验证完成条件，只能用“看起来做完了”停止。",
    },
  ];

  const trace = [];
  for (const stage of stages) {
    trace.push({
      phase: stage.phase,
      kind: stage.kind,
      ok: stage.ok,
      text: stage.ok ? stage.success : stage.failure,
    });
    if (!stage.ok) {
      return {
        status: "blocked",
        failedAt: stage.phase,
        explanation: stage.failure,
        trace,
      };
    }
  }

  return {
    status: "completed",
    failedAt: null,
    explanation: "环境、反馈、约束与完成证据形成了完整 Harness。",
    trace,
  };
}

/**
 * Loop Demo：用固定增益模拟“行动—观察—调整”，显式报告停止原因。
 */
export function runLoopDemo({
  initialScore,
  targetScore,
  maxIterations,
  budget,
}) {
  let score = initialScore;
  const trace = [];
  const allowedIterations = Math.max(0, Math.min(maxIterations, budget));

  for (let iteration = 1; iteration <= allowedIterations; iteration += 1) {
    const before = score;
    score = Math.min(100, score + 15);
    trace.push({
      iteration,
      before,
      score,
      gap: Math.max(0, targetScore - score),
      observation:
        score >= targetScore
          ? "验证器通过，达到停止条件。"
          : "验证器未通过，把差距带入下一轮调整。",
    });
    if (score >= targetScore) {
      return {
        status: "converged",
        iterations: iteration,
        finalScore: score,
        trace,
      };
    }
  }

  const status =
    budget <= maxIterations ? "budget_exhausted" : "max_iterations";
  return {
    status,
    iterations: allowedIterations,
    finalScore: score,
    trace,
  };
}

/**
 * Graph Demo：模拟多个局部优化循环是否被外部锚点与否决边约束。
 */
export function runGraphDemo({ anchorEnabled, vetoEnabled }) {
  const localMetrics = {
    speed: 96,
    qualityScore: 91,
    costEfficiency: 90,
  };
  const events = [
    {
      kind: "optimize",
      text: "速度、自动质量分和成本效率三个循环均显示绿色。",
    },
  ];

  if (!anchorEnabled) {
    events.push({
      kind: "blindness",
      text: "没有外部锚点：循环只对照彼此的内部报表，真实续费率跌至 62%。",
    });
    return {
      status: "drift",
      explanation: "三个局部优化循环全绿，但没有外部锚点：真实续费率跌至 62%。",
      localMetricsGreen: true,
      systemHealthy: false,
      retention: 62,
      localMetrics,
      events,
    };
  }

  events.push({
    kind: "anchor",
    text: "外部锚点接入：真实续费率和人工抽检不能被优化循环改写。",
  });

  if (!vetoEnabled) {
    events.push({
      kind: "warning",
      text: "锚点发现偏差，但没有否决边，快速循环仍可继续放大局部指标。",
    });
    return {
      status: "detected_not_corrected",
      explanation: "锚点发现偏差，但没有否决边，快速循环仍可继续放大局部指标；真实续费率停在 62%。",
      localMetricsGreen: true,
      systemHealthy: false,
      retention: 62,
      localMetrics,
      events,
    };
  }

  events.push({
    kind: "veto",
    text: "治理循环触发否决：回滚激进速度策略，并冻结成功阈值。",
  });
  events.push({
    kind: "recover",
    text: "重新平衡速度与解决质量，真实续费率恢复到 84%。",
  });
  return {
    status: "corrected",
    explanation: "外部锚点与否决边生效：速度与解决质量重新平衡，真实续费率恢复到 84%。",
    localMetricsGreen: true,
    systemHealthy: true,
    retention: 84,
    localMetrics,
    events,
  };
}
