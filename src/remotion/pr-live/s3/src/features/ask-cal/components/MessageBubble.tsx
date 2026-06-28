/* __PR_GENERIC_DEMO__ */
import type { ChatMessage, MessageFeedback } from "../../../types/askCal";
import { MessageActions } from "./MessageActions";
import { RichText } from "./RichText";

type MessageBubbleProps = {
  message: ChatMessage;
  feedback: MessageFeedback | null;
  onFeedback: (value: MessageFeedback) => void;
};

export function MessageBubble({
  message,
  feedback,
  onFeedback,
demoState = {},
}: MessageBubbleProps & { demoState?: Record<string, unknown> }) {
  const { open = false,  scheduleOpen = false,  redirectOpen = false,  typedText = '',  redirectTypedText = '',  demoHoverTrigger = false,  hoverInput = false,  demoHoverSubmit = false,  demoHoverExpand = false,  demoHoverDropdown = false,  modalEntrance = 0,  revealStep = -1,  dropdownOpen = false,  expanded = false,  showPayoff = false,  highlightTarget = '',  focusRef = '' } = demoState;
  if (message.role === "user") {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[85%] rounded-xl bg-[#2a2a2a] px-3.5 py-2.5 text-sm leading-relaxed text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative mb-8 max-w-[95%]">
      <div className="text-sm leading-relaxed text-cal-muted">
        <RichText content={message.content} />
      </div>
      <MessageActions
        content={message.content}
        feedback={feedback}
        onFeedback={onFeedback}
      />
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="mb-4 text-sm text-cal-subtle">
      <span className="animate-pulse">Thinking…</span>
    </div>
  );
}
