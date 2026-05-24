import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Bot } from '../database/schema';

export interface AlertPayload {
  botId: string;
  botName: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  extra?: Record<string, any>;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly queue: AlertPayload[] = [];
  private sending = false;

  // ── Send a Markdown alert to a Telegram chat via bot token ────────────────
  async sendAlert(bot: Bot, text: string): Promise<void> {
    if (!bot.alertChatId) return;

    const payload: AlertPayload = {
      botId: bot.id,
      botName: bot.name,
      level: 'info',
      message: text,
    };

    this.queue.push(payload);
    this.processQueue(bot.token, bot.alertChatId);
  }

  async sendRawAlert(token: string, chatId: string, text: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }, { timeout: 5000 });
      return true;
    } catch (err) {
      this.logger.warn(`Alert failed: ${err?.message}`);
      return false;
    }
  }

  // ── Dedicated "admin bot" alert (use a separate bot token for system alerts) ─
  async sendSystemAlert(text: string): Promise<void> {
    const adminToken = process.env.ALERT_BOT_TOKEN;
    const adminChat = process.env.ALERT_CHAT_ID;
    if (!adminToken || !adminChat) return;

    await this.sendRawAlert(adminToken, adminChat, text);
  }

  private async processQueue(token: string, chatId: string) {
    if (this.sending) return;
    this.sending = true;

    while (this.queue.length > 0) {
      const alert = this.queue.shift();
      if (!alert) break;

      const text =
        `🤖 *${this.escape(alert.botName)}*\n` +
        `${alert.message}`;

      await this.sendRawAlert(token, chatId, text);
      // Respect Telegram rate limit: 30 msg/sec per bot
      await this.sleep(100);
    }

    this.sending = false;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private escape(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
}
