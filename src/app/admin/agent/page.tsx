import { redirect } from "next/navigation"

export default function AdminAgentRedirect() {
    redirect("https://rss-admin-sigma.vercel.app/dashboard/agent")
}
