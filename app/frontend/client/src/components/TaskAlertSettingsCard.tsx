import { useEffect, useState } from "react";
import { BellRing, Save, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Field, FormGrid, SectionCard } from "@/components/patterns";
import {
  DEFAULT_TASK_ALERT_PREFERENCES,
  loadTaskAlertPreferences,
  playTaskAlertSound,
  saveTaskAlertPreferences,
  type TaskAlertPreferences,
} from "@/lib/taskAlerts";

export default function TaskAlertSettingsCard() {
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState<TaskAlertPreferences>(
    DEFAULT_TASK_ALERT_PREFERENCES
  );

  useEffect(() => {
    setPreferences(loadTaskAlertPreferences());
  }, []);

  const requestNotifications = async (enabled: boolean) => {
    if (!enabled) {
      setPreferences(current => ({ ...current, browserNotifications: false }));
      return;
    }
    if (typeof Notification === "undefined") {
      toast.info(t("taskAlerts.notificationsUnsupported"));
      return;
    }
    if (Notification.permission === "granted") {
      setPreferences(current => ({ ...current, browserNotifications: true }));
      return;
    }
    const permission = await Notification.requestPermission();
    setPreferences(current => ({
      ...current,
      browserNotifications: permission === "granted",
    }));
    if (permission !== "granted") toast.info(t("taskAlerts.notificationsDenied"));
  };

  const save = () => {
    saveTaskAlertPreferences(preferences);
    toast.success(t("taskAlerts.saved"));
  };

  const testSound = async () => {
    await playTaskAlertSound("high", preferences.volume);
    toast.success(t("taskAlerts.testPlayed"));
  };

  return (
    <SectionCard
      title={t("taskAlerts.title")}
      description={t("taskAlerts.hint")}
      stamp={t("taskAlerts.stamp")}
      footer={
        <Button type="button" className="w-full" onClick={save}>
          <Save className="h-4 w-4" />
          {t("taskAlerts.save")}
        </Button>
      }
    >
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/35 px-3 py-2.5">
          <span>
            <strong className="block text-xs">{t("taskAlerts.enable")}</strong>
            <span className="text-[10px] text-muted-foreground">{t("taskAlerts.enableHint")}</span>
          </span>
          <input
            type="checkbox"
            checked={preferences.enabled}
            onChange={event =>
              setPreferences(current => ({ ...current, enabled: event.target.checked }))
            }
          />
        </label>

        <FormGrid cols={2}>
          <Field
            label={t("taskAlerts.leadTime")}
            control={
              <select
                className="field-input w-full"
                value={preferences.leadMinutes}
                onChange={event =>
                  setPreferences(current => ({
                    ...current,
                    leadMinutes: Number(event.target.value),
                  }))
                }
              >
                <option value={0}>{t("taskAlerts.atTime")}</option>
                <option value={5}>{t("taskAlerts.before5")}</option>
                <option value={15}>{t("taskAlerts.before15")}</option>
                <option value={60}>{t("taskAlerts.before60")}</option>
                <option value={1440}>{t("taskAlerts.beforeDay")}</option>
              </select>
            }
          />
          <Field
            label={t("taskAlerts.volume")}
            control={
              <div className="flex min-h-10 items-center gap-3 rounded border border-border bg-[var(--field-surface)] px-3">
                <Volume2 className="h-4 w-4 text-[var(--ink)]" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full"
                  value={preferences.volume}
                  onChange={event =>
                    setPreferences(current => ({
                      ...current,
                      volume: Number(event.target.value),
                    }))
                  }
                />
                <span className="w-10 text-end text-[10px] font-semibold">
                  {Math.round(preferences.volume * 100)}%
                </span>
              </div>
            }
          />
        </FormGrid>

        <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
          <span>
            <strong className="block text-xs">{t("taskAlerts.browserNotifications")}</strong>
            <span className="text-[10px] text-muted-foreground">{t("taskAlerts.browserNotificationsHint")}</span>
          </span>
          <input
            type="checkbox"
            checked={preferences.browserNotifications}
            onChange={event => void requestNotifications(event.target.checked)}
          />
        </label>

        <Button type="button" variant="outline" className="w-full" onClick={() => void testSound()}>
          <BellRing className="h-4 w-4" />
          {t("taskAlerts.testSound")}
        </Button>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {t("taskAlerts.browserLimit")}
        </p>
      </div>
    </SectionCard>
  );
}
