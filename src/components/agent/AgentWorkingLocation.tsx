"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { LocateFixed, MapPin } from "lucide-react"
import { saveAgentWorkingLocation, updateAgentDuty } from "@/app/agent/workSettingsActions"
import { Button } from "@/components/ui/button"

type Fix = { latitude: number; longitude: number; accuracy: number; capturedAt: number }
type Settings = { latitude: number; longitude: number; accuracy_metres: number; on_duty: boolean }

function mapLink(latitude: number, longitude: number) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

export function AgentWorkingLocation({ settings, unavailable }: { settings: Settings | null; unavailable: boolean }) {
    const [editing, setEditing] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const [busy, setBusy] = useState(false)
    const [fix, setFix] = useState<Fix | null>(null)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const stopRef = useRef<(() => void) | null>(null)

    useEffect(() => () => stopRef.current?.(), [])

    function capture() {
        if (stopRef.current) return
        setFix(null)
        setError("")
        setNotice("")
        if (!window.isSecureContext || !navigator.geolocation) {
            setError("Open this page in a browser that supports location over HTTPS.")
            return
        }

        setCapturing(true)
        const handles: { watcher?: number; timer?: number } = {}
        let active = true
        const stop = () => {
            active = false
            if (handles.watcher !== undefined) navigator.geolocation.clearWatch(handles.watcher)
            window.clearTimeout(handles.timer)
            stopRef.current = null
        }
        stopRef.current = stop
        const finish = (message?: string) => {
            stop()
            setCapturing(false)
            if (message) setError(message)
        }
        const retry = "We couldn’t get a reading within 50 metres. Turn on precise location, move somewhere with a clear view of the sky, and try again."
        handles.timer = window.setTimeout(() => finish(retry), 25_000)
        handles.watcher = navigator.geolocation.watchPosition((position) => {
            if (!active) return
            const { latitude, longitude, accuracy } = position.coords
            const age = Date.now() - position.timestamp
            if (![latitude, longitude, accuracy, position.timestamp].every(Number.isFinite) ||
                Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
                accuracy < 0.01 || accuracy > 50 || age > 15_000 || age < -15_000) return
            setFix({ latitude, longitude, accuracy, capturedAt: position.timestamp })
            finish()
        }, (positionError) => {
            if (!active) return
            if (positionError.code === 1) finish("Allow precise location for this site in your device settings, then try again.")
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 })
    }

    async function save() {
        if (!fix || busy) return
        setBusy(true)
        setError("")
        try {
            const result = await saveAgentWorkingLocation(fix)
            if (result.error) {
                setFix(null)
                setError(result.error)
                return
            }
            setFix(null)
            setEditing(false)
            setNotice("Working location saved.")
        } catch {
            setError("Couldn’t save your working location. Try again.")
        } finally {
            setBusy(false)
        }
    }

    async function toggleDuty() {
        if (!settings || busy) return
        setBusy(true)
        setError("")
        setNotice("")
        try {
            const result = await updateAgentDuty(!settings.on_duty)
            if (result.error) setError(result.error)
            else setNotice(settings.on_duty ? "You’re now off duty." : "You’re now on duty.")
        } catch {
            setError("Couldn’t change your duty status. Try again.")
        } finally {
            setBusy(false)
        }
    }

    if (unavailable) return <p role="alert" className="mb-4 rounded-xl border bg-card p-4 text-sm">Working location settings couldn’t load. Refresh the page to try again.</p>

    return (
        <section className="mb-4 space-y-3 rounded-2xl border bg-card p-4" aria-labelledby="working-location-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="working-location-title" className="flex items-center gap-2 font-semibold">
                        <MapPin className="size-4 text-orange-700 dark:text-orange-300" aria-hidden="true" />
                        {settings ? "Working location" : "Set your working location to receive orders"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {settings ? `Pin confirmed · ${settings.on_duty ? "On duty" : "Off duty"}` : "Capture GPS while you’re in the area you’ll work from."}
                    </p>
                </div>
                {settings && !editing && (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => { setEditing(true); setError(""); setNotice("") }} disabled={busy}>Change pin</Button>
                        <Button variant={settings.on_duty ? "outline" : "default"} onClick={() => void toggleDuty()} disabled={busy}>{settings.on_duty ? "Go off duty" : "Go on duty"}</Button>
                    </div>
                )}
            </div>

            {(!settings || editing) && (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Your device must report accuracy within 50 metres. The app saves one pin when you confirm.</p>
                    {fix && <div className="space-y-1 rounded-xl border bg-orange-50 p-3 text-sm dark:bg-orange-950/30">
                        <p>Device-reported accuracy ±{Math.ceil(fix.accuracy)} metres</p>
                        <a className="font-medium underline" href={mapLink(fix.latitude, fix.longitude)} target="_blank" rel="noreferrer">Check pin on map</a>
                    </div>}
                    <div className="flex flex-wrap gap-2">
                        <Button variant={fix ? "outline" : "default"} onClick={capture} disabled={capturing || busy}>
                            <LocateFixed className="size-4" aria-hidden="true" />
                            {capturing ? "Finding a precise location…" : fix ? "Capture again" : "Use my current location"}
                        </Button>
                        {fix && <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Confirm working location"}</Button>}
                        {editing && <Button variant="ghost" disabled={busy} onClick={() => {
                            stopRef.current?.()
                            setCapturing(false)
                            setFix(null)
                            setError("")
                            setEditing(false)
                        }}>Cancel</Button>}
                    </div>
                </div>
            )}
            {settings && !editing && <div className="flex flex-wrap gap-4 text-sm">
                <a className="underline underline-offset-4" href={mapLink(settings.latitude, settings.longitude)} target="_blank" rel="noreferrer">View pin</a>
                <Link className="underline underline-offset-4" href="/account/profile">Edit contact details</Link>
            </div>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="text-sm">{notice}</p>}
        </section>
    )
}
