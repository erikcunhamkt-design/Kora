# src/repositories — Acesso a dados

Camada de acesso a dados: funções que falam com o Supabase (via
[`../integrations/supabase`](../integrations/supabase)) para ler e gravar cada
entidade (quotes, clients, finance, projects, tasks). Isola o SQL/PostgREST da UI
e dos hooks — a interface nunca chama o banco diretamente.
