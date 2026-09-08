import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'

export function CameraScanner({ open, close, onDetected }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return undefined
    let stream
    let frame
    let stopped = false
    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        setError('Camera barcode scanning is not supported by this browser. Use Chrome on Android or a USB/Bluetooth scanner.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] })
        const scan = async () => {
          if (stopped) return
          try {
            const [result] = await detector.detect(video)
            if (result?.rawValue) { stopped = true; onDetected(result.rawValue); return }
          } catch { /* Continue scanning transient frames. */ }
          frame = requestAnimationFrame(scan)
        }
        frame = requestAnimationFrame(scan)
      } catch { setError('Camera access was unavailable. Check browser permission and use HTTPS or localhost.') }
    }
    start()
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach((track) => track.stop()) }
  }, [open, onDetected])
  return <Modal open={open} onClose={close} title="Scan product barcode"><div className="overflow-hidden rounded-xl bg-black"><video ref={videoRef} className="aspect-[3/4] max-h-[65dvh] w-full object-cover sm:aspect-video" muted playsInline /></div>{error ? <div className="mt-4 flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><CameraOff className="shrink-0" size={18} />{error}</div> : <p className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500"><Camera size={17} />Hold the barcode inside the camera view.</p>}</Modal>
}
