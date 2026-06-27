import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function UserManagement() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

const [form, setForm] = useState({
  full_name: '',
  username: '',
  email: '',
  password: '',
  role_id: '',
  is_active: true,
})

  useEffect(() => {
    fetchUsers()
    fetchRoles()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, roles(name)')
      .order('created_at', { ascending: false })

    if (!error) setUsers(data)
    setLoading(false)
  }

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*').order('name')
    if (data) setRoles(data)
  }

  const resetForm = () => {
  setForm({ full_name: '', username: '', email: '', password: '', role_id: '', is_active: true })
  setError('')
  setSuccess('')
  setSelectedUser(null)
  setIsEditing(false)
}

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

const openEditModal = (user) => {
  setIsEditing(true)
  setSelectedUser(user)
  setForm({
    full_name: user.full_name,
    username: user.username || '',
    email: user.email,
    password: '',
    role_id: user.role_id || '',
    is_active: user.is_active,
  })
  setShowModal(true)
}

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (isEditing) {
      // Update profile
   const { error: updateError } = await supabase
  .from('profiles')
  .update({
    full_name: form.full_name,
    username: form.username,
    role_id: form.role_id || null,
    is_active: form.is_active,
  })
  .eq('id', selectedUser.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess('User updated successfully!')
    } else {
      // Create new user via Supabase Admin (using signUp)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name }
        }
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // Assign role
     if (data.user && form.role_id) {
  await supabase
    .from('profiles')
    .update({ 
      role_id: form.role_id,
      username: form.username,
    })
    .eq('id', data.user.id)
}

      setSuccess('User created successfully!')
    }

    fetchUsers()
    setTimeout(() => {
      setShowModal(false)
      resetForm()
    }, 1500)
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.full_name}"? This cannot be undone.`)) return

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (error) {
      alert(error.message)
    } else {
      fetchUsers()
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-700">User Management</h1>
          <p className="text-sm text-gray-400">Manage system users and roles</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add User
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading users...</p>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pink-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Username</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">Role</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {user.full_name || '—'}
                    </td>
                     <td className="px-6 py-4 text-gray-500">
    @{user.username || '—'}
  </td>
                    <td className="px-6 py-4 text-gray-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="bg-pink-100 text-pink-600 px-2 py-1 rounded-full text-xs font-medium">
                        {user.roles?.name || 'No Role'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-500'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-x-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-500 hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-700 mb-4">
              {isEditing ? 'Edit User' : 'Create New User'}
            </h2>

            {error && (
              <div className="bg-red-100 text-red-600 text-sm px-4 py-2 rounded-lg mb-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-100 text-green-600 text-sm px-4 py-2 rounded-lg mb-3">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
              <div>
  <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
  <input
    type="text"
    value={form.username}
    onChange={(e) => setForm({ ...form, username: e.target.value })}
    required
    placeholder="e.g. juan_dela_cruz"
    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
  />
</div>

              {!isEditing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={form.role_id}
                  onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {isEditing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="accent-pink-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-600">Active</label>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {isEditing ? 'Save Changes' : 'Create User'}
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

export default UserManagement