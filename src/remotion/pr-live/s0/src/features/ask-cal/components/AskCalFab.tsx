/* __PR_GENERIC_DEMO__ */
import { Sparkles } from "lucide-react";

type AskCalFabProps = {
  onClick: () => void;
};

export function AskCalFab({ onClick , demoState = {}}: AskCalFabProps & { demoState?: Record<string, unknown> }) {
  const { open = false,  scheduleOpen = false,  redirectOpen = false,  typedText = '',  redirectTypedText = '',  demoHoverTrigger = false,  hoverInput = false,  demoHoverSubmit = false,  demoHoverExpand = false,  demoHoverDropdown = false,  modalEntrance = 0,  revealStep = -1,  dropdownOpen = false,  expanded = false,  showPayoff = false,  highlightTarget = '',  focusRef = '' } = demoState;
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-lg border border-cal-border bg-cal-elevated px-3.5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-zinc-800"
    >
      <Sparkles className="h-4 w-4 text-cal-muted" />
      Ask Cal
    </button>
  );
}
