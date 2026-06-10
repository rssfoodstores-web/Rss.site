"use client"

import Script from "next/script"
import { Button } from "@/components/ui/button"
import { LocateFixed, MapPin } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Coordinates } from "@/lib/directions"

interface RiderRouteMapProps {
    riderLocation?: Coordinates | null
    pickupLocation?: Coordinates | null
    dropoffLocation?: Coordinates | null
    pickupLabel: string
    dropoffLabel: string
    activeStop: "pickup" | "dropoff"
}

const LEAFLET_CSS_ID = "leaflet-map-css"

function ensureLeafletStyles() {
    if (typeof document === "undefined" || document.getElementById(LEAFLET_CSS_ID)) {
        return
    }

    const link = document.createElement("link")
    link.id = LEAFLET_CSS_ID
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    link.crossOrigin = ""
    document.head.appendChild(link)
}

function toLatLng(coordinates: Coordinates): [number, number] {
    return [coordinates.lat, coordinates.lng]
}

function popupContent(label: string) {
    return label.replace(/[<>&"]/g, (character) => {
        switch (character) {
            case "<":
                return "&lt;"
            case ">":
                return "&gt;"
            case "&":
                return "&amp;"
            default:
                return "&quot;"
        }
    })
}

export function RiderRouteMap({
    riderLocation = null,
    pickupLocation = null,
    dropoffLocation = null,
    pickupLabel,
    dropoffLabel,
    activeStop,
}: RiderRouteMapProps) {
    const [mapLoaded, setMapLoaded] = useState(typeof window !== "undefined" && Boolean(window.L))
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<LeafletMapInstance | null>(null)
    const riderMarkerRef = useRef<LeafletCircleMarkerInstance | null>(null)
    const pickupMarkerRef = useRef<LeafletMarkerInstance | null>(null)
    const dropoffMarkerRef = useRef<LeafletMarkerInstance | null>(null)
    const routeLineRef = useRef<LeafletPolylineInstance | null>(null)

    const routePoints = useMemo(
        () => [riderLocation, pickupLocation, dropoffLocation].filter(Boolean) as Coordinates[],
        [dropoffLocation, pickupLocation, riderLocation]
    )

    const activeLocation = activeStop === "pickup" ? pickupLocation : dropoffLocation
    const fallbackLocation = activeLocation ?? riderLocation ?? pickupLocation ?? dropoffLocation

    const centerRoute = useCallback(() => {
        const map = mapInstanceRef.current
        if (!map || routePoints.length === 0) {
            return
        }

        if (routePoints.length === 1) {
            map.setView(toLatLng(routePoints[0]), 14)
            return
        }

        map.fitBounds(routePoints.map(toLatLng), { padding: [28, 28], maxZoom: 15 })
    }, [routePoints])

    useEffect(() => {
        ensureLeafletStyles()
    }, [])

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || mapInstanceRef.current || !fallbackLocation) {
            return
        }

        const leaflet = window.L
        const map = leaflet.map(mapRef.current, {
            zoomControl: true,
            attributionControl: true,
        }).setView(toLatLng(fallbackLocation), 14)

        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        mapInstanceRef.current = map
        setTimeout(() => map.invalidateSize(), 100)
    }, [fallbackLocation, mapLoaded])

    useEffect(() => {
        const map = mapInstanceRef.current
        if (!map || !mapLoaded) {
            return
        }

        const leaflet = window.L
        const stopIcon = leaflet.icon({
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
        })

        if (riderLocation) {
            const latLng = toLatLng(riderLocation)
            if (riderMarkerRef.current) {
                riderMarkerRef.current.setLatLng(latLng)
            } else {
                riderMarkerRef.current = leaflet.circleMarker(latLng, {
                    radius: 9,
                    color: "#2563eb",
                    weight: 3,
                    fillColor: "#60a5fa",
                    fillOpacity: 0.85,
                }).addTo(map)
                riderMarkerRef.current.bindPopup("Your live location")
            }
        } else {
            riderMarkerRef.current?.remove()
            riderMarkerRef.current = null
        }

        if (pickupLocation) {
            const latLng = toLatLng(pickupLocation)
            if (pickupMarkerRef.current) {
                pickupMarkerRef.current.setLatLng(latLng)
            } else {
                pickupMarkerRef.current = leaflet.marker(latLng, { icon: stopIcon }).addTo(map)
            }
            pickupMarkerRef.current.bindPopup(popupContent(pickupLabel))
        } else {
            pickupMarkerRef.current?.remove()
            pickupMarkerRef.current = null
        }

        if (dropoffLocation) {
            const latLng = toLatLng(dropoffLocation)
            if (dropoffMarkerRef.current) {
                dropoffMarkerRef.current.setLatLng(latLng)
            } else {
                dropoffMarkerRef.current = leaflet.marker(latLng, { icon: stopIcon }).addTo(map)
            }
            dropoffMarkerRef.current.bindPopup(popupContent(dropoffLabel))
        } else {
            dropoffMarkerRef.current?.remove()
            dropoffMarkerRef.current = null
        }

        const latLngs = routePoints.map(toLatLng)
        if (latLngs.length >= 2) {
            if (routeLineRef.current) {
                routeLineRef.current.setLatLngs(latLngs)
            } else {
                routeLineRef.current = leaflet.polyline(latLngs, {
                    color: "#F58220",
                    weight: 4,
                    opacity: 0.8,
                    dashArray: "8 8",
                }).addTo(map)
            }
        } else {
            routeLineRef.current?.remove()
            routeLineRef.current = null
        }

        centerRoute()
    }, [centerRoute, dropoffLabel, dropoffLocation, mapLoaded, pickupLabel, pickupLocation, riderLocation, routePoints])

    useEffect(() => {
        return () => {
            mapInstanceRef.current?.remove()
            mapInstanceRef.current = null
        }
    }, [])

    if (!fallbackLocation) {
        return (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Location details are not available for this order yet.
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <Script
                src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
                crossOrigin=""
                onLoad={() => setMapLoaded(true)}
            />

            <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <div ref={mapRef} className="h-72 w-full" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        Rider
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#F58220]" />
                        {activeStop === "pickup" ? "Pickup active" : "Dropoff active"}
                    </span>
                </div>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={centerRoute}>
                    <LocateFixed className="mr-2 h-3.5 w-3.5" />
                    Center route
                </Button>
            </div>
        </div>
    )
}
