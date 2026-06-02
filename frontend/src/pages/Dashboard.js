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

  const tileGroups = [
    {
      title: 'MASTERS',
      tiles: [
        { label: 'Customer Master', icon: <PeopleIcon />, color: '#00B4D8', to: '/masters/customers' },
        { label: 'Supplier Master', icon: <SupplierIcon />, color: '#0077B6', to: '/masters/suppliers' },
        { label: 'Product Master', icon: <ProductIcon />, color: '#03045E', to: '/masters/products' },
      ],
    },
    {
      title: 'TRANSACTIONS',
      tiles: [
        { label: 'Purchase', icon: <PurchaseIcon />, color: '#E76F51', to: '/transactions/purchase' },
        { label: 'Inventory', icon: <InventoryIcon />, color: '#9B5DE5', to: '/transactions/inventory' },
        { label: 'Sales', icon: <SalesIcon />, color: '#F15BB5', to: '/transactions/sales' },
        { label: 'Payment Receipt', icon: <PaymentReceiptIcon />, color: '#43AA8B', to: '/transactions/receipts' },
        { label: 'Payment Update', icon: <PaymentUpdateIcon />, color: '#F94144', to: '/transactions/payments' },
      ],
    },
    {
      title: 'REPORTS',
      tiles: [
        { label: 'Reports Dashboard', icon: <ReportDashboardIcon />, color: '#FFB703', to: '/reports/dashboard' },
        { label: 'Sales Reports', icon: <SalesReportIcon />, color: '#2A9D8F', to: '/reports/sales' },
        { label: 'Inventory Reports', icon: <InventoryReportIcon />, color: '#7209B7', to: '/reports/inventory' },
        { label: 'Purchase Reports', icon: <PurchaseReportIcon />, color: '#F72585', to: '/reports/purchase' },
      ],
    },
    {
      title: 'ADMIN',
      tiles: [
        { label: 'Company Config', icon: <CompanyIcon />, color: '#4A5759', to: '/admin/company' },
        { label: 'Branches', icon: <BranchIcon />, color: '#4D908E', to: '/admin/branches' },
        { label: 'Users & Roles', icon: <UserIcon />, color: '#3F51B5', to: '/admin/users' },
      ],
    },
  ];

  return (
    <Box sx={{ py: isMobile ? 1 : 2, px: isMobile ? 1 : 3 }}>
      <Typography 
        variant="h1" 
        sx={{ 
          fontSize: isMobile ? '1.5rem' : '1.75rem', 
          fontWeight: 800, 
          mb: isMobile ? 3 : 5, 
          letterSpacing: '-0.5px',
          color: '#1b4332'
        }}
      >
        App Dashboard
      </Typography>

      {tileGroups.map((group, gIdx) => (
        <Box key={gIdx} sx={{ mb: isMobile ? 4 : 6 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: '2px',
              mb: 3,
              borderBottom: '1px solid #e2e8f0',
              pb: 1,
            }}
          >
            {group.title}
          </Typography>

          <Grid container spacing={isMobile ? 3 : 4}>
            {group.tiles.map((tile, tIdx) => (
              <Grid 
                item 
                xs={4} 
                sm={3} 
                md={2} 
                key={tIdx}
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'center' 
                }}
              >
                <Box
                  onClick={() => navigate(tile.to)}
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
                        transform: 'translateY(-6px) scale(1.05)',
                        boxShadow: `0 12px 24px -6px ${tile.color}80`,
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
                      width: isMobile ? '64px' : '76px',
                      height: isMobile ? '64px' : '76px',
                      borderRadius: isMobile ? '16px' : '20px',
                      backgroundColor: tile.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      '& svg': {
                        fontSize: isMobile ? '32px' : '38px',
                        color: '#ffffff',
                      }
                    }}
                  >
                    {tile.icon}
                  </Box>

                  {/* Clean text label directly underneath (no card wrapper) */}
                  <Typography
                    className="odoo-app-label"
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      fontSize: isMobile ? '0.7rem' : '0.8rem',
                      textAlign: 'center',
                      color: '#475569',
                      mt: 1.5,
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.25,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {tile.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default Dashboard;
