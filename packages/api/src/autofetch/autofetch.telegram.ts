/**
 * AutoFetch Telegram Integration
 * Sends autofetch status updates and notifications to Telegram
 * Allows officers to trigger fetches and admins to get status updates
 */

import { logger } from '../shared/utils/logger.js';

/**
 * Format autofetch status for Telegram message
 */
export function formatFetchStatusMessage(result: {
  queued: number;
  conflicts: number;
  errors: number;
}): string {
  const parts = [
    '✅ <b>AutoFetch Completed</b>',
    '',
    `📦 Items Queued: <code>${result.queued}</code>`,
    `⚠️ Conflicts Found: <code>${result.conflicts}</code>`,
    `❌ Errors: <code>${result.errors}</code>`,
  ];

  return parts.join('\n');
}

/**
 * Format conflict summary for Telegram message
 */
export function formatConflictSummaryMessage(summary: {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}): string {
  const parts = [
    '🚨 <b>Conflict Summary</b>',
    '',
    `Total: <code>${summary.total}</code>`,
    `🔴 Critical: <code>${summary.critical}</code>`,
    `🟠 High: <code>${summary.high}</code>`,
    `🟡 Medium: <code>${summary.medium}</code>`,
    `🟢 Low: <code>${summary.low}</code>`,
  ];

  return parts.join('\n');
}

/**
 * Format pending queue status for Telegram message
 */
export function formatPendingQueueMessage(stats: {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}): string {
  const parts = [
    '📋 <b>Pending Queue Status</b>',
    '',
    `Total Items: <code>${stats.total}</code>`,
    `⏳ Pending Review: <code>${stats.pending}</code>`,
    `✅ Approved: <code>${stats.approved}</code>`,
    `❌ Rejected: <code>${stats.rejected}</code>`,
  ];

  return parts.join('\n');
}

/**
 * Format approval notification for Telegram message
 */
export function formatApprovalNotification(item: {
  title: string;
  auctionId: string;
  reviewer: string;
}): string {
  const parts = [
    '✅ <b>Item Approved</b>',
    '',
    `Title: <code>${escapeHtml(item.title)}</code>`,
    `Auction: <code>${item.auctionId}</code>`,
    `Approved by: <code>${item.reviewer}</code>`,
  ];

  return parts.join('\n');
}

/**
 * Format rejection notification for Telegram message
 */
export function formatRejectionNotification(item: {
  title: string;
  reason: string;
  reviewer: string;
}): string {
  const parts = [
    '❌ <b>Item Rejected</b>',
    '',
    `Title: <code>${escapeHtml(item.title)}</code>`,
    `Reason: <code>${escapeHtml(item.reason)}</code>`,
    `Rejected by: <code>${item.reviewer}</code>`,
  ];

  return parts.join('\n');
}

/**
 * Format source created notification for Telegram message
 */
export function formatSourceCreatedMessage(source: {
  name: string;
  adapterType: string;
  organizationId: string;
}): string {
  const parts = [
    '➕ <b>New Data Source Created</b>',
    '',
    `Name: <code>${escapeHtml(source.name)}</code>`,
    `Type: <code>${source.adapterType}</code>`,
    `Organization: <code>${source.organizationId}</code>`,
  ];

  return parts.join('\n');
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper to send message to Telegram channel
 * Requires Telegram service instance
 */
export async function sendTelegramMessage(
  message: string,
  channelId?: string
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { telegramService } = await import('../telegram/telegram.service.js');

    const bot = telegramService.getBotInstance?.();
    if (!bot) {
      logger.warn({
        event: 'autofetch:telegram:no_bot',
      });
      return;
    }

    if (!channelId) {
      logger.debug({
        event: 'autofetch:telegram:no_channel',
      });
      return;
    }

    await bot.telegram.sendMessage(channelId, message, {
      parse_mode: 'HTML',
    });

    logger.debug({
      event: 'autofetch:telegram:message_sent',
      channelId,
    });
  } catch (error) {
    logger.error({
      event: 'autofetch:telegram:send_error',
      error,
    });
  }
}

/**
 * Notify Telegram channel about fetch completion
 */
export async function notifyFetchCompleted(
  result: { queued: number; conflicts: number; errors: number },
  channelId?: string
): Promise<void> {
  const message = formatFetchStatusMessage(result);
  await sendTelegramMessage(message, channelId);
}

/**
 * Notify Telegram channel about pending queue status
 */
export async function notifyPendingQueueStatus(
  stats: { total: number; pending: number; approved: number; rejected: number },
  channelId?: string
): Promise<void> {
  const message = formatPendingQueueMessage(stats);
  await sendTelegramMessage(message, channelId);
}

/**
 * Notify Telegram channel about item approval
 */
export async function notifyItemApproved(
  item: { title: string; auctionId: string; reviewer: string },
  channelId?: string
): Promise<void> {
  const message = formatApprovalNotification(item);
  await sendTelegramMessage(message, channelId);
}

/**
 * Notify Telegram channel about item rejection
 */
export async function notifyItemRejected(
  item: { title: string; reason: string; reviewer: string },
  channelId?: string
): Promise<void> {
  const message = formatRejectionNotification(item);
  await sendTelegramMessage(message, channelId);
}

/**
 * Notify Telegram channel about new source creation
 */
export async function notifySourceCreated(
  source: { name: string; adapterType: string; organizationId: string },
  channelId?: string
): Promise<void> {
  const message = formatSourceCreatedMessage(source);
  await sendTelegramMessage(message, channelId);
}
