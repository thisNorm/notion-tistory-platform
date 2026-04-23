import { pathToFileURL } from "node:url";

import { z } from "zod";

import { safeTransformContent } from "@/ai";
import { appendProjectLog, fetchReadyPost, updatePostStatus } from "@/notion";
import { publishToTistory } from "@/publish-tistory";
import { publishToX } from "@/publish-x";
import { assertThumbnailExists, generateThumbnail } from "@/thumbnail";
import { composeFinalHtml } from "@/transform";
import type { AutomationRequest, AutomationRunResult, ProjectLogPayload } from "@/types";
import { DEFAULT_GEMINI_TEXT_MODEL } from "@/config/gemini";
import { errorToMessage, RunLogger } from "@/logger";
import { normalizeUrl } from "@/utils";

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  });

export const automationRequestSchema = z
  .object({
    notionApiKey: z.string().trim().min(1),
    notionDatabaseId: z.string().trim().min(1),
    notionLogDatabaseId: optionalTrimmedString,
    textModelProvider: z.enum(["gemini", "openai"]),
    textModel: z.string().trim().min(1).default(DEFAULT_GEMINI_TEXT_MODEL),
    openAiApiKey: optionalTrimmedString,
    geminiApiKey: optionalTrimmedString,
    tistoryBlogUrl: z.string().trim().url(),
    tistoryWriteUrl: optionalTrimmedString,
    tistoryStorageStatePath: z.string().trim().min(1),
    xAppKey: optionalTrimmedString,
    xAppSecret: optionalTrimmedString,
    xAccessToken: optionalTrimmedString,
    xAccessSecret: optionalTrimmedString,
    runMode: z.enum(["dry-run", "live"]),
    thumbnailDir: z.string().trim().min(1).default("assets/thumbnails"),
    thumbnailRegenerationEnabled: z.boolean().default(false),
    maxThumbnailRegenerations: z.number().int().min(0).max(1).default(1),
    editorialPrompt: optionalTrimmedString,
    headless: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.textModelProvider === "gemini" && !value.geminiApiKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["geminiApiKey"],
        message: "Gemini 텍스트 모델 사용 시 Gemini API Key가 필요합니다.",
      });
    }

    if (value.textModelProvider === "openai" && !value.openAiApiKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openAiApiKey"],
        message: "OpenAI 텍스트 모델 사용 시 OpenAI API Key가 필요합니다.",
      });
    }

    if (value.runMode === "live") {
      if (!value.geminiApiKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["geminiApiKey"],
          message: "Live 모드 썸네일 생성을 위해 Gemini API Key가 필요합니다.",
        });
      }

      for (const field of ["xAppKey", "xAppSecret", "xAccessToken", "xAccessSecret"] as const) {
        if (!value[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: "Live 모드 X 발행에는 모든 X API 인증 정보가 필요합니다.",
          });
        }
      }
    }
  });

export function normalizeAutomationRequestInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.trim()];
      }

      return [key, value];
    }),
  );
}

export async function runAutomation(request: AutomationRequest): Promise<AutomationRunResult> {
  const logger = new RunLogger();
  let sourcePageId: string | undefined;
  let sourceTitle = "";
  let sourceSlug: string | undefined;
  let thumbnailPath: string | undefined;
  let thumbnailPrompt: string | undefined;
  let tistoryUrl: string | undefined;
  let xPostId: string | undefined;
  let xPostText: string | undefined;

  try {
    logger.info("Starting automation workflow", {
      runMode: request.runMode,
      provider: request.textModelProvider,
    });

    const source = await fetchReadyPost(request.notionApiKey, request.notionDatabaseId, logger);

    if (!source) {
      logger.info("No Ready post found in Notion database");

      return {
        status: "success",
        message: "Status = Ready 인 글이 없습니다.",
        logs: logger.flush(),
      };
    }

    sourcePageId = source.pageId;
    sourceTitle = source.title;
    sourceSlug = source.slug;

    logger.info("Loaded Notion post", {
      title: source.title,
      imageCount: source.imageCandidates.length,
      blockCount: source.blocks.length,
    });

    const transform = await withRetry(
      () =>
        safeTransformContent({
          request,
          sourceTitle: source.title,
          sourceMarkdown: source.markdown,
          tags: source.tags,
          category: source.category,
          imageCandidates: source.imageCandidates,
          logger,
        }),
      2,
      logger,
      "AI transform",
    );

    const articleHtml = composeFinalHtml(transform, source.imageCandidates);
    thumbnailPrompt = transform.thumbnailPrompt;

    const thumbnail = await withRetry(
      () =>
        generateThumbnail({
          request,
          title: transform.title,
          prompt: transform.thumbnailPrompt,
          logger,
        }),
      2,
      logger,
      "thumbnail generation",
    );

    thumbnailPath = thumbnail.filePath;

    if (request.runMode === "live") {
      await assertThumbnailExists(thumbnail.filePath);

      const tistory = await withRetry(
        () =>
          publishToTistory({
            request,
            title: transform.title,
            html: articleHtml,
            thumbnailPath: thumbnail.filePath,
            logger,
          }),
        2,
        logger,
        "Tistory publish",
      );

      tistoryUrl = tistory.url;
      const finalizedXPost = finalizeXPost(transform.xPost, tistory.url);
      xPostText = finalizedXPost;

      const xPublish = await withRetry(
        () =>
          publishToX({
            request,
            text: finalizedXPost,
            logger,
          }),
        2,
        logger,
        "X publish",
      );

      xPostId = xPublish.postId;

      await updatePostStatus({
        apiKey: request.notionApiKey,
        pageId: source.pageId,
        status: "Published",
        publishedAt: new Date().toISOString(),
        errorLog: "",
        tistoryUrl,
        xPostId,
        thumbnailPath,
        thumbnailPrompt,
      });

      logger.info("Updated Notion page to Published", { pageId: source.pageId });
    } else {
      tistoryUrl = `${normalizeUrl(request.tistoryBlogUrl)}/${source.slug || "preview"}`;
      xPostText = finalizeXPost(transform.xPost, tistoryUrl);
    }

    await appendLogIfNeeded(
      request,
      {
        title: `[${request.runMode}] ${transform.title}`,
        date: new Date().toISOString(),
        today: `${source.title} 글을 기준으로 티스토리/X 발행용 자동화를 실행했습니다.`,
        implementation: [
          `티스토리 제목: ${transform.title}`,
          `SEO 제목: ${transform.seoTitle}`,
          `썸네일 프롬프트 생성 완료`,
          request.runMode === "live" ? `티스토리 발행 URL: ${tistoryUrl}` : "드라이런으로 실제 발행은 생략",
        ].join("\n"),
        problems: "실패한 단계가 없으면 '없음'으로 기록합니다.",
        resolutions:
          request.runMode === "live"
            ? "실발행 성공 후 Notion 상태를 Published로 갱신했습니다."
            : "드라이런이라 외부 서비스 변경 없이 결과만 점검했습니다.",
        next:
          request.runMode === "live"
            ? "다음 Ready 글을 작성하고 같은 흐름으로 반복합니다."
            : "결과를 확인한 뒤 Live 모드로 전환합니다.",
      },
      logger,
    );

    return {
      status: "success",
      message: request.runMode === "live" ? "라이브 발행이 완료되었습니다." : "드라이런이 완료되었습니다.",
      logs: logger.flush(),
      source: {
        pageId: source.pageId,
        title: source.title,
        slug: source.slug,
      },
      transform: {
        title: transform.title,
        seoTitle: transform.seoTitle,
        metaDescription: transform.metaDescription,
        thumbnailPrompt: transform.thumbnailPrompt,
        xPost: xPostText,
      },
      thumbnail,
      tistory: {
        url: tistoryUrl,
      },
      x: {
        postId: xPostId,
        text: xPostText,
      },
    };
  } catch (error) {
    const message = errorToMessage(error);
    logger.error("Workflow failed", { error: message });

    if (sourcePageId && request.runMode === "live") {
      try {
        await updatePostStatus({
          apiKey: request.notionApiKey,
          pageId: sourcePageId,
          status: "Error",
          errorLog: message,
          tistoryUrl,
          xPostId,
          thumbnailPath,
          thumbnailPrompt,
        });
      } catch (updateError) {
        logger.error("Failed to update Notion Error status", {
          error: errorToMessage(updateError),
        });
      }
    }

    await appendLogIfNeeded(
      request,
      {
        title: `[${request.runMode}] 실패 - ${sourceTitle || "Untitled"}`,
        date: new Date().toISOString(),
        today: `${sourceTitle || "Ready 글"} 처리 중 오류가 발생했습니다.`,
        implementation: "자동화 워크플로우를 실행했지만 중간 단계에서 실패했습니다.",
        problems: message,
        resolutions: "ErrorLog를 남기고 재시도 가능한 구조로 종료했습니다.",
        next: "오류 원인을 수정한 뒤 다시 실행합니다.",
      },
      logger,
    );

    return {
      status: "error",
      message,
      logs: logger.flush(),
      source: sourcePageId
        ? {
            pageId: sourcePageId,
            title: sourceTitle,
            slug: sourceSlug,
          }
        : undefined,
      tistory: {
        url: tistoryUrl,
      },
      x: {
        postId: xPostId,
        text: xPostText,
      },
      thumbnail: thumbnailPath
        ? {
            generated: request.runMode === "live",
            filePath: thumbnailPath,
            prompt: thumbnailPrompt || "",
          }
        : undefined,
    };
  }
}

async function withRetry<T>(
  task: () => Promise<T>,
  attempts: number,
  logger: RunLogger,
  label: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      logger.warn(`${label} failed`, {
        attempt,
        attempts,
        error: errorToMessage(error),
      });
    }
  }

  throw lastError;
}

function finalizeXPost(text: string, url: string): string {
  if (text.includes("[TISTORY_URL]")) {
    return text.replaceAll("[TISTORY_URL]", url);
  }

  return `${text}\n${url}`.trim();
}

async function appendLogIfNeeded(
  request: AutomationRequest,
  payload: ProjectLogPayload,
  logger: RunLogger,
): Promise<void> {
  if (!request.notionLogDatabaseId) {
    return;
  }

  try {
    await appendProjectLog(request.notionApiKey, request.notionLogDatabaseId, payload);
    logger.info("Project log appended to Notion", {
      databaseId: request.notionLogDatabaseId,
    });
  } catch (error) {
    logger.warn("Failed to append project log", {
      error: errorToMessage(error),
    });
  }
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

function envBoolean(name: string, defaultValue: boolean): boolean {
  const value = env(name);
  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

function envNumber(name: string, defaultValue: number): number {
  const value = env(name);
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readArg(name: string): string | undefined {
  const direct = process.argv.find((value) => value.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }

  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  return undefined;
}

async function runFromCli() {
  const parsed = automationRequestSchema.parse({
    notionApiKey: env("NOTION_API_KEY"),
    notionDatabaseId: env("NOTION_DATABASE_ID"),
    notionLogDatabaseId: env("NOTION_LOG_DATABASE_ID"),
    textModelProvider: (env("TEXT_MODEL_PROVIDER") ?? "gemini") as "gemini" | "openai",
    textModel: env("TEXT_MODEL") ?? DEFAULT_GEMINI_TEXT_MODEL,
    openAiApiKey: env("OPENAI_API_KEY"),
    geminiApiKey: env("GEMINI_API_KEY"),
    tistoryBlogUrl: env("TISTORY_BLOG_URL"),
    tistoryWriteUrl: env("TISTORY_WRITE_URL"),
    tistoryStorageStatePath: env("TISTORY_STORAGE_STATE_PATH") ?? "playwright/.auth/tistory.json",
    xAppKey: env("X_APP_KEY"),
    xAppSecret: env("X_APP_SECRET"),
    xAccessToken: env("X_ACCESS_TOKEN"),
    xAccessSecret: env("X_ACCESS_SECRET"),
    runMode: (readArg("--mode") ?? env("RUN_MODE") ?? "dry-run") as "dry-run" | "live",
    thumbnailDir: env("THUMBNAIL_DIR") ?? "assets/thumbnails",
    thumbnailRegenerationEnabled: envBoolean("THUMBNAIL_REGENERATION_ENABLED", false),
    maxThumbnailRegenerations: envNumber("MAX_THUMBNAIL_REGENERATIONS", 1),
    editorialPrompt: env("EDITORIAL_PROMPT"),
    headless: envBoolean("HEADLESS", true),
  });

  const result = await runAutomation(parsed);
  console.log(JSON.stringify(result, null, 2));

  if (result.status === "error") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
