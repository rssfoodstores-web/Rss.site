"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Camera, CheckCircle2, RefreshCw, Volume2, VolumeX } from "lucide-react"

interface LivePhotoCaptureProps {
    onCapture: (file: File) => void
    label?: string
    error?: string
}

type LivenessStep = "ready" | "blink" | "open_mouth" | "turn_head" | "stay_still" | "capturing" | "complete"

export default function LivePhotoCapture({ onCapture, label = "Take a Live Photo", error }: LivePhotoCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [step, setStep] = useState<LivenessStep>("ready")
    const [audioEnabled, setAudioEnabled] = useState(true)

    // Audio refs
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const playAudio = useCallback((filename: string) => {
        if (!audioEnabled) return
        const audio = new Audio(`/sounds/${filename}`)
        audio.play().catch(e => console.error("Audio play failed:", e))
    }, [audioEnabled])

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
            })
            setStream(mediaStream)
            // We set the srcObject in a useEffect to ensure ref is ready
            setIsCameraOpen(true)
            setStep("ready")
        } catch (err) {
            console.error("Error accessing camera:", err)
            alert("Could not access camera. Please allow camera permissions.")
        }
    }

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }
        setIsCameraOpen(false)
        setStep("ready")
    }, [stream])

    // Effect to attach stream to video element
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
        }
    }, [stream, isCameraOpen])

    // Liveness Sequence Logic
    useEffect(() => {
        if (!isCameraOpen || step === "ready" || step === "complete" || step === "capturing") return

        let timeoutId: NodeJS.Timeout
        let nextStepDelay = 3500 // Time for each step

        // Play instruction audio
        switch (step) {
            case "blink":
                playAudio("Blink your eyes.wav")
                break
            case "open_mouth":
                playAudio("open your mouth.wav")
                break
            case "turn_head":
                playAudio("turn your head.wav")
                break
            case "stay_still":
                playAudio("now stay steal.wav") // Typo in filename stored in public/sounds
                break
        }

        // Schedule next step
        timeoutId = setTimeout(() => {
            playAudio("good.wav")

            setStep(current => {
                switch (current) {
                    case "blink": return "open_mouth"
                    case "open_mouth": return "turn_head"
                    case "turn_head": return "stay_still"
                    case "stay_still": return "capturing"
                    default: return current
                }
            })
        }, nextStepDelay)

        return () => clearTimeout(timeoutId)
    }, [step, isCameraOpen, playAudio])

    // Trigger capture when in "capturing" state
    useEffect(() => {
        if (step === "capturing") {
            // Small delay to ensure "stay still" is settled
            const timeout = setTimeout(() => {
                capturePhoto()
            }, 500)
            return () => clearTimeout(timeout)
        }
    }, [step])

    const startProcess = () => {
        setStep("blink")
    }

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext("2d")

        if (context) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            // Flip horizontal to match mirrored video
            context.translate(canvas.width, 0)
            context.scale(-1, 1)

            context.drawImage(video, 0, 0, canvas.width, canvas.height)

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "live-photo.jpg", { type: "image/jpeg" })
                    const imageUrl = URL.createObjectURL(blob)
                    setCapturedImage(imageUrl)
                    onCapture(file)
                    setStep("complete")
                    stopCamera()
                }
            }, "image/jpeg", 0.9)
        }
    }

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label} *</label>
                {isCameraOpen && (
                    <button
                        type="button"
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        className="text-gray-500 hover:text-[#F58220] transition-colors"
                    >
                        {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                )}
            </div>

            {!isCameraOpen && !capturedImage && (
                <div
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center h-56 w-full border-2 border-dashed border-[#E5E5EA] dark:border-zinc-800 rounded-xl cursor-pointer hover:border-[#F58220] dark:hover:border-[#F58220] transition-all bg-gray-50/50 dark:bg-zinc-900/50 group"
                >
                    <div className="h-16 w-16 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <Camera className="h-8 w-8 text-[#F58220]" />
                    </div>
                    <span className="text-[#F58220] font-bold">Tap to Start Verification</span>
                    <p className="text-xs text-gray-400 mt-2 text-center max-w-[200px]">
                        We'll guide you through a few quick movements. <br />(Blink, Open Mouth, Turn Head)
                    </p>
                </div>
            )}

            {isCameraOpen && (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform scale-x-[-1]"
                    />

                    {/* Instructions Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        {step === "ready" && (
                            <div className="pointer-events-auto">
                                <Button
                                    type="button"
                                    onClick={startProcess}
                                    className="bg-[#F58220] hover:bg-[#E57210] text-white font-bold py-6 px-8 rounded-full shadow-xl animate-in fade-in zoom-in"
                                >
                                    I'm Ready, Start
                                </Button>
                            </div>
                        )}

                        {step !== "ready" && step !== "complete" && (
                            <div className="bg-black/60 backdrop-blur-sm text-white px-8 py-4 rounded-2xl font-bold text-xl animate-in fade-in slide-in-from-bottom-5 duration-300 text-center shadow-2xl border border-white/10">
                                {step === "blink" && "😉 Please Blink Your Eyes"}
                                {step === "open_mouth" && "😮 Open Your Mouth"}
                                {step === "turn_head" && "↔️ Slowly Turn Head"}
                                {step === "stay_still" && "📸 Now Stay Still..."}
                                {step === "capturing" && "Capturing..."}
                            </div>
                        )}
                    </div>

                    <canvas ref={canvasRef} className="hidden" />
                </div>
            )}

            {capturedImage && (
                <div className="relative rounded-xl overflow-hidden aspect-video border-2 border-[#F58220] shadow-md group animate-in fade-in zoom-in">
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => { setCapturedImage(null); startCamera(); }}
                            className="bg-white text-black hover:bg-gray-200"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                        </Button>
                    </div>
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="h-3 w-3" /> Live Verified
                    </div>
                </div>
            )}

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
        </div>
    )
}
