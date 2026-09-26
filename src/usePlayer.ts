import { useCallback, useEffect, useMemo, useState } from "react";
import type { Run } from "./algorithms/types";

export interface Answer {
  choice: string;
  correct: boolean;
}

export interface Player {
  run: Run;
  index: number;
  playing: boolean;
  speed: number;
  /** Pause at each question until it is answered. */
  questionsOn: boolean;
  answers: Record<number, Answer>;
  /** True while playback waits for the current question to be answered. */
  blocked: boolean;
  atEnd: boolean;
  setSpeed: (s: number) => void;
  setQuestionsOn: (on: boolean) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (i: number) => void;
  answer: (choice: string) => void;
}

/** Milliseconds per step at 1× speed. */
export const BASE_MS = 1300;

export function usePlayer(run: Run): Player {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [questionsOn, setQuestionsOn] = useState(true);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});

  // New run → start from the top.
  useEffect(() => {
    setIndex(0);
    setAnswers({});
    setPlaying(run.frames.length > 1);
  }, [run]);

  const frame = run.frames[index];
  const atEnd = index >= run.frames.length - 1;
  const blocked = questionsOn && !!frame?.question && !answers[index];

  const next = useCallback(() => {
    if (blocked) return;
    setIndex((i) => Math.min(i + 1, run.frames.length - 1));
  }, [blocked, run]);
  const prev = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);
  const seek = useCallback(
    (i: number) => {
      setPlaying(false);
      // With questions on, you can't scrub past an unanswered question.
      if (questionsOn) {
        const gate = run.frames.findIndex((f, k) => k >= index && k < i && f.question && !answers[k]);
        if (gate !== -1) i = gate;
      }
      setIndex(Math.max(0, Math.min(i, run.frames.length - 1)));
    },
    [questionsOn, run, index, answers],
  );

  useEffect(() => {
    if (!playing) return;
    if (atEnd || blocked) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(next, BASE_MS / speed);
    return () => clearTimeout(t);
  }, [playing, atEnd, blocked, next, speed, index]);

  const answer = useCallback(
    (choice: string) => {
      const q = run.frames[index]?.question;
      if (!q || answers[index]) return;
      setAnswers((a) => ({ ...a, [index]: { choice, correct: choice === q.answer } }));
    },
    [run, index, answers],
  );

  return useMemo(
    () => ({
      run,
      index,
      playing,
      speed,
      questionsOn,
      answers,
      blocked,
      atEnd,
      setSpeed,
      setQuestionsOn,
      play: () => {
        if (atEnd) setIndex(0);
        setPlaying(true);
      },
      pause: () => setPlaying(false),
      next,
      prev,
      seek,
      answer,
    }),
    [run, index, playing, speed, questionsOn, answers, blocked, atEnd, next, prev, seek, answer],
  );
}
