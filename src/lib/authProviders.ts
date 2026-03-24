import type { User } from "@supabase/supabase-js"

type AuthUserLike = Pick<User, "app_metadata" | "identities"> | null | undefined

export function getPrimaryAuthProvider(user: AuthUserLike) {
    const appProvider = typeof user?.app_metadata?.provider === "string"
        ? user.app_metadata.provider
        : null

    if (appProvider) {
        return appProvider
    }

    const identities = Array.isArray(user?.identities) ? user.identities : []
    const identityProvider = identities.find(
        (identity) => typeof identity.provider === "string"
    )?.provider

    return identityProvider ?? "email"
}

export function canUpdateAccountPassword(user: AuthUserLike) {
    return getPrimaryAuthProvider(user) === "email"
}
