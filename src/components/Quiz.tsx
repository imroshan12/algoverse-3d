import { useState } from "react";
import { optionOrder, QUIZ, type Level } from "../topics/quiz";
import type { TopicDef } from "../topics/types";
import { Rich } from "./Panels";

/** Picked option per question, per topic. −1 means the answer was revealed without guessing. */
type Picks = Record<string, Record<number, number>>;
type Filter = "All" | Level;

const KEY = "algoverse.quiz";
const REVEALED = -1;
const FILTERS: Filter[] = ["All", "Easy", "Medium", "Hard"];

function load(): Picks {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function save(p: Picks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage can be unavailable (private mode); the quiz still works for this visit.
  }
}

/** The first unanswered question among `ids`, or the first of them. */
const firstOpen = (picks: Record<number, number>, ids: number[]) => ids.find((i) => picks[i] === undefined) ?? ids[0] ?? 0;

/** Hand-written practice questions for the current topic, one at a time, each with a worked explanation. */
export function QuizPanel({ topic }: { topic: TopicDef }) {
  const qs = QUIZ[topic.id] ?? [];
  const [all, setAll] = useState<Picks>(load);
  const [filter, setFilter] = useState<Filter>("All");
  const picks = all[topic.id] ?? {};
  const idsFor = (f: Filter) => qs.map((_, i) => i).filter((i) => f === "All" || qs[i].level === f);
  const ids = idsFor(filter);
  const [cur, setCur] = useState(() => firstOpen(picks, ids));
  const [shown, setShown] = useState(topic.id);
  if (shown !== topic.id) {
    setShown(topic.id);
    setCur(firstOpen(all[topic.id] ?? {}, ids));
  }

  const update = (fn: (mine: Record<number, number>) => Record<number, number> | undefined) =>
    setAll((prev) => {
      const mine = fn({ ...(prev[topic.id] ?? {}) });
      const next = { ...prev };
      if (mine && Object.keys(mine).length) next[topic.id] = mine;
      else delete next[topic.id];
      save(next);
      return next;
    });
  const pick = (qi: number, opt: number) => update((mine) => ({ ...mine, [qi]: opt }));
  const choose = (f: Filter) => {
    setFilter(f);
    setCur(firstOpen(picks, idsFor(f)));
  };
  const reset = () => {
    update((mine) => {
      for (const i of ids) delete mine[i];
      return mine;
    });
    setCur(ids[0] ?? 0);
  };

  const pos = Math.max(0, ids.indexOf(cur));
  const qi = ids[pos];
  const q = qi === undefined ? undefined : qs[qi];
  const p = qi === undefined ? undefined : picks[qi];
  const answered = ids.filter((i) => (picks[i] ?? REVEALED) >= 0).length;
  const correct = ids.filter((i) => picks[i] === qs[i].answer).length;
  const finished = ids.length > 0 && ids.every((i) => picks[i] !== undefined);
  const order = q ? optionOrder(`${topic.id}:${qi}`, q.options.length) : [];
  const lines = q ? q.explain.split("\n") : [];

  return (
    <section className="panel quiz" id="practice">
      <h3>
        Practice questions
        {answered > 0 && (
          <span className="score">
            {correct}/{answered} correct
          </span>
        )}
      </h3>
      <div className="row quiz-levels" role="group" aria-label="Difficulty">
        {FILTERS.map((f) => (
          <button key={f} className={`small seg${f === filter ? " on" : ""}`} aria-pressed={f === filter} onClick={() => choose(f)}>
            {f} <span className="count">{idsFor(f).length}</span>
          </button>
        ))}
      </div>
      {!q || qi === undefined ? (
        <p className="hint">No {filter === "All" ? "" : `${filter.toLowerCase()} `}practice questions for this topic yet.</p>
      ) : (
        <>
          <div className="quiz-dots" role="tablist" aria-label="Questions">
            {ids.map((i, k) => {
              const v = picks[i];
              const status = v === undefined ? "" : v === REVEALED ? " seen" : v === qs[i].answer ? " ok" : " bad";
              return (
                <button key={i} role="tab" aria-selected={i === qi} className={`quiz-dot${status}${i === qi ? " on" : ""}`} onClick={() => setCur(i)} title={`Question ${k + 1} (${qs[i].level})`}>
                  {k + 1}
                </button>
              );
            })}
          </div>
          <div className="quiz-meta">
            <span>
              Question {pos + 1} of {ids.length}
            </span>
            <span className={`level ${q.level}`}>{q.level}</span>
          </div>
          <p className="prompt">{q.q}</p>
          <div className="options single">
            {order.map((k) => {
              const cls = p === undefined ? "" : k === q.answer ? "right" : k === p ? "wrong" : "dim";
              return (
                <button key={k} className={`opt ${cls}`} disabled={p !== undefined} onClick={() => pick(qi, k)}>
                  {q.options[k]}
                </button>
              );
            })}
          </div>
          {p !== undefined && (
            <>
              <p className={`verdict ${p === q.answer ? "ok" : p === REVEALED ? "" : "bad"}`}>{p === q.answer ? "✓ Correct!" : p === REVEALED ? `Answer: ${q.options[q.answer]}` : `✗ Not quite. The answer is: ${q.options[q.answer]}`}</p>
              <div className="explain-box quiz-explain">
                <span className="why-tag">Worked answer</span>
                {lines.length > 1 ? (
                  <ul className="quiz-steps">
                    {lines.map((l, i) => (
                      <li key={i}>
                        <Rich text={l} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Rich text={lines[0] ?? ""} />
                )}
              </div>
            </>
          )}
          <div className="quiz-nav">
            <button className="small" disabled={pos === 0} onClick={() => setCur(ids[pos - 1])}>
              ← Previous
            </button>
            {p === undefined ? (
              <button className="linkish reveal" onClick={() => pick(qi, REVEALED)}>
                Show answer
              </button>
            ) : (
              <span />
            )}
            <button className={p !== undefined && pos < ids.length - 1 ? "small primary-soft" : "small"} disabled={pos === ids.length - 1} onClick={() => setCur(ids[pos + 1])}>
              Next →
            </button>
          </div>
          {finished && (
            <div className="quiz-summary">
              <span>
                {correct === ids.length ? "🎉 All correct!" : `Done: ${correct} of ${ids.length} correct.`} {correct < ids.length && "Red and amber dots mark the ones worth rereading."}
              </span>
              <button className="small" onClick={reset}>
                Start over
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
