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
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

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
  created_at  timestamptz DEFAULT now()
);

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
