import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Logo from './Logo';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  DollarSign,
  UserCog
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['superadmin', 'sales', 'purchasing', 'finance'] },
  { name: 'Inventory', href: '/inventory', icon: Package, roles: ['superadmin', 'sales', 'purchasing', 'finance'] },
  { name: 'Sales', href: '/sales', icon: ShoppingCart, roles: ['superadmin', 'sales'] },
  { name: 'Purchasing', href: '/purchasing', icon: Truck, roles: ['superadmin', 'purchasing'] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['superadmin', 'sales'] },
  { name: 'Suppliers', href: '/suppliers', icon: Building2, roles: ['superadmin', 'purchasing'] },
  { name: 'Payment Verification', href: '/finance/payments', icon: CreditCard, roles: ['superadmin', 'finance'] },
  { name: 'Cashflow', href: '/finance/cashflow', icon: DollarSign, roles: ['superadmin', 'finance'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['superadmin', 'sales', 'purchasing', 'finance'] },
  { name: 'User Management', href: '/admin/users', icon: UserCog, roles: ['superadmin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['superadmin', 'sales', 'purchasing', 'finance'] },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, profile, loading } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error", error);
    } finally {
      navigate('/login');
    }
  };

  const filteredNavigation = navigation.filter(item => {
     if (loading) return false;
     // Fallback: if user is superadmin email, show everything even if profile lag
     if (user?.email === 'fakhrul@dapurlaborasi.com') return true;
     
     if (!profile) return false;
     return item.roles.includes(profile.role);
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 flex ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ease-in-out duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        
        <div
          className={`relative flex-1 flex flex-col max-w-xs w-full bg-white transition ease-in-out duration-300 transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>

          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <Logo className="h-10 w-auto" />
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                      isActive
                        ? 'bg-accent text-primary'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={`mr-4 h-6 w-6 flex-shrink-0 ${
                        isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <button
              onClick={handleSignOut}
              className="flex-shrink-0 group block w-full flex items-center"
            >
              <div className="flex items-center">
                <LogOut className="inline-block h-9 w-9 rounded-full text-gray-400 p-1 bg-gray-100" />
                <div className="ml-3">
                  <p className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                    Sign Out
                  </p>
                  <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                    {user?.email}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <Logo className="h-10 w-auto" />
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-accent text-primary'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-6 w-6 flex-shrink-0 ${
                        isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <button
              onClick={handleSignOut}
              className="flex-shrink-0 w-full group block"
            >
              <div className="flex items-center">
                <div className="inline-block h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-sm font-medium leading-none text-gray-700">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {user?.email}
                  </p>
                  <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                    Sign Out
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-100">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
        </div>
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
