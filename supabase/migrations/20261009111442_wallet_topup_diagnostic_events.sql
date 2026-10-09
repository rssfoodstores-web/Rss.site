create table public.wallet_topup_diagnostics (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null,
    source text not null check (source in ('client', 'app_server', 'monnify_edge')),
    event text not null check (event in (
        'client_submit',
        'client_pagehide',
        'client_pageshow',
        'client_navigation_timeout',
        'wallet_returned_without_callback',
        'server_failure_returned',
        'provider_returned',
        'payment_verification_error',
        'payment_verification_complete',
        'request_received',
        'request_rejected',
        'initialization_started',
        'initialization_threw',
        'initialization_returned_without_checkout',
        'checkout_url_rejected',
        'redirect_issued',
        'provider_request_received',
        'monnify_response',
        'checkout_created',
        'provider_initialization_failed'
    )),
    platform text not null check (platform in ('ios_webkit', 'android', 'other')),
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index wallet_topup_diagnostics_attempt_created_idx
    on public.wallet_topup_diagnostics (attempt_id, created_at);

alter table public.wallet_topup_diagnostics enable row level security;

revoke all on public.wallet_topup_diagnostics from public, anon, authenticated;
grant select, insert on public.wallet_topup_diagnostics to service_role;

