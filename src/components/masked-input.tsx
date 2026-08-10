import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MaskFn = (value: string) => string;

export type MaskedInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Function that returns the masked display value (only used when the field is unfocused and not "revealed"). */
  mask: MaskFn;
  /** When true, this field is treated as sensitive: masked while blurred, cleartext while focused or when user taps the eye. */
  sensitive?: boolean;
  /** Force-uppercase user input (useful for GSTIN, PAN, IFSC). */
  uppercase?: boolean;
  invalid?: boolean;
};

/**
 * Input that keeps sensitive text (GSTIN, PAN, account number, IFSC, UPI VPA) masked while editing.
 * The raw value stays in the parent's state; masking is purely visual so parsing/saving is unaffected.
 */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(function MaskedInput(
  { mask, sensitive = true, uppercase, invalid, className, onFocus, onBlur, onChange, value, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const raw = (value ?? "") as string;
  const shouldMask = sensitive && !focused && !revealed && raw.length > 0;
  const displayed = shouldMask ? mask(raw) : raw;

  return (
    <div className="relative">
      <Input
        {...rest}
        ref={ref}
        // Prevent password-manager autofill on masked sensitive fields.
        autoComplete={rest.autoComplete ?? "off"}
        spellCheck={false}
        value={displayed}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onChange={(e) => {
          // While masked, ignore edits — the visible text isn't the real value.
          if (shouldMask) return;
          if (uppercase) {
            const upper = e.target.value.toUpperCase();
            if (upper !== e.target.value) {
              e.target.value = upper;
            }
          }
          onChange?.(e);
        }}
        className={cn(
          sensitive && "pr-9 font-mono tracking-wide",
          invalid && "border-destructive focus-visible:ring-destructive/40",
          className,
        )}
      />
      {sensitive && raw.length > 0 && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={revealed ? "Hide value" : "Reveal value"}
          tabIndex={-1}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
    </div>
  );
});
