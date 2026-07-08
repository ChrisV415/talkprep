import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMINDERS_KEY = "@talkprep_reminders_enabled";
const REMINDER_HOUR = 17;

let _scheduledTimeout: ReturnType<typeof setTimeout> | null = null;

export async function isRemindersEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(REMINDERS_KEY);
  return val === "true";
}

async function requestWebPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function enableReminders(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (Platform.OS !== "web") {
    await AsyncStorage.setItem(REMINDERS_KEY, "true");
    return { ok: true };
  }
  const granted = await requestWebPermission();
  if (!granted) {
    return {
      ok: false,
      reason:
        "Notification permission was denied. Enable notifications in your browser settings and try again.",
    };
  }
  await AsyncStorage.setItem(REMINDERS_KEY, "true");
  _scheduleNextReminder();
  return { ok: true };
}

export async function disableReminders(): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, "false");
  if (_scheduledTimeout) {
    clearTimeout(_scheduledTimeout);
    _scheduledTimeout = null;
  }
}

export async function initReminders(): Promise<void> {
  if (Platform.OS !== "web") return;
  if (typeof Notification === "undefined") return;
  const enabled = await isRemindersEnabled();
  if (!enabled) return;
  if (Notification.permission !== "granted") return;
  _scheduleNextReminder();
}

function _scheduleNextReminder() {
  if (typeof window === "undefined") return;

  const now = new Date();
  const next = new Date();
  next.setHours(REMINDER_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const delay = next.getTime() - now.getTime();

  if (_scheduledTimeout) clearTimeout(_scheduledTimeout);
  _scheduledTimeout = setTimeout(async () => {
    await _fireReminder();
    _scheduleNextReminder();
  }, delay);
}

async function _fireReminder() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const title = "Time to practice 💬";
  const opts: NotificationOptions = {
    body: "Have a tough conversation coming up? Take 2 minutes to prep.",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: "talkprep-daily",
  };

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(title, opts);
      return;
    }
  } catch {
    // fall through
  }
  new Notification(title, opts);
}
