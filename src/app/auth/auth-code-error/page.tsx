import Link from 'next/link'

interface AuthErrorPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
    const params = await searchParams
    const error = typeof params.error === 'string' ? params.error : null
    const errorCode = typeof params.error_code === 'string' ? params.error_code : null
    const errorDescription = typeof params.error_description === 'string' ? params.error_description : null
    const callbackUrl = typeof params.callback_url === 'string' ? params.callback_url : null
    const mightNeedManualLogin = errorCode === "session_exchange_failed"
        || error?.toLowerCase().includes("pkce code verifier not found")

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2 px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">Authentication Error</h1>
            <p className="mb-4">There was an error authenticating your request.</p>

            {(error || errorDescription) && (
                <div className="mb-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <p className="font-semibold">{error ?? 'OAuth callback failed'}</p>
                    {errorCode && <p className="mt-1 font-mono text-xs uppercase tracking-wide">{errorCode}</p>}
                    {errorDescription && <p className="mt-1">{errorDescription}</p>}
                </div>
            )}

            <div className="mb-6 max-w-2xl space-y-3 text-sm text-gray-600">
                {mightNeedManualLogin ? (
                    <p>
                        If you opened a confirmation or sign-in link in a different browser, email app, or device, the secure session may not be resumable there. In that case, your account may already be verified, and you can continue by signing in manually.
                    </p>
                ) : (
                    <p>If this happens on localhost, the most common cause is that Supabase Auth does not allow the exact callback URL you used for this signin attempt.</p>
                )}
                {callbackUrl && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs text-gray-700">
                        <p className="font-semibold text-sm text-gray-900">Allowlist this exact callback URL in Supabase Auth</p>
                        <p className="mt-2 break-all font-mono">{callbackUrl}</p>
                    </div>
                )}
                <p>Also make sure you start sign-in and finish the callback on the same host and port. For example, do not start on <span className="font-mono">localhost:3000</span> and return on <span className="font-mono">127.0.0.1:3000</span> or a LAN IP.</p>
            </div>

            <Link href="/login" className="text-blue-500 hover:underline">
                Go to Login
            </Link>
        </div>
    )
}
