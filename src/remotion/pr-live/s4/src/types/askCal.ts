/* __PR_GENERIC_DEMO__ */
export type MessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

export type MessageFeedback = "up" | "down";

export type AskCalIntent =
  | "bookings"
  | "event-link"
  | "availability"
  | "event-types"
  | "fallback";
