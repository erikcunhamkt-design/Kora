import { useEffect, useState, useCallback } from "react";

export interface MeetingType {
  id: string;
  name: string;
  durationMinutes: number;
  description: string;
  color: string;
  active: boolean;
  isDemo?: boolean;
}

export interface Appointment {
  id: string;
  meetingTypeId: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  status: "scheduled" | "canceled" | "completed";
  isDemo?: boolean;
}

const MT_KEY = "orbyt.meetingTypes.v1";
const APP_KEY = "orbyt.appointments.v1";

const MT_SEEDS: MeetingType[] = [
  { id: "m1", name: "Reunião de diagnóstico", durationMinutes: 30, description: "Primeiro contato para entender o projeto.", color: "#F81040", active: true, isDemo: true },
  { id: "m2", name: "Apresentação de proposta", durationMinutes: 45, description: "Apresentação detalhada da proposta comercial.", color: "#0ea5e9", active: true, isDemo: true },
  { id: "m3", name: "Revisão de projeto", durationMinutes: 60, description: "Revisão de andamento e ajustes.", color: "#10b981", active: true, isDemo: true },
];

const APP_SEEDS: Appointment[] = [
  { id: "a1", meetingTypeId: "m1", name: "Marina Costa", email: "marina@acme.com", phone: "(11) 99812-3456", date: "2026-05-28", time: "14:00", status: "scheduled", isDemo: true },
  { id: "a2", meetingTypeId: "m2", name: "Rafael Mendes", email: "rafael@studiozen.com", phone: "(21) 98765-4321", date: "2026-05-30", time: "10:30", status: "scheduled", isDemo: true },
];

function load<T>(key: string, seeds: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(key, JSON.stringify(seeds));
  } catch {}
  return seeds;
}

export function useScheduling() {
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    setMeetingTypes(load(MT_KEY, MT_SEEDS));
    setAppointments(load(APP_KEY, APP_SEEDS));
  }, []);

  const addMeetingType = useCallback((m: Omit<MeetingType, "id" | "isDemo">) => {
    setMeetingTypes((prev) => {
      const next = [...prev, { ...m, id: crypto.randomUUID(), isDemo: false }];
      try { localStorage.setItem(MT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addAppointment = useCallback((a: Omit<Appointment, "id" | "status" | "isDemo">) => {
    setAppointments((prev) => {
      const next = [...prev, { ...a, id: crypto.randomUUID(), status: "scheduled" as const, isDemo: false }];
      try { localStorage.setItem(APP_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { meetingTypes, appointments, addMeetingType, addAppointment };
}
