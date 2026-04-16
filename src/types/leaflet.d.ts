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
    }

    interface LeafletMapInstance {
        setView: (coordinates: [number, number], zoom: number) => LeafletMapInstance
        remove: () => void
    }

    interface LeafletNamespace {
        map: (element: HTMLElement, options?: unknown) => LeafletMapInstance
        tileLayer: (urlTemplate: string, options?: unknown) => LeafletTileLayer
        marker: (
            coordinates: [number, number],
            options?: { icon?: LeafletIcon }
        ) => LeafletMarkerInstance
        icon: (options: LeafletIconOptions) => LeafletIcon
    }

    interface Window {
        L: LeafletNamespace
    }
}

export {}
