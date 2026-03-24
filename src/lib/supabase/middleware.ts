import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function requiresWorkspaceAuth(pathname: string) {
    return ["/account", "/agent", "/merchant", "/rider"].some((prefix) =>
        pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user && requiresWorkspaceAuth(request.nextUrl.pathname)) {
            const loginUrl = request.nextUrl.clone()
            loginUrl.pathname = "/login"
            loginUrl.search = ""
            loginUrl.searchParams.set(
                "next",
                `${request.nextUrl.pathname}${request.nextUrl.search}`
            )

            return NextResponse.redirect(loginUrl)
        }
    } catch {
        // Ignore errors here, just trying to refresh session
    }

    return supabaseResponse
}
