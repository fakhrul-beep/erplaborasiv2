
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    console.log('ProtectedRoute: Loading...');
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#f3f4f6',
        zIndex: 9999,
        color: '#333',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Loading Application...</h2>
          <p>Please wait while we authenticate your session.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user, redirecting to login', { from: location });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles) {
    // If user email is the superadmin fallback, allow access anyway
    if (user.email === 'fakhrul@ternakmart.com') {
      return <Outlet />;
    }

    if (!profile || !allowedRoles.includes(profile.role)) {
      console.log('ProtectedRoute: Access denied', { role: profile?.role, allowedRoles });
      
      // Prevent infinite redirect loop if we are already at root
      if (location.pathname === '/') {
          return (
              <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                  <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
                  <p className="mb-4">You do not have permission to view this page or your profile is incomplete.</p>
                  <button 
                      onClick={() => supabase.auth.signOut()}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                      Sign Out
                  </button>
              </div>
          );
      }
      
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}
