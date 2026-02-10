import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-primary p-3 rounded-lg">
            <LayoutDashboard className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900">Welcome to ERP Laborasi</h2>
        <p className="mt-2 text-gray-600">Integrated Management System</p>
        
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
          >
            Login to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
