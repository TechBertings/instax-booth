import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// ── Instax Mini Link BLE constants (reverse-engineered) ──────────
const INSTAX_SERVICE_UUID       = '70954471-2d83-4473-8b7d-6f3800a5e76c'
const INSTAX_WRITE_UUID         = '70954472-2d83-4473-8b7d-6f3800a5e76c'
const INSTAX_NOTIFY_UUID        = '70954473-2d83-4473-8b7d-6f3800a5e76c'

const CHUNK_SIZE = 900          // bytes per BLE packet
const INSTAX_WIDTH  = 600
const INSTAX_HEIGHT = 800

// Build an Instax print packet header
function buildHeader(totalBytes) {
  const buf = new Uint8Array(8)
  const view = new DataView(buf.buffer)
  buf[0] = 0x1b; buf[1] = 0x58    // ESC X  — start of image command
  view.setUint32(2, totalBytes, false)  // big-endian image size
  buf[6] = 0x00; buf[7] = 0x00
  return buf
}

// Resize + crop canvas to 600×800, return JPEG blob ≤ 65535 bytes
async function prepareImageBlob(sourceCanvas) {
  const out = document.createElement('canvas')
  out.width  = INSTAX_WIDTH
  out.height = INSTAX_HEIGHT
  const ctx = out.getContext('2d')

  // Cover-fit: fill 600×800 without stretching
  const src = sourceCanvas
  const srcRatio = src.width / src.height
  const dstRatio = INSTAX_WIDTH / INSTAX_HEIGHT
  let sx, sy, sw, sh
  if (srcRatio > dstRatio) {
    sh = src.height; sw = sh * dstRatio
    sy = 0; sx = (src.width - sw) / 2
  } else {
    sw = src.width; sh = sw / dstRatio
    sx = 0; sy = (src.height - sh) / 2
  }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, INSTAX_WIDTH, INSTAX_HEIGHT)

  // Reduce quality until ≤ 65535 bytes
const toBlob = (q) => new Promise((r) => out.toBlob(r, 'image/jpeg', q))
let quality = 0.92
let blob = await toBlob(quality)
while (blob.size > 65535 && quality > 0.1) {
  quality -= 0.05
  blob = await toBlob(quality)
}
return blob
}

function Booth() {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)

  // BLE refs — not state so they don't trigger re-renders
  const bleDeviceRef  = useRef(null)
  const writeCharRef  = useRef(null)
  const notifyCharRef = useRef(null)

  const [events, setEvents]               = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [shotsTaken, setShotsTaken]       = useState(0)
  const [capturedImages, setCapturedImages] = useState([])
  const [cameraReady, setCameraReady]     = useState(false)
  const [capturing, setCapturing]         = useState(false)
  const [printing, setPrinting]           = useState(false)
  const [error, setError]                 = useState('')
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [bleStatus, setBleStatus]         = useState('disconnected') // 'disconnected' | 'connecting' | 'connected'
  const [printProgress, setPrintProgress] = useState(0) // 0-100

  useEffect(() => { fetchEvents() }, [])

  useEffect(() => {
    if (selectedEvent) { startCamera(); loadShotCount() }
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent])

  // Auto-reconnect if device disconnects
  useEffect(() => {
    const device = bleDeviceRef.current
    if (!device) return
    const onDisconnect = () => setBleStatus('disconnected')
    device.addEventListener('gattserverdisconnected', onDisconnect)
    return () => device.removeEventListener('gattserverdisconnected', onDisconnect)
  }, [bleStatus])

  const fetchEvents = async () => {
    setLoadingEvents(true)
    const { data } = await supabase
      .from('events')
      .select('*, event_types(name)')
      .eq('status', 'upcoming')
      .order('event_date', { ascending: true })
    if (data) setEvents(data)
    setLoadingEvents(false)
  }

  const loadShotCount = async () => {
    if (!selectedEvent) return
    const { data } = await supabase
      .from('images').select('id').eq('event_id', selectedEvent.id)
    if (data) setShotsTaken(data.length)
    setCapturedImages([])
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraReady(true)
        setError('')
      }
    } catch {
      setError('Camera not accessible. Please allow camera permission.')
      setCameraReady(false)
    }
  }

  const stopCamera = () => {
    videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop())
    setCameraReady(false)
  }

  // ── BLE: Connect to Instax ────────────────────────────────────
  const connectInstax = async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not supported. Please use Bluefy browser on iPad.')
      return
    }
    try {
      setBleStatus('connecting')
      setError('')

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'INSTAX-' }],
        optionalServices: [INSTAX_SERVICE_UUID],
      })
      bleDeviceRef.current = device

      const server  = await device.gatt.connect()
      const service = await server.getPrimaryService(INSTAX_SERVICE_UUID)

      writeCharRef.current  = await service.getCharacteristic(INSTAX_WRITE_UUID)
      notifyCharRef.current = await service.getCharacteristic(INSTAX_NOTIFY_UUID)
      await notifyCharRef.current.startNotifications()

      setBleStatus('connected')
    } catch (err) {
      setBleStatus('disconnected')
      if (err.name !== 'NotFoundError') {
        setError('Could not connect to Instax. Make sure it is on and nearby.')
      }
    }
  }

  const disconnectInstax = () => {
    bleDeviceRef.current?.gatt?.disconnect()
    bleDeviceRef.current  = null
    writeCharRef.current  = null
    notifyCharRef.current = null
    setBleStatus('disconnected')
  }

  // ── BLE: Send image to printer ────────────────────────────────
  const printViaBLE = useCallback(async (sourceCanvas) => {
    const writeChar  = writeCharRef.current
    const notifyChar = notifyCharRef.current
    if (!writeChar || !notifyChar) throw new Error('Instax not connected')

    setPrinting(true)
    setPrintProgress(0)

    try {
      const blob       = await prepareImageBlob(sourceCanvas)
      const arrayBuf   = await blob.arrayBuffer()
      const imageBytes = new Uint8Array(arrayBuf)
      const header     = buildHeader(imageBytes.byteLength)

      // Helper: write + wait for printer ACK notification
      const writeAndWait = (data) =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('ACK timeout')), 8000)
          const handler = () => {
            clearTimeout(timeout)
            notifyChar.removeEventListener('characteristicvaluechanged', handler)
            resolve()
          }
          notifyChar.addEventListener('characteristicvaluechanged', handler)
          writeChar.writeValueWithoutResponse(data).catch(reject)
        })

      // 1. Send header
      await writeAndWait(header)

      // 2. Send image in chunks
      const total = imageBytes.byteLength
      let offset  = 0
      while (offset < total) {
        const end   = Math.min(offset + CHUNK_SIZE, total)
        const chunk = imageBytes.slice(offset, end)
        await writeAndWait(chunk)
        offset = end
        setPrintProgress(Math.round((offset / total) * 90))
      }

      // 3. Send print command
      const printCmd = new Uint8Array([0x1b, 0x50]) // ESC P
      await writeChar.writeValueWithoutResponse(printCmd)
      setPrintProgress(100)

    } finally {
      setTimeout(() => {
        setPrinting(false)
        setPrintProgress(0)
      }, 2000)
    }
  }, [])

  // ── Capture ───────────────────────────────────────────────────
  const shotLimit      = selectedEvent?.shot_limit ?? 5
  const shotsRemaining = Math.max(0, shotLimit - shotsTaken)
  const limitReached   = shotsTaken >= shotLimit

  const handleCapture = async () => {
    if (!cameraReady || capturing || limitReached || !selectedEvent) return
    setCapturing(true)
    setError('')

    try {
      const video  = videoRef.current
      const canvas = canvasRef.current
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)

      const blob     = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
      const fileName = `${Date.now()}_booth.jpg`
      const filePath = `${selectedEvent.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('instax-images')
        .upload(filePath, blob, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('instax-images').getPublicUrl(filePath)

      await supabase.from('images').insert({
        event_id: selectedEvent.id,
        file_name: fileName,
        file_path: filePath,
        file_url: urlData.publicUrl,
      })

      setShotsTaken((n) => n + 1)
      setCapturedImages((prev) => [{ url: urlData.publicUrl, name: fileName }, ...prev])

      // Print: BLE if connected, else fallback to window.print
      if (bleStatus === 'connected') {
        await printViaBLE(canvas)
      } else {
        triggerPrintFallback(urlData.publicUrl)
      }
    } catch (err) {
      setError(err.message === 'Instax not connected'
        ? 'Instax not connected. Connect first or use fallback print.'
        : 'Failed to capture. Please try again.')
    } finally {
      setCapturing(false)
    }
  }

  const triggerPrintFallback = (imageUrl) => {
    setPrinting(true)
    const win = window.open('', '_blank')
    win.document.write(`
      <html>
        <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">
          <img src="${imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          <script>window.onload=function(){window.print();window.close()}</script>
        </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => setPrinting(false), 3000)
  }

  // ── BLE status badge ─────────────────────────────────────────
  const BleBadge = () => {
    const map = {
      disconnected: { color: 'bg-gray-600',  dot: 'bg-gray-400',  label: 'No printer' },
      connecting:   { color: 'bg-yellow-700', dot: 'bg-yellow-400 animate-pulse', label: 'Connecting…' },
      connected:    { color: 'bg-green-800',  dot: 'bg-green-400', label: 'Printer ready' },
    }
    const s = map[bleStatus]
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${s.color}`}>
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        <span className="text-xs font-medium text-white">{s.label}</span>
      </div>
    )
  }

  // ── Event selection screen ────────────────────────────────────
  if (!selectedEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">inky way</h1>
          <p className="mt-1 text-sm text-gray-400">Capture the moment, print the memory.</p>
        </div>
        <div className="w-full max-w-sm">
          <p className="mb-3 text-sm font-medium tracking-wide text-center text-gray-500 uppercase">
            Select your event
          </p>
          {loadingEvents ? (
            <p className="text-sm text-center text-gray-400">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-center text-gray-400">No upcoming events found.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="w-full px-5 py-4 text-left transition bg-white border border-gray-100 rounded-2xl hover:border-pink-300 hover:bg-pink-50"
                >
                  <p className="font-semibold text-gray-700">{event.client_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {event.event_types?.name} —{' '}
                    {new Date(event.event_date).toLocaleDateString('en-PH', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                  <p className="mt-1 text-xs font-medium text-pink-500">
                    {event.shot_limit ?? 5} shots allowed
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Booth screen ─────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-between min-h-screen px-4 py-6 bg-gray-900">

      {/* Top bar */}
      <div className="flex items-center justify-between w-full max-w-lg">
        <div>
          <p className="text-sm font-semibold text-white">{selectedEvent.client_name}</p>
          <p className="text-xs text-gray-400">
            {new Date(selectedEvent.event_date).toLocaleDateString('en-PH', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => { stopCamera(); disconnectInstax(); setSelectedEvent(null) }}
          className="text-gray-500 hover:text-white text-xs border border-gray-700 px-3 py-1.5 rounded-lg transition"
        >
          ← Change event
        </button>
      </div>

      {/* BLE connect bar */}
      <div className="w-full max-w-lg flex items-center justify-between mt-3 bg-gray-800 rounded-xl px-4 py-2.5">
        <BleBadge />
        {bleStatus === 'connected' ? (
          <button
            onClick={disconnectInstax}
            className="text-xs text-gray-400 transition hover:text-red-400"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={connectInstax}
            disabled={bleStatus === 'connecting'}
            className="text-xs bg-pink-600 hover:bg-pink-500 disabled:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition"
          >
            {bleStatus === 'connecting' ? 'Connecting…' : '🖨 Connect Instax'}
          </button>
        )}
      </div>

      {/* Camera */}
      <div
        className="relative w-full max-w-lg mt-3 overflow-hidden bg-black rounded-2xl"
        style={{ aspectRatio: '4/3' }}
      >
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="object-cover w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <p className="text-sm text-gray-500">Starting camera…</p>
          </div>
        )}

        {limitReached && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center">
              <p className="text-lg font-semibold text-white">All shots used!</p>
              <p className="mt-1 text-sm text-gray-400">{shotLimit} photos captured and printed.</p>
            </div>
          </div>
        )}

        {cameraReady && !limitReached && (
          <div className="absolute top-3 right-3 bg-black bg-opacity-60 rounded-lg px-2 py-1 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-white">Live</span>
          </div>
        )}

        {capturing && (
          <div className="absolute inset-0 bg-white pointer-events-none opacity-60 animate-ping" />
        )}

        {/* Print progress overlay */}
        {printing && printProgress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black bg-opacity-70">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-pink-400 animate-pulse">🖨 Sending to Instax…</span>
              <span className="text-xs text-white">{printProgress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-pink-500 h-1.5 rounded-full transition-all"
                style={{ width: `${printProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Shot dots */}
      <div className="flex flex-col items-center gap-2 mt-4">
        <div className="flex items-center gap-2">
          {Array.from({ length: shotLimit }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < shotsTaken ? 'bg-pink-500' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400">
          {shotsTaken} of {shotLimit} shots used · {shotsRemaining} remaining
        </p>
      </div>

      {/* Capture button */}
      <button
        onClick={handleCapture}
        disabled={!cameraReady || capturing || limitReached || printing}
        className={`w-20 h-20 rounded-full flex items-center justify-center mt-3 transition-all ${
          limitReached || !cameraReady || printing
            ? 'bg-gray-700 cursor-not-allowed'
            : 'bg-pink-500 hover:bg-pink-400 active:scale-95'
        }`}
        aria-label="Take photo"
      >
        {capturing || printing ? (
          <div className="w-6 h-6 border-2 border-white rounded-full border-t-transparent animate-spin" />
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        )}
      </button>

      {/* Status + thumbnails */}
      <div className="w-full max-w-lg mt-4">
        {error && <p className="mb-2 text-xs text-center text-red-400">{error}</p>}

        {printing && printProgress === 0 && (
          <p className="mb-2 text-xs text-center text-pink-400 animate-pulse">
            🖨 Sending to Instax printer…
          </p>
        )}

        {capturedImages.length > 0 && (
          <div className="flex justify-center gap-2 pb-2 overflow-x-auto">
            {capturedImages.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={`Shot ${i + 1}`}
                className="flex-shrink-0 object-cover w-16 h-16 border-2 border-pink-500 rounded-lg"
              />
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-center text-gray-600">
          {bleStatus === 'connected'
            ? 'auto-saves & prints to Instax after each capture'
            : 'connect Instax above to enable auto-print'}
        </p>
      </div>
    </div>
  )
}

export default Booth