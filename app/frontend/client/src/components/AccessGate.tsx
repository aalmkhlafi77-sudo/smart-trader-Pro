/** قفل الدخول المحلي — دفتر الميناء: رمز من ستة أرقام لا يغادر هذا الجهاز. */
import { useState, type ReactNode } from "react";
import {
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/contexts/AccessContext";
import { useLoginBackground } from "@/contexts/LoginBackgroundContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrivateStorage } from "@/contexts/PrivateStorageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { PinSlots } from "@/components/PinSlots";

export default function AccessGate({ children }: { children: ReactNode }) {
  const { configured, createPin, hint, ready, unlock, unlocked } = useAccess();
  const { backgroundUrl } = useLoginBackground();
  const { direction, t } = useLanguage();
  const privateStorage = usePrivateStorage();
  const [pin, setPin] = useState("");
  const [privateUsername, setPrivateUsername] = useState("");
  const [privatePassword, setPrivatePassword] = useState("");
  const [privateSubmitting, setPrivateSubmitting] = useState(false);
  const [showPrivatePassword, setShowPrivatePassword] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wrongCode, setWrongCode] = useState(false);
  const [shakeVersion, setShakeVersion] = useState(0);

  if (!ready || !privateStorage.ready) return <div className="min-h-screen bg-[var(--paper)]" />;
  if (unlocked || privateStorage.authenticated) return <>{children}</>;

  const setup = !configured;
  const submitPrivate = async () => {
    if (!privateUsername.trim() || privatePassword.length < 8) {
      toast.error(t("access.privateInvalid"));
      return;
    }
    setPrivateSubmitting(true);
    try {
      await privateStorage.login(privateUsername.trim(), privatePassword);
      toast.success(t("access.privateOpened"));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === "TOO_MANY_ATTEMPTS"
          ? t("access.privateRateLimited")
          : t("access.privateIncorrect")
      );
    } finally {
      setPrivateSubmitting(false);
    }
  };

  const submit = async () => {
    if (pin.length !== 6 || (setup && confirmation.length !== 6)) {
      toast.error(t("access.sixDigits"));
      return;
    }
    if (setup && pin !== confirmation) {
      toast.error(t("access.mismatch"));
      setConfirmation("");
      return;
    }
    setSubmitting(true);
    try {
      if (setup) {
        await createPin(pin);
        toast.success(t("access.created"));
      } else if (await unlock(pin)) {
        toast.success(t("access.opened"));
      } else {
        toast.error(t("access.incorrect"));
        setWrongCode(true);
        setShakeVersion(version => version + 1);
        setPin("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="login-hero relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-10"
      dir={direction}
    >
      <div
        aria-hidden
        className="login-hero-image absolute inset-0"
        style={{ backgroundImage: `url(${backgroundUrl})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(115deg,rgba(9,31,48,0.86),rgba(9,31,48,0.44)_48%,rgba(5,35,46,0.76))]"
      />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col items-center justify-center py-6">
        <section
          className="glass-access-card ledger-tab relative grid w-full overflow-hidden rounded-[1rem] border border-white/40 shadow-[0_24px_70px_rgba(3,22,35,0.35)] md:grid-cols-[0.9fr_1.1fr]"
          data-document="ledger-cover"
        >
          <div
            aria-hidden
            className="absolute inset-y-0 end-0 z-10 w-1.5 bg-[var(--port-green)]"
          />
          <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
            <LanguageSwitcher tone="light" />
          </div>
          <aside className="relative overflow-hidden bg-[linear-gradient(145deg,rgba(10,42,64,0.76),rgba(10,42,64,0.55))] px-6 py-7 text-white backdrop-blur-md sm:px-9 sm:py-10">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_72%_16%,rgba(116,191,156,0.2),transparent_38%)]"
            />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div>
                <div className="flex items-center gap-3">
                  <img
                    src="/assets/port-ledger-mark.webp"
                    alt=""
                    className="brand-seal h-12 w-12 bg-[#f7f2e8] p-1.5"
                  />
                  <div>
                    <p className="font-display text-xl font-black">
                      {t("app.name")}
                    </p>
                    <p className="text-xs text-white/70">{t("app.tagline")}</p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-y border-white/15 py-2 text-[10px] font-semibold tracking-[0.14em] text-white/65">
                  <span>{t("access.record")}</span>
                  <span dir="ltr">LOCAL · 06</span>
                </div>
                <div className="mt-12 max-w-sm">
                  <div className="mb-3 flex items-center gap-2 text-[var(--port-green-soft)]">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="text-xs font-bold tracking-wide">
                      {t("access.localOnly")}
                    </span>
                  </div>
                  <h1 className="font-display text-3xl font-black leading-tight">
                    {t(setup ? "access.setupTitle" : "access.lockedTitle")}
                  </h1>
                  <p className="mt-4 text-sm leading-relaxed text-white/75">
                    {t(setup ? "access.setupText" : "access.lockedText")}
                  </p>
                </div>
                <div className="mt-7 grid grid-cols-2 border-y border-white/15 text-[10px] font-semibold tracking-[0.09em] text-white/72">
                  <div className="border-e border-white/15 px-3 py-2.5">
                    <p className="text-white/48">{t("access.record")}</p>
                    <p className="mt-1 text-white">{t("app.localSaved")}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-white/48">{t("access.localOnly")}</p>
                    <p className="mt-1 text-[var(--port-green-soft)]" dir="ltr">
                      DEVICE · 01
                    </p>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/15 pt-4 text-[11px] leading-relaxed text-white/70">
                <div className="flex items-start gap-2">
                  <img
                    src="/assets/port-ledger-mark.webp"
                    alt=""
                    className="brand-seal mt-0.5 h-7 w-7 shrink-0 bg-[#f7f2e8] p-0.5"
                  />
                  <div>
                    <p className="font-semibold text-white">
                      {t("app.localSaved")}
                    </p>
                    <p className="mt-1">{t("access.notInBackup")}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="access-form-surface relative px-5 py-7 backdrop-blur-xl sm:px-10 sm:py-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-5 top-[4.4rem] border-t border-dashed border-[var(--ink)]/20 sm:inset-x-10"
            />
            <div className="mb-8 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--ink)]">
                <div className="rounded border border-[var(--port-green)]/35 bg-[var(--port-green-soft)] p-2">
                  <LockKeyhole className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold">{t("access.record")}</span>
              </div>
            </div>

            <div className="max-w-md pt-4">
              <div className="access-document-band mb-5 flex items-center justify-between gap-3 text-[10px] font-bold tracking-[0.12em] text-[var(--ink)]">
                <span>{t("access.record")}</span>
                <span className="ledger-figure" dir="ltr">
                  LOCAL / 06
                </span>
              </div>
              <h2 className="font-display text-2xl font-black text-[var(--ink-deep)]">
                {t(setup ? "access.createCode" : "access.enterCode")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(setup ? "access.createHint" : "access.enterHint")}
              </p>

              <div
                key={shakeVersion}
                className={
                  wrongCode ? "access-shake mt-7 space-y-5" : "mt-7 space-y-5"
                }
              >
                <PinSlots
                  value={pin}
                  onChange={value => {
                    setPin(value);
                    setWrongCode(false);
                  }}
                  label={t("access.codeLabel")}
                />
                {setup ? (
                  <PinSlots
                    value={confirmation}
                    onChange={value => {
                      setConfirmation(value);
                      setWrongCode(false);
                    }}
                    label={t("access.confirmLabel")}
                  />
                ) : null}

                {!setup ? (
                  <div className="rounded border border-border bg-secondary/45 px-3 py-2.5">
                    {showHint ? (
                      <p className="text-xs text-[var(--ink)]">
                        {t("access.lastDigits")}:{" "}
                        <strong className="ledger-figure" dir="ltr">
                          {hint}
                        </strong>
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-[var(--ink)]"
                        onClick={() => setShowHint(true)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t("access.remind")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="rounded border border-[var(--field-border)] bg-[var(--field-surface)] px-3 py-2.5 text-xs leading-relaxed text-[var(--guidance)]">
                    {t("access.setupNote")}
                  </p>
                )}

                <Button
                  className="glass-login-submit w-full border border-white/50 !bg-[var(--port-green)] !text-white shadow-[0_10px_28px_rgba(4,28,43,0.3)] backdrop-blur-md hover:!bg-[color-mix(in_oklab,var(--port-green)_84%,var(--ink))]"
                  size="lg"
                  disabled={submitting}
                  onClick={() => void submit()}
                >
                  <KeyRound className="h-4 w-4" />
                  {t(setup ? "access.saveCode" : "access.open")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
                {privateStorage.databaseReady ? (
                  <div className="mt-6 space-y-3 border-t border-border pt-5">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-[var(--port-green)]" />
                      <div>
                        <p className="text-sm font-bold text-[var(--ink-deep)]">{t("access.privateTitle")}</p>
                        <p className="text-[11px] text-muted-foreground">{t("access.privateHint")}</p>
                      </div>
                    </div>
                    <Input
                      value={privateUsername}
                      onChange={event => setPrivateUsername(event.target.value)}
                      placeholder={t("access.privateUsername")}
                      autoComplete="username"
                    />
                    <div className="relative">
                      <Input
                        type={showPrivatePassword ? "text" : "password"}
                        className="pe-10"
                        value={privatePassword}
                        onChange={event => setPrivatePassword(event.target.value)}
                        placeholder={t("access.privatePassword")}
                        autoComplete="current-password"
                        onKeyDown={event => {
                          if (event.key === "Enter") void submitPrivate();
                        }}
                      />
                      <button
                        type="button"
                        className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPrivatePassword(value => !value)}
                        aria-label={showPrivatePassword ? t("access.hidePassword") : t("access.showPassword")}
                      >
                        {showPrivatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={privateSubmitting}
                      onClick={() => void submitPrivate()}
                    >
                      <Cloud className="h-4 w-4" />
                      {t("access.privateOpen")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
        <p
          className="mt-4 rounded-full border border-white/25 bg-[rgba(7,35,52,0.42)] px-4 py-1.5 text-[10px] font-medium tracking-[0.12em] text-white/90 backdrop-blur-md"
          dir="ltr"
        >
          Design Abdullah Almkhlafi 2026
        </p>
      </div>
    </main>
  );
}
