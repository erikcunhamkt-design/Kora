import { useCallback, useEffect, useState } from "react";

export type WAStatus = "disconnected" | "connecting" | "connected";

export interface WhatsAppConnection {
  status: WAStatus;
  phoneName?: string;
  connectedAt?: string;
}

export type ConversationStatus = "unread" | "open" | "waiting" | "closed";

export interface Conversation {
  id: string;
  contactName: string;
  phone: string;
  channel: "whatsapp";
  status: ConversationStatus;
  lastMessage: string;
  lastMessageAt: string;
  tags: string[];
  isDemo: boolean;
}

export interface WAMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  text: string;
  createdAt: string;
  isDemo: boolean;
}

const CONN_KEY = "orbyt.whatsapp.connection.v1";
const CONV_KEY = "orbyt.whatsapp.conversations.v1";
const MSG_KEY = "orbyt.whatsapp.messages.v1";

const seedConversations: Conversation[] = [
  { id: "conv-demo-1", contactName: "Marina Souza", phone: "+55 11 99999-1111", channel: "whatsapp", status: "unread", lastMessage: "Bom dia! Vocês fazem identidade visual?", lastMessageAt: new Date().toISOString(), tags: ["lead"], isDemo: true },
  { id: "conv-demo-2", contactName: "Carlos Mendes", phone: "+55 21 98888-2222", channel: "whatsapp", status: "open", lastMessage: "Pode me mandar o orçamento atualizado?", lastMessageAt: new Date().toISOString(), tags: ["cliente"], isDemo: true },
  { id: "conv-demo-3", contactName: "Estúdio Norte", phone: "+55 31 97777-3333", channel: "whatsapp", status: "waiting", lastMessage: "Estamos avaliando, retorno amanhã.", lastMessageAt: new Date().toISOString(), tags: ["proposta"], isDemo: true },
  { id: "conv-demo-4", contactName: "Júlia Pires", phone: "+55 41 96666-4444", channel: "whatsapp", status: "closed", lastMessage: "Obrigada! Fechado.", lastMessageAt: new Date().toISOString(), tags: ["fechado"], isDemo: true },
];

const seedMessages: WAMessage[] = [
  { id: "msg-d-1a", conversationId: "conv-demo-1", direction: "inbound", text: "Bom dia! Vocês fazem identidade visual?", createdAt: new Date().toISOString(), isDemo: true },
  { id: "msg-d-2a", conversationId: "conv-demo-2", direction: "inbound", text: "Pode me mandar o orçamento atualizado?", createdAt: new Date().toISOString(), isDemo: true },
  { id: "msg-d-2b", conversationId: "conv-demo-2", direction: "outbound", text: "Claro! Envio em instantes.", createdAt: new Date().toISOString(), isDemo: true },
  { id: "msg-d-3a", conversationId: "conv-demo-3", direction: "outbound", text: "Aguardo seu retorno!", createdAt: new Date().toISOString(), isDemo: true },
  { id: "msg-d-4a", conversationId: "conv-demo-4", direction: "inbound", text: "Obrigada! Fechado.", createdAt: new Date().toISOString(), isDemo: true },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* intentionally empty */ }
  return fallback;
}

export function useWhatsAppMock() {
  const [connection, setConnection] = useState<WhatsAppConnection>(() => load(CONN_KEY, { status: "disconnected" }));
  const [conversations, setConversations] = useState<Conversation[]>(() => load(CONV_KEY, seedConversations));
  const [messages, setMessages] = useState<WAMessage[]>(() => load(MSG_KEY, seedMessages));

  useEffect(() => { try { localStorage.setItem(CONN_KEY, JSON.stringify(connection)); } catch { /* intentionally empty */ } }, [connection]);
  useEffect(() => { try { localStorage.setItem(CONV_KEY, JSON.stringify(conversations)); } catch { /* intentionally empty */ } }, [conversations]);
  useEffect(() => { try { localStorage.setItem(MSG_KEY, JSON.stringify(messages)); } catch { /* intentionally empty */ } }, [messages]);

  const simulateConnect = useCallback(() => {
    setConnection({ status: "connecting" });
    setTimeout(() => {
      setConnection({ status: "connected", phoneName: "KORA HUB", connectedAt: new Date().toISOString() });
    }, 800);
  }, []);

  const disconnect = useCallback(() => setConnection({ status: "disconnected" }), []);

  const sendMessage = useCallback((conversationId: string, text: string) => {
    const msg: WAMessage = { id: `msg-${Date.now()}`, conversationId, direction: "outbound", text, createdAt: new Date().toISOString(), isDemo: false };
    setMessages((prev) => [...prev, msg]);
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, lastMessage: text, lastMessageAt: msg.createdAt, status: c.status === "unread" ? "open" : c.status } : c)));
  }, []);

  const createConversation = useCallback((data: { contactName: string; phone: string; firstMessage: string }) => {
    const id = `conv-${Date.now()}`;
    const now = new Date().toISOString();
    const conv: Conversation = { id, contactName: data.contactName, phone: data.phone, channel: "whatsapp", status: "open", lastMessage: data.firstMessage, lastMessageAt: now, tags: [], isDemo: false };
    const msg: WAMessage = { id: `msg-${Date.now()}`, conversationId: id, direction: "outbound", text: data.firstMessage, createdAt: now, isDemo: false };
    setConversations((prev) => [conv, ...prev]);
    setMessages((prev) => [...prev, msg]);
    return id;
  }, []);

  return { connection, conversations, messages, simulateConnect, disconnect, sendMessage, createConversation };
}
