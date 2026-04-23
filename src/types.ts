export type RunMode = "dry-run" | "live";
export type TextModelProvider = "gemini" | "openai";

export type LogLevel = "info" | "warn" | "error";

export type NotionStatus = "Draft" | "Ready" | "Published" | "Error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

export interface AutomationRequest {
  notionApiKey: string;
  notionDatabaseId: string;
  notionLogDatabaseId?: string;
  textModelProvider: TextModelProvider;
  textModel: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  tistoryBlogUrl: string;
  tistoryWriteUrl?: string;
  tistoryStorageStatePath: string;
  xAppKey?: string;
  xAppSecret?: string;
  xAccessToken?: string;
  xAccessSecret?: string;
  runMode: RunMode;
  thumbnailDir: string;
  thumbnailRegenerationEnabled: boolean;
  maxThumbnailRegenerations: number;
  editorialPrompt?: string;
  headless: boolean;
}

export interface NotionBlockNode {
  id: string;
  type: string;
  text?: string;
  language?: string;
  caption?: string;
  url?: string;
  sourceType?: "external" | "file";
  hasChildren: boolean;
  children: NotionBlockNode[];
}

export interface ImageCandidate {
  blockId: string;
  url: string;
  caption: string;
  sourceType: "external" | "file";
}

export interface NotionSourcePost {
  pageId: string;
  title: string;
  slug?: string;
  tags: string[];
  category?: string;
  blocks: NotionBlockNode[];
  markdown: string;
  imageCandidates: ImageCandidate[];
}

export interface ImageDecision {
  blockId: string;
  use: boolean;
  altText: string;
  reason: string;
}

export interface TransformResult {
  title: string;
  seoTitle: string;
  metaDescription: string;
  hook: string;
  conclusion: string;
  articleHtml: string;
  xPost: string;
  hashtags: string[];
  thumbnailPrompt: string;
  imageDecisions: ImageDecision[];
}

export interface ThumbnailResult {
  generated: boolean;
  filePath: string;
  prompt: string;
  mimeType?: string;
}

export interface TistoryPublishResult {
  url: string;
}

export interface XPublishResult {
  postId: string;
  text: string;
}

export interface AutomationRunResult {
  status: "success" | "error";
  message: string;
  logs: LogEntry[];
  source?: {
    pageId: string;
    title: string;
    slug?: string;
  };
  transform?: Pick<
    TransformResult,
    "title" | "seoTitle" | "metaDescription" | "thumbnailPrompt" | "xPost"
  >;
  thumbnail?: ThumbnailResult;
  tistory?: {
    url?: string;
  };
  x?: {
    postId?: string;
    text?: string;
  };
}

export interface ProjectLogPayload {
  title: string;
  date: string;
  today: string;
  implementation: string;
  problems: string;
  resolutions: string;
  next: string;
}
