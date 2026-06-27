import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function Booth() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [shotsTaken, setShotsTaken] = useState(0)
  const [capturedImages, setCapturedImages] = useState([])
  const [cameraReady, setCameraReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [loadingEvents, setLoadingEvents] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEvent) {
      startCamera()
      loadShotCount()
    }
    return () => stopCamera()
  }, [selectedEvent])

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
      .from('images')
      .select('id')
      .eq('event_id', selectedEvent.id)
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
    } catch (err) {
      setError('Camera not accessible. Please allow camera permission.')
      setCameraReady(false)
    }
  }

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject
    stream?.getTracks().forEach((t) => t.stop())
    setCameraReady(false)
  }

  const shotLimit = selectedEvent?.shot_limit ?? 5
  const shotsRemaining = Math.max(0, shotLimit - shotsTaken)
  const limitReached = shotsTaken >= shotLimit

  const handleCapture = async () => {
    if (!cameraReady || capturing || limitReached || !selectedEvent) return
    setCapturing(true)
    setError('')

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
      const fileName = `${Date.now()}_booth.jpg`
      const filePath = `${selectedEvent.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('instax-images')
        .upload(filePath, blob, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('instax-images')
        .getPublicUrl(filePath)

      await supabase.from('images').insert({
        event_id: selectedEvent.id,
        file_name: fileName,
        file_path: filePath,
        file_url: urlData.publicUrl,
      })

      const newCount = shotsTaken + 1
      setShotsTaken(newCount)
      setCapturedImages((prev) => [{ url: urlData.publicUrl, name: fileName }, ...prev])

      // Trigger print
      triggerPrint(urlData.publicUrl)
    } catch (err) {
      setError('Failed to capture. Please try again.')
    } finally {
      setCapturing(false)
    }
  }

  const triggerPrint = (imageUrl) => {
    setPrinting(true)
    const win = window.open('', '_blank')
    win.document.write(`
      <html>
        <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">
          <img src="${imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          <script>window.onload=function(){window.print();window.close()}<\/script>
        </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => setPrinting(false), 3000)
  }

  // ── Event selection screen ─────────────────────────────────────
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">inky way</h1>
          <p className="text-sm text-gray-400 mt-1">Capture the moment, print the memory.</p>
        </div>

        <div className="w-full max-w-sm">
          <p className="text-sm font-medium text-gray-500 mb-3 text-center uppercase tracking-wide">
            Select your event
          </p>

          {loadingEvents ? (
            <p className="text-center text-gray-400 text-sm">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="text-center text-gray-400 text-sm">No upcoming events found.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-left hover:border-pink-300 hover:bg-pink-50 transition"
                >
                  <p className="font-semibold text-gray-700">{event.client_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {event.event_types?.name} —{' '}
                    {new Date(event.event_date).toLocaleDateString('en-PH', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-pink-500 mt-1 font-medium">
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

  // ── Booth screen ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-between py-6 px-4">
      {/* Top bar */}
      <div className="w-full max-w-lg flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{selectedEvent.client_name}</p>
          <p className="text-gray-400 text-xs">
            {new Date(selectedEvent.event_date).toLocaleDateString('en-PH', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => { stopCamera(); setSelectedEvent(null) }}
          className="text-gray-500 hover:text-white text-xs border border-gray-700 px-3 py-1.5 rounded-lg transition"
        >
          ← Change event
        </button>
      </div>

      {/* Camera */}
      <div className="w-full max-w-lg rounded-2xl overflow-hidden bg-black relative mt-4" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <p className="text-gray-500 text-sm">Starting camera...</p>
          </div>
        )}

        {limitReached && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center">
              <p className="text-white font-semibold text-lg">All shots used!</p>
              <p className="text-gray-400 text-sm mt-1">
                {shotLimit} photos captured and printed.
              </p>
            </div>
          </div>
        )}

        {/* Live badge */}
        {cameraReady && !limitReached && (
          <div className="absolute top-3 right-3 bg-black bg-opacity-60 rounded-lg px-2 py-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs">Live</span>
          </div>
        )}

        {/* Capturing flash */}
        {capturing && (
          <div className="absolute inset-0 bg-white opacity-60 animate-ping pointer-events-none" />
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
        <p className="text-gray-400 text-xs">
          {shotsTaken} of {shotLimit} shots used · {shotsRemaining} remaining
        </p>
      </div>

      {/* Capture button */}
      <button
        onClick={handleCapture}
        disabled={!cameraReady || capturing || limitReached}
        className={`w-20 h-20 rounded-full flex items-center justify-center mt-3 transition-all ${
          limitReached || !cameraReady
            ? 'bg-gray-700 cursor-not-allowed'
            : 'bg-pink-500 hover:bg-pink-400 active:scale-95'
        }`}
        aria-label="Take photo"
      >
        {capturing ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        )}
      </button>

      {/* Status + thumbnails */}
      <div className="w-full max-w-lg mt-4">
        {error && (
          <p className="text-red-400 text-xs text-center mb-2">{error}</p>
        )}

        {printing && (
          <p className="text-pink-400 text-xs text-center mb-2 animate-pulse">
            🖨 Sending to Instax printer...
          </p>
        )}

        {capturedImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
            {capturedImages.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={`Shot ${i + 1}`}
                className="w-16 h-16 object-cover rounded-lg border-2 border-pink-500 flex-shrink-0"
              />
            ))}
          </div>
        )}

        <p className="text-gray-600 text-xs text-center mt-2">
          auto-saves &amp; prints after each capture
        </p>
      </div>
    </div>
  )
}

export default Booth