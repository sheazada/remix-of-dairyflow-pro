import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

/**
 * Theme toggle with three states: light / dark / system.
 * Click cycles: light → dark → system → light.
 */
export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(theme);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
  };

  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  const label =
    theme === "dark" ? "Dark" : theme === "system" ? "System" : "Light";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-2 h-9", className)}
      onClick={cycleTheme}
      aria-label={`Theme: ${label}. Click to switch.`}
      title={`Theme: ${label} — click to switch`}
    >
      <Icon className="size-4" />
      {showLabel && <span className="text-xs">{label}</span>}
    </Button>
  );
}

/**
 * Menu-friendly variant — one button per theme (used in the user dropdown).
 */
export function ThemeMenuItems({ onDismiss }: { onDismiss?: () => void }) {
  const { theme, setTheme } = useTheme();

  const items: Array<{ value: "light" | "dark" | "system"; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <>
      {items.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => {
              setTheme(value);
              onDismiss?.();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground font-medium",
            )}
            aria-pressed={active}
            role="menuitemradio"
          >
            <Icon className="size-4" />
            <span>{label}</span>
            {active && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </button>
        );
      })}
    </>
  );
}
