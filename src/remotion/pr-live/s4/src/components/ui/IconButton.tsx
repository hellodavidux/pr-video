/* __PR_GENERIC_DEMO__ */
import type { ButtonHTMLAttributes } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton({
  label,
  className = "",
  children,
  demoState = {},
  ...props
}: IconButtonProps & { demoState?: Record<string, unknown> }) {
  const { open = false,  scheduleOpen = false,  redirectOpen = false,  typedText = '',  redirectTypedText = '',  demoHoverTrigger = false,  hoverInput = false,  demoHoverSubmit = false,  demoHoverExpand = false,  demoHoverDropdown = false,  modalEntrance = 0,  revealStep = -1,  dropdownOpen = false,  expanded = false,  showPayoff = false,  highlightTarget = '',  focusRef = '' } = demoState;
  return (
    <button
      type="button"
      aria-label={label}
      className={`rounded-md p-1.5 text-cal-muted transition hover:bg-cal-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
