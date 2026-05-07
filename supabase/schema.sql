-- ============================================================
-- DealFlow — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name             text,
  default_commission_pct numeric DEFAULT 3.0,
  deadline_notifications boolean DEFAULT true,
  trial_started_at      timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Migration for existing databases — adds trial_started_at if missing
-- and backfills it from created_at for users created before this column existed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz DEFAULT now();

UPDATE public.profiles
  SET trial_started_at = created_at
  WHERE trial_started_at IS NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- ── Auto-create profile on signup ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ── Deals ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  address           text NOT NULL,
  sale_price        numeric,
  agent_role        text DEFAULT 'buyer' CHECK (agent_role IN ('buyer', 'seller')),
  commission_pct    numeric,
  phase             text DEFAULT 'Offer Accepted',
  phase_changed_at  timestamptz DEFAULT now(),
  offer_date        date,
  closing_date      date,
  buyer_name        text,
  buyer_phone       text,
  buyer_email       text,
  seller_name       text,
  seller_phone      text,
  seller_email      text,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deals"
  ON public.deals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deals"
  ON public.deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deals"
  ON public.deals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own deals"
  ON public.deals FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS deals_user_id_idx ON public.deals (user_id);
CREATE INDEX IF NOT EXISTS deals_phase_idx ON public.deals (phase);


-- ── Checklist Items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.deals ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label       text NOT NULL,
  phase       text NOT NULL,
  is_checked  boolean DEFAULT false,
  due_date    date,
  notes       text,
  is_custom   boolean DEFAULT false,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Migration for existing databases — adds the editable-checklist columns.
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklist items"
  ON public.checklist_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checklist items"
  ON public.checklist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklist items"
  ON public.checklist_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checklist items"
  ON public.checklist_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS checklist_deal_id_idx ON public.checklist_items (deal_id);
CREATE INDEX IF NOT EXISTS checklist_user_id_idx ON public.checklist_items (user_id);
CREATE INDEX IF NOT EXISTS checklist_due_date_idx ON public.checklist_items (due_date) WHERE due_date IS NOT NULL;


-- ── Communication Logs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comm_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid NOT NULL REFERENCES public.deals ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  log_type      text NOT NULL CHECK (log_type IN ('Call', 'Text', 'Email', 'In-Person', 'Note')),
  contact_name  text,
  summary       text NOT NULL,
  logged_at     timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.comm_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comm logs"
  ON public.comm_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comm logs"
  ON public.comm_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS comm_logs_deal_id_idx ON public.comm_logs (deal_id);
CREATE INDEX IF NOT EXISTS comm_logs_user_id_idx ON public.comm_logs (user_id);
CREATE INDEX IF NOT EXISTS comm_logs_logged_at_idx ON public.comm_logs (logged_at DESC);


-- ── Leads ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  phone                 text,
  email                 text,
  source                text NOT NULL DEFAULT 'Other',
  referrer_name         text,
  temperature           text NOT NULL DEFAULT 'Warm' CHECK (temperature IN ('Hot', 'Warm', 'Cold')),
  interest_type         text NOT NULL DEFAULT 'Buying' CHECK (interest_type IN ('Buying', 'Selling')),
  budget_min            numeric,
  budget_max            numeric,
  target_area           text,
  notes                 text,
  follow_up_date        date,
  converted_to_deal_id  uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON public.leads FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS leads_user_id_idx ON public.leads (user_id);
CREATE INDEX IF NOT EXISTS leads_temperature_idx ON public.leads (temperature);
CREATE INDEX IF NOT EXISTS leads_follow_up_date_idx ON public.leads (follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_converted_idx ON public.leads (converted_to_deal_id) WHERE converted_to_deal_id IS NOT NULL;


-- ── Client Portals ─────────────────────────────────────────
-- Each row mints a unique token used as the public URL fragment
-- (/portal/:token). Anyone with the token can render the portal,
-- but only while is_active = true.
--
-- Agent contact info is denormalized onto each portal row so the
-- public portal can display name/phone/email without exposing
-- auth.users or profiles to the anon key.
CREATE TABLE IF NOT EXISTS public.client_portals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_name   text,
  client_type   text NOT NULL DEFAULT 'buyer' CHECK (client_type IN ('buyer', 'seller')),
  is_active     boolean NOT NULL DEFAULT true,
  agent_name    text,
  agent_email   text,
  agent_phone   text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

-- Agent has full control over their own portals
CREATE POLICY "Agents can manage own portals" ON public.client_portals
  FOR ALL USING (auth.uid() = user_id);

-- Public read for active portals (the client opens the portal URL)
CREATE POLICY "Public can read active portals" ON public.client_portals
  FOR SELECT USING (is_active = true);

CREATE INDEX IF NOT EXISTS client_portals_deal_id_idx ON public.client_portals (deal_id);
CREATE INDEX IF NOT EXISTS client_portals_token_idx ON public.client_portals (token);


-- ── Client Tasks ───────────────────────────────────────────
-- Tasks the agent assigns to a portal. Public can read and update
-- (mark complete) while the parent portal is active.
CREATE TABLE IF NOT EXISTS public.client_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  portal_id     uuid NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  due_date      date,
  is_completed  boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own client tasks" ON public.client_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public can read tasks for active portal" ON public.client_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_portals cp
      WHERE cp.id = portal_id AND cp.is_active = true
    )
  );

CREATE POLICY "Public can complete tasks for active portal" ON public.client_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.client_portals cp
      WHERE cp.id = portal_id AND cp.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS client_tasks_portal_id_idx ON public.client_tasks (portal_id);
CREATE INDEX IF NOT EXISTS client_tasks_deal_id_idx ON public.client_tasks (deal_id);


-- ── Public read extensions for deals + checklist_items ─────
-- Required so the public portal page can render the deal record
-- (address, phase, closing date) and the agent's checklist items
-- for "What's coming next". Gated by the existence of an active
-- portal for the same deal.
CREATE POLICY "Public can read deal for active portal" ON public.deals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_portals cp
      WHERE cp.deal_id = deals.id AND cp.is_active = true
    )
  );

CREATE POLICY "Public can read checklist items for active portal" ON public.checklist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_portals cp
      WHERE cp.deal_id = checklist_items.deal_id AND cp.is_active = true
    )
  );


-- ── Showings ───────────────────────────────────────────────
-- Property showings the agent has scheduled. Optionally linked to a deal.
CREATE TABLE IF NOT EXISTS public.showings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id             uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  property_address    text NOT NULL,
  showing_date        date NOT NULL,
  showing_time        time,
  client_name         text,
  notes               text,
  status              text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  post_showing_notes  text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.showings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own showings" ON public.showings
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS showings_user_id_idx ON public.showings (user_id);
CREATE INDEX IF NOT EXISTS showings_date_idx ON public.showings (showing_date);
CREATE INDEX IF NOT EXISTS showings_deal_id_idx ON public.showings (deal_id);


-- ── Documents ──────────────────────────────────────────────
-- Metadata only — actual files live in the "deal-documents" Storage bucket.
CREATE TABLE IF NOT EXISTS public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id       uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_type     text NOT NULL,
  file_size     integer,
  storage_path  text NOT NULL,
  public_url    text,
  uploaded_at   timestamptz DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents" ON public.documents
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS documents_deal_id_idx ON public.documents (deal_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents (user_id);


-- ── Storage policies for the deal-documents bucket ─────────
-- Run AFTER creating the "deal-documents" bucket in Supabase Storage.
-- Files live at:  {user_id}/{deal_id}/{filename}
-- The first folder segment must equal auth.uid() — that's how RLS gates
-- per-user access without the agent ever seeing another agent's files.
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deal-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deal-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'deal-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ── Push Subscriptions ─────────────────────────────────────
-- Stores the browser's push subscription object for each user. A backend
-- (Vercel cron, Supabase Edge Function, etc.) reads these to actually
-- fire push messages — this app only writes them.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  subscription  jsonb NOT NULL,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);


-- ── Agent Network ──────────────────────────────────────────
-- Cooperating agents the user wants to keep on a personal mailing list.
-- Used by the Showing Blast feature to email a showing announcement to
-- the agent's network.
CREATE TABLE IF NOT EXISTS public.agent_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  email       text NOT NULL,
  phone       text,
  brokerage   text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.agent_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent contacts" ON public.agent_contacts
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS agent_contacts_user_id_idx ON public.agent_contacts (user_id);
