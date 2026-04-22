import type { PullSource, PushTarget } from "../core/types.js";
export type { PullSource, PushTarget } from "../core/types.js";

export interface GitContext {
  root: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface CLIConfig {
  // Push (targets exist → generated workflow triggers on push events)
  pushSrcPath: string;
  pushSrcBranch: string;
  pushTargets: PushTarget[];
  // Pull (sources exist → generated workflow triggers on schedule)
  pullBranch: string;
  pullSources: PullSource[];
  // Single global dedup toggle (applies to both push and pull)
  dedup: boolean;
  // Runtime state written by the Action. The CLI preserves this field
  // across rewrites so reconfiguring doesn't re-trigger full pulls.
  sourceSHAs?: Record<string, string>;
}
