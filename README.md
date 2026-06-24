# 글쓰기 연습장

학생이 초안을 작성하고 AI 피드백을 받은 뒤 수정본을 교사에게 제출하는 글쓰기 수행평가 웹앱입니다.

## 실행

```bash
npm install
npm run dev
```

## AI 피드백 설정

Vercel 환경변수에 `OPENAI_API_KEY`를 추가하면 `/api/ai-feedback` 라우트가 OpenAI API로 맞춤법, 띄어쓰기, 문장 비문 피드백을 생성합니다.

환경변수가 없으면 화면 검증을 위한 기본 피드백이 표시됩니다.

## 배포

GitHub에 소스를 올린 뒤 Vercel에서 이 저장소를 연결하면 됩니다.
