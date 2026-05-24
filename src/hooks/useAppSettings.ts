import { useCallback, useEffect, useState } from "react";

export interface ProfileSettings {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface CompanySettings {
  name: string;
  segment: string;
  website: string;
  whatsapp: string;
  instagram: string;
  city: string;
}

export interface NotificationSettings {
  tasks: boolean;
  leads: boolean;
  quotes: boolean;
  finance: boolean;
  support: boolean;
  aiCredits: boolean;
  product: boolean;
}

const PROFILE_KEY = "kora.settings.profile.v1";
const COMPANY_KEY = "kora.settings.company.v1";
const NOTIF_KEY = "kora.settings.notifications.v1";

const DEFAULT_PROFILE: ProfileSettings = {
  name: "Designer Studio",
  email: "designer@studio.com",
  phone: "(11) 99999-0000",
  role: "Founder",
};

const DEFAULT_COMPANY: CompanySettings = {
  name: "KORA HUB",
  segment: "Design & Branding",
  website: "https://kora.hub",
  whatsapp: "(11) 99999-0000",
  instagram: "@kora.hub",
  city: "São Paulo, BR",
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  tasks: true,
  leads: true,
  quotes: true,
  finance: true,
  support: true,
  aiCredits: true,
  product: false,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {}
  return fallback;
}

export function useAppSettings() {
  const [profile, setProfile] = useState<ProfileSettings>(() => load(PROFILE_KEY, DEFAULT_PROFILE));
  const [company, setCompany] = useState<CompanySettings>(() => load(COMPANY_KEY, DEFAULT_COMPANY));
  const [notifications, setNotifications] = useState<NotificationSettings>(() => load(NOTIF_KEY, DEFAULT_NOTIFICATIONS));

  useEffect(() => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {} }, [profile]);
  useEffect(() => { try { localStorage.setItem(COMPANY_KEY, JSON.stringify(company)); } catch {} }, [company]);
  useEffect(() => { try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications)); } catch {} }, [notifications]);

  const updateProfile = useCallback((patch: Partial<ProfileSettings>) => setProfile((p) => ({ ...p, ...patch })), []);
  const updateCompany = useCallback((patch: Partial<CompanySettings>) => setCompany((c) => ({ ...c, ...patch })), []);
  const toggleNotification = useCallback((key: keyof NotificationSettings) => {
    setNotifications((n) => ({ ...n, [key]: !n[key] }));
  }, []);

  return { profile, company, notifications, updateProfile, updateCompany, toggleNotification };
}
