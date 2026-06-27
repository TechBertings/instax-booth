import { useState } from 'react'

const menuItems = [
  {
    label: 'Dashboard',
    icon: '🏠',
    key: 'dashboard',
  },
  {
    label: 'Booth',
    icon: '📸',
    key: 'booth',
  },
  {
    label: 'Upload',
    icon: '📤',
    key: 'upload',
  },
  {
    label: 'Image History',
    icon: '🖼️',
    key: 'image_history',
  },
  {
    label: 'Transactions',
    icon: '💳',
    key: 'transactions',
  },
  {
    label: 'Clients & Events',
    icon: '🎉',
    key: 'clients',
  },
  {
    label: 'Maintenance',
    icon: '⚙️',
    key: 'maintenance',
    children: [
      { label: 'User Management', key: 'user_management' },
    ],
  },
]

function Sidebar({ activePage, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false)
  const [openMenus, setOpenMenus] = useState(['maintenance'])

  const toggleMenu = (key) => {
    setOpenMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  return (
    <div
      className={`bg-white shadow-md h-screen flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        {!collapsed && (
          <span className="text-pink-500 font-bold text-sm">📸 Instax Booth</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-pink-500 transition ml-auto"
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {menuItems.map((item) => (
          <div key={item.key}>
            {/* Parent Item */}
            <button
              onClick={() => {
                if (item.children) {
                  toggleMenu(item.key)
                } else {
                  onNavigate(item.key)
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition mb-1 ${
                activePage === item.key
                  ? 'bg-pink-50 text-pink-500'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-pink-400'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.children && (
                    <span className="text-xs text-gray-300">
                      {openMenus.includes(item.key) ? '▲' : '▼'}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Children */}
            {item.children && openMenus.includes(item.key) && !collapsed && (
              <div className="ml-6 mb-1">
                {item.children.map((child) => (
                  <button
                    key={child.key}
                    onClick={() => onNavigate(child.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                      activePage === child.key
                        ? 'bg-pink-50 text-pink-500 font-medium'
                        : 'text-gray-400 hover:bg-gray-50 hover:text-pink-400'
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  )
}

export default Sidebar