// Lightweight event bus to emit notifications from anywhere in the app
// The Notifications Center hook listens and persists.

export type NotificationCategory = "commercial" | "finance" | "project" | "system" | "support";
export type NotificationType = "info" | "success" | "warning" | "danger";
export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface NotifyPayload {
  title: string;
  description?: string;
  category: NotificationCategory;
  type?: NotificationType;
  priority?: NotificationPriority;
  actionLabel?: string;
  actionRoute?: string;
  sourceId?: string;
  sourceType?: string;
}

export const NOTIFY_EVENT = "orbyt:notify";

export function emitNotification(payload: NotifyPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NotifyPayload>(NOTIFY_EVENT, { detail: payload }));
}
