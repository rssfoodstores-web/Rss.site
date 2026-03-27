export const NIGERIAN_STATES = [
    "Abia",
    "Adamawa",
    "Akwa Ibom",
    "Anambra",
    "Bauchi",
    "Bayelsa",
    "Benue",
    "Borno",
    "Cross River",
    "Delta",
    "Ebonyi",
    "Edo",
    "Ekiti",
    "Enugu",
    "FCT - Abuja",
    "Gombe",
    "Imo",
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Kogi",
    "Kwara",
    "Lagos",
    "Nasarawa",
    "Niger",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
    "Plateau",
    "Rivers",
    "Sokoto",
    "Taraba",
    "Yobe",
    "Zamfara"
] as const

export type NigerianState = (typeof NIGERIAN_STATES)[number]

export function getNigerianStateFilterCandidates(state: string) {
    const normalizedState = state.trim()

    if (!normalizedState || normalizedState === "all") {
        return []
    }

    const candidates = new Set<string>([normalizedState])

    if (normalizedState === "FCT - Abuja" || normalizedState === "Abuja") {
        candidates.add("Abuja")
        candidates.add("FCT - Abuja")
        candidates.add("Federal Capital Territory")
        candidates.add("Federal Capital Territory (FCT)")
        candidates.add("FCT Abuja")
        return Array.from(candidates)
    }

    candidates.add(`${normalizedState} State`)
    return Array.from(candidates)
}
