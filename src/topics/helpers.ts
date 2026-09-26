import type { Frame, Run } from "../algorithms/types";

export function still(title: string, frame: Frame): Run {
  return { title, variant: "", code: [], frames: [frame] };
}

export function num(v: string | undefined, name: string, lo = -999, hi = 999): number | string {
  const n = Number(v);
  if (v === undefined || v.trim() === "" || !Number.isInteger(n)) return `${name} must be a whole number.`;
  if (n < lo || n > hi) return `${name} must be between ${lo} and ${hi}.`;
  return n;
}

export function numList(v: string | undefined, name: string, min = 2, max = 12, lo = 0, hi = 99): number[] | string {
  const parts = (v ?? "").split(/[\s,]+/).filter(Boolean);
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) return `${name} must be whole numbers separated by commas.`;
  if (nums.length < min || nums.length > max) return `${name} needs ${min} to ${max} numbers.`;
  if (nums.some((n) => n < lo || n > hi)) return `${name} values must be between ${lo} and ${hi}.`;
  return nums;
}
