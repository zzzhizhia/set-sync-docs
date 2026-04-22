export function normalizePath(input: string): string {
  let p = input.trim().replace(/\\/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  while (p.startsWith("/")) p = p.slice(1);
  if (p.split("/").some((s) => s === "..")) {
    throw new Error(`Path traversal ("..") is not allowed: ${input}`);
  }
  if (p && !p.endsWith("/")) p += "/";
  return p;
}
