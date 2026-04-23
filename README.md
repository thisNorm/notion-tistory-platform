# Notion Tistory Platform

사용자가 각자 API 키를 넣고, Notion 초안을 읽어 티스토리 스타일로 편집하고, Gemini 썸네일을 생성하고, 티스토리와 X까지 발행한 뒤 Notion 상태와 작업 로그를 남기는 MVP 플랫폼입니다.

## 핵심 구성

- **Frontend**: Next.js App Router 기반 실행 폼과 로그 UI
- **Backend API**: `POST /api/run`
- **Automation Modules**:
  - `src/notion.ts`
  - `src/ai.ts`
  - `src/transform.ts`
  - `src/image.ts`
  - `src/thumbnail.ts`
  - `src/publish-tistory.ts`
  - `src/publish-x.ts`
  - `src/login-tistory.ts`
  - `src/main.ts`
  - `src/logger.ts`

## MacBook 실행 방법

1. Node.js 20+ 설치
2. 프로젝트 루트에서 의존성 설치
3. Playwright 브라우저 설치
4. `.env.example`을 참고해 `.env.local` 또는 `.env` 작성
5. 개발 서버 또는 CLI로 실행

```bash
npm install
npm run playwright:install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후 폼에 키를 넣고 실행하면 됩니다.

## CLI 실행 방법

웹 UI 외에도 CLI 실행이 가능합니다.

```bash
npm run agent -- --mode=dry-run
npm run agent -- --mode=live
```

CLI는 `.env` 값을 읽고, 실행 결과를 JSON으로 출력합니다.

## 최초 티스토리 로그인 세션 저장 방법

티스토리 공식 API 대신 Playwright `storageState`를 재사용합니다.

```bash
npm run tistory:login -- --storage=playwright/.auth/tistory.json
```

실행 후 열린 브라우저에서 티스토리 로그인 완료 → 터미널에서 Enter → `playwright/.auth/tistory.json` 저장.

라이브 발행 시 이 파일 경로를 `TISTORY_STORAGE_STATE_PATH` 또는 웹 폼에 넣으면 됩니다.

## 환경변수 정리

### Notion

| 이름 | 설명 |
| --- | --- |
| `NOTION_API_KEY` | Notion Integration Token |
| `NOTION_DATABASE_ID` | 콘텐츠 DB ID |
| `NOTION_LOG_DATABASE_ID` | 프로젝트 로그 DB ID (선택) |

### 텍스트 모델

| 이름 | 설명 |
| --- | --- |
| `TEXT_MODEL_PROVIDER` | `gemini` 또는 `openai` |
| `TEXT_MODEL` | 예: `gemini-2.0-flash-lite`, `gpt-4.1-mini` |
| `OPENAI_API_KEY` | OpenAI 텍스트 생성용 |
| `GEMINI_API_KEY` | Gemini 텍스트 + 썸네일 생성용 |

### Tistory

| 이름 | 설명 |
| --- | --- |
| `TISTORY_BLOG_URL` | `https://your-blog.tistory.com` |
| `TISTORY_WRITE_URL` | 선택. 비우면 `/manage/newpost` 자동 사용 |
| `TISTORY_STORAGE_STATE_PATH` | Playwright 로그인 세션 파일 경로 |

### X API

| 이름 | 설명 |
| --- | --- |
| `X_APP_KEY` | X Developer Portal App Key |
| `X_APP_SECRET` | X Developer Portal App Secret |
| `X_ACCESS_TOKEN` | 사용자 Access Token |
| `X_ACCESS_SECRET` | 사용자 Access Token Secret |

### 실행 옵션

| 이름 | 설명 |
| --- | --- |
| `RUN_MODE` | `dry-run` 또는 `live` |
| `THUMBNAIL_DIR` | 기본 `assets/thumbnails` |
| `THUMBNAIL_REGENERATION_ENABLED` | 기본 `false` |
| `MAX_THUMBNAIL_REGENERATIONS` | 기본 `1`, 최대 `1` |
| `EDITORIAL_PROMPT` | 추가 스타일 지시 |
| `HEADLESS` | Playwright headless 실행 여부 |

## Notion 콘텐츠 DB 스키마

필수 속성:

- `Title`
- `Status` (`Draft`, `Ready`, `Published`, `Error`)
- `Slug`
- `Tags`
- `Category`
- `PublishedAt`
- `ErrorLog`
- `TistoryUrl`
- `XPostId`
- `ThumbnailPath`
- `ThumbnailPrompt`

## 프로젝트 로그 DB

프로젝트 로그 DB는 **title 속성 1개**만 있어도 생성됩니다. date 속성이 있으면 자동으로 날짜도 기록합니다.

세부 내용은 생성된 페이지 본문에 아래 섹션으로 남습니다.

- 오늘 한 일
- 구현 내용
- 문제점
- 해결 방법
- 다음 할 일

## 썸네일 저장 경로와 파일명 규칙

- 기본 저장 경로: `assets/thumbnails`
- 파일명 규칙: `{slugified-title}-{ISO timestamp}.png`

예시:

```text
assets/thumbnails/dockerfile-핵심-명령어-2026-04-23T10-22-15-233Z.png
```

## 썸네일 존재 여부 검사

라이브 발행 전 `src/thumbnail.ts`에서 생성된 파일 경로를 반환하고, `src/main.ts`에서 파일 존재 여부를 한 번 더 검사한 뒤에만 티스토리 발행으로 넘어갑니다.

## 실패 처리와 재시도

- AI 편집: 최대 2회 시도
- 썸네일 생성: 최대 2회 시도 + 재생성 옵션이 켜진 경우 1회 추가 허용
- 티스토리 발행: 최대 2회 시도
- X 발행: 최대 2회 시도
- 라이브 실패 시 Notion `Status = Error`, `ErrorLog` 기록

## 자동 실행 방법

### cron

```bash
crontab -e
```

예시:

```bash
0 9 * * * cd /Users/yourname/Desktop/notion-tistory-platform && /opt/homebrew/bin/npm run agent -- --mode=live >> /tmp/notion-tistory-agent.log 2>&1
```

### launchd

`~/Library/LaunchAgents/com.yourname.notion-tistory-platform.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.yourname.notion-tistory-platform</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>cd /Users/yourname/Desktop/notion-tistory-platform && npm run agent -- --mode=live</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>9</integer>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/notion-tistory-platform.out</string>
    <key>StandardErrorPath</key>
    <string>/tmp/notion-tistory-platform.err</string>
  </dict>
</plist>
```

등록:

```bash
launchctl load ~/Library/LaunchAgents/com.yourname.notion-tistory-platform.plist
```

## Docker Compose 실행

포트 충돌을 피하려고 기본 외부 포트는 `3001`로 잡았습니다.

```bash
docker compose up -d --build
```

접속:

```text
http://localhost:3001
```

중지:

```bash
docker compose down
```

## 주의사항

- 티스토리 에디터 DOM은 계정/에디터 상태에 따라 조금씩 달라질 수 있으므로 `src/config/selectors.ts`에서 셀렉터를 조정할 수 있게 분리했습니다.
- Notion 내부 업로드 이미지는 서명 URL 기반이라 장기 보관이 필요하면 별도 이미지 업로드 전략을 추가하는 것이 좋습니다.
- 웹 UI는 키를 DB에 저장하지 않는 MVP입니다.
