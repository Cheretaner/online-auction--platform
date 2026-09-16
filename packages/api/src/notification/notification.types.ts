export interface Notification {
  id: string;
  userId: string;
  channel: "email" | "in_app";
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}
