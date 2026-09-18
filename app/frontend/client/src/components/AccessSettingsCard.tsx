/** إدارة رمز الدخول — جزء من إعدادات دفتر الميناء، لا يحفظ الرمز ضمن بيانات العمل أو النسخة الاحتياطية. */
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pinSchema } from "@/lib/validation/schemas";

interface PinFormValues {
  currentPin: string;
  nextPin: string;
  confirmation: string;
}

export default function AccessSettingsCard() {
  const { changePin, configured } = useAccess();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema(t)),
    defaultValues: { currentPin: "", nextPin: "", confirmation: "" },
  });

  if (!configured) return null;

  const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  const submit = async (values: PinFormValues) => {
    setSaving(true);
    try {
      const changed = await changePin(values.currentPin, values.nextPin);
      if (!changed) {
        setError("currentPin", { message: t("access.currentIncorrect") });
        return;
      }
      reset();
      toast.success(t("access.changed"));
    } finally {
      setSaving(false);
    }
  };

  const pinInput = (
    name: "currentPin" | "nextPin" | "confirmation",
    id: string,
    label: string,
    autoComplete: string
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Input
            id={id}
            className="field-input"
            type="password"
            inputMode="numeric"
            autoComplete={autoComplete}
            maxLength={6}
            dir="ltr"
            value={field.value}
            onChange={e => field.onChange(digitsOnly(e.target.value))}
            onBlur={field.onBlur}
          />
        )}
      />
      {errors[name]?.message ? (
        <p className="text-[10px] font-medium text-[var(--danger)]">
          {errors[name]?.message}
        </p>
      ) : null}
    </div>
  );

  return (
    <SectionCard
      title={t("access.settingsTitle")}
      hint={t("access.settingsHint")}
      stamp={t("access.record")}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded border border-[var(--port-green)]/30 bg-[var(--port-green-soft)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--ink)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("access.settingsNote")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {pinInput("currentPin", "access-current", t("access.currentCode"), "current-password")}
          {pinInput("nextPin", "access-next", t("access.newCode"), "new-password")}
          {pinInput("confirmation", "access-confirm", t("access.confirmNewCode"), "new-password")}
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={saving}
          onClick={() => void handleSubmit(submit)()}
        >
          <KeyRound className="h-4 w-4" />
          {t("access.changeCode")}
        </Button>
      </div>
    </SectionCard>
  );
}
