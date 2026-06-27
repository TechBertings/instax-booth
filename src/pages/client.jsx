import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function Clients() {
  const [events, setEvents] = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [useCustomPackage, setUseCustomPackage] = useState(false)

  const [form, setForm] = useState({
    client_name: '',
    contact_number: '',
    email: '',
    event_type_id: '',
    event_date: '',
    package_id: '',
    custom_package_name: '',
    custom_package_price: '',
    notes: '',
    status: 'upcoming',
    shot_limit: 5,
  })

  useEffect(() => {
    fetchEvents()
    fetchEventTypes()
    fetchPackages()
  }, [])

  const fetchEvents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('*, event_types(name), packages(name, price)')
      .order('event_date', { ascending: false })
    if (data) setEvents(data)
    setLoading(false)
  }

  const fetchEventTypes = async () => {
    const { data } = await supabase.from('event_types').select('*').order('name')
    if (data) setEventTypes(data)
  }

  const fetchPackages = async () => {
    const { data } = await supabase
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (data) setPackages(data)
  }

  const resetForm = () => {
    setForm({
      client_name: '', contact_number: '', email: '',
      event_type_id: '', event_date: '', package_id: '',
      custom_package_name: '', custom_package_price: '',
      notes: '', status: 'upcoming', shot_limit: 5,
    })
    setUseCustomPackage(false)
    setError('')
    setSuccess('')
    setSelectedEvent(null)
    setIsEditing(false)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (event) => {
    setIsEditing(true)
    setSelectedEvent(event)
    setUseCustomPackage(!!event.custom_package_name)
    setForm({
      client_name: event.client_name,
      contact_number: event.contact_number || '',
      email: event.email || '',
      event_type_id: event.event_type_id || '',
      event_date: event.event_date,
      package_id: event.package_id || '',
      custom_package_name: event.custom_package_name || '',
      custom_package_price: event.custom_package_price || '',
      notes: event.notes || '',
      status: event.status,
      shot_limit: event.shot_limit ?? 5,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      client_name: form.client_name,
      contact_number: form.contact_number,
      email: form.email,
      event_type_id: form.event_type_id || null,
      event_date: form.event_date,
      package_id: useCustomPackage ? null : (form.package_id || null),
      custom_package_name: useCustomPackage ? form.custom_package_name : null,
      custom_package_price: useCustomPackage ? form.custom_package_price : null,
      notes: form.notes,
      status: form.status,
      shot_limit: parseInt(form.shot_limit, 10) || 5,
    }

    if (isEditing) {
      const { error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', selectedEvent.id)
      if (error) { setError(error.message); return }
      setSuccess('Event updated!')
    } else {
      const { error } = await supabase.from('events').insert(payload)
      if (error) { setError(error.message); return }
      setSuccess('Event created!')
    }

    fetchEvents()
    setTimeout(() => { setShowModal(false); resetForm() }, 1500)
  }

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete "${event.client_name}'s" event?`)) return
    await supabase.from('events').delete().eq('id', event.id)
    fetchEvents()
  }

  const statusColor = (status) => {
    if (status === 'upcoming') return 'bg-blue-100 text-blue-500'
    if (status === 'completed') return 'bg-green-100 text-green-600'
    return 'bg-red-100 text-red-500'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-700">Clients & Events</h1>
          <p className="text-sm text-gray-400">Manage all client events</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Event
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pink-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Client</th>
                <th className="px-6 py-3 text-left">Event Type</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Package</th>
                <th className="px-6 py-3 text-left">Shots</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-400">
                    No events yet.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-700">{event.client_name}</p>
                      <p className="text-xs text-gray-400">{event.contact_number}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {event.event_types?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(event.event_date).toLocaleDateString('en-PH', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {event.custom_package_name
                        ? `${event.custom_package_name} (₱${event.custom_package_price})`
                        : event.packages
                          ? `${event.packages.name} (₱${event.packages.price})`
                          : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-pink-500 font-medium text-xs">
                        {event.shot_limit ?? 5} shots
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-x-2">
                      <button
                        onClick={() => openEditModal(event)}
                        className="text-blue-500 hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(event)}
                        className="text-red-400 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-700 mb-4">
              {isEditing ? 'Edit Event' : 'Add New Event'}
            </h2>

            {error && (
              <div className="bg-red-100 text-red-600 text-sm px-4 py-2 rounded-lg mb-3">{error}</div>
            )}
            {success && (
              <div className="bg-green-100 text-green-600 text-sm px-4 py-2 rounded-lg mb-3">{success}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Client Name</label>
                <input
                  type="text"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  required
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={form.contact_number}
                    onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Event Type</label>
                  <select
                    value={form.event_type_id}
                    onChange={(e) => setForm({ ...form, event_type_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  >
                    <option value="">Select type</option>
                    {eventTypes.map((et) => (
                      <option key={et.id} value={et.id}>{et.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Event Date</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    required
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>
              </div>

              {/* Shot Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Shot Limit
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.shot_limit}
                    onChange={(e) => setForm({ ...form, shot_limit: e.target.value })}
                    className="w-24 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  <span className="text-sm text-gray-400">
                    photos allowed for this event
                  </span>
                </div>
              </div>

              {/* Package Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom_pkg"
                  checked={useCustomPackage}
                  onChange={(e) => setUseCustomPackage(e.target.checked)}
                  className="accent-pink-500"
                />
                <label htmlFor="custom_pkg" className="text-sm text-gray-600">
                  Use custom package
                </label>
              </div>

              {useCustomPackage ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Package Name</label>
                    <input
                      type="text"
                      value={form.custom_package_name}
                      onChange={(e) => setForm({ ...form, custom_package_name: e.target.value })}
                      placeholder="e.g. 50/50 + 10"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Price (₱)</label>
                    <input
                      type="number"
                      value={form.custom_package_price}
                      onChange={(e) => setForm({ ...form, custom_package_price: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Package</label>
                  <select
                    value={form.package_id}
                    onChange={(e) => setForm({ ...form, package_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  >
                    <option value="">Select package</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} — ₱{pkg.price}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {isEditing ? 'Save Changes' : 'Create Event'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clients