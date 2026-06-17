-- Migration to create whatsapp_mensagens table for chat history / AI memory
create table if not exists whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references whatsapp_sessoes(id) on delete cascade,
  remote_jid text not null, -- The phone number or ID of the chat (e.g. 5511999999999@s.whatsapp.net)
  mensagem text not null,
  from_me boolean not null default false, -- true if sent by AI/user, false if received
  message_id text, -- Wuzapi message ID to avoid duplicates and track
  created_at timestamp with time zone default now()
);

-- Index for fast queries by session and remote_jid
create index if not exists idx_whatsapp_mensagens_chat on whatsapp_mensagens(sessao_id, remote_jid, created_at desc);

-- RLS policies
alter table whatsapp_mensagens enable row level security;

create policy "Enable read access for authenticated users"
  on whatsapp_mensagens for select
  to authenticated
  using (true);

create policy "Enable insert access for authenticated users"
  on whatsapp_mensagens for insert
  to authenticated
  with check (true);

create policy "Enable update access for authenticated users"
  on whatsapp_mensagens for update
  to authenticated
  using (true);

create policy "Enable delete access for authenticated users"
  on whatsapp_mensagens for delete
  to authenticated
  using (true);
