import { prisma } from '../utils/prisma';

export type NotifChannel = 'both' | 'email' | 'push' | 'none';
export type NotifCategory = 'WITHDRAWALS' | 'DEPOSITS' | 'ORDER_MATCH' | 'PAYMENTS' | 'P2P_COMPLETED' | 'CANCELLATIONS' | 'DISPUTES';
type NotifPreferences = Record<string, NotifChannel>;

const DEFAULTS: NotifPreferences = {
  WITHDRAWALS: 'both',
  DEPOSITS: 'both',
  ORDER_MATCH: 'both',
  PAYMENTS: 'both',
  P2P_COMPLETED: 'both',
  CANCELLATIONS: 'both',
  DISPUTES: 'both',
};

const FORCED_BOTH = ['SECURITY', 'ADMIN'];
const VALID_CHANNELS: NotifChannel[] = ['both', 'email', 'push', 'none'];
const VALID_CATEGORIES = Object.keys(DEFAULTS);

class NotificationPreferencesService {
  /**
   * Parse raw JSON string into preferences merged with defaults.
   * Returns defaults if raw is null/invalid.
   */
  getPreferences(raw: string | null | undefined): NotifPreferences {
    if (!raw) return { ...DEFAULTS };

    try {
      const parsed = JSON.parse(raw) as NotifPreferences;
      const merged = { ...DEFAULTS };
      for (const key of VALID_CATEGORIES) {
        if (parsed[key] && VALID_CHANNELS.includes(parsed[key])) {
          merged[key] = parsed[key];
        }
      }
      return merged;
    } catch {
      return { ...DEFAULTS };
    }
  }

  /** Should we send an email for this category? */
  shouldEmail(raw: string | null | undefined, category: string): boolean {
    if (FORCED_BOTH.includes(category)) return true;
    const prefs = this.getPreferences(raw);
    const channel = prefs[category] || 'both';
    return channel === 'both' || channel === 'email';
  }

  /** Should we send an in-app notification (push/bell) for this category? */
  shouldPush(raw: string | null | undefined, category: string): boolean {
    if (FORCED_BOTH.includes(category)) return true;
    const prefs = this.getPreferences(raw);
    const channel = prefs[category] || 'both';
    return channel === 'both' || channel === 'push';
  }

  /** Update user preferences. Only valid categories/channels are accepted. */
  async updatePreferences(userId: string, updates: Partial<Record<string, string>>): Promise<NotifPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });

    const current = this.getPreferences(user?.notificationPreferences ?? null);

    for (const [key, value] of Object.entries(updates)) {
      if (VALID_CATEGORIES.includes(key) && VALID_CHANNELS.includes(value as NotifChannel)) {
        current[key] = value as NotifChannel;
      }
      // Silently ignore invalid keys/values
    }

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: JSON.stringify(current) },
    });

    return current;
  }
}

export const notifPrefsService = new NotificationPreferencesService();
