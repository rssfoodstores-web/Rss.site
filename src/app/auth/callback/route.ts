import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface ErrorRedirectOptions {
    description?: string | null
    errorCode?: string | null
    message: string
}

function getSafeNextPath(nextPath: string | null) {
    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
        return "/"
    }

    return nextPath
}

function buildErrorRedirect(origin: string, options: ErrorRedirectOptions) {
    const url = new URL('/auth/auth-code-error', origin)
    url.searchParams.set('error', options.message)
    url.searchParams.set('callback_url', `${origin}/auth/callback`)

    if (options.description) {
        url.searchParams.set('error_description', options.description)
    }

    if (options.errorCode) {
        url.searchParams.set('error_code', options.errorCode)
    }

    return NextResponse.redirect(url)
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = getSafeNextPath(searchParams.get('next'))
    const referralCode = searchParams.get('ref')?.trim().toUpperCase() ?? null
    const oauthError = searchParams.get('error')
    const oauthErrorCode = searchParams.get('error_code')
    const oauthErrorDescription = searchParams.get('error_description')

    if (oauthError) {
        console.error('OAuth provider returned an error:', {
            error: oauthError,
            errorCode: oauthErrorCode,
            description: oauthErrorDescription,
        })

        return buildErrorRedirect(origin, {
            message: oauthError,
            description: oauthErrorDescription,
            errorCode: oauthErrorCode,
        })
    }

    if (!code) {
        return buildErrorRedirect(origin, {
            message: 'Missing auth code',
            description: 'Supabase did not return an authorization code.',
        })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                    }
                }
            },
        }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        console.error('OAuth code exchange failed:', error)
        return buildErrorRedirect(origin, {
            message: error.message,
            description: 'Session exchange failed in /auth/callback. Make sure you start and finish Google sign-in on the exact same origin and that this callback URL is allowlisted in Supabase Auth.',
            errorCode: 'session_exchange_failed',
        })
    }

    if (referralCode) {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("referred_by")
                    .eq("id", user.id)
                    .single()

                if (profile && !profile.referred_by) {
                    const { data: referrer } = await supabase
                        .from("profiles")
                        .select("id")
                        .eq("referral_code", referralCode)
                        .maybeSingle()

                    if (referrer && referrer.id !== user.id) {
                        await supabase
                            .from("profiles")
                            .update({ referred_by: referrer.id })
                            .eq("id", user.id)
                            .is("referred_by", null)
                    }
                }
            }
        } catch (referralError) {
            console.error("Failed to apply referral code in auth callback:", referralError)
        }
    }

    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'

    if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
    }

    if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
    }

    return NextResponse.redirect(`${origin}${next}`)
}
