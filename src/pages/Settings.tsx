import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import toast from 'react-hot-toast';

export default function Settings() {
  const { general, notifications, updateGeneralSettings, updateNotificationSettings, loading } = useSettingsStore();
  
  // Local state for forms
  const [formData, setFormData] = useState({
    company_name: '',
    currency: 'IDR',
    timezone: ''
  });

  const [notifData, setNotifData] = useState({
    order_updates: true,
    low_stock_alerts: true
  });

  useEffect(() => {
    setFormData(general as any);
    setNotifData(notifications);
  }, [general, notifications]);

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateGeneralSettings(formData as any);
      toast.success('General settings updated successfully');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleNotificationSubmit = async () => {
     try {
      await updateNotificationSettings(notifData);
      // Toast handled in general submit if triggered together, or separately here
     } catch (error) {
      console.error(error);
     }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">System Settings</h1>
        <button 
          onClick={async (e) => {
              await handleGeneralSubmit(e);
              await handleNotificationSubmit();
          }}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
        >
          <Save className="-ml-1 mr-2 h-5 w-5" />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="divide-y divide-gray-200">
          
          {/* General Settings */}
          <div className="px-4 py-5 sm:p-6">
            <div className="md:grid md:grid-cols-3 md:gap-6">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium leading-6 text-gray-900">General Information</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Basic configuration for the ERP system.
                </p>
              </div>
              <div className="mt-5 md:mt-0 md:col-span-2">
                <form onSubmit={handleGeneralSubmit}>
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6 sm:col-span-4">
                      <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">Company Name</label>
                      <input 
                        type="text" 
                        name="company-name" 
                        id="company-name" 
                        value={formData.company_name || ''}
                        onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                        className="mt-1 focus:ring-accent focus:border-accent block w-full shadow-sm sm:text-sm border-gray-300 rounded-md py-2 px-3" 
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                      <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Currency</label>
                      <select 
                        id="currency" 
                        name="currency" 
                        value={formData.currency}
                        onChange={(e) => setFormData({...formData, currency: e.target.value})}
                        className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="IDR">IDR (Rp)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="px-4 py-5 sm:p-6">
            <div className="md:grid md:grid-cols-3 md:gap-6">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Notifications</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Manage how you receive alerts and notifications.
                </p>
              </div>
              <div className="mt-5 md:mt-0 md:col-span-2">
                <fieldset>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input 
                          id="comments" 
                          name="comments" 
                          type="checkbox" 
                          checked={notifData.order_updates}
                          onChange={(e) => setNotifData({...notifData, order_updates: e.target.checked})}
                          className="focus:ring-accent h-4 w-4 text-primary border-gray-300 rounded" 
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="comments" className="font-medium text-gray-700">Order Updates</label>
                        <p className="text-gray-500">Get notified when an order status changes.</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input 
                          id="candidates" 
                          name="candidates" 
                          type="checkbox" 
                          checked={notifData.low_stock_alerts}
                          onChange={(e) => setNotifData({...notifData, low_stock_alerts: e.target.checked})}
                          className="focus:ring-accent h-4 w-4 text-primary border-gray-300 rounded" 
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="candidates" className="font-medium text-gray-700">Low Stock Alerts</label>
                        <p className="text-gray-500">Get notified when product stock is running low.</p>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="px-4 py-5 sm:p-6">
             <div className="md:grid md:grid-cols-3 md:gap-6">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Security</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Update your password and security settings.
                </p>
              </div>
              <div className="mt-5 md:mt-0 md:col-span-2">
                <button className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent">
                  Change Password
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
