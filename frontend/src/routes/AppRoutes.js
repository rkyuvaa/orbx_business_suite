import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';

// Pages
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';

// Masters Module Pages
import Customers from '../pages/Masters/Customers';
import Suppliers from '../pages/Masters/Suppliers';
import Products from '../pages/Masters/Products';

// Transactions Module Pages
import Purchase from '../pages/Transactions/Purchase';
import Inventory from '../pages/Transactions/Inventory';
import Sales from '../pages/Transactions/Sales';
import Payments from '../pages/Transactions/Payments';
import Receipts from '../pages/Transactions/Receipts';

// Reports Module Pages
import ReportsDashboard from '../pages/Reports/ReportsDashboard';
import SalesReport from '../pages/Reports/SalesReport';
import InventoryReport from '../pages/Reports/InventoryReport';
import PurchaseReport from '../pages/Reports/PurchaseReport';

// Admin Module Pages
import CompanyConfig from '../pages/Admin/CompanyConfig';
import Branches from '../pages/Admin/Branches';
import UsersAndRoles from '../pages/Admin/UsersAndRoles';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Protected ERP Modules Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />

        {/* Masters Namespace */}
        <Route path="/masters">
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="products" element={<Products />} />
          <Route path="*" element={<Navigate to="customers" replace />} />
        </Route>

        {/* Transactions Namespace */}
        <Route path="/transactions">
          <Route path="purchase" element={<Purchase />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="payments" element={<Payments />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="*" element={<Navigate to="purchase" replace />} />
        </Route>

        {/* Reports Namespace */}
        <Route path="/reports">
          <Route path="dashboard" element={<ReportsDashboard />} />
          <Route path="sales" element={<SalesReport />} />
          <Route path="inventory" element={<InventoryReport />} />
          <Route path="purchase" element={<PurchaseReport />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Admin Namespace */}
        <Route path="/admin">
          <Route path="company" element={<CompanyConfig />} />
          <Route path="branches" element={<Branches />} />
          <Route path="users" element={<UsersAndRoles />} />
          <Route path="*" element={<Navigate to="company" replace />} />
        </Route>
      </Route>

      {/* Catch-all Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
