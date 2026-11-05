import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_ALERT_PREFERENCES,
  loadTaskAlertPreferences,
  markTaskAlerted,
  saveTaskAlertPreferences,
  taskAlertKey,
  wasTaskAlerted,
} from "./taskAlerts";

describe("task alert preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and reloads alert preferences", () => {
    const prefs = {
      enabled: true,
      leadMinutes: 60,
      volume: 0.4,
      browserNotifications: false,
    };
    saveTaskAlertPreferences(prefs);
    expect(loadTaskAlertPreferences()).toEqual(prefs);
  });

  it("falls back to safe defaults for unsupported values", () => {
    localStorage.setItem(
      "smart-trader:task-alert-preferences",
      JSON.stringify({ enabled: true, leadMinutes: 7, volume: 9 })
    );
    expect(loadTaskAlertPreferences()).toEqual({
      ...DEFAULT_TASK_ALERT_PREFERENCES,
      enabled: true,
      volume: 1,
    });
  });

  it("marks a task deadline as alerted only for its exact schedule", () => {
    const first = taskAlertKey("task-1", "2026-11-05T13:00", 15);
    const moved = taskAlertKey("task-1", "2026-11-05T14:00", 15);
    expect(wasTaskAlerted(first)).toBe(false);
    markTaskAlerted(first);
    expect(wasTaskAlerted(first)).toBe(true);
    expect(wasTaskAlerted(moved)).toBe(false);
  });
});
