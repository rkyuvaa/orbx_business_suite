import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Typography, Paper } from '@mui/material';
import {
  People as PeopleIcon,
  LocalShipping as SupplierIcon,
  Inventory as ProductIcon,
  ShoppingBag as PurchaseIcon,
  Warehouse as InventoryIcon,
  ShoppingCart as SalesIcon,
  Payments as PaymentReceiptIcon,
  ReceiptLong as PaymentUpdateIcon,
  Dashboard as ReportDashboardIcon,
  ShowChart as SalesReportIcon,
  Assessment as InventoryReportIcon,
  BarChart as PurchaseReportIcon,
  Business as CompanyIcon,
  Store as BranchIcon,
  Group as UserIcon
} from '@mui/icons-material';

const Dashboard = () => {
  const navigate = useNavigate();

  const tileGroups = [
    {
      title: 'MASTERS',
      tiles: [
        { label: 'Customer Master', icon: <PeopleIcon sx={{ fontSize: 32 }} />, color: '#1b4332', to: '/masters/customers' },
        { label: 'Supplier Master', icon: <SupplierIcon sx={{ fontSize: 32 }} />, color: '#0d3b66', to: '/masters/suppliers' },
        { label: 'Product Master', icon: <ProductIcon sx={{ fontSize: 32 }} />, color: '#2d6a4f', to: '/masters/products' },
      ],
    },
    {
      title: 'TRANSACTIONS',
      tiles: [
        { label: 'Purchase', icon: <PurchaseIcon sx={{ fontSize: 32 }} />, color: '#e76f51', to: '/transactions/purchase' },
        { label: 'Inventory', icon: <InventoryIcon sx={{ fontSize: 32 }} />, color: '#8338ec', to: '/transactions/inventory' },
        { label: 'Sales', icon: <SalesIcon sx={{ fontSize: 32 }} />, color: '#3a86c8', to: '/transactions/sales' },
        { label: 'Payment Receipt', icon: <PaymentReceiptIcon sx={{ fontSize: 32 }} />, color: '#38b000', to: '/transactions/receipts' },
        { label: 'Payment Update', icon: <PaymentUpdateIcon sx={{ fontSize: 32 }} />, color: '#d90429', to: '/transactions/payments' },
      ],
    },
    {
      title: 'REPORTS',
      tiles: [
        { label: 'Reports Dashboard', icon: <ReportDashboardIcon sx={{ fontSize: 32 }} />, color: '#ffb703', to: '/reports/dashboard' },
        { label: 'Sales Reports', icon: <SalesReportIcon sx={{ fontSize: 32 }} />, color: '#00b4d8', to: '/reports/sales' },
        { label: 'Inventory Reports', icon: <InventoryReportIcon sx={{ fontSize: 32 }} />, color: '#7209b7', to: '/reports/inventory' },
        { label: 'Purchase Reports', icon: <PurchaseReportIcon sx={{ fontSize: 32 }} />, color: '#ff006e', to: '/reports/purchase' },
      ],
    },
    {
      title: 'ADMIN',
      tiles: [
        { label: 'Company Config', icon: <CompanyIcon sx={{ fontSize: 32 }} />, color: '#4a5759', to: '/admin/company' },
        { label: 'Branches', icon: <BranchIcon sx={{ fontSize: 32 }} />, color: '#028090', to: '/admin/branches' },
        { label: 'Users & Roles', icon: <UserIcon sx={{ fontSize: 32 }} />, color: '#3f51b5', to: '/admin/users' },
      ],
    },
  ];

  return (
    <Box sx={{ py: 2 }}>
      <Typography variant="h1" sx={{ fontSize: '1.75rem', fontWeight: 800, mb: 4, letterSpacing: '-0.5px' }}>
        App Dashboard
      </Typography>

      {tileGroups.map((group, gIdx) => (
        <Box key={gIdx} sx={{ mb: 5 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: '1.5px',
              mb: 2,
              borderBottom: '2px solid #e2e8f0',
              pb: 1,
            }}
          >
            {group.title}
          </Typography>

          <Grid container spacing={3}>
            {group.tiles.map((tile, tIdx) => (
              <Grid item xs={6} sm={4} md={2.4} key={tIdx}>
                <Paper
                  onClick={() => navigate(tile.to)}
                  sx={{
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: `0 12px 28px rgba(0, 0, 0, 0.08)`,
                      borderColor: tile.color,
                      '& .tile-icon': {
                        color: tile.color,
                        transform: 'scale(1.1)'
                      }
                    },
                  }}
                >
                  <Box
                    className="tile-icon"
                    sx={{
                      color: 'text.secondary',
                      mb: 2,
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    {tile.icon}
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      color: 'text.primary',
                    }}
                  >
                    {tile.label}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default Dashboard;
