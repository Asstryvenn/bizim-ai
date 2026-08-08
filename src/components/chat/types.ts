import type { ChatMessage } from "@/types";

export type MessageStatus = "pending" | "streaming" | "done" | "error";

/** ChatMessage + состояние, которое существует только в браузере (не пишется в БД). */
export interface UIMessage extends ChatMessage {
  status?: MessageStatus;
  errorText?: string;
}

export type ReactionMap = Record<string, "up" | "down">;
