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
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
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
  teacherFeedback: string;
  startedAt: string;
  aiCheckedAt?: string;
  submittedAt?: string;
  status: "writing" | "ai-reviewed" | "submitted" | "teacher-reviewed";
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

function nowKst() {
  return formatKst(new Date().toISOString());
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

function elapsed(startedAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}분 ${rest}초`;
}

function countChars(text: string) {
  return text.replace(/\s/g, "").length;
}

export default function Home() {
  const [view, setView] = useState<"student" | "teacher">("student");
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [phase, setPhase] = useState<"intro" | "writing" | "revision">("intro");
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
      setSubmissions(parsed.submissions ?? []);
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
    const id = crypto.randomUUID();
    const submission: Submission = {
      id,
      assignmentId: activeAssignment.id,
      className: draft.className,
      studentNumber: draft.studentNumber,
      studentName: draft.studentName,
      title: "",
      originalText: "",
      revisedText: "",
      aiFeedback: [],
      teacherFeedback: "",
      startedAt: new Date().toISOString(),
      status: "writing"
    };
    setSubmissions((items) => [submission, ...items]);
    setCurrentId(id);
    setPhase("writing");
  };

  const updateCurrent = (patch: Partial<Submission>) => {
    if (!currentId) return;
    setSubmissions((items) =>
      items.map((item) => (item.id === currentId ? { ...item, ...patch } : item))
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
      aiCheckedAt: new Date().toISOString(),
      revisedText: draft.text,
      status: "ai-reviewed"
    });
    setDraft((prev) => ({ ...prev, revisedText: prev.text }));
    setPhase("revision");
    setFeedbackLoading(false);
  };

  const submitToTeacher = () => {
    updateCurrent({
      revisedText: draft.revisedText,
      submittedAt: new Date().toISOString(),
      status: "submitted"
    });
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

  const addAssignment = () => {
    const id = crypto.randomUUID();
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

  const saveTeacherFeedback = (id: string, feedback: string) => {
    setSubmissions((items) =>
      items.map((item) =>
        item.id === id ? { ...item, teacherFeedback: feedback, status: "teacher-reviewed" } : item
      )
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

function StudentView({
  assignment,
  draft,
  setDraft,
  phase,
  currentSubmission,
  onStart,
  onAiFeedback,
  onSubmit,
  feedbackLoading
}: {
  assignment: Assignment;
  draft: typeof emptyDraft;
  setDraft: Dispatch<SetStateAction<typeof emptyDraft>>;
  phase: "intro" | "writing" | "revision";
  currentSubmission?: Submission;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
  onAiFeedback: () => void;
  onSubmit: () => void;
  feedbackLoading: boolean;
}) {
  const charCount = countChars(phase === "revision" ? draft.revisedText : draft.text);
  const progress = Math.min(100, Math.round((charCount / assignment.maxChars) * 100));

  if (phase === "intro") {
    return (
      <section className="student-intro">
        <h1>글쓰기 수행평가 안내</h1>
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
        <div className="notice warning">
          <strong>주의 사항</strong>
          <p>생성형 AI를 활용하여 작성할 경우 채점에서 불이익이 있을 수 있습니다.</p>
          <p>글쓰기 과정에서 복사하기, 붙여넣기는 금지됩니다.</p>
        </div>
        <form className="start-panel" onSubmit={onStart}>
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

  return (
    <section className="writing-shell">
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
            {currentSubmission ? elapsed(currentSubmission.startedAt) : "0분 0초"}
          </div>
          <p className="small">제한: {assignment.timeLimit}분</p>
        </Panel>
      </aside>

      <section className="editor-area">
        <input
          className="title-input"
          value={draft.title}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="제목을 입력하세요"
        />
        <p className="student-meta">
          {draft.className} &nbsp; 학번: {draft.studentNumber} &nbsp; 이름: {draft.studentName}
        </p>

        {phase === "writing" ? (
          <>
            <textarea
              className="essay-input"
              value={draft.text}
              onChange={(event) => setDraft((prev) => ({ ...prev, text: event.target.value }))}
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
              <h2>AI 피드백</h2>
              <div className="feedback-list">
                {currentSubmission?.aiFeedback.map((item, index) => (
                  <article key={`${item.type}-${index}`} className="feedback-item">
                    <strong>{item.type}</strong>
                    <p>{item.message}</p>
                    <span>{item.suggestion}</span>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h2>수정본</h2>
              <textarea
                className="essay-input compact"
                value={draft.revisedText}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, revisedText: event.target.value }))
                }
              />
              <button className="success-button full" type="button" onClick={onSubmit}>
                <Send size={18} /> 교사에게 제출
              </button>
            </div>
          </div>
        )}
      </section>
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
  onAddAssignment: () => void;
  onDeleteSubmission: (id: string) => void;
  onSaveFeedback: (id: string, feedback: string) => void;
}) {
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
            <button className="outline-button" onClick={() => onSetActiveAssignment(assignment.id)}>
              {assignment.active ? <Check size={16} /> : <UserRound size={16} />}
              {assignment.active ? "현재 과제" : "현재 과제로 설정"}
            </button>
          </article>
        ))}
        <button className="outline-button" onClick={onAddAssignment}>
          <Plus size={16} /> 새 과제 추가
        </button>
        <p className="storage-note">현재 저장된 제출: {allSubmissions.length}건</p>
      </section>
    </section>
  );
}

function SubmissionDetail({
  submission,
  onSaveFeedback
}: {
  submission: Submission;
  onSaveFeedback: (id: string, feedback: string) => void;
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
          {submission.aiFeedback.map((item, index) => (
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
          <button className="primary-button" onClick={() => onSaveFeedback(submission.id, feedbackDraft)}>
            <Save size={18} /> 저장
          </button>
        </section>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: Submission["status"] }) {
  const labels = {
    writing: "작성 중",
    "ai-reviewed": "AI 확인",
    submitted: "제출 완료",
    "teacher-reviewed": "교사 확인"
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
