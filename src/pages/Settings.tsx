import React from 'react';
import { Save, Bell, Lock, Globe, Mail } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">System Settings</h1>
        <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent">
          <Save className="-ml-1 mr-2 h-5 w-5" />
          Save Changes
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
                <form action="#" method="POST">
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6 sm:col-span-4">
                      <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">Company Name</label>
                      <input type="text" name="company-name" id="company-name" defaultValue="Dapur Laborasi" className="mt-1 focus:ring-accent focus:border-accent block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                      <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Currency</label>
                      <select id="currency" name="currency" className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm">
                        <option>USD ($)</option>
                        <option>IDR (Rp)</option>
                        <option>EUR (€)</option>
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
                        <input id="comments" name="comments" type="checkbox" className="focus:ring-accent h-4 w-4 text-primary border-gray-300 rounded" defaultChecked />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="comments" className="font-medium text-gray-700">Order Updates</label>
                        <p className="text-gray-500">Get notified when an order status changes.</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input id="candidates" name="candidates" type="checkbox" className="focus:ring-accent h-4 w-4 text-primary border-gray-300 rounded" />
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
