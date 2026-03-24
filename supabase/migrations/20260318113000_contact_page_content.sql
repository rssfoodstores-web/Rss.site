insert into public.app_settings (key, value, description)
values (
    'contact_page_content',
    jsonb_build_object(
        'page_title', 'Contact Us',
        'intro_title', 'Just Say Hello!',
        'intro_description', 'Do you fancy saying hi to me or you want to get started with your project and you need my help? Feel free to contact me.',
        'form', jsonb_build_object(
            'first_name_placeholder', 'First Name',
            'last_name_placeholder', 'Last Name',
            'email_placeholder', 'Email',
            'message_placeholder', 'Subjects',
            'button_text', 'Send Message'
        ),
        'methods', jsonb_build_array(
            jsonb_build_object(
                'id', 'address-main',
                'type', 'address',
                'title', 'Visit us',
                'value', 'OTK Industries Nigeria Ltd, Lagos, Nigeria',
                'description', 'Our main office location.'
            ),
            jsonb_build_object(
                'id', 'email-main',
                'type', 'email',
                'title', 'Email us',
                'value', 'hello@myrss.com.ng',
                'description', 'For general enquiries and support.'
            ),
            jsonb_build_object(
                'id', 'phone-main',
                'type', 'phone',
                'title', 'Call us',
                'value', '+234 903 019 854',
                'description', 'Speak directly with the support team.'
            )
        )
    ),
    'Editable public contact page content, including intro copy, form labels, and contact methods.'
)
on conflict (key) do update
set value = coalesce(public.app_settings.value, '{}'::jsonb) || excluded.value,
    description = excluded.description;
