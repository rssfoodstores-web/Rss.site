import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { MONNIFY_API_URL, corsHeaders, getAccessToken } from "../_shared/monnify.ts"

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const accessToken = await getAccessToken()
        const response = await fetch(`${MONNIFY_API_URL}/api/v1/banks`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        const data = await response.json()

        if (!response.ok || !data?.requestSuccessful) {
            throw new Error(data?.responseMessage ?? "Failed to fetch banks.")
        }

        return new Response(
            JSON.stringify({
                banks: data.responseBody ?? [],
            }),
            {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unable to fetch banks.",
            }),
            {
                status: 400,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            }
        )
    }
})
