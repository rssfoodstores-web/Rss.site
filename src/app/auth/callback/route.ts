import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSafeNextPath, resolvePostAuthPath } from "@/lib/auth-redirects"
import { buildAbsoluteUrl, getServerSiteUrl } from "@/lib/site-url"

interface ErrorRedirectOptions {
    description?: string | null
    errorCode?: string | null
    message: string
}

function buildErrorRedirect(origin: string, options: ErrorRedirectOptions) {
    const url = new URL('/auth/auth-code-error', `${origin}/`)
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
    const { searchParams } = new URL(request.url)
    const siteOrigin = getServerSiteUrl(request)
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

        return buildErrorRedirect(siteOrigin, {
            message: oauthError,
            description: oauthErrorDescription,
            errorCode: oauthErrorCode,
        })
    }

    if (!code) {
        return buildErrorRedirect(siteOrigin, {
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
        return buildErrorRedirect(siteOrigin, {
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

    let destination = next ?? "/"

    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            destination = await resolvePostAuthPath(supabase, user.id, next)
        }
    } catch (destinationError) {
        console.error("Failed to resolve post-auth destination:", destinationError)
    }

    return NextResponse.redirect(buildAbsoluteUrl(siteOrigin, destination))
}
