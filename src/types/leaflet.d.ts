declare global {
    interface Window {
        L: {
            map: (element: HTMLElement, options?: unknown) => {
                setView: (coordinates: [number, number], zoom: number) => unknown
                remove: () => void
            }
            tileLayer: (urlTemplate: string, options?: unknown) => { addTo: (map: unknown) => void }
            marker: (coordinates: [number, number]) => {
                addTo: (map: unknown) => {
                    bindPopup: (content: string) => { openPopup: () => void }
                }
            }
        }
    }
}

export {}
