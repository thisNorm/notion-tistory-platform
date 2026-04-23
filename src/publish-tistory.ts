import fs from "node:fs/promises";

import { chromium, type Locator, type Page } from "playwright";

import { DEFAULT_TISTORY_WRITE_PATH, TISTORY_SELECTORS } from "@/config/selectors";
import { RunLogger } from "@/logger";
import type { AutomationRequest, TistoryPublishResult } from "@/types";
import { delay, normalizeUrl, resolveProjectPath, stripHtml } from "@/utils";

interface PublishToTistoryInput {
  request: AutomationRequest;
  title: string;
  html: string;
  thumbnailPath: string;
  logger: RunLogger;
}

export async function publishToTistory(input: PublishToTistoryInput): Promise<TistoryPublishResult> {
  const storageStatePath = resolveProjectPath(input.request.tistoryStorageStatePath);
  const thumbnailPath = resolveProjectPath(input.thumbnailPath);
  await fs.access(storageStatePath);
  await fs.access(thumbnailPath);

  const browser = await chromium.launch({
    headless: input.request.headless,
  });

  const context = await browser.newContext({
    storageState: storageStatePath,
  });

  const page = await context.newPage();

  try {
    const writeUrl =
      input.request.tistoryWriteUrl?.trim() ||
      `${normalizeUrl(input.request.tistoryBlogUrl)}${DEFAULT_TISTORY_WRITE_PATH}`;

    input.logger.info("Opening Tistory editor", { writeUrl });
    await page.goto(writeUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await dismissOptionalDialog(page);
    await fillTitle(page, input.title);
    await setEditorHtml(page, input.html);
    await uploadThumbnail(page, thumbnailPath, input.logger);
    await clickPublish(page);

    await page.waitForURL((url) => !url.toString().includes("/manage/newpost"), {
      timeout: 30000,
    });

    return {
      url: page.url(),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function dismissOptionalDialog(page: Page) {
  const closeButtons = [
    'button[aria-label="닫기"]',
    'button[title="닫기"]',
    ".btn_close",
  ];

  for (const selector of closeButtons) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);

    if (visible) {
      await locator.click();
      await delay(500);
    }
  }
}

async function fillTitle(page: Page, title: string) {
  const locator = await findVisibleLocator(page, TISTORY_SELECTORS.title, 20000);
  await locator.click();

  if ((await locator.evaluate((element) => element.tagName.toLowerCase())) === "input") {
    await locator.fill(title);
    return;
  }

  await locator.evaluate(
    (element, value) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    title,
  );
}

async function setEditorHtml(page: Page, html: string) {
  const locator = await findVisibleLocator(page, TISTORY_SELECTORS.editor, 20000);
  await locator.click();

  const applied = await locator.evaluate((element, value) => {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    const target = element as HTMLElement;
    if (target.isContentEditable || target.matches(".ProseMirror, .editor-contents")) {
      target.innerHTML = value;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      return true;
    }

    return false;
  }, html);

  if (!applied) {
    await page.keyboard.insertText(stripHtml(html));
  }
}

async function uploadThumbnail(page: Page, filePath: string, logger: RunLogger) {
  for (const selector of TISTORY_SELECTORS.mediaButton) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);

    if (visible) {
      await locator.click().catch(() => undefined);
      await delay(1000);
      break;
    }
  }

  const input = await findVisibleLocator(page, TISTORY_SELECTORS.fileInput, 15000);
  await input.setInputFiles(filePath);
  logger.info("Thumbnail uploaded to Tistory editor", { filePath });
  await delay(2000);
}

async function clickPublish(page: Page) {
  const trigger = await findVisibleLocator(page, TISTORY_SELECTORS.publishTrigger, 20000);
  await trigger.click();
  await delay(1200);

  for (const selector of TISTORY_SELECTORS.publishConfirm) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);

    if (visible) {
      await locator.click();
      return;
    }
  }

  await trigger.click();
}

async function findVisibleLocator(
  page: Page,
  selectors: string[],
  timeoutMs: number,
): Promise<Locator> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      const visible = await locator.isVisible().catch(() => false);

      if (visible) {
        return locator;
      }
    }

    await delay(300);
  }

  throw new Error(`Tistory selector를 찾지 못했습니다: ${selectors.join(", ")}`);
}
