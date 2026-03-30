import { input, confirm } from "@inquirer/prompts";
import { execFileSync, execSync } from "node:child_process";
import pc from "picocolors";
import type { Config, GitContext } from "./index.js";

export async function collectConfig(ctx: GitContext): Promise<Config> {
  const srcPath = await input({
    message: "Source docs path (relative to repo root)",
    default: "docs/",
    validate: (v) => (v.trim() ? true : "Path cannot be empty"),
  });

  const srcBranch = await input({
    message: "Source branch",
    default: ctx.branch || "main",
  });

  const dstOwner = await input({
    message: "Target repo owner",
    default: ctx.owner || undefined,
    validate: (v) => (v.trim() ? true : "Owner cannot be empty"),
  });

  const dstRepoName = await input({
    message: "Target repo name",
    validate: (v) => (v.trim() ? true : "Repo name cannot be empty"),
  });

  const dstPath = await input({
    message: "Target path (files will be copied here)",
    default: "/",
  });

  const dstBranch = await input({
    message: "Target branch",
    default: "main",
  });

  const clean = await confirm({
    message: "Clean target directory before sync?",
    default: true,
  });

  return { srcPath, srcBranch, dstOwner, dstRepoName, dstPath, dstBranch, clean };
}

export async function checkTargetRepo(owner: string, repo: string): Promise<void> {
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch {
    console.log(pc.yellow(`⚠ gh CLI not found. Skipping target repo check. Please verify ${owner}/${repo} exists.`));
    return;
  }

  try {
    execFileSync("gh", ["api", `repos/${owner}/${repo}`], { stdio: "ignore" });
    console.log(pc.green(`✓ Target repo ${owner}/${repo} exists`));
  } catch {
    console.log(pc.yellow(`⚠ Cannot access ${owner}/${repo} (may be private or not yet created). Workflow will still be generated.`));
  }
}

export async function confirmGeneration(config: Config): Promise<boolean> {
  console.log("\n" + pc.bold("Configuration summary:"));
  console.log(`  Source path:   ${config.srcPath}`);
  console.log(`  Source branch: ${config.srcBranch}`);
  console.log(`  Target repo:   ${config.dstOwner}/${config.dstRepoName}`);
  console.log(`  Target path:   ${config.dstPath}`);
  console.log(`  Target branch: ${config.dstBranch}`);
  console.log(`  Clean target:  ${config.clean ? "yes" : "no"}`);
  console.log();

  return confirm({ message: "Generate workflow file?", default: true });
}
