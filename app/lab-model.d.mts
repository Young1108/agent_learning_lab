export type HarnessConfig = {
  tools: boolean;
  observability: boolean;
  constraints: boolean;
  completionProof: boolean;
};

export type HarnessResult = {
  status: "blocked" | "completed";
  failedAt: string | null;
  explanation: string;
  trace: Array<{
    phase: string;
    kind: string;
    ok: boolean;
    text: string;
  }>;
};

export type LoopResult = {
  status: "converged" | "budget_exhausted" | "max_iterations";
  iterations: number;
  finalScore: number;
  trace: Array<{
    iteration: number;
    before: number;
    score: number;
    gap: number;
    observation: string;
  }>;
};

export type GraphResult = {
  status: "drift" | "detected_not_corrected" | "corrected";
  localMetricsGreen: boolean;
  systemHealthy: boolean;
  retention: number;
  localMetrics: {
    speed: number;
    qualityScore: number;
    costEfficiency: number;
  };
  events: Array<{ kind: string; text: string }>;
};

export function runHarnessDemo(config: HarnessConfig): HarnessResult;

export function runLoopDemo(config: {
  initialScore: number;
  targetScore: number;
  maxIterations: number;
  budget: number;
}): LoopResult;

export function runGraphDemo(config: {
  anchorEnabled: boolean;
  vetoEnabled: boolean;
}): GraphResult;
