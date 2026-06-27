function Dashboard({ user }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-700">Welcome back, {user?.full_name}! 👋</h1>
      <p className="text-gray-400 text-sm mt-1">Here's what's happening today.</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm text-gray-400">Total Clients</p>
          <h2 className="text-3xl font-bold text-pink-500 mt-1">0</h2>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm text-gray-400">Total Images</p>
          <h2 className="text-3xl font-bold text-pink-500 mt-1">0</h2>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-sm text-gray-400">This Month's Revenue</p>
          <h2 className="text-3xl font-bold text-pink-500 mt-1">₱0</h2>
        </div>
      </div>
    </div>
  )
}

export default Dashboard