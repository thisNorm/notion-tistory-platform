import { renderSelectedImage } from "@/image";
import type { ImageCandidate, ImageDecision, NotionBlockNode, TransformResult } from "@/types";

export function blocksToMarkdown(blocks: NotionBlockNode[], depth = 0): string {
  return blocks
    .map((block) => blockToMarkdown(block, depth))
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function blockToMarkdown(block: NotionBlockNode, depth: number): string {
  const childContent = block.children.length > 0 ? `\n${blocksToMarkdown(block.children, depth + 1)}` : "";
  const text = block.text?.trim() ?? "";

  switch (block.type) {
    case "heading_1":
      return `# ${text}${childContent}`;
    case "heading_2":
      return `## ${text}${childContent}`;
    case "heading_3":
      return `### ${text}${childContent}`;
    case "paragraph":
      return `${text}${childContent}`.trim();
    case "bulleted_list_item":
      return `${"  ".repeat(depth)}- ${text}${childContent}`.trimEnd();
    case "numbered_list_item":
      return `${"  ".repeat(depth)}1. ${text}${childContent}`.trimEnd();
    case "quote":
      return `> ${text}${childContent}`;
    case "code":
      return `\`\`\`${block.language ?? ""}\n${text}\n\`\`\`${childContent}`;
    case "image":
      return `![${block.caption ?? "image"}](${block.url ?? ""})`;
    default:
      return `${text}${childContent}`.trim();
  }
}

export function composeFinalHtml(
  transform: TransformResult,
  imageCandidates: ImageCandidate[],
): string {
  const decisions = new Map<string, ImageDecision>(
    transform.imageDecisions.map((decision) => [decision.blockId, decision]),
  );
  const images = new Map<string, ImageCandidate>(
    imageCandidates.map((candidate) => [candidate.blockId, candidate]),
  );

  let html = transform.articleHtml.trim();
  const selectedWithoutToken = new Set<string>();

  for (const [blockId, decision] of decisions.entries()) {
    if (!decision.use) {
      continue;
    }

    const image = images.get(blockId);
    if (!image) {
      continue;
    }

    const token = `<!-- IMAGE:${blockId} -->`;
    const figure = renderSelectedImage(image, decision);

    if (html.includes(token)) {
      html = html.replaceAll(token, figure);
    } else {
      selectedWithoutToken.add(blockId);
    }
  }

  if (selectedWithoutToken.size > 0) {
    const appendix = [...selectedWithoutToken]
      .map((blockId) => {
        const image = images.get(blockId);
        const decision = decisions.get(blockId);

        return image ? renderSelectedImage(image, decision) : "";
      })
      .filter(Boolean)
      .join("\n");

    html = `${html}\n${appendix}`.trim();
  }

  return html.replace(/<!-- IMAGE:[^>]+ -->/g, "").replace(/\n{3,}/g, "\n\n");
}
