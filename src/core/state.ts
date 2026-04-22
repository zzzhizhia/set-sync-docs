import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { State } from "./types.js";

export async function readState(path: string): Promise<State> {
  try {
    const txt = await readFile(path, "utf-8");
    const parsed = JSON.parse(txt);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeState(path: string, state: State): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export function shaKey(owner: string, repo: string, branch: string): string {
  return `${owner}/${repo}@${branch}`;
}
