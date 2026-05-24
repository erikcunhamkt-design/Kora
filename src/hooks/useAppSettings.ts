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
  taxId: string;
  website: string;
  whatsapp: string;
  instagram: string;
  country: string;
  city: string;
  state: string;
  address: string;
  number: string;
  postalCode: string;
  currency: string;
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

export interface PublicLinksSettings {
  profileSlug: string;
  bioSlug: string;
  bookingSlug: string;
}

export type ClientPortalStyle = "essencial" | "premium" | "editorial" | "minimal";

export interface ClientPortalPermissions {
  viewProjects: boolean;
  viewTasks: boolean;
  createTasks: boolean;
  commentTasks: boolean;
  viewQuotes: boolean;
  approveQuotes: boolean;
  viewFiles: boolean;
  requestService: boolean;
  viewReports: boolean;
}

export interface ClientPortalTabs {
  requests: boolean;
  reports: boolean;
  projectProgress: boolean;
  approvalHistory: boolean;
}

export interface ClientPortalSettings {
  brandName: string;
  primaryColor: string;
  buttonTextColor: string;
  backgroundColor: string;
  style: ClientPortalStyle;
  loginTitle: string;
  loginMessage: string;
  loginBgColor: string;
  permissions: ClientPortalPermissions;
  tabs: ClientPortalTabs;
}


const PROFILE_KEY = "kora.settings.profile.v1";
const COMPANY_KEY = "kora.settings.company.v1";
const NOTIF_KEY = "kora.settings.notifications.v1";
const LINKS_KEY = "kora.settings.publicLinks.v1";

const DEFAULT_PROFILE: ProfileSettings = {
  name: "Designer Studio",
  email: "designer@studio.com",
  phone: "(11) 99999-0000",
  role: "Founder",
};

const DEFAULT_COMPANY: CompanySettings = {
  name: "KORA HUB",
  segment: "Design & Branding",
  taxId: "",
  website: "https://kora.hub",
  whatsapp: "(11) 99999-0000",
  instagram: "@kora.hub",
  country: "Brasil",
  city: "São Paulo",
  state: "SP",
  address: "",
  number: "",
  postalCode: "",
  currency: "BRL",
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

const DEFAULT_LINKS: PublicLinksSettings = {
  profileSlug: "kora-hub",
  bioSlug: "kora-hub",
  bookingSlug: "kora-hub",
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
  const [publicLinks, setPublicLinks] = useState<PublicLinksSettings>(() => load(LINKS_KEY, DEFAULT_LINKS));

  useEffect(() => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {} }, [profile]);
  useEffect(() => { try { localStorage.setItem(COMPANY_KEY, JSON.stringify(company)); } catch {} }, [company]);
  useEffect(() => { try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications)); } catch {} }, [notifications]);
  useEffect(() => { try { localStorage.setItem(LINKS_KEY, JSON.stringify(publicLinks)); } catch {} }, [publicLinks]);

  const updateProfile = useCallback((patch: Partial<ProfileSettings>) => setProfile((p) => ({ ...p, ...patch })), []);
  const updateCompany = useCallback((patch: Partial<CompanySettings>) => setCompany((c) => ({ ...c, ...patch })), []);
  const updatePublicLinks = useCallback((patch: Partial<PublicLinksSettings>) => setPublicLinks((l) => ({ ...l, ...patch })), []);
  const toggleNotification = useCallback((key: keyof NotificationSettings) => {
    setNotifications((n) => ({ ...n, [key]: !n[key] }));
  }, []);

  return {
    profile,
    company,
    notifications,
    publicLinks,
    updateProfile,
    updateCompany,
    updatePublicLinks,
    toggleNotification,
  };
}
