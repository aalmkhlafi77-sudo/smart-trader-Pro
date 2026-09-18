/**
 * نظام الأنماط — منتقيات قائمة قابلة للبحث (cmdk): Picker عام،
 * وEntityPicker/ItemPicker اسمان دلاليان لنفس البنية لتوحيد الاستدعاء في الشاشات.
 */
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickerOption = { value: string; label: string; hint?: string };

export type PickerProps = {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  className?: string;
};

export function Picker({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
  className,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "field-input h-auto min-h-10 w-full justify-between font-normal",
            className
          )}
        >
          <span
            className={cn(
              "truncate",
              selected ? "text-[var(--ink)]" : "text-[var(--guidance)]"
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="ms-auto shrink-0 text-[10px] text-[var(--guidance)]">
                      {option.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const EntityPicker = (props: PickerProps) => <Picker {...props} />;
export const ItemPicker = (props: PickerProps) => <Picker {...props} />;
