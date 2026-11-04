import { useState } from "react";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccess } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrivateStorage } from "@/contexts/PrivateStorageContext";

export default function PrivateAccountSettingsCard() {
  const { t } = useLanguage();
  const privateStorage = usePrivateStorage();
  const { lock } = useAccess();
  const [currentPassword, setCurrentPassword] = useState("");
  const [username, setUsername] = useState(privateStorage.username);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  if (!privateStorage.authenticated) return null;

  const submit = async () => {
    if (!currentPassword) {
      toast.error(t("access.privateCurrentRequired"));
      return;
    }
    const usernameChanged = username.trim() && username.trim() !== privateStorage.username;
    const passwordChanged = password.length > 0;
    if (!usernameChanged && !passwordChanged) {
      toast.error(t("access.privateNothingToChange"));
      return;
    }
    if (passwordChanged && password.length < 8) {
      toast.error(t("access.privatePasswordMin"));
      return;
    }
    if (passwordChanged && password !== confirmation) {
      toast.error(t("access.privatePasswordMismatch"));
      return;
    }

    setSaving(true);
    try {
      await privateStorage.updateAccount({
        currentPassword,
        username: usernameChanged ? username.trim() : undefined,
        password: passwordChanged ? password : undefined,
      });
      toast.success(t("access.privateCredentialsChanged"));
      lock();
      window.location.reload();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "CURRENT_PASSWORD_INCORRECT") {
        toast.error(t("access.privateCurrentIncorrect"));
      } else if (code === "USERNAME_EXISTS") {
        toast.error(t("access.privateUsernameExists"));
      } else {
        toast.error(t("access.privateCredentialsFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title={t("access.privateAccountSettings")}
      hint={t("access.privateAccountSettingsHint")}
      stamp={t("access.privateMode")}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded border border-[var(--port-green)]/30 bg-[var(--port-green-soft)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--ink)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("access.privateCredentialsNote")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="private-username">{t("access.privateUsername")}</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="private-username"
                className="field-input ps-9"
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoComplete="username"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="private-current-password">{t("access.privateCurrentPassword")}</Label>
            <Input
              id="private-current-password"
              className="field-input"
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="private-new-password">{t("access.privateNewPassword")}</Label>
            <Input
              id="private-new-password"
              className="field-input"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={t("access.privateKeepPassword")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="private-confirm-password">{t("access.privateConfirmPassword")}</Label>
            <Input
              id="private-confirm-password"
              className="field-input"
              type="password"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={saving}
          onClick={() => void submit()}
        >
          <KeyRound className="h-4 w-4" />
          {t("access.privateSaveCredentials")}
        </Button>
      </div>
    </SectionCard>
  );
}
