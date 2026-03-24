export const MONNIFY_API_URL = Deno.env.get("MONNIFY_API_URL") ?? "https://sandbox.monnify.com"
export const API_KEY = Deno.env.get("MONNIFY_API_KEY") ?? ""
export const SECRET_KEY = Deno.env.get("MONNIFY_SECRET_KEY") ?? ""
export const CONTRACT_CODE = Deno.env.get("MONNIFY_CONTRACT_CODE") ?? ""

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, monnify-signature",
}

export async function getAccessToken() {
    const encoded = btoa(`${API_KEY}:${SECRET_KEY}`)

    const response = await fetch(`${MONNIFY_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${encoded}`,
        },
    })

    const data = await response.json()

    if (!response.ok || !data?.requestSuccessful) {
        throw new Error(data?.responseMessage ?? "Failed to authenticate with Monnify.")
    }

    return data.responseBody.accessToken as string
}
