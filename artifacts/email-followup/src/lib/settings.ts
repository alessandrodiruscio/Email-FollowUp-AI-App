const SETTINGS_KEY = "email_followup_settings";

export interface UserSettings {
  fromName: string;
  fromEmail: string;
  footerName?: string;
  footerTitle?: string;
  footerImageUrl?: string;
  footerWebsite?: string;
  footerWebsiteUrl?: string;
  footerFacebook?: string;
  footerInstagram?: string;
  footerYoutube?: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  fromName: "Alessandro Di Ruscio",
  fromEmail: "alex@alessandrodiruscio.com",
};

export function getSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
