export interface User {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface EntitlementOverride {
  id: number
  user_id: string
  is_pro: boolean
  reason: string | null
  granted_by: string | null
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
}

export interface Subscription {
  id: number
  user_id: string
  local_id: number | null
  name: string
  provider_id: string | null
  category_name: string | null
  price_cents: number
  currency_code: string
  cycle: string
  anchor_date: string
  next_renewal_date: string | null
  is_active: boolean
  on_free_trial: boolean
  label: string
  color_hex: string | null
  logo_url: string | null
  payment_method: string | null
  last_paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AnalyticsEvent {
  id: number
  user_id: string | null
  event_name: string
  properties: Record<string, unknown>
  created_at: string
}

export interface AuditLogEntry {
  id: number
  admin_id: string
  action: string
  target_user_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export interface DashboardStats {
  total_users: number
  new_users_7d: number
  new_users_30d: number
  active_subscriptions: number
  users_with_subs: number
  active_pro_overrides: number
  dau: number
  wau: number
}
