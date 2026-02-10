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
            
            <Route path="/inventory" element={<ProductList />} />
            <Route path="/inventory/new" element={<ProductForm />} />
            <Route path="/inventory/:id/edit" element={<ProductForm />} />
            
            <Route path="/sales" element={<OrderList />} />
            <Route path="/sales/new" element={<OrderForm />} />
            <Route path="/sales/:id/edit" element={<OrderForm />} />
            
            <Route path="/purchasing" element={<PurchaseOrderList />} />
            <Route path="/purchasing/new" element={<PurchaseOrderForm />} />
            <Route path="/purchasing/:id/edit" element={<PurchaseOrderForm />} />
            
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
