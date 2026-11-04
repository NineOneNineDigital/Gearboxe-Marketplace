import { cn } from "@/lib/utils";

interface BrandLockupProps {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
  label?: string;
}

export function BrandLockup({
  className,
  compact = false,
  inverse = false,
  label = "Market",
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className="relative flex h-8 w-8 items-center justify-center border border-primary/50 bg-primary/10"
      >
        <span className="absolute h-px w-4 bg-primary" />
        <span className="absolute h-4 w-px bg-primary" />
      </span>
      <span className="flex items-center gap-2.5">
        <span
          className={cn(
            "text-base font-extrabold uppercase tracking-[-0.04em]",
            inverse ? "text-[hsl(var(--bone))]" : "text-foreground"
          )}
        >
          Gearboxe
        </span>
        {!compact && (
          <span
            className={cn(
              "border-l pl-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em]",
              inverse
                ? "border-white/20 text-[hsl(var(--chrome))]"
                : "border-border text-muted-foreground"
            )}
          >
            {label}
          </span>
        )}
      </span>
    </span>
  );
}
