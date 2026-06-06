import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Menu, MenuItem,
  Select, FormControl, InputLabel, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Divider, Avatar, Tooltip,
  useTheme, useMediaQuery
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Home as HomeIcon,
  ChevronLeft as ChevronLeftIcon,
  People as PeopleIcon,
  LocalShipping as SupplierIcon,
  LocalShipping as DispatchIcon,
  Inventory as ProductIcon,
  ShoppingCart as SalesIcon,
  ReceiptLong as ReceiptIcon,
  Assessment as ReportIcon,
  Settings as AdminIcon,
  Business as BranchIcon
} from '@mui/icons-material';

import { logoutUser } from '../app/slices/authSlice';
import { fetchBranches, setActiveBranch } from '../app/slices/branchSlice';

const AppLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  
  // Responsive check: sidebar turns temporary on screens smaller than medium (960px)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { user } = useSelector((state) => state.auth);
  const { branches, activeBranch, activeBranchId } = useSelector((state) => state.branch);

  const [anchorEl, setAnchorEl] = React.useState(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  useEffect(() => {
    dispatch(fetchBranches());
  }, [dispatch]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    dispatch(logoutUser());
    navigate('/login');
  };

  const handleBranchChange = (e) => {
    const selected = branches.find((b) => b.id === e.target.value);
    if (selected) {
      dispatch(setActiveBranch(selected));
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Determine active module from path
  const path = location.pathname;
  const isDashboard = path === '/';

  const getPageInfo = () => {
    const p = path.toLowerCase();
    if (p.startsWith('/masters/customers')) {
      return { title: 'Customer Master', breadcrumbs: 'Dashboard > Customer Master' };
    }
    if (p.startsWith('/masters/suppliers')) {
      return { title: 'Supplier Master', breadcrumbs: 'Dashboard > Supplier Master' };
    }
    if (p.startsWith('/masters/products')) {
      return { title: 'Product Master', breadcrumbs: 'Dashboard > Product Master' };
    }
    if (p.startsWith('/transactions/purchase')) {
      return { title: 'Purchase Module', breadcrumbs: 'Dashboard > Purchase Module' };
    }
    if (p.startsWith('/transactions/inventory')) {
      return { title: 'Inventory Module', breadcrumbs: 'Dashboard > Inventory Module' };
    }
    if (p.startsWith('/transactions/transfers')) {
      return { title: 'Stock Transfers / DC', breadcrumbs: 'Dashboard > Stock Transfers & Delivery Challans' };
    }
    if (p.startsWith('/transactions/sales')) {
      return { title: 'Sales Module', breadcrumbs: 'Dashboard > Sales Module' };
    }
    if (p.startsWith('/transactions/receipts')) {
      return { title: 'Payment Receipt', breadcrumbs: 'Dashboard > Payment Receipt' };
    }
    if (p.startsWith('/transactions/payments')) {
      return { title: 'Payment Update', breadcrumbs: 'Dashboard > Payment Update' };
    }
    if (p.startsWith('/transactions/customer-ledger')) {
      return { title: 'Customer Ledger Report', breadcrumbs: 'Dashboard > Customer Ledger' };
    }
    if (p.startsWith('/transactions/supplier-ledger')) {
      return { title: 'Supplier Ledger Report', breadcrumbs: 'Dashboard > Supplier Ledger' };
    }
    if (p.startsWith('/reports/dashboard')) {
      return { title: 'Reports Dashboard', breadcrumbs: 'Dashboard > Reports Dashboard' };
    }
    if (p.startsWith('/reports/sales')) {
      return { title: 'Sales Reports', breadcrumbs: 'Dashboard > Sales Reports' };
    }
    if (p.startsWith('/reports/inventory')) {
      return { title: 'Inventory Reports', breadcrumbs: 'Dashboard > Inventory Reports' };
    }
    if (p.startsWith('/reports/purchase')) {
      return { title: 'Purchase Reports', breadcrumbs: 'Dashboard > Purchase Reports' };
    }
    if (p.startsWith('/admin/company')) {
      return { title: 'Company Config', breadcrumbs: 'Dashboard > Company Config' };
    }
    if (p.startsWith('/admin/branches')) {
      return { title: 'Branches', breadcrumbs: 'Dashboard > Branches' };
    }
    if (p.startsWith('/admin/users')) {
      return { title: 'Users & Roles', breadcrumbs: 'Dashboard > Users & Roles' };
    }
    return { title: 'App Dashboard', breadcrumbs: 'Dashboard' };
  };

  // Sub-navigation menus based on active module prefix
  const getSidebarMenu = () => {
    if (path.startsWith('/transactions/purchase') || path.startsWith('/masters/suppliers')) {
      return [
        { label: 'Purchase Module', icon: <SupplierIcon />, to: '/transactions/purchase' },
        { label: 'Supplier Master', icon: <PeopleIcon />, to: '/masters/suppliers' },
      ];
    }
    if (path.startsWith('/transactions/inventory') || path.startsWith('/transactions/transfers') || path.startsWith('/masters/products')) {
      return [
        { label: 'Inventory Module', icon: <ProductIcon />, to: '/transactions/inventory' },
        { label: 'Stock Transfers / DC', icon: <DispatchIcon />, to: '/transactions/transfers' },
        { label: 'Product Master', icon: <ProductIcon />, to: '/masters/products' },
      ];
    }
    if (path.startsWith('/transactions/sales') || path.startsWith('/masters/customers')) {
      return [
        { label: 'Sales Module', icon: <SalesIcon />, to: '/transactions/sales' },
        { label: 'Customer Master', icon: <PeopleIcon />, to: '/masters/customers' },
      ];
    }
    if (path.startsWith('/transactions/receipts') ||
        path.startsWith('/transactions/payments') ||
        path.startsWith('/transactions/customer-ledger') ||
        path.startsWith('/transactions/supplier-ledger')) {
      return [
        { label: 'Payment Receipt', icon: <ReceiptIcon />, to: '/transactions/receipts' },
        { label: 'Payment Update', icon: <ReceiptIcon />, to: '/transactions/payments' },
        { label: 'Customer Ledger', icon: <PeopleIcon />, to: '/transactions/customer-ledger' },
        { label: 'Supplier Ledger', icon: <SupplierIcon />, to: '/transactions/supplier-ledger' },
      ];
    }
    if (path.startsWith('/reports')) {
      return [
        { label: 'Reports Dashboard', icon: <ReportIcon />, to: '/reports/dashboard' },
        { label: 'Sales Reports', icon: <ReportIcon />, to: '/reports/sales' },
        { label: 'Inventory Reports', icon: <ReportIcon />, to: '/reports/inventory' },
        { label: 'Purchase Reports', icon: <ReportIcon />, to: '/reports/purchase' },
      ];
    }
    if (path.startsWith('/admin')) {
      return [
        { label: 'Company Config', icon: <AdminIcon />, to: '/admin/company' },
        { label: 'Branches', icon: <BranchIcon />, to: '/admin/branches' },
        { label: 'Users & Roles', icon: <PeopleIcon />, to: '/admin/users' },
      ];
    }
    return [];
  };

  const sidebarItems = getSidebarMenu();
  const showSidebar = !isDashboard && sidebarItems.length > 0;
  const drawerWidth = 260;

  // Render contents of sidebar list
  const drawerContent = (
    <Box sx={{ overflow: 'auto', p: 2 }}>
      <List>
        {sidebarItems.map((item, index) => {
          const isActive = path === item.to || path.startsWith(item.to);
          return (
            <ListItem key={index} disablePadding sx={{ mb: 1.2 }}>
              <ListItemButton
                component={RouterLink}
                to={item.to}
                selected={isActive}
                onClick={isMobile ? handleDrawerToggle : undefined}
                sx={{
                  borderRadius: '8px',
                  py: 1.2,
                  px: 2,
                  backgroundColor: isActive ? 'rgba(27, 67, 50, 0.04)' : 'transparent',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'rgba(27, 67, 50, 0.02)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(27, 67, 50, 0.06)',
                    color: 'primary.main',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: 'rgba(27, 67, 50, 0.08)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, backgroundColor: '#ffffff', color: 'text.primary', borderBottom: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Hamburger Toggle for Mobile Drawer */}
            {showSidebar && isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ color: 'primary.main', mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            <IconButton
              component={RouterLink}
              to="/"
              color="inherit"
              edge="start"
              sx={{ color: 'primary.main', mr: 0.5 }}
            >
              <HomeIcon />
            </IconButton>

            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 800, fontSize: isSmallMobile ? '0.95rem' : '1.1rem', letterSpacing: '-0.3px', color: '#1b4332' }}>
              ORBX {!isSmallMobile && <span style={{ fontWeight: 400, opacity: 0.8, color: '#334155' }}>Business Suite</span>}
            </Typography>

            {!isDashboard && (
              <Box sx={{ display: 'flex', alignItems: 'center', ml: isSmallMobile ? 1 : 2.5, gap: isSmallMobile ? 1 : 1.5 }}>
                <Typography sx={{ color: '#cbd5e1', fontWeight: 300, fontSize: '1.2rem' }}>|</Typography>
                <Box>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: isSmallMobile ? '0.85rem' : '0.95rem', lineHeight: 1.2 }}>
                    {getPageInfo().title}
                  </Typography>
                  {!isSmallMobile && (
                    <Typography sx={{ color: '#64748b', fontSize: '0.725rem', display: 'block', lineHeight: 1 }}>
                      {getPageInfo().breadcrumbs}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: isSmallMobile ? 1.5 : 3 }}>
            {/* Multi-Branch Selector */}
            {branches.length > 0 && (
              <FormControl size="small" sx={{ minWidth: isSmallMobile ? 120 : 160 }}>
                <Select
                  value={activeBranchId || ''}
                  onChange={handleBranchChange}
                  displayEmpty
                  sx={{
                    borderRadius: '10px',
                    backgroundColor: '#f1f5f9',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: isSmallMobile ? '0.75rem' : '0.85rem',
                    height: '36px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none',
                    }
                  }}
                >
                  {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {isSmallMobile ? b.code : `${b.branch_name} (${b.code})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* User Profile Avatar and Dropdown */}
            {user && (
              <Box>
                <Tooltip title="Account settings">
                  <IconButton onClick={handleMenu} sx={{ p: 0 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34, fontSize: '0.85rem', fontWeight: 600 }}>
                      {user.full_name.charAt(0).toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    sx: {
                      mt: 1.5,
                      boxShadow: '0px 12px 30px rgba(0, 0, 0, 0.08)',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      minWidth: 180
                    }
                  }}
                >
                  <MenuItem onClick={handleClose} disabled sx={{ borderBottom: '1px solid #f1f5f9', py: 1.5 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{user.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main', fontWeight: 600, fontSize: '0.875rem' }}>
                    <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sub-navigation Drawer Layout */}
      {showSidebar && (
        <Box component="nav">
          {/* Temporary Drawer for Mobile Screens */}
          {isMobile ? (
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{
                keepMounted: true, // Better open performance on mobile
              }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': {
                  boxSizing: 'border-box',
                  width: drawerWidth,
                  borderRight: '1px solid #e2e8f0',
                  boxShadow: '4px 0 24px rgba(0,0,0,0.05)'
                },
              }}
            >
              <Toolbar />
              {drawerContent}
            </Drawer>
          ) : (
            /* Permanent Drawer for Desktop Screens */
            <Drawer
              variant="permanent"
              sx={{
                display: { xs: 'none', md: 'block' },
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: {
                  width: drawerWidth,
                  boxSizing: 'border-box',
                  borderRight: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                },
              }}
            >
              <Toolbar />
              {drawerContent}
            </Drawer>
          )}
        </Box>
      )}

      {/* Core Workspace outlet container */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isSmallMobile ? 2 : 3,
          mt: 8,
          width: showSidebar && !isMobile ? `calc(100% - ${drawerWidth}px)` : '100%',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease-in-out',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
