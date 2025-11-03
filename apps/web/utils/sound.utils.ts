/**
 * Sound Notification Utilities
 * Provides audio feedback for notifications using Web Audio API
 */

// Sound preferences key for localStorage
const SOUND_PREF_KEY = 'notification_sound_enabled';

/**
 * Check if sound notifications are enabled by user preference
 */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  const pref = localStorage.getItem(SOUND_PREF_KEY);
  // Default to enabled if not set
  return pref === null ? true : pref === 'true';
}

/**
 * Set sound notification preference
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_PREF_KEY, enabled.toString());
}

/**
 * Play notification sound based on priority
 */
export function playNotificationSound(priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'): void {
  if (!isSoundEnabled()) return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      console.warn('Web Audio API not supported');
      return;
    }

    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure sound based on priority
    switch (priority) {
      case 'URGENT':
        // Urgent: Triple beep, higher frequency
        oscillator.frequency.value = 880; // A5
        gainNode.gain.value = 0.3;
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);

        // Second beep
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 880;
          gain2.gain.value = 0.3;
          osc2.start();
          osc2.stop(audioContext.currentTime + 0.1);
        }, 150);

        // Third beep
        setTimeout(() => {
          const osc3 = audioContext.createOscillator();
          const gain3 = audioContext.createGain();
          osc3.connect(gain3);
          gain3.connect(audioContext.destination);
          osc3.frequency.value = 880;
          gain3.gain.value = 0.3;
          osc3.start();
          osc3.stop(audioContext.currentTime + 0.1);
        }, 300);
        break;

      case 'HIGH':
        // High: Double beep
        oscillator.frequency.value = 660; // E5
        gainNode.gain.value = 0.25;
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);

        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 660;
          gain2.gain.value = 0.25;
          osc2.start();
          osc2.stop(audioContext.currentTime + 0.1);
        }, 150);
        break;

      case 'NORMAL':
        // Normal: Single soft ding
        oscillator.frequency.value = 523; // C5
        gainNode.gain.value = 0.2;
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
        break;

      case 'LOW':
        // Low: Very soft, short beep
        oscillator.frequency.value = 440; // A4
        gainNode.gain.value = 0.15;
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
    }

    // Cleanup
    setTimeout(() => {
      audioContext.close();
    }, 1000);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

/**
 * Test sound notification (for settings)
 */
export function testNotificationSound(priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'): void {
  playNotificationSound(priority);
}
