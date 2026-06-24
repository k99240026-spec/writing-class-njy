import { NextResponse } from "next/server";

type FeedbackRequest = {
  title?: string;
  text?: string;
  assignment?: {
    title?: string;
    topic?: string;
    minChars?: number;
    maxChars?: number;
  };
};

type FeedbackItem = {
  type: "맞춤법" | "문장";
  message: string;
  suggestion: string;
};

const feedbackTypes = new Set(["맞춤법", "문장"]);

const fallbackFeedback = (text: string): FeedbackItem[] => {
  const trimmed = text.trim();
  const sentences = trimmed.split(/[.!?。！？\n]+/).filter(Boolean);
  const longSentences = sentences.filter((sentence) => sentence.length > 90);
  const spacingHint = /\s[,.!?]/.test(trimmed) || /[가-힣][A-Za-z]/.test(trimmed);

  return [
    {
      type: "맞춤법",
      message: spacingHint
        ? "띄어쓰기나 문장부호 앞뒤 간격을 다시 확인할 부분이 있습니다."
        : "눈에 띄는 기본 맞춤법 오류는 많지 않습니다.",
      suggestion:
        "조사 사용, 띄어쓰기, 문장부호 위치를 중심으로 다시 읽어 보세요. OpenAI API 키를 연결하면 더 정밀한 검사가 실행됩니다."
    },
    {
      type: "문장",
      message: longSentences.length > 0
        ? "긴 문장이 있어 주어와 서술어의 호응이 흐려질 수 있습니다."
        : "문장 길이는 대체로 안정적입니다.",
      suggestion: longSentences.length > 0
        ? "한 문장에 여러 생각이 이어진 곳은 의미 단위별로 나누고, 주어와 서술어가 자연스럽게 맞는지 확인하세요."
        : "각 문장이 앞뒤 문장과 자연스럽게 이어지는지, 어색한 반복 표현은 없는지 확인하세요."
    }
  ];
};

function normalizeFeedback(value: unknown, fallbackText: string): FeedbackItem[] {
  if (!Array.isArray(value)) return fallbackFeedback(fallbackText);

  const normalized = value
    .filter((item): item is Partial<FeedbackItem> => Boolean(item) && typeof item === "object")
    .filter((item) => typeof item.type === "string" && feedbackTypes.has(item.type))
    .map((item) => ({
      type: item.type as FeedbackItem["type"],
      message: typeof item.message === "string" ? item.message : "",
      suggestion: typeof item.suggestion === "string" ? item.suggestion : ""
    }));

  return ["맞춤법", "문장"].map((type) => {
    const found = normalized.find((item) => item.type === type);
    if (found) return found;
    return fallbackFeedback(fallbackText).find((item) => item.type === type)!;
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as FeedbackRequest;
  const title = body.title?.trim() || "제목 없음";
  const text = body.text?.trim() || "";

  if (!text) {
    return NextResponse.json({ error: "검사할 글이 없습니다." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ feedback: fallbackFeedback(text), source: "fallback" });
  }

  const prompt = [
    "너는 한국어 글쓰기 교사다.",
    "학생 글을 대신 고치거나 새 문장을 써 주지 말고, 학생이 직접 고칠 수 있게 피드백한다.",
    "피드백 범위는 반드시 맞춤법/띄어쓰기와 문장 수준의 비문/호응/어색한 표현으로만 제한한다.",
    "문단 짜임, 논리 전개, 주장과 근거, 서론/본론/결론에 대한 피드백은 절대 하지 않는다.",
    "반드시 JSON 배열만 반환한다. 배열은 정확히 두 항목이어야 한다.",
    "첫 번째 항목 type은 '맞춤법', 두 번째 항목 type은 '문장'이어야 한다.",
    "각 항목은 type, message, suggestion 필드만 가진다.",
    "message에는 발견한 문제나 전반 판단을 쓰고, suggestion에는 학생이 확인할 구체적 수정 방향을 쓴다.",
    "",
    `과제: ${body.assignment?.title ?? ""}`,
    `주제: ${body.assignment?.topic ?? ""}`,
    `분량 기준: ${body.assignment?.minChars ?? "-"}~${body.assignment?.maxChars ?? "-"}자`,
    `제목: ${title}`,
    "",
    "학생 글:",
    text
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    return NextResponse.json({ feedback: fallbackFeedback(text), source: "fallback" });
  }

  const data = await response.json();
  const outputText =
    data.output_text ??
    data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
      ?.map((content: { text?: string }) => content.text)
      ?.join("") ??
    "";

  try {
    return NextResponse.json({ feedback: normalizeFeedback(JSON.parse(outputText), text), source: "openai" });
  } catch {
    return NextResponse.json({
      feedback: [
        {
          type: "맞춤법",
          message: "AI 응답을 구조화하지 못했습니다.",
          suggestion: "맞춤법과 띄어쓰기를 중심으로 다시 확인하세요."
        },
        {
          type: "문장",
          message: outputText || "AI 피드백을 정리하지 못했습니다.",
          suggestion: "주어와 서술어의 호응, 문장 길이, 어색한 표현을 중심으로 다시 확인하세요."
        }
      ],
      source: "openai"
    });
  }
}
