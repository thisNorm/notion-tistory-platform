import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "playwright";

import { resolveProjectPath } from "@/utils";

async function main() {
  const storageStateArg = readArg("--storage");
  const loginUrlArg = readArg("--login-url");
  const storageStatePath = resolveProjectPath(storageStateArg || "playwright/.auth/tistory.json");
  const loginUrl = loginUrlArg || "https://www.tistory.com/auth/login";

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  console.log("브라우저에서 티스토리 로그인을 완료한 뒤 Enter를 누르세요.");

  const rl = readline.createInterface({ input, output });
  await rl.question("");
  rl.close();

  await context.storageState({ path: storageStatePath });
  await browser.close();

  console.log(`storageState saved to ${storageStatePath}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
