"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Camera, CheckCircle2, RefreshCw, Volume2, VolumeX } from "lucide-react"

interface LivePhotoCaptureProps { onCapture: (file: File) => void; label?: string; error?: string }
type LivenessStep = "ready" | "blink" | "open_mouth" | "turn_head" | "stay_still" | "capturing" | "complete"
type Status = "idle" | "loading_camera" | "loading_model" | "ready" | "error"
type FaceResult = { faceLandmarks?: Array<Array<{ x: number }>>; faceBlendshapes?: Array<{ categories?: Array<{ categoryName?: string; score?: number }> }> }
type Landmarker = { detectForVideo: (video: HTMLVideoElement, timestamp: number) => FaceResult; close?: () => void }
// Keep the verification runtime on the same origin as the app. Relying on a
// third party CDN made camera verification fail on phones and restricted
// networks even when camera permission had already been granted.
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"

function cameraErrorMessage(error: unknown) {
    const name = error instanceof DOMException ? error.name : ""
    if (!window.isSecureContext) return "Camera access requires a secure connection. Open the site using its HTTPS address."
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Camera permission is blocked. In your phone settings, allow camera access for this browser, then reload the page."
    if (name === "NotReadableError" || name === "AbortError") return "Your camera is busy in another app. Close Camera, WhatsApp, Instagram, or another browser tab, then try again."
    if (name === "NotFoundError") return "No camera was found. Check that this device has a working front camera."
    if (name === "OverconstrainedError") return "This camera does not support the requested quality. Try again with the phone held normally."
    return "Camera access failed. Use the latest Chrome or Safari, open the site directly (not inside WhatsApp or another app), allow camera access, and try again."
}

function blendshapeScore(result: FaceResult, name: string) {
    const category = result.faceBlendshapes?.[0]?.categories?.find((item) => item.categoryName === name)
    return typeof category?.score === "number" ? category.score : 0
}

export default function LivePhotoCapture({ onCapture, label = "Take a Live Photo", error }: LivePhotoCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const landmarkerRef = useRef<Landmarker | null>(null)
    const frameRef = useRef<number | null>(null)
    const baselineNoseRef = useRef<number | null>(null)
    const stillSamplesRef = useRef<number[]>([])
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [step, setStep] = useState<LivenessStep>("ready")
    const [status, setStatus] = useState<Status>("idle")
    const [statusMessage, setStatusMessage] = useState("")
    const [audioEnabled, setAudioEnabled] = useState(true)
    const [verificationError, setVerificationError] = useState<string | null>(null)

    const stopCamera = useCallback(() => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setIsCameraOpen(false)
        setStep("ready")
    }, [])
    const playAudio = useCallback((filename: string) => { if (audioEnabled) void new Audio(`/sounds/${filename}`).play().catch(() => undefined) }, [audioEnabled])
    const loadModel = useCallback(async () => {
        if (landmarkerRef.current) return landmarkerRef.current
        setStatus("loading_model"); setStatusMessage("Loading face verification model…")
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("MODEL_TIMEOUT")), 20000))
        try {
            const load = (async () => {
                const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision")
                const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
                const landmarker = await FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, minFaceDetectionConfidence: 0.65, minFacePresenceConfidence: 0.65, minTrackingConfidence: 0.65 })
                landmarkerRef.current = landmarker
                return landmarker
            })()
            const model = await Promise.race([load, timeout])
            setStatus("ready"); setStatusMessage("Model ready. Center your face and begin.")
            return model
        } catch (loadError) {
            console.error("Face model failed to load", loadError); setStatus("error"); setStatusMessage("Poor network or the verification model could not load. Check your connection and try again."); throw loadError
        }
    }, [])
    const startCamera = async () => {
        setVerificationError(null); setStatus("loading_camera"); setStatusMessage("Requesting camera access…")
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error("CAMERA_UNSUPPORTED")
            streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
            setIsCameraOpen(true); await loadModel()
        } catch (cameraError) {
            console.error("Camera or model error", cameraError); setStatus("error"); setStatusMessage((cameraError as Error)?.message === "CAMERA_UNSUPPORTED" ? "This device does not provide a supported camera." : cameraErrorMessage(cameraError))
            if (streamRef.current && !landmarkerRef.current) setStatusMessage("The verification camera is ready, but the private face checker could not load. Check your connection and try again.")
            else if ((cameraError as DOMException)?.name === "NotAllowedError" || (cameraError as DOMException)?.name === "PermissionDeniedError") setStatusMessage("Camera permission was blocked. Allow camera access in your browser settings and try again.")
            else if ((cameraError as DOMException)?.name === "NotReadableError") setStatusMessage("The camera is being used by another app. Close it and try again.")
            streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setIsCameraOpen(false)
        }
    }
    useEffect(() => { if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current }, [isCameraOpen])
    const capturePhoto = useCallback(() => {
        const video = videoRef.current, canvas = canvasRef.current, context = canvas?.getContext("2d")
        if (!video || !canvas || !context || video.videoWidth === 0) return
        canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => { if (!blob) return; setCapturedImage(URL.createObjectURL(blob)); onCapture(new File([blob], "live-photo.jpg", { type: "image/jpeg" })); setStep("complete"); stopCamera() }, "image/jpeg", 0.9)
    }, [onCapture, stopCamera])
    const detectStep = useCallback((currentStep: LivenessStep, result: FaceResult) => {
        if (!result?.faceLandmarks?.length || result.faceLandmarks.length !== 1) return false
        const nose = result.faceLandmarks[0][1]
        if (!nose) return false
        if (currentStep === "blink") return blendshapeScore(result, "eyeBlinkLeft") > 0.45 && blendshapeScore(result, "eyeBlinkRight") > 0.45
        if (currentStep === "open_mouth") return blendshapeScore(result, "jawOpen") > 0.35
        if (currentStep === "turn_head") { if (baselineNoseRef.current === null) baselineNoseRef.current = nose.x; return Math.abs(nose.x - baselineNoseRef.current) > 0.08 }
        if (currentStep === "stay_still") { stillSamplesRef.current = [...stillSamplesRef.current.slice(-14), nose.x]; if (stillSamplesRef.current.length < 10) return false; const values = stillSamplesRef.current, average = values.reduce((sum, value) => sum + value, 0) / values.length; return Math.max(...values.map((value) => Math.abs(value - average))) < 0.025 }
        return false
    }, [])
    useEffect(() => {
        if (!isCameraOpen || !landmarkerRef.current || ["ready", "complete", "capturing"].includes(step)) return
        playAudio(step === "blink" ? "Blink your eyes.wav" : step === "open_mouth" ? "open your mouth.wav" : step === "turn_head" ? "turn your head.wav" : "now stay steal.wav")
        const startedAt = performance.now()
        const scan = () => {
            const video = videoRef.current
            if (!video || video.readyState < 2 || !landmarkerRef.current) { frameRef.current = requestAnimationFrame(scan); return }
            try {
                const result = landmarkerRef.current.detectForVideo(video, performance.now())
                if (detectStep(step, result)) { playAudio("good.wav"); setStep((current) => current === "blink" ? "open_mouth" : current === "open_mouth" ? "turn_head" : current === "turn_head" ? "stay_still" : "capturing"); baselineNoseRef.current = null; stillSamplesRef.current = []; return }
                if (performance.now() - startedAt > 8000) { setVerificationError("We could not verify that action. Make sure one face is visible, then try again."); setStep("ready"); return }
            } catch { setVerificationError("Face detection is unavailable on this device. Please try again."); setStep("ready"); return }
            frameRef.current = requestAnimationFrame(scan)
        }
        frameRef.current = requestAnimationFrame(scan)
        return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
    }, [detectStep, isCameraOpen, playAudio, step])
    useEffect(() => { if (step === "capturing") { const id = setTimeout(capturePhoto, 400); return () => clearTimeout(id) } }, [capturePhoto, step])
    useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); landmarkerRef.current?.close?.() }, [])
    const startProcess = () => { setVerificationError(null); baselineNoseRef.current = null; stillSamplesRef.current = []; setStep("blink") }
    const retry = () => { setStatus("idle"); setStatusMessage(""); void startCamera() }

    return <div className="space-y-3">
        <div className="flex items-center justify-between"><label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label} *</label>{isCameraOpen && <button type="button" onClick={() => setAudioEnabled(!audioEnabled)} className="text-gray-500 hover:text-[#F58220]">{audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>}</div>
        {!isCameraOpen && !capturedImage && <div onClick={startCamera} className="group flex h-56 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E5E5EA] bg-gray-50/50 dark:border-zinc-800 dark:bg-zinc-900/50"><div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800"><Camera className="h-8 w-8 text-[#F58220]" /></div><span className="font-bold text-[#F58220]">Tap to Start Verification</span><p className="mt-2 max-w-[240px] text-center text-xs text-gray-400">Your camera will verify each requested movement before continuing.</p></div>}
        {isCameraOpen && <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-lg"><video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" /><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{status !== "ready" && status !== "error" && <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-white/30 bg-slate-950/80 px-6 py-5 text-center shadow-2xl backdrop-blur-md"><div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#FDBA74]"><div className="absolute inset-2 animate-ping rounded-full border border-[#F58220]/80" /><Camera className="relative h-8 w-8 text-[#FDBA74]" /></div><div><p className="text-lg font-extrabold text-[#FDBA74]">{status === "loading_camera" ? "Getting your camera ready" : "Preparing your private verification"}</p><p className="mt-1 text-xs font-medium text-white">This will only take a moment</p></div><Button type="button" onClick={retry} variant="outline" className="mt-1 border-[#FDBA74] bg-slate-950/70 text-[#FDBA74] hover:bg-slate-800 hover:text-white">Restart camera</Button></div>}{status === "ready" && step === "ready" && <div className="pointer-events-auto text-center"><Button type="button" onClick={startProcess} className="rounded-full bg-[#F58220] px-8 py-6 font-bold text-white shadow-xl hover:bg-[#E57210]">I’m Ready, Start</Button><p className="mt-3 text-xs text-white">Your camera is ready.</p></div>}{status === "ready" && step !== "ready" && step !== "complete" && <div className="rounded-2xl border border-white/10 bg-black/60 px-8 py-4 text-center text-xl font-bold text-white backdrop-blur-sm">{step === "blink" ? "Please blink your eyes" : step === "open_mouth" ? "Open your mouth" : step === "turn_head" ? "Slowly turn your head" : step === "stay_still" ? "Now stay still" : "Capturing…"}</div>}</div><canvas ref={canvasRef} className="hidden" /></div>}
        {status === "error" && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{statusMessage}</span><Button type="button" size="sm" variant="outline" onClick={retry} className="ml-auto">Retry</Button></div>}
        {verificationError && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{verificationError} <button type="button" className="ml-2 font-semibold underline" onClick={startProcess}>Try again</button></div>}
        {capturedImage && <div className="group relative aspect-video overflow-hidden rounded-xl border-2 border-[#F58220] shadow-md"><Image src={capturedImage} alt="Captured live verification photo" fill unoptimized className="object-cover" /><div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"><Button type="button" variant="secondary" onClick={() => { setCapturedImage(null); void startCamera() }}><RefreshCw className="mr-2 h-4 w-4" />Retake Photo</Button></div><div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs text-white"><CheckCircle2 className="h-3 w-3" />Live Verified</div></div>}
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
    </div>
}

