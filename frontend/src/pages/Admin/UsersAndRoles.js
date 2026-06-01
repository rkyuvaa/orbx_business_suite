import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Button, Box, Alert, Typography, Tabs, Tab, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox
} from '@mui/material';
import { Add as AddIcon, Shield as SecurityIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const userSchema = yup.object().shape({
  full_name: yup.string().required('Full name is required'),
  email: yup.string().email('Please enter a valid email').required('Email is required'),
  role_id: yup.string().required('Role is required'),
  branch_id: yup.string().nullable(),
  password: yup.string().nullable().when('$editMode', {
    is: false,
    then: () => yup.string().min(6, 'Password must be 6+ characters').required('Password is required'),
    otherwise: () => yup.string().nullable(),
  }),
});

const UsersAndRoles = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [openUserModal, setOpenUserModal] = useState(false);
  const [openPermModal, setOpenPermModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Custom permissions local matrix state
  const [permMatrix, setPermMatrix] = useState([]);
  const [error, setError] = useState(null);

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(userSchema),
    context: { editMode: !!selectedUser }
  });

  const loadData = async () => {
    try {
      const uRes = await apiClient.get('/admin/users');
      const rRes = await apiClient.get('/admin/roles');
      const bRes = await apiClient.get('/admin/branches');
      setUsers(uRes.data);
      setRoles(rRes.data);
      setBranches(bRes.data);
    } catch (err) {
      setError('Failed to load users or roles lists.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (event, newIndex) => {
    setTabIndex(newIndex);
  };

  // ==========================================
  // USER HANDLERS
  // ==========================================
  const handleOpenAddUser = () => {
    setSelectedUser(null);
    reset({
      full_name: '',
      email: '',
      role_id: roles.length > 0 ? roles[0].id : '',
      branch_id: branches.length > 0 ? branches[0].id : '',
      password: '',
    });
    setOpenUserModal(true);
  };

  const handleOpenEditUser = (user) => {
    setSelectedUser(user);
    reset({
      full_name: user.full_name,
      email: user.email,
      role_id: user.role_id,
      branch_id: user.branch_id || '',
      password: '',
    });
    setOpenUserModal(true);
  };

  const onUserSubmit = async (data) => {
    try {
      // Clean up empty optional fields
      const payload = { ...data };
      if (!payload.branch_id) {
        payload.branch_id = null;
      }
      if (selectedUser) {
        if (!payload.password) delete payload.password;
        await apiClient.put(`/admin/users/${selectedUser.id}`, payload);
      } else {
        await apiClient.post('/admin/users', payload);
      }
      setOpenUserModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save user.');
    }
  };

  // ==========================================
  // PERMISSIONS MATRIX HANDLERS
  // ==========================================
  const handleOpenPermissions = (role) => {
    setSelectedRole(role);
    
    // Construct local grid state out of role's existing permissions
    const modules = ["masters", "purchase", "inventory", "sales", "payments", "reports", "admin"];
    const actions = ["view", "create", "edit", "delete"];
    
    const matrix = [];
    modules.forEach((mod) => {
      const row = { module: mod };
      actions.forEach((act) => {
        const found = role.permissions?.find((p) => p.module === mod && p.action === act);
        row[act] = found ? found.is_allowed : false;
      });
      matrix.push(row);
    });

    setPermMatrix(matrix);
    setOpenPermModal(true);
  };

  const handleCheckboxChange = (module, action, checked) => {
    setPermMatrix((prev) =>
      prev.map((row) => {
        if (row.module === module) {
          return { ...row, [action]: checked };
        }
        return row;
      })
    );
  };

  const savePermissions = async () => {
    try {
      // Re-pack matrix back into permissions list
      const permissionsList = [];
      permMatrix.forEach((row) => {
        ["view", "create", "edit", "delete"].forEach((act) => {
          permissionsList.push({
            module: row.module,
            action: act,
            is_allowed: !!row[act]
          });
        });
      });

      await apiClient.put(`/admin/roles/${selectedRole.id}`, {
        name: selectedRole.name,
        description: selectedRole.description,
        permissions: permissionsList
      });

      setOpenPermModal(false);
      loadData();
    } catch (err) {
      setError('Failed to update permission matrix.');
    }
  };

  const userColumns = [
    { id: 'full_name', label: 'Full Name' },
    { id: 'email', label: 'Email Address' },
    {
      id: 'role_id',
      label: 'System Role',
      render: (row) => {
        const role = roles.find((r) => r.id === row.role_id);
        return role ? role.name : 'Unknown';
      },
    },
    {
      id: 'branch_id',
      label: 'Assigned Branch',
      render: (row) => {
        const branch = branches.find((b) => b.id === row.branch_id);
        return branch ? `${branch.branch_name} (${branch.code})` : 'Global/All';
      },
    },
    {
      id: 'is_active',
      label: 'Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: row.is_active ? 'rgba(45, 106, 79, 0.1)' : 'rgba(217, 4, 41, 0.1)',
            color: row.is_active ? '#2d6a4f' : '#d90429',
          }}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </Typography>
      ),
    },
  ];

  const roleColumns = [
    { id: 'name', label: 'Role Name' },
    { id: 'description', label: 'Description' },
  ];

  return (
    <Box>
      <PageHeader
        title="Users & Roles"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Users & Roles' },
        ]}
        actions={
          tabIndex === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddUser}>
              Add User
            </Button>
          )
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={handleTabChange} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="System User Accounts" sx={{ fontWeight: 600 }} />
          <Tab label="Roles & Access Matrix" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 ? (
        <CommonTable columns={userColumns} rows={users} actions={[{ type: 'edit', label: 'Edit User Profile', onClick: handleOpenEditUser }]} searchKey="full_name" />
      ) : (
        <CommonTable
          columns={roleColumns}
          rows={roles}
          actions={[
            {
              icon: <SecurityIcon />,
              label: 'Access Matrix permissions',
              onClick: handleOpenPermissions,
              color: 'primary'
            }
          ]}
          searchKey="name"
        />
      )}

      {/* User Edit Modal */}
      <CommonModal
        open={openUserModal}
        onClose={() => setOpenUserModal(false)}
        title={selectedUser ? 'Edit User details' : 'Create User Account'}
      >
        <form onSubmit={handleSubmit(onUserSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormInput name="full_name" control={control} label="Full User Name" />
            <FormInput name="email" control={control} label="Email Address (Username)" type="email" />
            
            <FormInput
              name="role_id"
              control={control}
              label="Assigned Role"
              type="select"
              options={roles.map(r => ({ value: r.id, label: r.name }))}
            />
            
            <FormInput
              name="branch_id"
              control={control}
              label="Assigned Branch"
              type="select"
              options={[
                { value: '', label: 'Global (All Branches)' },
                ...branches.map(b => ({ value: b.id, label: `${b.branch_name} (${b.code})` }))
              ]}
            />
            
            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput
                name="password"
                control={control}
                label={selectedUser ? 'Reset Password (optional)' : 'Password'}
                type="password"
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenUserModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Save Account
            </Button>
          </Box>
        </form>
      </CommonModal>

      {/* Permissions Matrix Modal */}
      <CommonModal
        open={openPermModal}
        onClose={() => setOpenPermModal(false)}
        title={selectedRole ? `Permission Matrix: ${selectedRole.name}` : ''}
        maxWidth="md"
      >
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>System Module</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>View</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Create</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {permMatrix.map((row) => (
                <TableRow hover key={row.module}>
                  <TableCell sx={{ textTransform: 'capitalize', fontWeight: 600 }}>{row.module}</TableCell>
                  <TableCell align="center">
                    <Checkbox
                      checked={row.view}
                      disabled={selectedRole?.name === 'Super Admin'}
                      onChange={(e) => handleCheckboxChange(row.module, 'view', e.target.checked)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Checkbox
                      checked={row.create}
                      disabled={selectedRole?.name === 'Super Admin'}
                      onChange={(e) => handleCheckboxChange(row.module, 'create', e.target.checked)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Checkbox
                      checked={row.edit}
                      disabled={selectedRole?.name === 'Super Admin'}
                      onChange={(e) => handleCheckboxChange(row.module, 'edit', e.target.checked)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Checkbox
                      checked={row.delete}
                      disabled={selectedRole?.name === 'Super Admin'}
                      onChange={(e) => handleCheckboxChange(row.module, 'delete', e.target.checked)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setOpenPermModal(false)} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={savePermissions}
            variant="contained"
            disabled={selectedRole?.name === 'Super Admin'}
          >
            Save Access Matrix
          </Button>
        </Box>
      </CommonModal>
    </Box>
  );
};

export default UsersAndRoles;
