import { NextResponse } from "next/server";

import {
  automationRequestSchema,
  normalizeAutomationRequestInput,
  runAutomation,
} from "@/main";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = normalizeAutomationRequestInput(await request.json());
    const parsed = automationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: parsed.error.issues.map((issue) => issue.message).join("\n"),
          logs: [],
        },
        { status: 400 },
      );
    }

    const result = await runAutomation(parsed.data);

    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 500,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "서버 실행 중 오류가 발생했습니다.",
        logs: [],
      },
      { status: 500 },
    );
  }
}
