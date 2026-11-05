import type { TaskPriority } from "./db";

export type TaskAlertPreferences = {
  enabled: boolean;
  leadMinutes: number;
  volume: number;
  browserNotifications: boolean;
};

const PREFS_KEY = "smart-trader:task-alert-preferences";
const ALERTED_KEY = "smart-trader:task-alerted";

export const DEFAULT_TASK_ALERT_PREFERENCES: TaskAlertPreferences = {
  enabled: false,
  leadMinutes: 15,
  volume: 0.65,
  browserNotifications: true,
};

export function loadTaskAlertPreferences(): TaskAlertPreferences {
  if (typeof window === "undefined") return DEFAULT_TASK_ALERT_PREFERENCES;
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as Partial<TaskAlertPreferences>;
    return {
      enabled: Boolean(parsed.enabled),
      leadMinutes: [0, 5, 15, 60, 1440].includes(Number(parsed.leadMinutes))
        ? Number(parsed.leadMinutes)
        : DEFAULT_TASK_ALERT_PREFERENCES.leadMinutes,
      volume: Math.min(1, Math.max(0, Number(parsed.volume ?? DEFAULT_TASK_ALERT_PREFERENCES.volume))),
      browserNotifications:
        parsed.browserNotifications == null
          ? DEFAULT_TASK_ALERT_PREFERENCES.browserNotifications
          : Boolean(parsed.browserNotifications),
    };
  } catch {
    return DEFAULT_TASK_ALERT_PREFERENCES;
  }
}

export function saveTaskAlertPreferences(value: TaskAlertPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("smart-trader:task-alert-preferences"));
}

export function taskAlertKey(taskId: string, dueAt: string, leadMinutes: number) {
  return `${taskId}::${dueAt}::${leadMinutes}`;
}

export function wasTaskAlerted(key: string): boolean {
  try {
    const values = JSON.parse(localStorage.getItem(ALERTED_KEY) || "[]") as string[];
    return values.includes(key);
  } catch {
    return false;
  }
}

export function markTaskAlerted(key: string) {
  let values: string[] = [];
  try {
    values = JSON.parse(localStorage.getItem(ALERTED_KEY) || "[]") as string[];
  } catch {
    values = [];
  }
  const next = [...new Set([...values.slice(-300), key])];
  localStorage.setItem(ALERTED_KEY, JSON.stringify(next));
}

function toneProfile(priority: TaskPriority) {
  if (priority === "high") return { frequency: 880, pulses: 3, duration: 0.16 };
  if (priority === "medium") return { frequency: 660, pulses: 2, duration: 0.15 };
  return { frequency: 520, pulses: 1, duration: 0.18 };
}

export async function playTaskAlertSound(priority: TaskPriority, volume: number) {
  if (typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  if (context.state === "suspended") await context.resume();
  const profile = toneProfile(priority);
  const safeVolume = Math.min(0.3, Math.max(0.01, volume * 0.3));
  for (let index = 0; index < profile.pulses; index += 1) {
    const start = context.currentTime + index * (profile.duration + 0.09);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(profile.frequency + index * 70, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(safeVolume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + profile.duration + 0.02);
  }
  window.setTimeout(() => void context.close(), 1400);
}
