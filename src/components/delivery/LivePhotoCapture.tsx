"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Camera, CheckCircle2, RefreshCw, Volume2, VolumeX } from "lucide-react"

interface LivePhotoCaptureProps {
    onCapture: (file: File) => void
    label?: string
    error?: string
}

type LivenessStep = "ready" | "blink" | "open_mouth" | "turn_head" | "stay_still" | "capturing" | "complete"

export default function LivePhotoCapture({
    onCapture,
    label = "Take a Live Photo",
    error,
}: LivePhotoCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [step, setStep] = useState<LivenessStep>("ready")
    const [audioEnabled, setAudioEnabled] = useState(true)

    const playAudio = useCallback((filename: string) => {
        if (!audioEnabled) return
        const audio = new Audio(`/sounds/${filename}`)
        audio.play().catch((playbackError) => console.error("Audio play failed:", playbackError))
    }, [audioEnabled])

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            })

            setStream(mediaStream)
            setIsCameraOpen(true)
            setStep("ready")
        } catch (cameraError) {
            console.error("Error accessing camera:", cameraError)
            alert("Could not access camera. Please allow camera permissions.")
        }
    }

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop())
            setStream(null)
        }

        setIsCameraOpen(false)
        setStep("ready")
    }, [stream])

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
        }
    }, [isCameraOpen, stream])

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext("2d")

        if (!context) {
            return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Flip horizontally to match the mirrored preview.
        context.translate(canvas.width, 0)
        context.scale(-1, 1)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
            if (!blob) {
                return
            }

            const file = new File([blob], "live-photo.jpg", { type: "image/jpeg" })
            const imageUrl = URL.createObjectURL(blob)
            setCapturedImage(imageUrl)
            onCapture(file)
            setStep("complete")
            stopCamera()
        }, "image/jpeg", 0.9)
    }, [onCapture, stopCamera])

    useEffect(() => {
        if (!isCameraOpen || step === "ready" || step === "complete" || step === "capturing") {
            return
        }

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
                playAudio("now stay steal.wav")
                break
        }

        const timeoutId = setTimeout(() => {
            playAudio("good.wav")

            setStep((current) => {
                switch (current) {
                    case "blink":
                        return "open_mouth"
                    case "open_mouth":
                        return "turn_head"
                    case "turn_head":
                        return "stay_still"
                    case "stay_still":
                        return "capturing"
                    default:
                        return current
                }
            })
        }, 3500)

        return () => clearTimeout(timeoutId)
    }, [isCameraOpen, playAudio, step])

    useEffect(() => {
        if (step !== "capturing") {
            return
        }

        const timeoutId = setTimeout(() => {
            capturePhoto()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [capturePhoto, step])

    const startProcess = () => {
        setStep("blink")
    }

    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop())
            }
        }
    }, [stream])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label} *</label>
                {isCameraOpen && (
                    <button
                        type="button"
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        className="text-gray-500 transition-colors hover:text-[#F58220]"
                    >
                        {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                )}
            </div>

            {!isCameraOpen && !capturedImage && (
                <div
                    onClick={startCamera}
                    className="group flex h-56 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E5E5EA] bg-gray-50/50 transition-all hover:border-[#F58220] dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-[#F58220]"
                >
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110 dark:bg-zinc-800">
                        <Camera className="h-8 w-8 text-[#F58220]" />
                    </div>
                    <span className="font-bold text-[#F58220]">Tap to Start Verification</span>
                    <p className="mt-2 max-w-[200px] text-center text-xs text-gray-400">
                        We&apos;ll guide you through a few quick movements.
                        <br />
                        (Blink, Open Mouth, Turn Head)
                    </p>
                </div>
            )}

            {isCameraOpen && (
                <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-lg">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full scale-x-[-1] object-cover"
                    />

                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        {step === "ready" && (
                            <div className="pointer-events-auto">
                                <Button
                                    type="button"
                                    onClick={startProcess}
                                    className="animate-in zoom-in rounded-full bg-[#F58220] px-8 py-6 font-bold text-white shadow-xl fade-in hover:bg-[#E57210]"
                                >
                                    I&apos;m Ready, Start
                                </Button>
                            </div>
                        )}

                        {step !== "ready" && step !== "complete" && (
                            <div className="animate-in slide-in-from-bottom-5 rounded-2xl border border-white/10 bg-black/60 px-8 py-4 text-center text-xl font-bold text-white shadow-2xl backdrop-blur-sm duration-300 fade-in">
                                {step === "blink" && "Please Blink Your Eyes"}
                                {step === "open_mouth" && "Open Your Mouth"}
                                {step === "turn_head" && "Slowly Turn Head"}
                                {step === "stay_still" && "Now Stay Still..."}
                                {step === "capturing" && "Capturing..."}
                            </div>
                        )}
                    </div>

                    <canvas ref={canvasRef} className="hidden" />
                </div>
            )}

            {capturedImage && (
                <div className="group relative aspect-video overflow-hidden rounded-xl border-2 border-[#F58220] shadow-md animate-in fade-in zoom-in">
                    <Image
                        src={capturedImage}
                        alt="Captured live verification photo"
                        fill
                        unoptimized
                        className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setCapturedImage(null)
                                startCamera()
                            }}
                            className="bg-white text-black hover:bg-gray-200"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                        </Button>
                    </div>
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs text-white shadow-sm">
                        <CheckCircle2 className="h-3 w-3" /> Live Verified
                    </div>
                </div>
            )}

            {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        </div>
    )
}
