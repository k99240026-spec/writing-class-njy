"use client";

import {
  Check,
  Clock,
  Download,
  FileText,
  Lock,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  UserRound
} from "lucide-react";
import type { ClipboardEvent, Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

type Assignment = {
  id: string;
  title: string;
  topic: string;
  timeLimit: number;
  minChars: number;
  targetChars: number;
  maxChars: number;
  active: boolean;
};

type AiFeedback = {
  type: string;
  message: string;
  suggestion: string;
};

type TeacherFeedback = {
  id: string;
  text: string;
  createdAt: string;
  action: "revision-opened" | "feedback-complete" | "final-closed";
};

type SubmissionStatus =
  | "writing"
  | "ai-reviewed"
  | "submitted"
  | "revision-opened"
  | "teacher-reviewed"
  | "final-closed";

type Submission = {
  id: string;
  assignmentId: string;
  className: string;
  studentNumber: string;
  studentName: string;
  title: string;
  originalText: string;
  revisedText: string;
  aiFeedback: AiFeedback[];
  aiFeedbackSource?: "openai" | "fallback";
  teacherFeedback: string;
  teacherFeedbacks?: TeacherFeedback[];
  startedAt: string;
  aiCheckedAt?: string;
  submittedAt?: string;
  lastEditedAt?: string;
  status: SubmissionStatus;
};

const initialAssignments: Assignment[] = [
  {
    id: "assignment-1",
    title: "3-1학기 독서와사고 글쓰기",
    topic: "능력주의와 불평등",
    timeLimit: 100,
    minChars: 1300,
    targetChars: 1550,
    maxChars: 1800,
    active: true
  },
  {
    id: "assignment-2",
    title: "3-2 독서와삶 글쓰기",
    topic: "행복이란 무엇인가",
    timeLimit: 50,
    minChars: 1000,
    targetChars: 1100,
    maxChars: 1200,
    active: false
  }
];

const classes = ["1반", "2반", "3반", "4반", "5반", "6반", "7반", "8반"];
const storageKey = "writing-practice-state";

const emptyDraft = {
  className: "",
  studentNumber: "",
  studentName: "",
  title: "",
  text: "",
  revisedText: ""
};

function nowIso() {
  return new Date().toISOString();
}

function nowKst() {
  return formatKst(nowIso());
}

function formatKst(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function elapsed(startedAt: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}분 ${rest}초`;
}

function countChars(text: string) {
  return text.replace(/\s/g, "").length;
}

function studentKey(submission: Pick<Submission, "assignmentId" | "className" | "studentNumber" | "studentName">) {
  return [
    submission.assignmentId,
    submission.className.trim(),
    submission.studentNumber.trim(),
    submission.studentName.trim()
  ].join("|");
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canStudentEdit(status: SubmissionStatus) {
  return status === "writing" || status === "ai-reviewed" || status === "revision-opened" || status === "teacher-reviewed";
}

function visibleAiFeedback(feedback: AiFeedback[] = []) {
  return feedback.filter((item) => item.type === "맞춤법" || item.type === "문장");
}

export default function Home() {
  const [view, setView] = useState<"student" | "teacher">("student");
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [phase, setPhase] = useState<"intro" | "writing" | "revision" | "submitted">("intro");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [teacherPassword, setTeacherPassword] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { assignments: Assignment[]; submissions: Submission[] };
      // localStorage is the app's current persistence layer, so the initial client sync is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssignments(parsed.assignments?.length ? parsed.assignments : initialAssignments);
      setSubmissions(dedupeSubmissions(parsed.submissions ?? []));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ assignments, submissions }));
  }, [assignments, submissions]);

  const activeAssignment = assignments.find((assignment) => assignment.active) ?? assignments[0];
  const currentSubmission = submissions.find((submission) => submission.id === currentId);
  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) ?? null;

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      const assignmentMatch = selectedAssignment === "all" || submission.assignmentId === selectedAssignment;
      const classMatch = selectedClass === "all" || submission.className === selectedClass;
      return assignmentMatch && classMatch;
    });
  }, [selectedAssignment, selectedClass, submissions]);

  const startWriting = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeAssignment) {
      window.alert("현재 선택된 과제가 없습니다. 교사 화면에서 현재 과제를 설정해 주세요.");
      return;
    }

    if (!draft.className.trim() || !draft.studentNumber.trim() || !draft.studentName.trim()) {
      window.alert("분반, 학번, 이름을 모두 입력해 주세요.");
      return;
    }

    const normalized = {
      assignmentId: activeAssignment.id,
      className: draft.className.trim(),
      studentNumber: draft.studentNumber.trim(),
      studentName: draft.studentName.trim()
    };
    const key = studentKey(normalized);
    const existing = submissions.find((submission) => studentKey(submission) === key);

    if (existing) {
      setCurrentId(existing.id);
      setDraft({
        className: existing.className,
        studentNumber: existing.studentNumber,
        studentName: existing.studentName,
        title: existing.title,
        text: existing.originalText,
        revisedText: existing.revisedText || existing.originalText
      });
      if (existing.status === "submitted" || existing.status === "final-closed") {
        setPhase("submitted");
      } else if (existing.status === "writing") {
        setPhase("writing");
      } else {
        setPhase("revision");
      }
      return;
    }

    const id = createId();
    const submission: Submission = {
      id,
      ...normalized,
      title: "",
      originalText: "",
      revisedText: "",
      aiFeedback: [],
      aiFeedbackSource: undefined,
      teacherFeedback: "",
      teacherFeedbacks: [],
      startedAt: nowIso(),
      lastEditedAt: nowIso(),
      status: "writing"
    };
    setSubmissions((items) => [submission, ...items]);
    setCurrentId(id);
    setDraft((prev) => ({ ...prev, ...normalized }));
    setPhase("writing");
  };

  const updateCurrent = (patch: Partial<Submission>) => {
    if (!currentId) return;
    setSubmissions((items) =>
      items.map((item) => (item.id === currentId ? { ...item, ...patch, lastEditedAt: nowIso() } : item))
    );
  };

  const requestAiFeedback = async () => {
    if (!currentSubmission || feedbackLoading) return;
    setFeedbackLoading(true);
    updateCurrent({ title: draft.title, originalText: draft.text });

    const response = await fetch("/api/ai-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        text: draft.text,
        assignment: activeAssignment
      })
    });
    const data = await response.json();
    updateCurrent({
      aiFeedback: data.feedback ?? [],
      aiFeedbackSource: data.source === "openai" ? "openai" : "fallback",
      aiCheckedAt: nowIso(),
      revisedText: draft.revisedText || draft.text,
      status: "ai-reviewed"
    });
    setDraft((prev) => ({ ...prev, revisedText: prev.revisedText || prev.text }));
    setPhase("revision");
    setFeedbackLoading(false);
  };

  const submitToTeacher = () => {
    updateCurrent({
      title: draft.title,
      revisedText: draft.revisedText,
      submittedAt: nowIso(),
      status: "submitted"
    });
    window.alert("제출되었습니다.");
    setPhase("submitted");
  };

  const exitStudent = () => {
    setDraft(emptyDraft);
    setCurrentId(null);
    setPhase("intro");
  };

  const unlockTeacher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (teacherPassword === "1234") setTeacherUnlocked(true);
  };

  const setActiveAssignment = (id: string) => {
    setAssignments((items) => items.map((item) => ({ ...item, active: item.id === id })));
  };

  const updateAssignment = (id: string, patch: Partial<Assignment>) => {
    setAssignments((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              timeLimit: Math.max(1, Number(patch.timeLimit ?? item.timeLimit)),
              minChars: Math.max(0, Number(patch.minChars ?? item.minChars)),
              targetChars: Math.max(0, Number(patch.targetChars ?? item.targetChars)),
              maxChars: Math.max(1, Number(patch.maxChars ?? item.maxChars))
            }
          : item
      )
    );
  };

  const deleteAssignment = (id: string) => {
    if (assignments.length <= 1) {
      window.alert("과제는 최소 1개 이상 필요합니다.");
      return;
    }

    const hasSubmissions = submissions.some((submission) => submission.assignmentId === id);
    if (hasSubmissions && !window.confirm("이 과제로 제출된 글이 있습니다. 과제를 삭제해도 제출 기록은 남습니다. 삭제할까요?")) {
      return;
    }

    setAssignments((items) => {
      const deleted = items.find((item) => item.id === id);
      const remaining = items.filter((item) => item.id !== id);
      if (deleted?.active && remaining.length > 0) {
        return remaining.map((item, index) => ({ ...item, active: index === 0 }));
      }
      return remaining;
    });

    if (selectedAssignment === id) setSelectedAssignment("all");
  };

  const addAssignment = () => {
    const id = createId();
    setAssignments((items) => [
      ...items.map((item) => ({ ...item, active: false })),
      {
        id,
        title: "새 글쓰기 과제",
        topic: "주제를 입력하세요",
        timeLimit: 50,
        minChars: 800,
        targetChars: 1000,
        maxChars: 1200,
        active: true
      }
    ]);
  };

  const saveTeacherFeedback = (id: string, feedback: string, action: TeacherFeedback["action"]) => {
    setSubmissions((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const entry: TeacherFeedback = {
          id: createId(),
          text: feedback,
          createdAt: nowIso(),
          action
        };
        const nextStatus: SubmissionStatus =
          action === "final-closed"
            ? "final-closed"
            : action === "revision-opened"
              ? "revision-opened"
              : "teacher-reviewed";
        return {
          ...item,
          teacherFeedback: feedback,
          teacherFeedbacks: [...(item.teacherFeedbacks ?? []), entry],
          status: nextStatus,
          lastEditedAt: nowIso()
        };
      })
    );
  };

  const deleteSubmission = (id: string) => {
    setSubmissions((items) => items.filter((item) => item.id !== id));
    if (selectedSubmissionId === id) setSelectedSubmissionId(null);
  };

  return (
    <main>
      <nav className="mode-tabs" aria-label="화면 전환">
        <button className={view === "student" ? "active" : ""} onClick={() => setView("student")}>
          학생 화면
        </button>
        <button className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>
          교사 확인
        </button>
      </nav>

      {view === "student" ? (
        <StudentView
          assignment={activeAssignment}
          draft={draft}
          setDraft={setDraft}
          phase={phase}
          currentSubmission={currentSubmission}
          onStart={startWriting}
          onAiFeedback={requestAiFeedback}
          onSubmit={submitToTeacher}
          onExit={exitStudent}
          onResumeRevision={() => setPhase("revision")}
          onSaveDraft={updateCurrent}
          feedbackLoading={feedbackLoading}
        />
      ) : teacherUnlocked ? (
        <TeacherDashboard
          assignments={assignments}
          submissions={filteredSubmissions}
          allSubmissions={submissions}
          selectedAssignment={selectedAssignment}
          selectedClass={selectedClass}
          selectedSubmission={selectedSubmission}
          onAssignmentFilter={setSelectedAssignment}
          onClassFilter={setSelectedClass}
          onSelect={setSelectedSubmissionId}
          onSetActiveAssignment={setActiveAssignment}
          onUpdateAssignment={updateAssignment}
          onDeleteAssignment={deleteAssignment}
          onAddAssignment={addAssignment}
          onDeleteSubmission={deleteSubmission}
          onSaveFeedback={saveTeacherFeedback}
        />
      ) : (
        <TeacherLogin
          password={teacherPassword}
          setPassword={setTeacherPassword}
          onSubmit={unlockTeacher}
        />
      )}
    </main>
  );
}

function dedupeSubmissions(items: Submission[]) {
  const byStudent = new Map<string, Submission>();
  items.forEach((item) => {
    const normalized: Submission = {
      ...item,
      aiFeedback: visibleAiFeedback(item.aiFeedback ?? []),
      teacherFeedbacks: item.teacherFeedbacks ?? [],
      status: item.status ?? "writing"
    };
    const key = studentKey(normalized);
    const previous = byStudent.get(key);
    if (!previous || new Date(normalized.lastEditedAt ?? normalized.startedAt) > new Date(previous.lastEditedAt ?? previous.startedAt)) {
      byStudent.set(key, normalized);
    }
  });
  return Array.from(byStudent.values());
}

function StudentView({
  assignment,
  draft,
  setDraft,
  phase,
  currentSubmission,
  onStart,
  onAiFeedback,
  onSubmit,
  onExit,
  onResumeRevision,
  onSaveDraft,
  feedbackLoading
}: {
  assignment: Assignment;
  draft: typeof emptyDraft;
  setDraft: Dispatch<SetStateAction<typeof emptyDraft>>;
  phase: "intro" | "writing" | "revision" | "submitted";
  currentSubmission?: Submission;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
  onAiFeedback: () => void;
  onSubmit: () => void;
  onExit: () => void;
  onResumeRevision: () => void;
  onSaveDraft: (patch: Partial<Submission>) => void;
  feedbackLoading: boolean;
}) {
  const [timerNow, setTimerNow] = useState(0);
  const charCount = countChars(phase === "revision" ? draft.revisedText : draft.text);
  const progress = Math.min(100, Math.round((charCount / assignment.maxChars) * 100));
  const locked = currentSubmission?.status === "final-closed";
  const editable = currentSubmission ? canStudentEdit(currentSubmission.status) : true;
  const timerDisplayNow = timerNow || (currentSubmission ? new Date(currentSubmission.startedAt).getTime() : 0);

  useEffect(() => {
    if (phase === "intro") return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const blockClipboard = (event: ClipboardEvent<HTMLElement>) => {
    event.preventDefault();
  };

  if (phase === "intro") {
    return (
      <section className="student-intro">
        <h1>노지연 샘과 함께 하는 글쓰기 수업</h1>
        <p className="intro-copy">
          글은 생각과 인격을 비추는 거울입니다.
          <br />
          정교한 문장으로 지혜를 가꾸는 글쓰기 수업에 여러분을 초대합니다.
        </p>
        <div className="notice primary">
          <strong>
            <FileText size={16} /> 과제 안내
          </strong>
          <p>주제: {assignment.topic}</p>
          <p>
            분량: 띄어쓰기 포함 {assignment.targetChars.toLocaleString()}자 내외, 최소{" "}
            {assignment.minChars.toLocaleString()}자, 최대 {assignment.maxChars.toLocaleString()}자
          </p>
          <p>제한 시간: {assignment.timeLimit}분</p>
        </div>
        <form className="start-panel" onSubmit={onStart} noValidate>
          <label>
            분반
            <select
              required
              value={draft.className}
              onChange={(event) => setDraft((prev) => ({ ...prev, className: event.target.value }))}
            >
              <option value="">분반 선택</option>
              {classes.map((className) => (
                <option key={className}>{className}</option>
              ))}
            </select>
          </label>
          <label>
            학번
            <input
              required
              value={draft.studentNumber}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, studentNumber: event.target.value }))
              }
              placeholder="학번 입력"
            />
          </label>
          <label>
            이름
            <input
              required
              value={draft.studentName}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, studentName: event.target.value }))
              }
              placeholder="이름 입력"
            />
          </label>
          <button className="primary-button" type="submit">
            <Pencil size={18} /> 글쓰기 시작
          </button>
        </form>
      </section>
    );
  }

  if (phase === "submitted") {
    return (
      <SubmittedView
        assignment={assignment}
        submission={currentSubmission}
        draft={draft}
        locked={locked}
        editable={editable}
        onResumeRevision={onResumeRevision}
        onExit={onExit}
      />
    );
  }

  return (
    <section className="writing-shell" onCopy={blockClipboard} onCut={blockClipboard} onPaste={blockClipboard}>
      <aside className="writing-sidebar">
        <Panel title="과제 안내">
          <p className="eyebrow">주제</p>
          <strong>{assignment.topic}</strong>
          <p className="eyebrow">분량</p>
          <p>
            띄어쓰기 포함 <strong>{assignment.targetChars.toLocaleString()}자</strong> 내외
          </p>
          <p className="small">
            최소 {assignment.minChars.toLocaleString()}자 ~ 최대 {assignment.maxChars.toLocaleString()}자
          </p>
          <p className="eyebrow">제한 시간</p>
          <strong>{assignment.timeLimit}분</strong>
        </Panel>
        <Panel title="현재 글자수">
          <div className="count">{charCount.toLocaleString()}</div>
          <p className="small">자 작성됨</p>
          <div className="meter">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="meter-label">
            <span>최소 {assignment.minChars.toLocaleString()}자</span>
            <span>최대 {assignment.maxChars.toLocaleString()}자</span>
          </div>
        </Panel>
        <Panel title="경과 시간">
          <div className="timer">
            <Clock size={22} />
            {currentSubmission ? elapsed(currentSubmission.startedAt, timerDisplayNow) : "0분 0초"}
          </div>
          <p className="small">제한: {assignment.timeLimit}분</p>
        </Panel>
      </aside>

      <section className="editor-area">
        <input
          className="title-input"
          value={draft.title}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, title: event.target.value }));
            onSaveDraft({ title: event.target.value });
          }}
          onPaste={blockClipboard}
          placeholder="제목을 입력하세요"
          disabled={!editable}
        />
        <p className="student-meta">
          {draft.className} &nbsp; 학번: {draft.studentNumber} &nbsp; 이름: {draft.studentName}
        </p>

        {phase === "writing" ? (
          <>
            <textarea
              className="essay-input"
              value={draft.text}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, text: event.target.value }));
                onSaveDraft({ originalText: event.target.value });
              }}
              onPaste={blockClipboard}
              onCopy={blockClipboard}
              onCut={blockClipboard}
              placeholder="여기에 초안을 작성하세요."
            />
            <div className="bottom-bar">
              <span>자동 저장: {nowKst()}</span>
              <button
                className="success-button"
                type="button"
                disabled={!draft.title.trim() || countChars(draft.text) < 1 || feedbackLoading}
                onClick={onAiFeedback}
              >
                <Sparkles size={18} /> {feedbackLoading ? "AI 검사 중" : "AI 피드백 받기"}
              </button>
            </div>
          </>
        ) : (
          <div className="revision-grid">
            <div>
              <h2>원문</h2>
              <pre className="student-readonly">{currentSubmission?.originalText || "원문이 없습니다."}</pre>
              <h2>AI 피드백</h2>
              <AiFeedbackSourceBadge source={currentSubmission?.aiFeedbackSource} />
              <div className="feedback-list">
                {visibleAiFeedback(currentSubmission?.aiFeedback).map((item, index) => (
                  <article key={`${item.type}-${index}`} className="feedback-item">
                    <strong>{item.type}</strong>
                    <p>{item.message}</p>
                    <span>{item.suggestion}</span>
                  </article>
                ))}
              </div>
              <TeacherFeedbackList submission={currentSubmission} />
            </div>
            <div>
              <h2>수정본</h2>
              <textarea
                className="essay-input compact"
                value={draft.revisedText}
                disabled={!editable}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, revisedText: event.target.value }));
                  onSaveDraft({ revisedText: event.target.value });
                }}
                onPaste={blockClipboard}
                onCopy={blockClipboard}
                onCut={blockClipboard}
              />
              <button className="success-button full" type="button" onClick={onSubmit} disabled={!editable}>
                <Send size={18} /> 교사에게 제출
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function SubmittedView({
  submission,
  draft,
  locked,
  editable,
  onResumeRevision,
  onExit,
}: {
  assignment: Assignment;
  submission?: Submission;
  draft: typeof emptyDraft;
  locked: boolean;
  editable: boolean;
  onResumeRevision: () => void;
  onExit: () => void;
}) {
  return (
    <section className="submitted-page">
      <div className="submitted-panel">
        <Check size={34} />
        <h1>{locked ? "최종 마감되었습니다." : "제출되었습니다."}</h1>
        <p>
          {locked
            ? "교사가 최종 마감을 눌러 더 이상 수정할 수 없습니다."
            : editable
              ? "교사 피드백이 도착했습니다. 수정본을 다시 작성할 수 있습니다."
              : "교사가 확인할 때까지 이 화면에 머물 수 있습니다."}
        </p>
        <div className="submitted-actions">
          {editable && !locked && (
            <button className="success-button" onClick={onResumeRevision}>
              <Pencil size={18} /> 다시 수정하기
            </button>
          )}
          <button className="outline-button" onClick={onExit}>
            나가기
          </button>
        </div>
      </div>
      <div className="submitted-grid">
        <ReadOnlyBlock title="원문" text={submission?.originalText ?? draft.text} icon={<FileText />} />
        <ReadOnlyBlock title="수정본" text={submission?.revisedText ?? draft.revisedText} icon={<Pencil />} />
        <section className="read-block">
          <h3>
            <MessageSquareText size={18} /> 교사 피드백
          </h3>
          <TeacherFeedbackList submission={submission} />
        </section>
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="side-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function TeacherLogin({
  password,
  setPassword,
  onSubmit
}: {
  password: string;
  setPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="login-wrap">
      <form className="login-panel" onSubmit={onSubmit}>
        <Lock size={20} />
        <h1>교사 확인 페이지</h1>
        <p>비밀번호를 입력하세요</p>
        <label>
          비밀번호
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="비밀번호"
          />
        </label>
        <button className="primary-button" type="submit">
          확인
        </button>
      </form>
    </section>
  );
}

function TeacherDashboard({
  assignments,
  submissions,
  allSubmissions,
  selectedAssignment,
  selectedClass,
  selectedSubmission,
  onAssignmentFilter,
  onClassFilter,
  onSelect,
  onSetActiveAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onAddAssignment,
  onDeleteSubmission,
  onSaveFeedback
}: {
  assignments: Assignment[];
  submissions: Submission[];
  allSubmissions: Submission[];
  selectedAssignment: string;
  selectedClass: string;
  selectedSubmission: Submission | null;
  onAssignmentFilter: (id: string) => void;
  onClassFilter: (className: string) => void;
  onSelect: (id: string) => void;
  onSetActiveAssignment: (id: string) => void;
  onUpdateAssignment: (id: string, patch: Partial<Assignment>) => void;
  onDeleteAssignment: (id: string) => void;
  onAddAssignment: () => void;
  onDeleteSubmission: (id: string) => void;
  onSaveFeedback: (id: string, feedback: string, action: TeacherFeedback["action"]) => void;
}) {
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const updateEditingAssignment = (patch: Partial<Assignment>) => {
    setEditingAssignment((current) => (current ? { ...current, ...patch } : current));
  };

  const saveEditingAssignment = () => {
    if (!editingAssignment) return;
    onUpdateAssignment(editingAssignment.id, editingAssignment);
    setEditingAssignment(null);
  };

  return (
    <section className="teacher-page">
      <header className="teacher-header">
        <div>
          <h1>교사 확인 대시보드</h1>
          <p>실시간 업데이트 중</p>
        </div>
        <button className="dark-button" onClick={() => window.print()}>
          <Download size={16} /> 현재 반 PDF 다운로드
        </button>
      </header>

      <div className="filter-row">
        <span>과제별 필터</span>
        <button
          className={selectedAssignment === "all" ? "chip active" : "chip"}
          onClick={() => onAssignmentFilter("all")}
        >
          전체 과제
        </button>
        {assignments.map((assignment) => (
          <button
            key={assignment.id}
            className={selectedAssignment === assignment.id ? "chip active" : "chip"}
            onClick={() => onAssignmentFilter(assignment.id)}
          >
            {assignment.title}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <span>반별 필터</span>
        <button
          className={selectedClass === "all" ? "chip active" : "chip"}
          onClick={() => onClassFilter("all")}
        >
          전체
        </button>
        {classes.map((className) => (
          <button
            key={className}
            className={selectedClass === className ? "chip active" : "chip"}
            onClick={() => onClassFilter(className)}
          >
            {className}
          </button>
        ))}
      </div>

      <section className="table-panel">
        <p className="hint">이름을 클릭하면 상세 내용을 확인할 수 있습니다.</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>반</th>
                <th>이름</th>
                <th>학번</th>
                <th>주제</th>
                <th>글자수</th>
                <th>작성 시간</th>
                <th>제출 완료 시간</th>
                <th>상태</th>
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const assignment = assignments.find((item) => item.id === submission.assignmentId);
                return (
                  <tr key={submission.id}>
                    <td>{submission.className}</td>
                    <td>
                      <button className="link-button" onClick={() => onSelect(submission.id)}>
                        {submission.studentName}
                      </button>
                    </td>
                    <td>{submission.studentNumber}</td>
                    <td>{assignment?.topic}</td>
                    <td>{countChars(submission.revisedText || submission.originalText)}자</td>
                    <td>{elapsed(submission.startedAt)}</td>
                    <td>{submission.submittedAt ? formatKst(submission.submittedAt) : "-"}</td>
                    <td>
                      <StatusBadge status={submission.status} />
                    </td>
                    <td>
                      <button className="danger-mini" onClick={() => onDeleteSubmission(submission.id)}>
                        <Trash2 size={14} /> 삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    제출된 글이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSubmission && (
        <SubmissionDetail
          key={selectedSubmission.id}
          submission={selectedSubmission}
          onSaveFeedback={onSaveFeedback}
        />
      )}

      <section className="assignment-panel">
        <h2>과제 관리</h2>
        {assignments.map((assignment) => (
          <article key={assignment.id} className={assignment.active ? "assignment active" : "assignment"}>
            <div>
              <strong>{assignment.title}</strong>
              <p>
                주제: {assignment.topic} / 제한: {assignment.timeLimit}분 /{" "}
                {assignment.minChars.toLocaleString()}자 ~ {assignment.maxChars.toLocaleString()}자
              </p>
            </div>
            <div className="assignment-actions">
              <button className="outline-button" onClick={() => onSetActiveAssignment(assignment.id)}>
                {assignment.active ? <Check size={16} /> : <UserRound size={16} />}
                {assignment.active ? "현재 과제" : "현재 과제로 설정"}
              </button>
              <button className="outline-button" onClick={() => setEditingAssignment(assignment)}>
                <Pencil size={16} /> 수정
              </button>
              <button className="danger-mini" onClick={() => onDeleteAssignment(assignment.id)}>
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </article>
        ))}
        <button className="outline-button" onClick={onAddAssignment}>
          <Plus size={16} /> 새 과제 추가
        </button>
        <p className="storage-note">현재 저장된 제출: {allSubmissions.length}건</p>
      </section>

      {editingAssignment && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="과제 수정">
          <div className="assignment-modal">
            <header>
              <h2>과제 수정</h2>
              <button className="link-button" onClick={() => setEditingAssignment(null)}>
                닫기
              </button>
            </header>
            <div className="assignment-fields">
              <label>
                과제명
                <input
                  value={editingAssignment.title}
                  onChange={(event) => updateEditingAssignment({ title: event.target.value })}
                />
              </label>
              <label>
                글쓰기 주제
                <input
                  value={editingAssignment.topic}
                  onChange={(event) => updateEditingAssignment({ topic: event.target.value })}
                />
              </label>
              <div className="assignment-number-grid">
                <label>
                  제한 시간
                  <input
                    type="number"
                    min={1}
                    value={editingAssignment.timeLimit}
                    onChange={(event) => updateEditingAssignment({ timeLimit: Number(event.target.value) })}
                  />
                </label>
                <label>
                  최소 글자수
                  <input
                    type="number"
                    min={0}
                    value={editingAssignment.minChars}
                    onChange={(event) => updateEditingAssignment({ minChars: Number(event.target.value) })}
                  />
                </label>
                <label>
                  기준 글자수
                  <input
                    type="number"
                    min={0}
                    value={editingAssignment.targetChars}
                    onChange={(event) => updateEditingAssignment({ targetChars: Number(event.target.value) })}
                  />
                </label>
                <label>
                  최대 글자수
                  <input
                    type="number"
                    min={1}
                    value={editingAssignment.maxChars}
                    onChange={(event) => updateEditingAssignment({ maxChars: Number(event.target.value) })}
                  />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="outline-button" onClick={() => setEditingAssignment(null)}>
                취소
              </button>
              <button className="primary-button" onClick={saveEditingAssignment}>
                <Save size={18} /> 저장
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

function SubmissionDetail({
  submission,
  onSaveFeedback
}: {
  submission: Submission;
  onSaveFeedback: (id: string, feedback: string, action: TeacherFeedback["action"]) => void;
}) {
  const [feedbackDraft, setFeedbackDraft] = useState(submission.teacherFeedback);

  return (
    <section className="detail-panel">
      <header>
        <div>
          <h2>
            {submission.studentName} · {submission.className} · {submission.studentNumber}
          </h2>
          <p>{submission.title}</p>
        </div>
        <StatusBadge status={submission.status} />
      </header>
      <div className="detail-grid">
        <ReadOnlyBlock title="학생 원문" text={submission.originalText} icon={<FileText />} />
        <section className="read-block">
          <h3>
            <Sparkles size={18} /> AI 피드백
          </h3>
          <AiFeedbackSourceBadge source={submission.aiFeedbackSource} />
          {visibleAiFeedback(submission.aiFeedback).map((item, index) => (
            <article key={index} className="feedback-item">
              <strong>{item.type}</strong>
              <p>{item.message}</p>
              <span>{item.suggestion}</span>
            </article>
          ))}
        </section>
        <ReadOnlyBlock title="학생 수정본" text={submission.revisedText} icon={<Pencil />} />
        <section className="read-block">
          <h3>
            <MessageSquareText size={18} /> 교사 피드백
          </h3>
          <textarea
            value={feedbackDraft}
            onChange={(event) => setFeedbackDraft(event.target.value)}
            placeholder="교사 피드백을 입력하세요."
          />
          <div className="teacher-action-row">
            <button
              className="outline-button"
              onClick={() => onSaveFeedback(submission.id, feedbackDraft, "revision-opened")}
            >
              <Pencil size={18} /> 수정 가능
            </button>
            <button
              className="primary-button"
              onClick={() => onSaveFeedback(submission.id, feedbackDraft, "feedback-complete")}
            >
              <Save size={18} /> 피드백 완료
            </button>
            <button
              className="danger-button"
              onClick={() => onSaveFeedback(submission.id, feedbackDraft, "final-closed")}
            >
              <Lock size={18} /> 최종 마감
            </button>
          </div>
          <TeacherFeedbackList submission={submission} />
        </section>
      </div>
    </section>
  );
}

function AiFeedbackSourceBadge({ source }: { source?: Submission["aiFeedbackSource"] }) {
  if (!source) return null;

  return (
    <p className={source === "openai" ? "ai-source openai" : "ai-source fallback"}>
      {source === "openai"
        ? "실제 OpenAI API로 검사했습니다."
        : "OpenAI API 키가 연결되지 않아 기본 예시 검사만 표시 중입니다."}
    </p>
  );
}

function TeacherFeedbackList({ submission }: { submission?: Submission }) {
  const feedbacks = submission?.teacherFeedbacks ?? [];
  if (feedbacks.length === 0 && !submission?.teacherFeedback) {
    return <p className="small">아직 교사 피드백이 없습니다.</p>;
  }
  return (
    <div className="teacher-feedback-list">
      {feedbacks.map((feedback) => (
        <article key={feedback.id} className="teacher-feedback-item">
          <strong>{formatKst(feedback.createdAt)}</strong>
          <p>{feedback.text || "피드백 내용이 없습니다."}</p>
        </article>
      ))}
      {feedbacks.length === 0 && submission?.teacherFeedback && (
        <article className="teacher-feedback-item">
          <strong>최근 피드백</strong>
          <p>{submission.teacherFeedback}</p>
        </article>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const labels: Record<SubmissionStatus, string> = {
    writing: "작성 중",
    "ai-reviewed": "AI 확인",
    submitted: "제출 완료",
    "revision-opened": "수정 가능",
    "teacher-reviewed": "피드백 완료",
    "final-closed": "최종 마감"
  };
  return <span className={`status ${status}`}>{labels[status]}</span>;
}

function ReadOnlyBlock({
  title,
  text,
  icon
}: {
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <section className="read-block">
      <h3>
        {icon}
        {title}
      </h3>
      <pre>{text || "내용이 없습니다."}</pre>
    </section>
  );
}
