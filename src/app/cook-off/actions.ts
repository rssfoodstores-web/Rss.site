"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

interface VoteRpcPayload {
    success?: boolean
    error?: string
    [key: string]: Json | undefined
}

function getVoteRpcPayload(data: unknown) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {}
    }

    return data as VoteRpcPayload
}

export async function castCookOffVoteAction(entryId: string) {
    if (!entryId) {
        return {
            success: false,
            error: "Cook-Off entry is required.",
        }
    }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return {
            success: false,
            error: "Please log in to vote.",
        }
    }

    const { data, error } = await supabase.rpc("cast_cook_off_vote", {
        p_entry_id: entryId,
    })

    if (error) {
        return {
            success: false,
            error: error.message,
        }
    }

    const payload = getVoteRpcPayload(data)

    if (!payload.success) {
        return {
            success: false,
            error: typeof payload.error === "string" ? payload.error : "Unable to submit your vote.",
        }
    }

    revalidatePath("/cook-off")
    revalidatePath("/account/cook-off")

    return {
        success: true,
    }
}
