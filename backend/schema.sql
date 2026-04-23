-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_name text NOT NULL UNIQUE,
  phone text,
  email text,
  address text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  team_lead_id uuid,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id),
  CONSTRAINT clients_team_lead_id_fkey FOREIGN KEY (team_lead_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.content_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  content_type USER-DEFINED NOT NULL,
  scheduled_datetime timestamp with time zone NOT NULL,
  status text NOT NULL,
  created_by uuid,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  title text NOT NULL DEFAULT 'Untitled Content'::text,
  description text,
  creative_url text,
  CONSTRAINT content_items_pkey PRIMARY KEY (id),
  CONSTRAINT content_items_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT content_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.status_logs (
  log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  note text,
  CONSTRAINT status_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT status_logs_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.content_items(id),
  CONSTRAINT status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.users (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role USER-DEFINED NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  role_identifier text,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);