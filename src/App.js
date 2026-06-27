import { useState, useEffect } from 'react'
import Login from './pages/login'
import Sidebar from './components/sidebar'
import Dashboard from './pages/dashboard'
import UserManagement from './maintenance/user_management'
import Clients from './pages/client'
import ImageHistory from './pages/image_history'
import Booth from './pages/booth'

function App() {
  const [user, setUser] = useState(null)
  const [activePage, setActivePage] = useState('dashboard')

  useEffect(() => {
    const savedUser = localStorage.getItem('instax_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('instax_user')
    setUser(null)
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard user={user} />
      case 'user_management': return <UserManagement />
      case 'clients': return <Clients />
      case 'image_history': return <ImageHistory />
      case 'booth': return <Booth />
      default: return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-700 capitalize">
            {activePage.replace('_', ' ')}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Coming soon...</p>
        </div>
      )
    }
  }

  if (!user) return <Login onLogin={handleLogin} />

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Nav */}
        <div className="bg-white shadow-sm px-6 py-3 flex justify-between items-center">
          <p className="text-sm text-gray-400 capitalize">
            {activePage.replace('_', ' ')}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">👤 {user.full_name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-red-400"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}

export default App