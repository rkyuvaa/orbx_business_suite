import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Menu, MenuItem,
  Select, FormControl, InputLabel, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Divider, Avatar, Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Home as HomeIcon,
  ChevronLeft as ChevronLeftIcon,
  People as PeopleIcon,
  LocalShipping as SupplierIcon,
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
  const { user } = useSelector((state) => state.auth);
  const { branches, activeBranch, activeBranchId } = useSelector((state) => state.branch);

  const [anchorEl, setAnchorEl] = React.useState(null);

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

  // Determine active module from path
  const path = location.pathname;
  const isDashboard = path === '/';

  // Sub-navigation menus based on active module prefix
  const getSidebarMenu = () => {
    if (path.startsWith('/masters')) {
      return [
        { label: 'Customer Master', icon: <PeopleIcon />, to: '/masters/customers' },
        { label: 'Supplier Master', icon: <SupplierIcon />, to: '/masters/suppliers' },
        { label: 'Product Master', icon: <ProductIcon />, to: '/masters/products' },
      ];
    }
    if (path.startsWith('/transactions')) {
      return [
        { label: 'Purchase Module', icon: <SupplierIcon />, to: '/transactions/purchase' },
        { label: 'Inventory Module', icon: <ProductIcon />, to: '/transactions/inventory' },
        { label: 'Sales Module', icon: <SalesIcon />, to: '/transactions/sales' },
        { label: 'Payment Receipt', icon: <ReceiptIcon />, to: '/transactions/receipts' },
        { label: 'Payment Update', icon: <ReceiptIcon />, to: '/transactions/payments' },
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              component={RouterLink}
              to="/"
              color="inherit"
              edge="start"
              sx={{ color: 'primary.main', mr: 1 }}
            >
              <HomeIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, letterSpacing: '0.5px' }}>
              ORBX <span style={{ fontWeight: 400, opacity: 0.8 }}>Business Suite</span>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {/* Multi-Branch Selector */}
            {branches.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="branch-select-label">Active Branch</InputLabel>
                <Select
                  labelId="branch-select-label"
                  value={activeBranchId || ''}
                  label="Active Branch"
                  onChange={handleBranchChange}
                  sx={{
                    borderRadius: '6px',
                    backgroundColor: '#f1f5f9',
                    border: 'none',
                    fontWeight: 600
                  }}
                >
                  {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.branch_name} ({b.code})
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
                    <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: '0.95rem' }}>
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
                      boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9',
                      minWidth: 160
                    }
                  }}
                >
                  <MenuItem onClick={handleClose} disabled sx={{ borderBottom: '1px solid #f1f5f9', py: 1.5 }}>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{user.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
                    <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Conditional Sub-navigation left sidebar */}
      {showSidebar && (
        <Drawer
          variant="permanent"
          sx={{
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
          <Box sx={{ overflow: 'auto', p: 2 }}>
            <List>
              {sidebarItems.map((item, index) => {
                const isActive = path === item.to || path.startsWith(item.to);
                return (
                  <ListItem key={index} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={RouterLink}
                      to={item.to}
                      selected={isActive}
                      sx={{
                        borderRadius: '8px',
                        py: 1,
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
        </Drawer>
      )}

      {/* Core Workspace outlet container */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          width: showSidebar ? `calc(100% - ${drawerWidth}px)` : '100%',
          transition: 'all 0.15s ease-in-out',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
