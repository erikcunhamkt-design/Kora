# supabase/functions — Backend serverless (Edge Functions)

Funções Deno executadas na borda do Supabase (webhooks e processamento de
WhatsApp, envio de mensagens, IA/Vertex, etc.). É o **backend**: aqui vivem os
segredos (lidos via `Deno.env.get`, configurados em Supabase → Edge Functions →
Secrets) e a lógica que não pode rodar no cliente. Cada subpasta é uma função
implantável; `_shared/` guarda utilitários comuns.
