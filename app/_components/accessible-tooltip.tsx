"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "cnfast";

type AccessibleTooltipProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly content: string;
};

export function AccessibleTooltip({ children, className, content }: AccessibleTooltipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const lastPointerTypeRef = useRef<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !tooltipRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const gutter = 12;
    const gap = 8;
    const left = Math.min(
      Math.max(gutter, trigger.left),
      Math.max(gutter, window.innerWidth - tooltip.width - gutter),
    );
    const below = trigger.bottom + gap;
    const top = below + tooltip.height <= window.innerHeight - gutter
      ? below
      : Math.max(gutter, trigger.top - tooltip.height - gap);
    setPosition({ left, top });
  }, [content, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) setIsOpen(false);
    }

    function closeWhenPositionChanges() {
      setIsOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("scroll", closeWhenPositionChanges, true);
    window.addEventListener("resize", closeWhenPositionChanges);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("scroll", closeWhenPositionChanges, true);
      window.removeEventListener("resize", closeWhenPositionChanges);
    };
  }, [isOpen]);

  function rememberPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    lastPointerTypeRef.current = event.pointerType;
  }

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-flex min-w-0", className)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setIsOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && document.activeElement !== triggerRef.current) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        className="min-w-0 cursor-help border-0 bg-transparent p-0 text-inherit [font:inherit] [text-align:inherit]"
        type="button"
        aria-describedby={isOpen ? tooltipId : undefined}
        onBlur={() => setIsOpen(false)}
        onClick={() => {
          if (lastPointerTypeRef.current === "touch" || lastPointerTypeRef.current === "pen") {
            setIsOpen((current) => !current);
          }
          else {
            setIsOpen(true);
          }
          lastPointerTypeRef.current = null;
        }}
        onFocus={() => {
          if (lastPointerTypeRef.current !== "touch" && lastPointerTypeRef.current !== "pen") {
            setIsOpen(true);
          }
        }}
        onPointerDown={rememberPointer}
      >
        {children}
      </button>
      {isOpen ? (
        <span ref={tooltipRef} id={tooltipId} className="fixed z-1000 w-max max-w-[min(360px,calc(100vw-24px))] rounded-lg bg-navy-deep px-3 py-2.5 text-left text-[0.76rem] font-semibold leading-[1.65] tracking-[0.02em] text-white shadow-[0_10px_28px_rgb(16_38_59/24%)]" role="tooltip" style={position}>
          {content}
        </span>
      ) : null}
    </span>
  );
}
