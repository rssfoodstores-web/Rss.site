"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function saveAgentWorkingLocation(fix: {
    latitude: number
    longitude: number
    accuracy: number
    capturedAt: number
}) {
    const { latitude, longitude, accuracy, capturedAt } = fix
    const age = Date.now() - capturedAt
    if (![latitude, longitude, accuracy, capturedAt].every(Number.isFinite) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
        accuracy < 0.01 || accuracy > 50 || age > 120_000 || age < -15_000) {
        return { error: "Capture a fresh GPS reading within 50 metres, then try again." }
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc("save_agent_working_location", {
        p_latitude: latitude, p_longitude: longitude,
        p_accuracy_metres: accuracy, p_captured_at: new Date(capturedAt).toISOString(),
    })
    if (error) {
        console.error("Could not save agent working location", error.code)
        return { error: "Could not save your working location. Capture it again and retry." }
    }

    revalidatePath("/agent", "layout")
    return { error: null }
}

export async function updateAgentDuty(onDuty: boolean) {
    if (typeof onDuty !== "boolean") return { error: "Choose a valid duty status." }
    const supabase = await createClient()
    const { error } = await supabase.rpc("set_agent_on_duty", { p_on_duty: onDuty })
    if (error) {
        console.error("Could not update agent duty", error.code)
        return { error: "Could not update duty status. Check that your working pin is confirmed and try again." }
    }

    revalidatePath("/agent", "layout")
    return { error: null }
}
