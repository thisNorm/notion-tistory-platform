import type { ImageCandidate, ImageDecision, NotionBlockNode } from "@/types";

function walkBlocks(blocks: NotionBlockNode[], callback: (block: NotionBlockNode) => void) {
  for (const block of blocks) {
    callback(block);
    if (block.children.length > 0) {
      walkBlocks(block.children, callback);
    }
  }
}

export function collectImageCandidates(blocks: NotionBlockNode[]): ImageCandidate[] {
  const results: ImageCandidate[] = [];

  walkBlocks(blocks, (block) => {
    if (block.type === "image" && block.url && block.sourceType) {
      results.push({
        blockId: block.id,
        url: block.url,
        caption: block.caption ?? "",
        sourceType: block.sourceType,
      });
    }
  });

  return results;
}

export function buildImagePromptSummary(candidates: ImageCandidate[]): string {
  if (candidates.length === 0) {
    return "이미지 후보 없음";
  }

  return candidates
    .map(
      (candidate, index) =>
        `${index + 1}. blockId=${candidate.blockId}, sourceType=${candidate.sourceType}, caption=${
          candidate.caption || "(캡션 없음)"
        }`,
    )
    .join("\n");
}

export function renderSelectedImage(image: ImageCandidate, decision?: ImageDecision): string {
  const altText = decision?.altText || image.caption || "본문 관련 이미지";
  const caption = image.caption || altText;

  return [
    `<figure data-notion-image-id="${image.blockId}">`,
    `<img src="${image.url}" alt="${escapeHtmlAttribute(altText)}" loading="lazy" />`,
    `<figcaption>${escapeHtmlText(caption)}</figcaption>`,
    `</figure>`,
  ].join("");
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
