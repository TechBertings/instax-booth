import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function ImageHistory() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingImages, setLoadingImages] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('*, event_types(name)')
      .order('event_date', { ascending: false })
    if (data) setEvents(data)
    setLoading(false)
  }

  const fetchImages = async (event) => {
    setSelectedEvent(event)
    setLoadingImages(true)
    setImages([])

    const folderPath = `${event.id}/`

    const { data, error } = await supabase.storage
      .from('instax-images')
      .list(folderPath, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

    if (error || !data) {
      setLoadingImages(false)
      return
    }

    // Get public URLs
    const imagesWithUrls = data
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((file) => {
        const { data: urlData } = supabase.storage
          .from('instax-images')
          .getPublicUrl(`${folderPath}${file.name}`)
        return {
          ...file,
          url: urlData.publicUrl,
          path: `${folderPath}${file.name}`,
        }
      })

    setImages(imagesWithUrls)
    setLoadingImages(false)
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length || !selectedEvent) return

    setUploading(true)

    for (const file of files) {
      const fileName = `${Date.now()}_${file.name}`
      const filePath = `${selectedEvent.id}/${fileName}`

      const { error } = await supabase.storage
        .from('instax-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (!error) {
        // Save to images table
        const { data: urlData } = supabase.storage
          .from('instax-images')
          .getPublicUrl(filePath)

        await supabase.from('images').insert({
          event_id: selectedEvent.id,
          file_name: fileName,
          file_path: filePath,
          file_url: urlData.publicUrl,
        })
      }
    }

    setUploading(false)
    fetchImages(selectedEvent)
  }

  const handleDelete = async (image) => {
    if (!window.confirm('Delete this image?')) return

    await supabase.storage.from('instax-images').remove([image.path])
    await supabase.from('images').delete().eq('file_path', image.path)
    fetchImages(selectedEvent)
  }

  const handlePrint = (image) => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#000;">
          <img src="${image.url}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Image History</h1>
        <p className="text-sm text-gray-400">View and manage photos per event</p>
      </div>

      <div className="flex gap-6">
        {/* Events List */}
        <div className="w-72 shrink-0">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Events</h2>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="text-gray-400 text-sm">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => fetchImages(event)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition text-sm ${
                    selectedEvent?.id === event.id
                      ? 'bg-pink-50 border-pink-300 text-pink-600'
                      : 'bg-white border-gray-100 text-gray-600 hover:border-pink-200'
                  }`}
                >
                  <p className="font-medium">{event.client_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {event.event_types?.name} —{' '}
                    {new Date(event.event_date).toLocaleDateString('en-PH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Images Panel */}
        <div className="flex-1">
          {!selectedEvent ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">Select an event to view images</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-700">
                    {selectedEvent.client_name}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {images.length} photo{images.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Upload Button */}
                <label className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                  {uploading ? 'Uploading...' : '+ Upload Photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              {/* Images Grid */}
              {loadingImages ? (
                <p className="text-gray-400 text-sm">Loading images...</p>
              ) : images.length === 0 ? (
                <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">No photos yet for this event.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {images.map((image) => (
                    <div key={image.name} className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-40 object-cover cursor-pointer"
                        onClick={() => setPreviewImage(image)}
                      />
                      {/* Actions */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => setPreviewImage(image)}
                          className="bg-white text-gray-700 px-2 py-1 rounded-lg text-xs font-medium"
                        >
                          👁 View
                        </button>
                        <button
                          onClick={() => handlePrint(image)}
                          className="bg-pink-500 text-white px-2 py-1 rounded-lg text-xs font-medium"
                        >
                          🖨 Print
                        </button>
                        <button
                          onClick={() => handleDelete(image)}
                          className="bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-medium"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="w-full rounded-2xl object-contain max-h-[80vh]"
            />
            <div className="flex gap-2 mt-3 justify-center">
              <button
                onClick={() => handlePrint(previewImage)}
                className="bg-pink-500 text-white px-6 py-2 rounded-lg text-sm font-medium"
              >
                🖨 Print
              </button>
              <button
                onClick={() => setPreviewImage(null)}
                className="bg-white text-gray-600 px-6 py-2 rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageHistory