import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import ProductList from './pages/Inventory/ProductList';
import ProductForm from './pages/Inventory/ProductForm';
import OrderList from './pages/Sales/OrderList';
import OrderForm from './pages/Sales/OrderForm';
import PurchaseOrderList from './pages/Purchasing/PurchaseOrderList';
import PurchaseOrderForm from './pages/Purchasing/PurchaseOrderForm';
import CustomerList from './pages/Customers/CustomerList';
import CustomerForm from './pages/Customers/CustomerForm';
import SupplierList from './pages/Suppliers/SupplierList';
import SupplierForm from './pages/Suppliers/SupplierForm';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import UserManagement from './pages/Admin/UserManagement';
import PaymentVerification from './pages/Finance/PaymentVerification';
import Cashflow from './pages/Finance/Cashflow';

function App() {
  const { checkUser } = useAuthStore();

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            
            <Route path="/inventory/equipment" element={<ProductList type="equipment" />} />
            <Route path="/inventory/equipment/new" element={<ProductForm type="equipment" />} />
            <Route path="/inventory/equipment/:id/edit" element={<ProductForm type="equipment" />} />

            <Route path="/inventory/raw-materials" element={<ProductList type="raw_material" />} />
            <Route path="/inventory/raw-materials/new" element={<ProductForm type="raw_material" />} />
            <Route path="/inventory/raw-materials/:id/edit" element={<ProductForm type="raw_material" />} />
            
            {/* Sales Routes */}
            <Route path="/sales/new" element={<OrderForm />} />
            <Route path="/sales/:id/edit" element={<OrderForm />} />
            <Route path="/sales/equipment" element={<OrderList type="equipment" />} />
            <Route path="/sales/equipment/new" element={<OrderForm type="equipment" />} />
            <Route path="/sales/equipment/:id/edit" element={<OrderForm type="equipment" />} />
            
            <Route path="/sales/raw-materials" element={<OrderList type="raw_material" />} />
            <Route path="/sales/raw-materials/new" element={<OrderForm type="raw_material" />} />
            <Route path="/sales/raw-materials/:id/edit" element={<OrderForm type="raw_material" />} />

            {/* Purchasing Routes */}
            <Route path="/purchasing/new" element={<PurchaseOrderForm />} />
            <Route path="/purchasing/:id/edit" element={<PurchaseOrderForm />} />
            <Route path="/purchasing/equipment" element={<PurchaseOrderList type="equipment" />} />
            <Route path="/purchasing/equipment/new" element={<PurchaseOrderForm type="equipment" />} />
            <Route path="/purchasing/equipment/:id/edit" element={<PurchaseOrderForm type="equipment" />} />

            <Route path="/purchasing/raw-materials" element={<PurchaseOrderList type="raw_material" />} />
            <Route path="/purchasing/raw-materials/new" element={<PurchaseOrderForm type="raw_material" />} />
            <Route path="/purchasing/raw-materials/:id/edit" element={<PurchaseOrderForm type="raw_material" />} />
            
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            
            <Route path="/suppliers" element={<SupplierList />} />
            <Route path="/suppliers/new" element={<SupplierForm />} />
            <Route path="/suppliers/:id/edit" element={<SupplierForm />} />
            
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/finance/payments" element={<PaymentVerification />} />
            <Route path="/finance/cashflow" element={<Cashflow />} />
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
