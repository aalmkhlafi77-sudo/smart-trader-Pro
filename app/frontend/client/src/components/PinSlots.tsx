import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export function PinSlots({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-[var(--ink)]">
        {label}
      </label>
      <InputOTP
        maxLength={6}
        value={value}
        onChange={next => onChange(next.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        containerClassName="w-full justify-center"
      >
        <InputOTPGroup className="gap-1.5 sm:gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot
              key={index}
              index={index}
              masked
              className="h-11 w-10 rounded border border-[var(--amber-line)] bg-[var(--amber-field)] text-base font-black text-[var(--ink)] first:rounded last:rounded sm:h-12 sm:w-11"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
