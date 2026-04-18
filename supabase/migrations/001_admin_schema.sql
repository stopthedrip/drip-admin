-- ============================================================================
-- drip Admin Schema — run this in your Supabase SQL editor
-- ============================================================================

-- 1. Users mirror (populated by auth trigger + admin dashboard)
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    display_name TEXT,
    is_admin    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Auto-insert a user row when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Entitlement overrides — admin-granted Pro access
CREATE TABLE IF NOT EXISTS public.entitlement_overrides (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_pro          BOOLEAN DEFAULT true,
    reason          TEXT,
    granted_by      UUID REFERENCES public.users(id),
    granted_at      TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ,                    -- NULL = permanent
    revoked_at      TIMESTAMPTZ                     -- set when admin revokes
);

CREATE INDEX idx_ent_override_user ON public.entitlement_overrides(user_id);
CREATE INDEX idx_ent_override_active ON public.entitlement_overrides(user_id)
    WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());

-- 3. Cloud subscriptions — synced from app for Pro users
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    local_id            BIGINT,                     -- matches Room id on the device
    name                TEXT NOT NULL,
    provider_id         TEXT,
    category_name       TEXT,
    price_cents         BIGINT NOT NULL,
    currency_code       TEXT NOT NULL DEFAULT 'USD',
    cycle               TEXT NOT NULL DEFAULT 'MONTHLY',
    anchor_date         DATE NOT NULL,
    next_renewal_date   DATE,
    is_active           BOOLEAN DEFAULT true,
    on_free_trial       BOOLEAN DEFAULT false,
    label               TEXT DEFAULT 'PERSONAL',
    color_hex           TEXT,
    logo_url            TEXT,
    payment_method      TEXT,
    last_paid_date      DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subs_user ON public.subscriptions(user_id);
CREATE INDEX idx_subs_active ON public.subscriptions(user_id, is_active);
CREATE UNIQUE INDEX idx_subs_user_local ON public.subscriptions(user_id, local_id)
    WHERE local_id IS NOT NULL;

-- 4. Analytics events — lightweight event log from the app
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_name  TEXT NOT NULL,                      -- e.g. 'app_open', 'sub_added', 'sub_cancelled'
    properties  JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_events_date ON public.analytics_events(created_at);

-- 5. Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    admin_id        UUID NOT NULL REFERENCES public.users(id),
    action          TEXT NOT NULL,                  -- e.g. 'grant_pro', 'revoke_pro', 'view_user'
    target_user_id  UUID REFERENCES public.users(id),
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_admin ON public.admin_audit_log(admin_id);
CREATE INDEX idx_audit_date ON public.admin_audit_log(created_at);

-- 6. Row-Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own row; admins can read all
CREATE POLICY users_self ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_admin ON public.users FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- Entitlement overrides: users read their own; admins manage all
CREATE POLICY ent_self ON public.entitlement_overrides FOR SELECT USING (user_id = auth.uid());
CREATE POLICY ent_admin ON public.entitlement_overrides FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- Subscriptions: users manage their own; admins read all
CREATE POLICY subs_self ON public.subscriptions FOR ALL USING (user_id = auth.uid());
CREATE POLICY subs_admin ON public.subscriptions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- Analytics: insert-only for users; admins read all
CREATE POLICY events_insert ON public.analytics_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY events_admin ON public.analytics_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- Audit log: admins only
CREATE POLICY audit_admin ON public.admin_audit_log FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- 7. Helper function: check if a user has an active Pro override
CREATE OR REPLACE FUNCTION public.has_pro_override(p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.entitlement_overrides
        WHERE user_id = p_user_id
          AND is_pro = true
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 8. Dashboard stats view (for quick admin queries)
CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM public.users) AS total_users,
    (SELECT COUNT(*) FROM public.users WHERE created_at > now() - interval '7 days') AS new_users_7d,
    (SELECT COUNT(*) FROM public.users WHERE created_at > now() - interval '30 days') AS new_users_30d,
    (SELECT COUNT(*) FROM public.subscriptions WHERE is_active = true) AS active_subscriptions,
    (SELECT COUNT(DISTINCT user_id) FROM public.subscriptions) AS users_with_subs,
    (SELECT COUNT(*) FROM public.entitlement_overrides WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS active_pro_overrides,
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE event_name = 'app_open' AND created_at > now() - interval '24 hours') AS dau,
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE event_name = 'app_open' AND created_at > now() - interval '7 days') AS wau;
