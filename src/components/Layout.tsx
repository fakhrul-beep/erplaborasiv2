import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Logo from './Logo';
import {
  LayoutDashboard,
  Package,
  Utensils,
  Wheat,
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
  UserCog,
  Container,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  FileText
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['superadmin', 'sales', 'sales_equipment', 'sales_raw_material', 'purchasing', 'finance', 'delivery'] },
  
  // Section: Logistik (Logistics)
  { 
    name: 'Logistik', 
    icon: Truck, 
    roles: ['superadmin', 'admin', 'manager', 'logistik', 'delivery'],
    children: [
      { name: 'Dashboard Logistik', href: '/delivery/dashboard', icon: LayoutDashboard },
      { name: 'Pengiriman Perlengkapan', href: '/delivery/penerimaan', icon: Container },
      { name: 'Pengiriman Bahan Baku', href: '/delivery/pengiriman', icon: ShoppingBag },
      { name: 'Vendor Ekspedisi', href: '/delivery/vendors', icon: Building2 },
      { name: 'Tracking Real-time', href: '/delivery/tracking', icon: Package },
      { name: 'Laporan Logistik', href: '/delivery/reports', icon: BarChart3 },
    ]
  },

  // Section: Perlengkapan (Equipment)
  { 
    name: 'Perlengkapan', 
    icon: Utensils, 
    roles: ['superadmin', 'sales', 'sales_equipment', 'purchasing', 'finance'],
    children: [
      { name: 'Stok', href: '/inventory/equipment', icon: Container },
      { name: 'Stock Opname', href: '/inventory/equipment/opname', icon: FileText },
      { name: 'Penjualan', href: '/sales/equipment', icon: ShoppingBag },
      { name: 'Pembelian', href: '/purchasing/equipment', icon: Truck },
    ]
  },

  // Section: Bahan Baku (Raw Materials)
  { 
    name: 'Bahan Baku', 
    icon: Wheat, 
    roles: ['superadmin', 'sales', 'sales_raw_material', 'purchasing', 'finance'],
    children: [
      { name: 'Stok', href: '/inventory/raw-materials', icon: Container },
      { name: 'Stock Opname', href: '/inventory/raw-materials/opname', icon: FileText },
      { name: 'Penjualan', href: '/sales/raw-materials', icon: ShoppingBag },
      { name: 'Pembelian', href: '/purchasing/raw-materials', icon: Truck },
    ]
  },
  
  { name: 'Mutasi Stok', href: '/inventory/stock-movements', icon: FileText, roles: ['superadmin', 'admin', 'manager'] },
  
  { name: 'Customers', href: '/customers', icon: Users, roles: ['superadmin', 'sales', 'sales_equipment', 'sales_raw_material'] },
  { name: 'Suppliers', href: '/suppliers', icon: Truck, roles: ['superadmin', 'purchasing', 'sales_equipment', 'sales_raw_material'] },
  { name: 'Payment Verification', href: '/finance/payments', icon: CreditCard, roles: ['superadmin', 'finance'] },
  { name: 'Cashflow', href: '/finance/cashflow', icon: DollarSign, roles: ['superadmin', 'finance'] },
  { name: 'Documents', href: '/documents', icon: FileText, roles: ['superadmin', 'finance', 'sales', 'purchasing'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['superadmin', 'sales', 'sales_equipment', 'sales_raw_material', 'purchasing', 'finance'] },
  { name: 'User Management', href: '/admin/users', icon: UserCog, roles: ['superadmin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['superadmin', 'sales', 'sales_equipment', 'sales_raw_material', 'purchasing', 'finance'] },
];

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  roles: string[];
  children?: { name: string; href: string; icon: any }[];
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]); // Default collapsed for everyone initially
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, profile, loading } = useAuthStore();

  // Effect to auto-expand sections based on role or active route
  useEffect(() => {
    try {
      // Auto-expand if active child (always check this regardless of profile loading)
      const activeSection = navigation.find(item => 
        item.children?.some(child => location.pathname.startsWith(child.href))
      );
      if (activeSection) {
        setExpandedSections(prev => Array.from(new Set([...prev, activeSection.name])));
      }

      if (profile) {
        // If user is specific sales role, expand only their section as a default preference
        if (profile.role === 'sales_equipment') {
          setExpandedSections((prev) => Array.from(new Set([...prev, 'Perlengkapan'])));
        } else if (profile.role === 'sales_raw_material') {
           setExpandedSections((prev) => Array.from(new Set([...prev, 'Bahan Baku'])));
        }
      }
    } catch (error) {
      console.error("Error in auto-expand effect:", error);
    }
  }, [profile, location.pathname]);

  const toggleSection = (sectionName: string) => {
    try {
      setExpandedSections(prev => 
        prev.includes(sectionName) 
          ? prev.filter(name => name !== sectionName)
          : [...prev, sectionName]
      );
    } catch (error) {
      console.error("Error toggling section:", error);
    }
  };

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
     if (user?.email === 'fakhrul@ternakmart.com') return true;
     
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
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
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
                // Handle nested items for mobile (Fix for bug: Mobile menu not expanding)
                // This logic mirrors the desktop sidebar expansion logic but adapted for mobile UI
                if (item.children) {
                  const isExpanded = expandedSections.includes(item.name);
                  const hasActiveChild = item.children.some(child => location.pathname.startsWith(child.href));
                  
                  return (
                    <div key={item.name} className="space-y-1">
                      {/* Parent Item Toggle */}
                      <button
                        onClick={() => toggleSection(item.name)}
                        className={`group w-full flex items-center justify-between px-2 py-2 text-base font-medium rounded-md ${
                          hasActiveChild ? 'bg-gray-50 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center">
                          <item.icon className={`mr-4 h-6 w-6 flex-shrink-0 ${
                            hasActiveChild ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
                          }`} />
                          {item.name}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      
                      {/* Animated expansion container with smooth transition */}
                      <div 
                        className={`overflow-hidden transition-all duration-200 ease-in-out ${
                          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="space-y-1 pl-11">
                          {item.children.map((child) => {
                            const isChildActive = location.pathname === child.href;
                            return (
                              <Link
                                key={child.name}
                                to={child.href}
                                className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                                  isChildActive
                                    ? 'bg-accent text-primary'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                                // Close sidebar when a child link is clicked for better UX
                                onClick={() => setSidebarOpen(false)}
                              >
                                <child.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                                  isChildActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
                                }`} />
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href || '#'}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                      isActive
                        ? 'bg-accent text-primary-900 font-semibold shadow-sm ring-1 ring-accent-600/20'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={`mr-4 h-6 w-6 flex-shrink-0 ${
                        isActive ? 'text-primary-800' : 'text-gray-400 group-hover:text-gray-500'
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
                // If item has children, render as accordion/section
                if (item.children) {
                  const isExpanded = expandedSections.includes(item.name);
                  const hasActiveChild = item.children.some(child => location.pathname.startsWith(child.href));
                  
                  return (
                    <div key={item.name} className="space-y-1">
                      <button
                        onClick={() => toggleSection(item.name)}
                        className={`group w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md ${
                          hasActiveChild ? 'bg-gray-50 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center">
                          <item.icon className={`mr-3 h-6 w-6 flex-shrink-0 ${
                            hasActiveChild ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
                          }`} />
                          {item.name}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                      
                      {/* Animated expansion container for desktop */}
                      <div 
                        className={`overflow-hidden transition-all duration-200 ease-in-out ${
                          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="space-y-1 pl-11">
                          {item.children.map((child) => {
                            const isChildActive = location.pathname === child.href;
                            return (
                              <Link
                                key={child.name}
                                to={child.href}
                                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                                  isChildActive
                                    ? 'bg-accent text-primary-900 font-semibold shadow-sm ring-1 ring-accent-600/20'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                              >
                                <child.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                                  isChildActive ? 'text-primary-800' : 'text-gray-400 group-hover:text-gray-500'
                                }`} />
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href || '#'}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-accent text-primary-900 font-semibold shadow-sm ring-1 ring-accent-600/20'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-6 w-6 flex-shrink-0 ${
                        isActive ? 'text-primary-800' : 'text-gray-400 group-hover:text-gray-500'
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
