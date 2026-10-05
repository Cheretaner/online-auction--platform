export interface TelegramLinkToken {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface TelegramUserProfile {
  id: string;
  email: string;
  fullName: string;
  verificationStatus: string;
  telegramId: string | null;
  telegramUsername: string | null;
  telegramChatId: string | null;
  telegramLinkedAt: string | null;
  telegramLanguage: TelegramLanguage;
}

export type TelegramLanguage = "en" | "am";

export type VoiceIntent = "bid" | "discover" | "status" | "verify" | "help" | "question";

export interface VoiceParseResult {
  transcription: string;
  intent: VoiceIntent;
  available?: boolean;
  provider?: string;
  auctionId?: string | null;
  auctionNumber?: number | null;
  amount?: string | null;
  language?: string;
  details?: string | null;
}

export interface TelegramChannelPost {
  auctionId: string;
  channelId: string;
  messageId: number;
  postedAt: Date;
  updatedAt: Date;
}

export interface TelegramNotificationPayload {
  title: string;
  message: string;
  type: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}
