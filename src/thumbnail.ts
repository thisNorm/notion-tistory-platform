import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_GEMINI_IMAGE_MODEL } from "@/config/gemini";
import { RunLogger } from "@/logger";
import type { AutomationRequest, ThumbnailResult } from "@/types";
import { resolveProjectPath, slugify } from "@/utils";

interface ThumbnailInput {
  request: AutomationRequest;
  title: string;
  prompt: string;
  logger: RunLogger;
}

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

export async function generateThumbnail(input: ThumbnailInput): Promise<ThumbnailResult> {
  const outputDir = resolveProjectPath(input.request.thumbnailDir);
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${slugify(input.title) || "thumbnail"}-${timestamp}.png`;
  const filePath = path.join(outputDir, fileName);

  if (input.request.runMode === "dry-run") {
    input.logger.info("Dry run thumbnail generation skipped", { filePath });

    return {
      generated: false,
      filePath,
      prompt: input.prompt,
    };
  }

  if (!input.request.geminiApiKey) {
    throw new Error("썸네일 생성을 위해 Gemini API Key가 필요합니다.");
  }

  const attempts = input.request.thumbnailRegenerationEnabled
    ? Math.min(input.request.maxThumbnailRegenerations, 1) + 1
    : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    input.logger.info("Generating thumbnail with Gemini", {
      attempt,
      model: DEFAULT_GEMINI_IMAGE_MODEL,
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_IMAGE_MODEL}:generateContent?key=${input.request.geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: input.prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini 썸네일 호출 실패: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as GeminiImageResponse;
    const part = data.candidates?.[0]?.content?.parts?.find(
      (item) => item.inlineData?.data || item.inline_data?.data,
    );

    const inlineData = part?.inlineData;
    const inlineLegacyData = part?.inline_data;
    const rawData = inlineData?.data ?? inlineLegacyData?.data;

    if (rawData) {
      await fs.writeFile(filePath, Buffer.from(rawData, "base64"));

      return {
        generated: true,
        filePath,
        prompt: input.prompt,
        mimeType: inlineData?.mimeType ?? inlineLegacyData?.mime_type ?? "image/png",
      };
    }
  }

  throw new Error("Gemini 썸네일 응답에서 이미지 데이터를 찾지 못했습니다.");
}

export async function assertThumbnailExists(filePath: string): Promise<void> {
  await fs.access(resolveProjectPath(filePath));
}
