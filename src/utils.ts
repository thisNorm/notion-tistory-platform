import path from "node:path";

export function resolveProjectPath(targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), targetPath);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function extractJsonObject(value: string): string {
  const cleaned = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("모델 응답에서 JSON 객체를 찾지 못했습니다.");
  }

  return cleaned.slice(start, end + 1);
}

export function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
