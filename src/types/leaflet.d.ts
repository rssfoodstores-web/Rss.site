declare global {
    interface LeafletIconOptions {
        iconUrl: string
        shadowUrl?: string
        iconSize?: [number, number]
        iconAnchor?: [number, number]
    }

    interface LeafletTileLayer {
        addTo: (map: LeafletMapInstance) => void
    }

    interface LeafletIcon {
        options: LeafletIconOptions
    }

    interface LeafletMarkerInstance {
        addTo: (map: LeafletMapInstance) => LeafletMarkerInstance
        bindPopup: (content: string) => { openPopup: () => void }
        setLatLng: (coordinates: [number, number]) => LeafletMarkerInstance
        remove: () => void
    }

    interface LeafletPolylineInstance {
        addTo: (map: LeafletMapInstance) => LeafletPolylineInstance
        setLatLngs: (coordinates: [number, number][]) => LeafletPolylineInstance
        remove: () => void
    }

    interface LeafletCircleMarkerInstance {
        addTo: (map: LeafletMapInstance) => LeafletCircleMarkerInstance
        bindPopup: (content: string) => { openPopup: () => void }
        setLatLng: (coordinates: [number, number]) => LeafletCircleMarkerInstance
        remove: () => void
    }

    interface LeafletMapInstance {
        setView: (coordinates: [number, number], zoom: number) => LeafletMapInstance
        fitBounds: (coordinates: [number, number][], options?: unknown) => LeafletMapInstance
        invalidateSize: () => LeafletMapInstance
        remove: () => void
    }

    interface LeafletNamespace {
        map: (element: HTMLElement, options?: unknown) => LeafletMapInstance
        tileLayer: (urlTemplate: string, options?: unknown) => LeafletTileLayer
        marker: (
            coordinates: [number, number],
            options?: { icon?: LeafletIcon }
        ) => LeafletMarkerInstance
        circleMarker: (
            coordinates: [number, number],
            options?: unknown
        ) => LeafletCircleMarkerInstance
        polyline: (
            coordinates: [number, number][],
            options?: unknown
        ) => LeafletPolylineInstance
        icon: (options: LeafletIconOptions) => LeafletIcon
    }

    interface Window {
        L: LeafletNamespace
    }
}

export {}
