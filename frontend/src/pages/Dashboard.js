import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Typography, Paper, useTheme, useMediaQuery } from '@mui/material';
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
        { label: 'Customer Master', icon: <PeopleIcon />, color: '#1b4332', to: '/masters/customers' },
        { label: 'Supplier Master', icon: <SupplierIcon />, color: '#0d3b66', to: '/masters/suppliers' },
        { label: 'Product Master', icon: <ProductIcon />, color: '#2d6a4f', to: '/masters/products' },
      ],
    },
    {
      title: 'TRANSACTIONS',
      tiles: [
        { label: 'Purchase', icon: <PurchaseIcon />, color: '#e76f51', to: '/transactions/purchase' },
        { label: 'Inventory', icon: <InventoryIcon />, color: '#8338ec', to: '/transactions/inventory' },
        { label: 'Sales', icon: <SalesIcon />, color: '#3a86c8', to: '/transactions/sales' },
        { label: 'Payment Receipt', icon: <PaymentReceiptIcon />, color: '#38b000', to: '/transactions/receipts' },
        { label: 'Payment Update', icon: <PaymentUpdateIcon />, color: '#d90429', to: '/transactions/payments' },
      ],
    },
    {
      title: 'REPORTS',
      tiles: [
        { label: 'Reports Dashboard', icon: <ReportDashboardIcon />, color: '#ffb703', to: '/reports/dashboard' },
        { label: 'Sales Reports', icon: <SalesReportIcon />, color: '#00b4d8', to: '/reports/sales' },
        { label: 'Inventory Reports', icon: <InventoryReportIcon />, color: '#7209b7', to: '/reports/inventory' },
        { label: 'Purchase Reports', icon: <PurchaseReportIcon />, color: '#ff006e', to: '/reports/purchase' },
      ],
    },
    {
      title: 'ADMIN',
      tiles: [
        { label: 'Company Config', icon: <CompanyIcon />, color: '#4a5759', to: '/admin/company' },
        { label: 'Branches', icon: <BranchIcon />, color: '#028090', to: '/admin/branches' },
        { label: 'Users & Roles', icon: <UserIcon />, color: '#3f51b5', to: '/admin/users' },
      ],
    },
  ];

  return (
    <Box sx={{ py: isMobile ? 1 : 2 }}>
      <Typography 
        variant="h1" 
        sx={{ 
          fontSize: isMobile ? '1.5rem' : '1.75rem', 
          fontWeight: 800, 
          mb: isMobile ? 3 : 4, 
          letterSpacing: '-0.5px',
          color: '#1b4332'
        }}
      >
        App Dashboard
      </Typography>

      {tileGroups.map((group, gIdx) => (
        <Box key={gIdx} sx={{ mb: isMobile ? 4 : 5 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: '2px',
              mb: 3,
              borderBottom: '2px solid #e2e8f0',
              pb: 1,
            }}
          >
            {group.title}
          </Typography>

          <Grid container spacing={isMobile ? 2 : 3}>
            {group.tiles.map((tile, tIdx) => (
              <Grid item xs={6} sm={4} md={2.4} key={tIdx}>
                <Paper
                  onClick={() => navigate(tile.to)}
                  sx={{
                    p: isMobile ? 2 : 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderRadius: '24px',
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.01)',
                    aspectRatio: '1 / 1',
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: `0 20px 35px -10px ${tile.color}33`,
                      borderColor: tile.color,
                      '& .tile-icon-container': {
                        backgroundColor: tile.color,
                        transform: 'scale(1.05)',
                        '& svg': {
                          color: '#ffffff',
                          transform: 'rotate(5deg)'
                        }
                      },
                      '& .tile-label': {
                        color: tile.color
                      }
                    },
                  }}
                >
                  <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box
                      className="tile-icon-container"
                      sx={{
                        width: isMobile ? '56px' : '72px',
                        height: isMobile ? '56px' : '72px',
                        borderRadius: '20px',
                        backgroundColor: `${tile.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '& svg': {
                          fontSize: isMobile ? '28px' : '36px',
                          color: tile.color,
                          transition: 'all 0.3s ease',
                        }
                      }}
                    >
                      {tile.icon}
                    </Box>
                  </Box>

                  <Typography
                    className="tile-label"
                    variant="body1"
                    sx={{
                      fontWeight: 700,
                      fontSize: isMobile ? '0.75rem' : '0.85rem',
                      textAlign: 'center',
                      color: 'text.primary',
                      letterSpacing: '-0.2px',
                      mt: 1.5,
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.2s ease',
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
