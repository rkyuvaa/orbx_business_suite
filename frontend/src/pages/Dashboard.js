import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Typography, useTheme, useMediaQuery } from '@mui/material';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const apps = [
    { label: 'Masters', icon: <PeopleIcon />, color: '#00B4D8', to: '/masters/customers' },
    { label: 'Purchase', icon: <PurchaseIcon />, color: '#E76F51', to: '/transactions/purchase' },
    { label: 'Inventory', icon: <InventoryIcon />, color: '#9B5DE5', to: '/transactions/inventory' },
    { label: 'Sales', icon: <SalesIcon />, color: '#F15BB5', to: '/transactions/sales' },
    { label: 'Accounting', icon: <PaymentReceiptIcon />, color: '#43AA8B', to: '/transactions/receipts' },
    { label: 'Reports', icon: <ReportDashboardIcon />, color: '#FFB703', to: '/reports/dashboard' },
    { label: 'Settings', icon: <CompanyIcon />, color: '#4A5759', to: '/admin/company' },
  ];

  return (
    <Box sx={{ 
      py: isMobile ? 2 : 4, 
      px: isMobile ? 2 : 4, 
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Grid 
        container 
        spacing={isMobile ? 3 : 5} 
        justifyContent="center" 
        alignItems="center"
        sx={{ maxWidth: '1000px', margin: '0 auto' }}
      >
        {apps.map((app, idx) => (
          <Grid 
            item 
            xs={6} 
            sm={4} 
            md={2.4} 
            key={idx}
            sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <Box
              onClick={() => navigate(app.to)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '120px',
                transition: 'transform 0.2s ease',
                '&:hover': {
                  '& .odoo-app-icon': {
                    transform: 'translateY(-6px)',
                    boxShadow: `0 14px 28px -6px ${app.color}80`,
                  },
                  '& .odoo-app-label': {
                    color: 'text.primary',
                    fontWeight: 700
                  }
                },
              }}
            >
              {/* Colored App Icon Block (Odoo Squircle Style) */}
              <Box
                className="odoo-app-icon"
                sx={{
                  width: isMobile ? '64px' : '84px',
                  height: isMobile ? '64px' : '84px',
                  borderRadius: isMobile ? '16px' : '22px',
                  backgroundColor: app.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  '& svg': {
                    fontSize: isMobile ? '32px' : '42px',
                    color: '#ffffff',
                  }
                }}
              >
                {app.icon}
              </Box>

              {/* Clean text label directly underneath */}
              <Typography
                className="odoo-app-label"
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontSize: isMobile ? '0.75rem' : '0.9rem',
                  textAlign: 'center',
                  color: '#475569',
                  mt: 1.5,
                  width: '100%',
                  lineHeight: 1.25,
                  transition: 'all 0.2s ease',
                }}
              >
                {app.label}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;
