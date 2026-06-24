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

const fallbackFeedback = (text: string) => {
  const trimmed = text.trim();
  const sentences = trimmed.split(/[.!?。！？\n]+/).filter(Boolean);
  const longSentences = sentences.filter((sentence) => sentence.length > 90);

  return [
    {
      type: "맞춤법",
      message:
        "자동 검사 예시입니다. OpenAI API 키를 연결하면 실제 맞춤법과 띄어쓰기 오류를 더 정밀하게 확인합니다.",
      suggestion: "제출 전 문장을 한 번 소리 내어 읽고 조사, 띄어쓰기, 반복 표현을 확인하세요."
    },
    {
      type: "문장",
      message:
        longSentences.length > 0
          ? "긴 문장이 있어 의미 단위가 흐려질 수 있습니다."
          : "문장 길이는 대체로 안정적입니다.",
      suggestion:
        longSentences.length > 0
          ? "한 문장에 두 가지 이상의 생각이 담긴 곳은 쉼표보다 마침표로 나누어 보세요."
          : "핵심 주장과 근거가 자연스럽게 이어지는지 확인하세요."
    },
    {
      type: "구성",
      message:
        trimmed.length < 500
          ? "분량이 아직 짧아 주장과 근거가 충분히 드러나기 어렵습니다."
          : "초안의 기본 분량은 확보되었습니다.",
      suggestion: "서론에는 관점, 본론에는 구체적 근거, 결론에는 다시 정리한 판단을 넣어 보세요."
    }
  ];
};

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
    "학생 글을 검사하되, 대신 써 주지 말고 학생이 직접 고칠 수 있게 구체적으로 피드백한다.",
    "맞춤법/띄어쓰기, 비문/문장 호응, 글의 구성과 논리 흐름을 나누어 본다.",
    "반드시 JSON 배열만 반환한다. 각 항목은 type, message, suggestion 필드를 가진다.",
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
    const feedback = JSON.parse(outputText);
    return NextResponse.json({ feedback, source: "openai" });
  } catch {
    return NextResponse.json({
      feedback: [
        {
          type: "AI 피드백",
          message: outputText || "AI 피드백을 정리하지 못했습니다.",
          suggestion: "글의 주장, 근거, 문장 호응을 중심으로 다시 확인하세요."
        }
      ],
      source: "openai"
    });
  }
}
