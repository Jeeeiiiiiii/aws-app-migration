import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Press and hold to confirm an action that can't be undone. Slow while the user is
 * deciding, instant to let go. Works with pointer, Space and Enter.
 */
export function HoldButton({
  onConfirm,
  children,
  holdMs = 1600,
  disabled,
  className = "btn danger",
}: {
  onConfirm: () => void;
  children: ReactNode;
  holdMs?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, holdMs);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      data-holding={holding}
      style={{ "--hold-ms": `${holdMs}ms` } as React.CSSProperties}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      onBlur={cancel}
    >
      <span className="hold-fill" aria-hidden />
      <span className="content">{children}</span>
    </button>
  );
}
