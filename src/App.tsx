import { useEffect, useMemo, useRef, useState } from "react";
import type { Run } from "./algorithms/types";
import { CodePanel, ConceptPanel, Controls, DataPanel, Legend, Narration, OperationsPanel, QuestionCard, StepExplainer } from "./components/Panels";
import { QuizPanel } from "./components/Quiz";
import { Scene } from "./components/Scene";
import { CATEGORIES, TOPICS } from "./topics";
import type { TopicInstance, Values } from "./topics/types";
import { usePlayer } from "./usePlayer";

const LAST_TOPIC = "algoverse.topic";

function initialTopic(): string {
  try {
    const t = localStorage.getItem(LAST_TOPIC);
    if (t && TOPICS.some((x) => x.id === t)) return t;
  } catch {
    // ignore
  }
  return TOPICS[0].id;
}

export default function App() {
  const [topicId, setTopicId] = useState(initialTopic);
  const instances = useRef(new Map<string, TopicInstance>());
  const instance = useMemo(() => {
    let inst = instances.current.get(topicId);
    if (!inst) {
      inst = TOPICS.find((t) => t.id === topicId)!.create();
      instances.current.set(topicId, inst);
    }
    return inst;
  }, [topicId]);
  const topic = TOPICS.find((t) => t.id === topicId)!;

  const [values, setValues] = useState<Record<string, Values>>({});
  const topicValues = useMemo(() => ({ ...Object.fromEntries(instance.fields.map((f) => [f.id, f.default])), ...values[topicId] }), [instance, values, topicId]);
  const [run, setRun] = useState<Run>(() => instance.view());
  const [error, setError] = useState<string | null>(null);
  const [freeCam, setFreeCam] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lastAction = useRef<string | null>(null);

  const flash = (msg: string, ms = 5000) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  };

  useEffect(() => {
    try {
      localStorage.setItem(LAST_TOPIC, topicId);
    } catch {
      // ignore
    }
    lastAction.current = null;
    setError(null);
    setRun(instance.view());
  }, [instance, topicId]);

  const player = usePlayer(run);

  const setField = (id: string, v: string) => setValues((all) => ({ ...all, [topicId]: { ...all[topicId], [id]: v } }));

  const doAction = (actionId: string, vals = topicValues) => {
    const a = instance.actions.find((x) => x.id === actionId);
    if (!a) return;
    const r = a.run(vals);
    if (typeof r === "string") {
      setError(r);
      return;
    }
    setError(null);
    lastAction.current = actionId;
    setRun(r);
  };

  const doPreset = (label: string) => {
    const p = instance.presets.find((x) => x.label === label);
    if (!p) return;
    const vals = { ...topicValues, ...p.fill };
    if (p.fill) setValues((all) => ({ ...all, [topicId]: { ...all[topicId], ...p.fill } }));
    setError(null);
    lastAction.current = null;
    setRun(p.run(vals));
  };

  const onPick = instance.pickField
    ? (id: string) => {
        const vals = { ...topicValues, [instance.pickField!]: id };
        setField(instance.pickField!, id);
        if (lastAction.current) doAction(lastAction.current, vals);
        else flash(`Start set to ${id}. Now pick an algorithm.`, 2500);
      }
    : undefined;

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">◆</span> AlgoVerse <b>3D</b>
        </div>
        <select className="topic-select" value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Topic">
          {CATEGORIES.map((c) => (
            <optgroup key={c} label={c}>
              {TOPICS.filter((t) => t.category === c).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </header>

      <main>
        <nav className="topics" aria-label="Topics">
          {CATEGORIES.map((c) => (
            <div key={c} className="cat">
              <div className="cat-name">{c}</div>
              {TOPICS.filter((t) => t.category === c).map((t) => (
                <button key={t.id} className={t.id === topicId ? "topic on" : "topic"} onClick={() => setTopicId(t.id)} title={t.blurb}>
                  <span className="ticon">{t.icon}</span>
                  <span className="tname">{t.name}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="stage">
          <div className="canvas-wrap">
            <Scene run={run} index={player.index} speed={player.speed} freeCam={freeCam} hideCallouts={player.blocked} onPick={onPick} />
            <div className="overlay-top">
              <div className="overlay-left">
                <div className="title-row">
                  <span className="run-title">{run.title}</span>
                  {run.complexity && <span className="complexity-chip">{run.complexity}</span>}
                </div>
                <Legend run={run} />
              </div>
              <label className="toggle small">
                <input type="checkbox" checked={freeCam} onChange={(e) => setFreeCam(e.target.checked)} />
                Free camera
              </label>
            </div>
          </div>
          <Narration player={player} />
          <Controls player={player} />
        </div>

        <aside>
          <OperationsPanel topic={topic} instance={instance} values={topicValues} error={error} onField={setField} onAction={(id) => doAction(id)} onPreset={doPreset} />
          <ConceptPanel topicId={topicId} />
          <QuestionCard player={player} />
          {run.code.length > 0 && <CodePanel player={player} />}
          <DataPanel player={player} />
          {run.code.length > 0 && <StepExplainer player={player} />}
          <QuizPanel topic={topic} />
        </aside>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
