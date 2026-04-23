"use client";

import { useMemo, useState } from "react";

type RunMode = "dry-run" | "live";
type TextModelProvider = "gemini" | "openai";
type IntegrationState = "ready" | "attention" | "optional";

type LogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
};

type RunResponse = {
  status: "success" | "error";
  message: string;
  logs: LogEntry[];
  source?: {
    pageId: string;
    title: string;
    slug?: string;
  };
  transform?: {
    title: string;
    seoTitle: string;
    metaDescription: string;
    thumbnailPrompt: string;
    xPost: string;
  };
  thumbnail?: {
    generated: boolean;
    filePath: string;
    prompt: string;
  };
  tistory?: {
    url?: string;
  };
  x?: {
    postId?: string;
    text?: string;
  };
};

type FormState = {
  notionApiKey: string;
  notionDatabaseId: string;
  notionLogDatabaseId: string;
  textModelProvider: TextModelProvider;
  textModel: string;
  openAiApiKey: string;
  geminiApiKey: string;
  tistoryBlogUrl: string;
  tistoryWriteUrl: string;
  tistoryStorageStatePath: string;
  xAppKey: string;
  xAppSecret: string;
  xAccessToken: string;
  xAccessSecret: string;
  runMode: RunMode;
  thumbnailDir: string;
  thumbnailRegenerationEnabled: boolean;
  maxThumbnailRegenerations: number;
  editorialPrompt: string;
  headless: boolean;
};

const initialFormState: FormState = {
  notionApiKey: "",
  notionDatabaseId: "",
  notionLogDatabaseId: "",
  textModelProvider: "gemini",
  textModel: "gemini-2.0-flash-lite",
  openAiApiKey: "",
  geminiApiKey: "",
  tistoryBlogUrl: "",
  tistoryWriteUrl: "",
  tistoryStorageStatePath: "playwright/.auth/tistory.json",
  xAppKey: "",
  xAppSecret: "",
  xAccessToken: "",
  xAccessSecret: "",
  runMode: "dry-run",
  thumbnailDir: "assets/thumbnails",
  thumbnailRegenerationEnabled: false,
  maxThumbnailRegenerations: 1,
  editorialPrompt: "",
  headless: true,
};

const sectionCardClass =
  "rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";

const labelClass = "mb-2 block text-sm font-medium text-slate-700";

const heroStats = [
  {
    label: "Connected APIs",
    value: "4",
  },
  {
    label: "Publish Channels",
    value: "2",
  },
  {
    label: "Launch Mode",
    value: "Preview / Live",
  },
];

const quickStartItems = [
  "Notion API Key와 Database ID를 입력합니다.",
  "모델과 Tistory 정보만 먼저 맞춘 뒤 Dry Run으로 실행합니다.",
  "결과를 확인한 뒤 필요할 때만 Live와 X 연결로 확장합니다.",
];

export default function Home() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runSummary = useMemo(
    () => [
      {
        label: "텍스트 모델",
        value: form.textModelProvider === "gemini" ? "Gemini" : "OpenAI",
      },
      {
        label: "실행 모드",
        value: form.runMode === "dry-run" ? "미리보기 중심" : "실제 발행",
      },
      {
        label: "브라우저",
        value: form.headless ? "백그라운드 실행" : "화면 표시",
      },
      {
        label: "썸네일 재생성",
        value: form.thumbnailRegenerationEnabled ? "허용" : "기본 1회만",
      },
    ],
    [form.headless, form.runMode, form.textModelProvider, form.thumbnailRegenerationEnabled],
  );

  const integrationStatus = useMemo<
    { label: string; detail: string; state: IntegrationState }[]
  >(() => {
    const notionReady = Boolean(form.notionApiKey && form.notionDatabaseId);
    const modelReady = Boolean(
      form.textModel &&
        (form.textModelProvider === "gemini" ? form.geminiApiKey : form.openAiApiKey),
    );
    const tistoryReady = Boolean(form.tistoryBlogUrl && form.tistoryStorageStatePath);
    const xReady = Boolean(
      form.xAppKey && form.xAppSecret && form.xAccessToken && form.xAccessSecret,
    );

    return [
      {
        label: "Notion 데이터 소스",
        detail: notionReady ? "콘텐츠를 읽을 기본 정보가 준비되었습니다." : "API Key와 Database ID가 필요합니다.",
        state: notionReady ? "ready" : "attention",
      },
      {
        label: "텍스트 모델",
        detail: modelReady
          ? `${form.textModelProvider === "gemini" ? "Gemini" : "OpenAI"} 모델이 실행 가능합니다.`
          : "선택한 모델 제공자에 맞는 키와 모델명을 확인하세요.",
        state: modelReady ? "ready" : "attention",
      },
      {
        label: "Tistory 발행",
        detail: tistoryReady
          ? "블로그 주소와 세션 파일 경로가 연결되어 있습니다."
          : "블로그 URL과 storageState 경로를 입력해야 합니다.",
        state: tistoryReady ? "ready" : "attention",
      },
      {
        label: "X 배포",
        detail:
          form.runMode === "dry-run"
            ? xReady
              ? "인증값이 준비되어 있어 Live 전환도 가능합니다."
              : "Dry Run에서는 선택 사항입니다."
            : xReady
              ? "실제 게시에 필요한 인증값이 준비되었습니다."
              : "Live 모드에서는 App/Access 키 4종이 모두 필요합니다.",
        state: form.runMode === "dry-run" ? (xReady ? "ready" : "optional") : xReady ? "ready" : "attention",
      },
    ];
  }, [
    form.geminiApiKey,
    form.notionApiKey,
    form.notionDatabaseId,
    form.openAiApiKey,
    form.runMode,
    form.textModel,
    form.textModelProvider,
    form.tistoryBlogUrl,
    form.tistoryStorageStatePath,
    form.xAccessSecret,
    form.xAccessToken,
    form.xAppKey,
    form.xAppSecret,
  ]);

  const readyIntegrationCount = integrationStatus.filter((item) => item.state === "ready").length;

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetSecrets = () => {
    setForm((current) => ({
      ...current,
      notionApiKey: "",
      openAiApiKey: "",
      geminiApiKey: "",
      xAppKey: "",
      xAppSecret: "",
      xAccessToken: "",
      xAccessSecret: "",
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as RunResponse;
      setResult(data);

      if (!response.ok) {
        setErrorMessage(data.message);
      }
    } catch (error) {
      setResult(null);
      setErrorMessage(
        error instanceof Error ? error.message : "요청 중 알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <header className="mb-6 overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
        <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">
              NP
            </div>
            <div>
              <p className="text-sm font-semibold">Notion Publishing Console</p>
              <p className="text-xs text-slate-400">API-first publishing workspace</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-300">
            <a
              href="#config"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10"
            >
              Configuration
            </a>
            <a
              href="#status"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10"
            >
              Run status
            </a>
          </div>
        </div>

        <div className="grid gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-10">
          <div className="space-y-6">
            <div className="inline-flex w-fit items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
              Built for real publishing workflows
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Notion 초안을 API 기반 발행 흐름으로 바로 연결하는 운영형 플랫폼
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                예시 사이트들처럼 소개 화면보다 제품 인상을 먼저 주고, 아래에서 실제 설정과 실행을
                이어서 처리할 수 있게 구성했습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#config"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                설정 시작하기
              </a>
              <a
                href="#status"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                실행 상태 보기
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm font-medium text-slate-300">Quick start</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">처음이라면 이렇게 시작하세요</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                {quickStartItems.map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white p-5 text-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Integration health</p>
                  <h3 className="mt-1 text-xl font-semibold">현재 연결 상태</h3>
                </div>
                <div className="rounded-2xl bg-slate-950 px-3 py-2 text-right text-white">
                  <p className="text-xs text-slate-300">Ready</p>
                  <p className="text-lg font-semibold">{readyIntegrationCount}/4</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {integrationStatus.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <StatePill state={item.state} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section id="config" className={`${sectionCardClass} p-6 lg:p-8`}>
            <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Configuration
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">설정 입력</h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  위에서 연결 상태를 보고, 아래에서 필요한 값만 채우면 됩니다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
                {runSummary.slice(0, 4).map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <FormSection
                title="1. Notion 연결"
                description="먼저 콘텐츠를 읽을 기본 정보부터 입력합니다."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Notion API Key" htmlFor="notionApiKey">
                    <input
                      id="notionApiKey"
                      className={inputClass}
                      type="password"
                      value={form.notionApiKey}
                      onChange={(event) => handleChange("notionApiKey", event.target.value)}
                      placeholder="secret_xxx"
                    />
                  </Field>
                  <Field label="Notion Database ID" htmlFor="notionDatabaseId">
                    <input
                      id="notionDatabaseId"
                      className={inputClass}
                      value={form.notionDatabaseId}
                      onChange={(event) => handleChange("notionDatabaseId", event.target.value)}
                      placeholder="콘텐츠 DB ID"
                    />
                  </Field>
                  <Field
                    label="Notion Project Log Database ID"
                    htmlFor="notionLogDatabaseId"
                    className="md:col-span-2"
                    optional
                  >
                    <input
                      id="notionLogDatabaseId"
                      className={inputClass}
                      value={form.notionLogDatabaseId}
                      onChange={(event) => handleChange("notionLogDatabaseId", event.target.value)}
                      placeholder="프로젝트 로그 DB ID"
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="2. 글 다듬기 설정"
                description="제목, 본문, 썸네일 프롬프트를 만들 모델을 정합니다."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="모델 제공자" htmlFor="textModelProvider">
                    <select
                      id="textModelProvider"
                      className={inputClass}
                      value={form.textModelProvider}
                      onChange={(event) =>
                        handleChange("textModelProvider", event.target.value as TextModelProvider)
                      }
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </Field>
                  <Field label="모델명" htmlFor="textModel">
                    <input
                      id="textModel"
                      className={inputClass}
                      value={form.textModel}
                      onChange={(event) => handleChange("textModel", event.target.value)}
                      placeholder="gemini-2.0-flash-lite / gpt-4.1-mini"
                    />
                  </Field>
                  <Field label="Gemini API Key" htmlFor="geminiApiKey">
                    <input
                      id="geminiApiKey"
                      className={inputClass}
                      type="password"
                      value={form.geminiApiKey}
                      onChange={(event) => handleChange("geminiApiKey", event.target.value)}
                      placeholder="AIza..."
                    />
                  </Field>
                  <Field label="OpenAI API Key" htmlFor="openAiApiKey">
                    <input
                      id="openAiApiKey"
                      className={inputClass}
                      type="password"
                      value={form.openAiApiKey}
                      onChange={(event) => handleChange("openAiApiKey", event.target.value)}
                      placeholder="sk-..."
                    />
                  </Field>
                  <Field
                    label="추가 편집 메모"
                    htmlFor="editorialPrompt"
                    className="md:col-span-2"
                    optional
                  >
                    <textarea
                      id="editorialPrompt"
                      className={`${inputClass} min-h-32 resize-y`}
                      value={form.editorialPrompt}
                      onChange={(event) => handleChange("editorialPrompt", event.target.value)}
                      placeholder="추가로 반영할 문장 톤이나 규칙이 있으면 적어주세요."
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="3. Tistory 연결"
                description="발행에 필요한 블로그 주소와 세션 파일 경로를 입력합니다."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="블로그 URL" htmlFor="tistoryBlogUrl">
                    <input
                      id="tistoryBlogUrl"
                      className={inputClass}
                      value={form.tistoryBlogUrl}
                      onChange={(event) => handleChange("tistoryBlogUrl", event.target.value)}
                      placeholder="https://yourblog.tistory.com"
                    />
                  </Field>
                  <Field label="글쓰기 URL" htmlFor="tistoryWriteUrl" optional>
                    <input
                      id="tistoryWriteUrl"
                      className={inputClass}
                      value={form.tistoryWriteUrl}
                      onChange={(event) => handleChange("tistoryWriteUrl", event.target.value)}
                      placeholder="비우면 /manage/newpost"
                    />
                  </Field>
                  <Field label="storageState 경로" htmlFor="tistoryStorageStatePath">
                    <input
                      id="tistoryStorageStatePath"
                      className={inputClass}
                      value={form.tistoryStorageStatePath}
                      onChange={(event) =>
                        handleChange("tistoryStorageStatePath", event.target.value)
                      }
                      placeholder="playwright/.auth/tistory.json"
                    />
                  </Field>
                  <Field label="썸네일 저장 경로" htmlFor="thumbnailDir">
                    <input
                      id="thumbnailDir"
                      className={inputClass}
                      value={form.thumbnailDir}
                      onChange={(event) => handleChange("thumbnailDir", event.target.value)}
                      placeholder="assets/thumbnails"
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="4. X 연결"
                description="Live 모드에서 함께 게시할 때만 입력하면 됩니다."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="App Key" htmlFor="xAppKey">
                    <input
                      id="xAppKey"
                      className={inputClass}
                      type="password"
                      value={form.xAppKey}
                      onChange={(event) => handleChange("xAppKey", event.target.value)}
                    />
                  </Field>
                  <Field label="App Secret" htmlFor="xAppSecret">
                    <input
                      id="xAppSecret"
                      className={inputClass}
                      type="password"
                      value={form.xAppSecret}
                      onChange={(event) => handleChange("xAppSecret", event.target.value)}
                    />
                  </Field>
                  <Field label="Access Token" htmlFor="xAccessToken">
                    <input
                      id="xAccessToken"
                      className={inputClass}
                      type="password"
                      value={form.xAccessToken}
                      onChange={(event) => handleChange("xAccessToken", event.target.value)}
                    />
                  </Field>
                  <Field label="Access Secret" htmlFor="xAccessSecret">
                    <input
                      id="xAccessSecret"
                      className={inputClass}
                      type="password"
                      value={form.xAccessSecret}
                      onChange={(event) => handleChange("xAccessSecret", event.target.value)}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="5. 실행 옵션"
                description="처음에는 Dry Run으로 결과를 확인하는 것을 권장합니다."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="실행 모드" htmlFor="runMode">
                    <select
                      id="runMode"
                      className={inputClass}
                      value={form.runMode}
                      onChange={(event) => handleChange("runMode", event.target.value as RunMode)}
                    >
                      <option value="dry-run">Dry Run</option>
                      <option value="live">Live Publish</option>
                    </select>
                  </Field>
                  <Field label="썸네일 최대 재생성 횟수" htmlFor="maxThumbnailRegenerations">
                    <input
                      id="maxThumbnailRegenerations"
                      className={inputClass}
                      type="number"
                      min={0}
                      max={1}
                      value={form.maxThumbnailRegenerations}
                      onChange={(event) =>
                        handleChange("maxThumbnailRegenerations", Number(event.target.value))
                      }
                    />
                  </Field>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Toggle
                    id="thumbnailRegenerationEnabled"
                    checked={form.thumbnailRegenerationEnabled}
                    onChange={(checked) => handleChange("thumbnailRegenerationEnabled", checked)}
                    label="썸네일 재생성 허용"
                  />
                  <Toggle
                    id="headless"
                    checked={form.headless}
                    onChange={(checked) => handleChange("headless", checked)}
                    label="Headless 브라우저 실행"
                  />
                </div>
              </FormSection>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center">
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "실행 중..." : "워크플로 실행"}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={resetSecrets}
              >
                민감한 키 입력값만 비우기
              </button>
              <p className="text-sm leading-6 text-slate-500">
                입력값은 이 실행 요청에만 사용되고, 별도 저장 로직은 두지 않았습니다.
              </p>
            </div>
          </form>
          </section>
        </div>

        <aside id="status" className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          <div className={`${sectionCardClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">실행 상태</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">이번 결과</h2>
              </div>
              <StatusBadge status={result?.status} />
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              {errorMessage ?? result?.message ?? "아직 실행 전입니다. 설정을 확인한 뒤 실행해보세요."}
            </p>

            <div className="mt-5 space-y-3">
              <SummaryRow label="Notion 원문" value={result?.source?.title ?? "아직 없음"} />
              <SummaryRow label="티스토리 제목" value={result?.transform?.title ?? "-"} />
              <SummaryRow label="썸네일 파일" value={result?.thumbnail?.filePath ?? "-"} />
              <SummaryRow label="티스토리 URL" value={result?.tistory?.url ?? "-"} />
              <SummaryRow label="X Post ID" value={result?.x?.postId ?? "-"} />
            </div>
          </div>

          <div className={`${sectionCardClass} p-6`}>
            <h3 className="text-lg font-semibold text-slate-950">생성된 X 문안</h3>
            <p className="mt-4 whitespace-pre-wrap rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              {result?.x?.text ?? result?.transform?.xPost ?? "실행 후 여기에 문안이 표시됩니다."}
            </p>
          </div>

          <div className={`${sectionCardClass} p-6`}>
            <h3 className="text-lg font-semibold text-slate-950">실행 로그</h3>
            <div className="mt-4 space-y-3">
              {result?.logs?.length ? (
                result.logs.map((log) => (
                  <div
                    key={`${log.timestamp}-${log.message}`}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={logLevelClass(log.level)}>{log.level.toUpperCase()}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(log.timestamp).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{log.message}</p>
                    {log.data ? (
                      <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100">
                        <code>{JSON.stringify(log.data, null, 2)}</code>
                      </pre>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
                  실행 후 상세 로그가 여기에 표시됩니다.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
  optional = false,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={className}>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ml-2 text-xs font-normal text-slate-400">선택</span> : null}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function StatusBadge({ status }: { status?: "success" | "error" }) {
  if (status === "success") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
        정상 완료
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
        확인 필요
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
      실행 전
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function StatePill({ state }: { state: IntegrationState }) {
  if (state === "ready") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Ready
      </span>
    );
  }

  if (state === "optional") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Optional
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      Check
    </span>
  );
}

function logLevelClass(level: LogEntry["level"]): string {
  if (level === "error") {
    return "inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700";
  }

  if (level === "warn") {
    return "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700";
  }

  return "inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700";
}
