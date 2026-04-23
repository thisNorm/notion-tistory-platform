import OpenAI from "openai";
import { z } from "zod";

import { THUMBNAIL_STYLE_GUIDE } from "@/config/gemini";
import { X_POST_RULES } from "@/config/x";
import { errorToMessage, RunLogger } from "@/logger";
import type { AutomationRequest, ImageCandidate, TransformResult } from "@/types";
import { extractJsonObject, truncateText } from "@/utils";

const transformSchema = z.object({
  title: z.string().min(1),
  seoTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  hook: z.string().min(1),
  conclusion: z.string().min(1),
  articleHtml: z.string().min(1),
  xPost: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  thumbnailPrompt: z.string().min(1),
  imageDecisions: z
    .array(
      z.object({
        blockId: z.string().min(1),
        use: z.boolean(),
        altText: z.string().default(""),
        reason: z.string().default(""),
      }),
    )
    .default([]),
});

interface TransformInput {
  request: AutomationRequest;
  sourceTitle: string;
  sourceMarkdown: string;
  tags: string[];
  category?: string;
  imageCandidates: ImageCandidate[];
  logger: RunLogger;
}

export async function transformContent(input: TransformInput): Promise<TransformResult> {
  const prompt = buildTransformPrompt(input);
  const rawResponse =
    input.request.textModelProvider === "openai"
      ? await callOpenAiModel(prompt, input.request, input.logger)
      : await callGeminiTextModel(prompt, input.request, input.logger);

  const parsed = transformSchema.parse(JSON.parse(extractJsonObject(rawResponse)));

  return {
    ...parsed,
    hashtags: parsed.hashtags.slice(0, 3),
    xPost: truncateText(parsed.xPost.trim(), 280),
    articleHtml: parsed.articleHtml.trim(),
    thumbnailPrompt: parsed.thumbnailPrompt.trim(),
  };
}

async function callOpenAiModel(
  prompt: string,
  request: AutomationRequest,
  logger: RunLogger,
): Promise<string> {
  if (!request.openAiApiKey) {
    throw new Error("OpenAI 텍스트 모델을 사용하려면 OpenAI API Key가 필요합니다.");
  }

  logger.info("Calling OpenAI text model", { model: request.textModel });

  const client = new OpenAI({
    apiKey: request.openAiApiKey,
  });

  const response = await client.chat.completions.create({
    model: request.textModel,
    response_format: { type: "json_object" },
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "You are a meticulous Korean technical blog editor. Return JSON only with no markdown fence.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI 응답 본문이 비어 있습니다.");
  }

  return content;
}

async function callGeminiTextModel(
  prompt: string,
  request: AutomationRequest,
  logger: RunLogger,
): Promise<string> {
  if (!request.geminiApiKey) {
    throw new Error("Gemini 텍스트 모델을 사용하려면 Gemini API Key가 필요합니다.");
  }

  logger.info("Calling Gemini text model", { model: request.textModel });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${request.textModel}:generateContent?key=${request.geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini 텍스트 호출 실패: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;

  if (!text) {
    throw new Error("Gemini 텍스트 응답에서 JSON 문자열을 찾지 못했습니다.");
  }

  return text;
}

function buildTransformPrompt(input: TransformInput): string {
  return `
너는 Notion 초안을 티스토리와 X용으로 다듬는 한국어 기술 블로그 편집자다.
응답은 JSON 객체 하나만 반환하고 코드펜스는 절대 쓰지 마라.

목표:
- 클릭률 좋은 제목 생성
- SEO 친화 제목 생성
- 초반 Hook 문단 추가
- 긴 문단 짧게 분리
- 모바일 가독성 최적화
- 소제목 구조 정리
- 초보자도 이해 가능하게 설명 강화
- 결론 요약 추가
- 자연스럽고 전문성 있게 작성
- 티스토리 친화적인 HTML 사용
- X 게시글은 개발자 노트 톤 유지

본문 HTML 규칙:
- h2, h3, p, ul, ol, li, blockquote, pre, code, strong 정도로 구성
- 과도한 공백 금지
- 코드블록은 유지
- 서론 Hook과 결론 요약을 articleHtml 안에 포함
- 사용할 이미지는 articleHtml 안의 자연스러운 위치에 <!-- IMAGE:blockId --> 형태 토큰으로 삽입
- 이미지 토큰은 use=true로 판단한 blockId에만 사용

X 게시글 규칙:
${X_POST_RULES}
- 실제 링크 대신 [TISTORY_URL] 플레이스홀더를 포함

썸네일 프롬프트 규칙:
- 글 전체를 그대로 붙이지 말고 주제, 대상, 핵심 포인트, 톤 구조로 요약
- 아래 스타일 가이드를 반드시 반영
${THUMBNAIL_STYLE_GUIDE}

이미지 사용 판단 기준:
- 사용: 아키텍처 다이어그램, 성능 그래프, 결과 비교 화면, 오류 화면, 설명 가치 높은 캡처
- 제거 가능: 단순 장식 이미지, 의미 없는 캡처, 텍스트만 있는 이미지, 흐름을 끊는 이미지
- use=false면 reason을 분명히 적어라

추가 편집 지시:
${input.request.editorialPrompt?.trim() || "추가 지시 없음"}

출력 JSON 스키마:
{
  "title": "티스토리용 최종 제목",
  "seoTitle": "검색 친화 제목",
  "metaDescription": "140~170자 내외 설명",
  "hook": "서론 Hook 문장",
  "conclusion": "결론 요약 문장",
  "articleHtml": "<p>...</p>",
  "xPost": "280자 이내 X 게시글, [TISTORY_URL] 포함",
  "hashtags": ["#Docker", "#Tistory"],
  "thumbnailPrompt": "주제: ...",
  "imageDecisions": [
    {
      "blockId": "이미지 블록 id",
      "use": true,
      "altText": "대체 텍스트",
      "reason": "판단 이유"
    }
  ]
}

원본 제목:
${input.sourceTitle}

카테고리:
${input.category ?? "(없음)"}

태그:
${input.tags.length > 0 ? input.tags.join(", ") : "(없음)"}

이미지 후보:
${input.imageCandidates.length > 0 ? JSON.stringify(input.imageCandidates, null, 2) : "[]"}

원본 마크다운:
${input.sourceMarkdown}
`.trim();
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function safeTransformContent(input: TransformInput): Promise<TransformResult> {
  try {
    return await transformContent(input);
  } catch (error) {
    input.logger.error("AI transform failed", { error: errorToMessage(error) });
    throw error;
  }
}
