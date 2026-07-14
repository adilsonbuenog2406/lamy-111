create table if not exists public.lamy_calculator_leads (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'incomplete' check (status in ('incomplete', 'complete')),
  current_step integer not null default 1 check (current_step between 1 and 3),
  completed_at timestamptz,
  segment text,
  segment_label text,
  email text,
  phone text,
  cnpj text,
  contact_consent boolean not null default false,
  marketing_consent boolean not null default false,
  rbt12 text,
  rbt12_value numeric(14, 2),
  vehicle_value text,
  vehicle_value_numeric numeric(14, 2),
  simples text check (simples in ('sim', 'nao') or simples is null),
  estimated_savings numeric(14, 2),
  page_url text,
  referrer text,
  user_agent text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lamy_calculator_leads_status_updated_at_idx
  on public.lamy_calculator_leads (status, updated_at desc);

create index if not exists lamy_calculator_leads_email_idx
  on public.lamy_calculator_leads (email);

create index if not exists lamy_calculator_leads_cnpj_idx
  on public.lamy_calculator_leads (cnpj);

alter table public.lamy_calculator_leads enable row level security;

grant usage on schema public to service_role;
revoke all on table public.lamy_calculator_leads from anon, authenticated;
grant select, insert, update, delete on table public.lamy_calculator_leads to service_role;
