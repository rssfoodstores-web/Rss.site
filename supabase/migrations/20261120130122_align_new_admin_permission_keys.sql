alter table public.admin_dashboard_permissions
drop constraint admin_dashboard_permissions_permission_key_check;

alter table public.admin_dashboard_permissions
add constraint admin_dashboard_permissions_permission_key_check
check (permission_key = any (array[
    'promotions',
    'dashboard',
    'approvals',
    'orders',
    'agent',
    'notifications',
    'messages',
    'reports',
    'delivery_settings',
    'location_access',
    'ads',
    'hero_section',
    'referrals',
    'rewards',
    'cook_off',
    'discount_bundles',
    'contact',
    'faqs',
    'terms',
    'privacy',
    'support',
    'accounts',
    'account_info'
]::text[]));
