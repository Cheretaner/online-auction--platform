const notifications = new Map<string, import("./notification.types.js").Notification>();

export async function insertNotification(
  notification: import("./notification.types.js").Notification,
): Promise<void> {
  notifications.set(notification.id, notification);
}

export async function listByUser(userId: string) {
  return [...notifications.values()].filter((n) => n.userId === userId);
}
