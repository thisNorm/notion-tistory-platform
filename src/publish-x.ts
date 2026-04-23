import { TwitterApi } from "twitter-api-v2";

import { RunLogger } from "@/logger";
import type { AutomationRequest, XPublishResult } from "@/types";

interface PublishToXInput {
  request: AutomationRequest;
  text: string;
  logger: RunLogger;
}

export async function publishToX(input: PublishToXInput): Promise<XPublishResult> {
  const { request, logger } = input;

  if (!request.xAppKey || !request.xAppSecret || !request.xAccessToken || !request.xAccessSecret) {
    throw new Error("Live 모드 X 게시에는 App Key/Secret 및 Access Token/Secret이 모두 필요합니다.");
  }

  logger.info("Publishing post to X");

  const client = new TwitterApi({
    appKey: request.xAppKey,
    appSecret: request.xAppSecret,
    accessToken: request.xAccessToken,
    accessSecret: request.xAccessSecret,
  });

  const response = await client.v2.tweet(input.text);

  return {
    postId: response.data.id,
    text: input.text,
  };
}
