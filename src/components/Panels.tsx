import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NodeState, Run } from "../algorithms/types";
import { LEARN } from "../topics/learn";
import { QUIZ } from "../topics/quiz";
import type { TopicDef, TopicInstance, Values } from "../topics/types";
import type { Player } from "../usePlayer";
import { NODE_COLORS } from "./Scene";

/** Bold the numbers and quoted tokens in a caption so the values that matter stand out. */
export function Rich({ text }: { text: string }): ReactNode {
  const parts = text.split(/(-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|∞)/g);
  return parts.map((p, i) => (i % 2 ? <b key={i} className="val">{p}</b> : <Fragment key={i}>{p}</Fragment>));
}

/** The running commentary under the 3D view: what just happened, and the rule behind it. */
export function Narration({ player }: { player: Player }) {
  const { run, index } = player;
  const f = run.frames[index];
  if (!f) return null;
  const note = f.line >= 0 ? run.notes?.[f.line] : undefined;
  const single = run.frames.length <= 1;
  return (
    <div className="narration" aria-live="polite">
      {!single && (
        <span className="step-badge">
          {index + 1}
          <small>/{run.frames.length}</small>
        </span>
      )}
      <div className="narration-body" key={`${run.title}|${index}`}>
        <p className="narration-msg">
          <Rich text={f.message} />
        </p>
        {note && (
          <p className="narration-why">
            <span className="why-tag">Why</span> {note}
          </p>
        )}
      </div>
    </div>
  );
}

export function CodePanel({ player }: { player: Player }) {
  const { run, index } = player;
  const line = run.frames[index]?.line ?? -1;
  const active = useRef<HTMLDivElement>(null);
  // Scroll only the code box, never the page, so the 3D view stays in sight.
  useEffect(() => {
    const el = active.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop - 8;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 8;
  }, [line]);
  return (
    <section className="panel">
      <h3>Pseudocode</h3>
      <pre className="code">
        {run.code.map((l, i) => (
          <div key={i} ref={i === line ? active : undefined} className={i === line ? "code-line on" : "code-line"} title={run.notes?.[i]}>
            <span className="ln">{i}</span>
            {l || " "}
          </div>
        ))}
      </pre>
    </section>
  );
}

/** Queues, stacks, outputs and counters for the current step. */
export function DataPanel({ player }: { player: Player }) {
  const f = player.run.frames[player.index];
  if (!f || !f.aux.length) return null;
  return (
    <section className="panel">
      <h3>State</h3>
      {f.aux.map((a) => (
        <div key={a.label} className="aux">
          <span className="aux-label">{a.label}</span>
          <div className="chips">
            {a.items.length ? a.items.map((it, i) => <span key={i} className="chip">{it}</span>) : <span className="empty">empty</span>}
          </div>
        </div>
      ))}
    </section>
  );
}

export function Controls({ player }: { player: Player }) {
  const { index, run, playing, speed, blocked, atEnd } = player;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") player.next();
      else if (e.key === "ArrowLeft") player.prev();
      else if (e.key === " ") {
        e.preventDefault();
        if (playing) player.pause();
        else player.play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, playing]);

  const ticks = useMemo(() => {
    const n = run.frames.length - 1;
    return n > 0 ? run.frames.flatMap((f, i) => (f.question ? [(i / n) * 100] : [])) : [];
  }, [run]);

  return (
    <div className="controls">
      <button title="Restart" onClick={() => player.seek(0)}>⏮</button>
      <button title="Step back (←)" onClick={player.prev} disabled={index === 0}>◀</button>
      {playing ? (
        <button className="primary" title="Pause (space)" onClick={player.pause}>⏸ Pause</button>
      ) : (
        <button className="primary" title="Play (space)" onClick={player.play} disabled={blocked}>▶ {atEnd ? "Replay" : "Play"}</button>
      )}
      <button title="Step forward (→)" onClick={player.next} disabled={atEnd || blocked}>▶︎|</button>
      <div className="scrubber">
        <input
          type="range"
          min={0}
          max={run.frames.length - 1}
          value={index}
          onChange={(e) => player.seek(Number(e.target.value))}
          aria-label="Scrub steps"
        />
        <div className="ticks" aria-hidden>
          {ticks.map((t, i) => (
            <i key={i} style={{ left: `calc(${t}% + ${8 - (t / 100) * 16}px)` }} title="Question" />
          ))}
        </div>
      </div>
      <select value={speed} onChange={(e) => player.setSpeed(Number(e.target.value))} aria-label="Speed">
        {[0.5, 1, 2, 4].map((s) => (
          <option key={s} value={s}>{s}×</option>
        ))}
      </select>
    </div>
  );
}

/** The question attached to the current step, if any, with its answer and worked reasoning. */
export function QuestionCard({ player }: { player: Player }) {
  const { run, index, answers, questionsOn } = player;
  const q = run.frames[index]?.question;
  const total = Object.keys(answers).length;
  const correct = Object.values(answers).filter((a) => a.correct).length;
  return (
    <section className="panel question-card">
      <h3>
        <label className="toggle">
          <input type="checkbox" checked={questionsOn} onChange={(e) => player.setQuestionsOn(e.target.checked)} />
          Pause for questions
        </label>
        {total > 0 && <span className="score">{correct}/{total} correct</span>}
      </h3>
      {questionsOn && q ? (
        <>
          <p className="prompt">{q.prompt}</p>
          <div className="options">
            {q.options.map((o) => {
              const a = answers[index];
              const cls = !a ? "" : o === q.answer ? "right" : o === a.choice ? "wrong" : "dim";
              return (
                <button key={o} className={`opt ${cls}`} disabled={!!a} onClick={() => player.answer(o)}>
                  {o}
                </button>
              );
            })}
          </div>
          {answers[index] && (
            <>
              <p className={answers[index].correct ? "verdict ok" : "verdict bad"}>
                {answers[index].correct ? "✓ Correct!" : `✗ Not quite: the answer is ${q.answer}.`}
              </p>
              <p className="explain-box">
                <span className="why-tag">Why</span> <Rich text={q.explain ?? run.frames[index + 1]?.message ?? ""} />
              </p>
              <p className="hint">Press ▶ to continue.</p>
            </>
          )}
        </>
      ) : (
        <p className="hint">{questionsOn ? "Playback pauses at each question so you can think about the next step before it happens." : "Questions are off: playback runs straight through. Tick the box to pause at each question."}</p>
      )}
    </section>
  );
}

/**
 * "Explain this step", written by hand: the pseudocode line being run, what just happened and why,
 * what happens next, the steps just before, and the exact version of the algorithm on screen.
 */
export function StepExplainer({ player }: { player: Player }) {
  const { run, index, blocked } = player;
  const f = run.frames[index];
  if (!f || run.frames.length <= 1) return null;
  const codeAt = (l: number) => (l >= 0 && l < run.code.length ? run.code[l].trim() : "");
  const code = codeAt(f.line);
  const note = f.line >= 0 ? run.notes?.[f.line] : undefined;
  const next = run.frames[index + 1];
  const from = Math.max(0, index - 2);
  const earlier = run.frames.slice(from, index);
  return (
    <section className="panel step-explain">
      <h3>
        Step explained
        <span className="score">
          {index + 1} / {run.frames.length}
        </span>
      </h3>
      {code && (
        <p className="se-line">
          <span className="se-tag">Line {f.line}</span>
          <code>{code}</code>
        </p>
      )}
      <dl className="se">
        <dt>What happened</dt>
        <dd>
          <Rich text={f.message} />
        </dd>
        {note && (
          <>
            <dt>Why this line</dt>
            <dd>{note}</dd>
          </>
        )}
        <dt>What happens next</dt>
        <dd>
          {blocked ? (
            <span className="hint">Answer the question first: the next step gives the answer away.</span>
          ) : next ? (
            <>
              <Rich text={next.message} />
              {next.line >= 0 && next.line !== f.line && codeAt(next.line) && <span className="se-next-line"> (line {next.line})</span>}
            </>
          ) : (
            <span className="hint">Nothing: this is the last step.</span>
          )}
        </dd>
        {earlier.length > 0 && (
          <>
            <dt>Just before</dt>
            <dd>
              <ol className="se-earlier" start={from + 1}>
                {earlier.map((p, k) => (
                  <li key={from + k}>
                    <Rich text={p.message} />
                  </li>
                ))}
              </ol>
            </dd>
          </>
        )}
        {run.variant && (
          <>
            <dt>This version of the algorithm</dt>
            <dd>{run.variant}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

const DEFAULT_LEGEND: Record<NodeState, string> = {
  idle: "not touched yet",
  pending: "waiting",
  current: "working on now",
  visited: "done",
  found: "found / new",
  removing: "being removed",
  ghost: "out of play",
};
const LEGEND_ORDER: NodeState[] = ["current", "pending", "visited", "found", "removing", "idle", "ghost"];

/** Only the colours this run actually uses, labelled with what they mean in this algorithm. */
export function Legend({ run }: { run: Run }) {
  const used = useMemo(() => {
    const s = new Set<NodeState>();
    for (const f of run.frames) for (const n of f.nodes) s.add(n.state);
    return LEGEND_ORDER.filter((st) => s.has(st) && (st !== "ghost" || run.legend?.ghost) && (st !== "idle" || s.size > 1));
  }, [run]);
  if (!used.length) return null;
  return (
    <div className="legend">
      {used.map((s) => (
        <span key={s}>
          <i style={{ background: NODE_COLORS[s], opacity: s === "ghost" ? 0.55 : 1 }} />
          {run.legend?.[s] ?? DEFAULT_LEGEND[s]}
        </span>
      ))}
    </div>
  );
}

/** The textbook summary for a topic: idea, how it works, costs and exam pitfalls. */
export function ConceptPanel({ topicId }: { topicId: string }) {
  const learn = LEARN[topicId];
  const quizCount = QUIZ[topicId]?.length ?? 0;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("algoverse.concept") !== "closed";
    } catch {
      return true;
    }
  });
  if (!learn) return null;
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem("algoverse.concept", open ? "closed" : "open");
    } catch {
      // ignore
    }
  };
  return (
    <section className="panel concept">
      <h3>
        <button className="linkish" onClick={toggle} aria-expanded={open}>
          {open ? "▾" : "▸"} Concept
        </button>
      </h3>
      <p className="concept-idea">{learn.idea}</p>
      {quizCount > 0 && (
        <button className="linkish practice-link" onClick={() => document.getElementById("practice")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          📝 {quizCount} practice questions with worked answers ↓
        </button>
      )}
      {open && (
        <>
          <ul className="concept-how">
            {learn.how.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <table className="complexity">
            <tbody>
              {learn.complexity.map((c) => (
                <tr key={c.op}>
                  <td>{c.op}</td>
                  <td>
                    <b>{c.cost}</b>
                    {c.note && <span className="hint"> · {c.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pitfalls">
            <span className="aux-label">Exam tips &amp; pitfalls</span>
            <ul>
              {learn.pitfalls.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

export function OperationsPanel(props: {
  topic: TopicDef;
  instance: TopicInstance;
  values: Values;
  error: string | null;
  onField: (id: string, v: string) => void;
  onAction: (id: string) => void;
  onPreset: (label: string) => void;
}) {
  const { topic, instance, values, error } = props;
  const first = instance.actions[0]?.id;
  return (
    <section className="panel ops">
      <div className="topic-head">
        <span className="big-icon">{topic.icon}</span>
        <div>
          <h2>{topic.name}</h2>
          <p className="hint">{topic.blurb}</p>
        </div>
      </div>
      {instance.fields.length > 0 && (
        <div className="fields">
          {instance.fields.map((f) => (
            <label key={f.id} className={f.wide ? "field wide" : "field"}>
              <span>{f.label}</span>
              {f.kind === "select" ? (
                <select value={f.options?.().includes(values[f.id]) ? values[f.id] : f.options?.()[0]} onChange={(e) => props.onField(f.id, e.target.value)}>
                  {f.options?.().map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.kind === "number" ? "number" : "text"}
                  value={values[f.id] ?? ""}
                  onChange={(e) => props.onField(f.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && first && props.onAction(first)}
                />
              )}
            </label>
          ))}
        </div>
      )}
      <div className="row">
        {instance.actions.map((a) => (
          <button key={a.id} onClick={() => props.onAction(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      {instance.presets.length > 0 && (
        <div className="row presets">
          {instance.presets.map((p) => (
            <button key={p.label} className="ghost small" onClick={() => props.onPreset(p.label)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="verdict bad">{error}</p>}
    </section>
  );
}
