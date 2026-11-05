import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { db, type TaskRow } from "@/lib/db";
import {
  loadTaskAlertPreferences,
  markTaskAlerted,
  playTaskAlertSound,
  taskAlertKey,
  wasTaskAlerted,
} from "@/lib/taskAlerts";

const CHECK_INTERVAL_MS = 15000;
const OVERDUE_GRACE_MS = 60 * 60 * 1000;

function dueTimestamp(task: TaskRow) {
  if (!task.dueAt) return NaN;
  const value = new Date(task.dueAt).getTime();
  return Number.isFinite(value) ? value : NaN;
}

export default function TaskAlertEngine() {
  const { t } = useLanguage();
  const [revision, setRevision] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    const onPreferences = () => setRevision(value => value + 1);
    window.addEventListener("smart-trader:task-alert-preferences", onPreferences);
    return () => window.removeEventListener("smart-trader:task-alert-preferences", onPreferences);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (running.current || cancelled) return;
      const preferences = loadTaskAlertPreferences();
      if (!preferences.enabled) return;
      running.current = true;
      try {
        const tasks = await db.listTasks();
        const now = Date.now();
        const active = tasks
          .filter(task => !task.completedAt && task.dueAt)
          .sort((left, right) => left.dueAt.localeCompare(right.dueAt));

        for (const task of active) {
          const due = dueTimestamp(task);
          if (!Number.isFinite(due)) continue;
          const triggerAt = due - preferences.leadMinutes * 60 * 1000;
          if (now < triggerAt || now > due + OVERDUE_GRACE_MS) continue;
          const key = taskAlertKey(task.id, task.dueAt, preferences.leadMinutes);
          if (wasTaskAlerted(key)) continue;

          await playTaskAlertSound(task.priority, preferences.volume);

          if (
            preferences.browserNotifications &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            const priorityLabel = t(`followup.priority${task.priority[0].toUpperCase()}${task.priority.slice(1)}`);
            const body = `${t("taskAlerts.due")}: ${new Date(due).toLocaleString()} · ${priorityLabel}`;
            new Notification(task.title, {
              body,
              icon: "/assets/port-ledger-mark.webp",
              tag: `task-${task.id}`,
            });
          }

          markTaskAlerted(key);
          window.dispatchEvent(
            new CustomEvent("smart-trader:task-alert-fired", {
              detail: { taskId: task.id, title: task.title },
            })
          );
        }
      } finally {
        running.current = false;
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [revision, t]);

  return null;
}
