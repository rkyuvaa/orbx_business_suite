import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box, Button, Typography, Paper, Alert, IconButton, Tooltip,
  Collapse, Card, CardContent, Grid, Badge, TextField, InputAdornment,
  MenuItem, Checkbox, FormControlLabel, CircularProgress, Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Description as LedgerIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  AccountTree as AccountTreeIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

// Validation Schemas
const groupSchema = yup.object().shape({
  name: yup.string().required('Group Name is required').max(100, 'Max 100 characters'),
  parent_id: yup.string().nullable(),
  nature: yup.string().required('Nature is required')
});

const ledgerSchema = yup.object().shape({
  code: yup.string().required('Account Code is required').max(30, 'Max 30 characters'),
  name: yup.string().required('Account Name is required').max(100, 'Max 100 characters'),
  group_id: yup.string().required('Parent Group is required'),
  opening_bal: yup.number().typeError('Must be a number').default(0.0),
  opening_bal_type: yup.string().required('Balance Type is required'),
  currency: yup.string().default('INR'),
  is_closing_stock: yup.boolean().default(false),
  sundry_type: yup.string().nullable(),
  partnership_type: yup.string().nullable()
});

const ChartOfAccounts = () => {
  const [coaData, setCoaData] = useState([]);
  const [flatGroups, setFlatGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Tally balance state
  const [tallyInfo, setTallyInfo] = useState(null);
  const [tallyLoading, setTallyLoading] = useState(false);

  // Tree UI Search & Collapse State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState({});

  // Modals state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);

  // react-hook-form configuration
  const { 
    control: groupControl, 
    handleSubmit: handleGroupSubmit, 
    reset: resetGroup, 
    watch: watchGroup,
    setValue: setGroupValue
  } = useForm({
    resolver: yupResolver(groupSchema),
    defaultValues: { name: '', parent_id: '', nature: 'Debit' }
  });

  const { 
    control: ledgerControl, 
    handleSubmit: handleLedgerSubmit, 
    reset: resetLedger,
    watch: watchLedger,
    setValue: setLedgerValue
  } = useForm({
    resolver: yupResolver(ledgerSchema),
    defaultValues: {
      code: '',
      name: '',
      group_id: '',
      opening_bal: 0.0,
      opening_bal_type: 'Dr',
      currency: 'INR',
      is_closing_stock: false,
      sundry_type: '',
      partnership_type: ''
    }
  });

  // Watch group parent_id to inherit nature
  const watchedParentId = watchGroup('parent_id');
  useEffect(() => {
    if (watchedParentId) {
      const parent = flatGroups.find(g => g.id === watchedParentId);
      if (parent) {
        setGroupValue('nature', parent.nature);
      }
    }
  }, [watchedParentId, flatGroups, setGroupValue]);

  // Load COA Hierarchy tree & Flat list for dropdowns
  const loadCOAData = async () => {
    setLoading(true);
    try {
      const coaRes = await apiClient.get('/accounts/coa');
      setCoaData(coaRes.data);
      
      const flatRes = await apiClient.get('/accounts/groups?flat=true');
      setFlatGroups(flatRes.data);
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch Chart of Accounts data.');
    } finally {
      setLoading(false);
    }
  };

  // Run initial load
  useEffect(() => {
    loadCOAData();
    validateBalances(true); // silent check on load
  }, []);

  // Validate Opening Balances Tally
  const validateBalances = async (silent = false) => {
    if (!silent) setTallyLoading(true);
    try {
      const res = await apiClient.post('/accounts/validate-balances', {});
      setTallyInfo(res.data);
    } catch (err) {
      if (!silent) setError('Failed to validate opening balances.');
    } finally {
      if (!silent) setTallyLoading(false);
    }
  };

  const handleToggleNode = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group Handlers
  const handleOpenAddGroup = (parentId = null) => {
    setSelectedGroup(null);
    resetGroup({
      name: '',
      parent_id: parentId || '',
      nature: parentId ? (flatGroups.find(g => g.id === parentId)?.nature || 'Debit') : 'Debit'
    });
    setGroupModalOpen(true);
  };

  const handleOpenEditGroup = (group) => {
    setSelectedGroup(group);
    resetGroup({
      name: group.name,
      parent_id: group.parent_id || '',
      nature: group.nature
    });
    setGroupModalOpen(true);
  };

  const handleDeleteGroup = async (group) => {
    if (window.confirm(`Are you sure you want to delete account group '${group.name}'?`)) {
      try {
        await apiClient.delete(`/accounts/groups/${group.id}`);
        await loadCOAData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete account group.');
      }
    }
  };

  const onGroupSubmit = async (data) => {
    try {
      const payload = {
        name: data.name,
        parent_id: data.parent_id || null,
        nature: data.nature
      };
      
      if (selectedGroup) {
        // Edit group API endpoint was not defined in plans but let's see. If edit is unsupported, we raise info.
        // Wait, the API routes don't have PUT /accounts/groups/{id}, so groups are only created or deleted.
        // Let's check if the API has PUT groups. No, the backend router does not have it.
        // So we can only create groups. Let's make sure we alert or handle this.
        alert("Editing account groups is not supported. Please recreate the group or contact admin.");
        return;
      } else {
        await apiClient.post('/accounts/groups', payload);
      }
      setGroupModalOpen(false);
      await loadCOAData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save account group.');
    }
  };

  // Ledger Handlers
  const handleOpenAddLedger = (groupId = '') => {
    setSelectedLedger(null);
    resetLedger({
      code: '',
      name: '',
      group_id: groupId || '',
      opening_bal: 0.0,
      opening_bal_type: 'Dr',
      currency: 'INR',
      is_closing_stock: false,
      sundry_type: '',
      partnership_type: ''
    });
    setLedgerModalOpen(true);
  };

  const handleOpenEditLedger = (ledger) => {
    setSelectedLedger(ledger);
    resetLedger({
      code: ledger.code,
      name: ledger.name,
      group_id: ledger.group_id,
      opening_bal: ledger.opening_bal,
      opening_bal_type: ledger.opening_bal_type,
      currency: ledger.currency,
      is_closing_stock: ledger.is_closing_stock,
      sundry_type: ledger.sundry_type || '',
      partnership_type: ledger.partnership_type || ''
    });
    setLedgerModalOpen(true);
  };

  const handleDeleteLedger = async (ledger) => {
    if (window.confirm(`Are you sure you want to delete ledger account '${ledger.name}'?`)) {
      try {
        await apiClient.delete(`/accounts/ledgers/${ledger.id}`);
        await loadCOAData();
        await validateBalances(true);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete ledger account.');
      }
    }
  };

  const onLedgerSubmit = async (data) => {
    try {
      const payload = {
        code: data.code,
        name: data.name,
        group_id: data.group_id,
        opening_bal: Number(data.opening_bal),
        opening_bal_type: data.opening_bal_type,
        currency: data.currency,
        is_closing_stock: data.is_closing_stock,
        sundry_type: data.sundry_type || null,
        partnership_type: data.partnership_type || null
      };

      if (selectedLedger) {
        await apiClient.put(`/accounts/ledgers/${selectedLedger.id}`, payload);
      } else {
        await apiClient.post('/accounts/ledgers', payload);
      }
      setLedgerModalOpen(false);
      await loadCOAData();
      await validateBalances(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save ledger account.');
    }
  };

  // Helper formatting for currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Helper check if node or children match search query
  const matchesSearch = (node, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    
    // Check group name
    if (node.name.toLowerCase().includes(q)) return true;
    
    // Check nested ledgers
    if (node.ledgers && node.ledgers.some(l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q))) {
      return true;
    }
    
    // Check nested subgroups
    if (node.subgroups && node.subgroups.some(sub => matchesSearch(sub, query))) {
      return true;
    }
    
    return false;
  };

  // Render Recursive Tree Node
  const renderTreeNode = (node) => {
    if (!matchesSearch(node, searchQuery)) return null;

    const isExpanded = !!expandedNodes[node.id] || !!searchQuery;
    const hasChildren = (node.subgroups && node.subgroups.length > 0) || (node.ledgers && node.ledgers.length > 0);
    const depthPadding = node.depth * 24;

    return (
      <Box key={node.id} sx={{ select: 'none' }}>
        {/* Group Item Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 1,
            pr: 2,
            pl: `${Math.max(8, depthPadding)}px`,
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            transition: 'background-color 0.2s',
            '&:hover': {
              backgroundColor: '#f8fafc',
              '& .node-actions': { opacity: 1 }
            }
          }}
        >
          {/* Collapse/Expand Toggle */}
          <IconButton
            size="small"
            onClick={() => handleToggleNode(node.id)}
            disabled={!hasChildren}
            sx={{ mr: 0.5, color: '#64748b' }}
          >
            {hasChildren ? (
              isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />
            ) : (
              <Box sx={{ width: 22 }} />
            )}
          </IconButton>

          {/* Group Icon */}
          {isExpanded ? (
            <FolderOpenIcon fontSize="small" sx={{ color: 'primary.light', mr: 1 }} />
          ) : (
            <FolderIcon fontSize="small" sx={{ color: 'primary.light', mr: 1 }} />
          )}

          {/* Group Name */}
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', flexGrow: 1 }}>
            {node.name}
          </Typography>

          {/* Nature Badge */}
          <Typography
            variant="caption"
            sx={{
              mr: 2,
              px: 1,
              py: 0.2,
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.7rem',
              backgroundColor: node.nature === 'Debit' ? '#e8f5e9' : '#e3f2fd',
              color: node.nature === 'Debit' ? '#2e7d32' : '#1565c0'
            }}
          >
            {node.nature}
          </Typography>

          {/* Hover Action Group */}
          <Box
            className="node-actions"
            sx={{
              display: 'flex',
              gap: 0.5,
              opacity: { xs: 1, md: 0 },
              transition: 'opacity 0.15s ease-in-out'
            }}
          >
            <Tooltip title="Add Subgroup">
              <IconButton size="small" onClick={() => handleOpenAddGroup(node.id)} color="primary">
                <AddIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add Ledger Account">
              <IconButton size="small" onClick={() => handleOpenAddLedger(node.id)} color="secondary">
                <AddIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            {/* Soft delete constraint checked at service layer */}
            <Tooltip title="Delete Group">
              <IconButton size="small" onClick={() => handleDeleteGroup(node)} color="error">
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Collapsible Children & Ledgers */}
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ borderLeft: node.depth >= 0 ? '1px dashed #cbd5e1' : 'none', ml: `${depthPadding + 18}px` }}>
            {/* 1. Render Subgroups recursively */}
            {node.subgroups && node.subgroups.map(subgroup => renderTreeNode(subgroup))}

            {/* 2. Render Ledgers under this Group */}
            {node.ledgers && node.ledgers.map(ledger => {
              const matchesLedger = !searchQuery || 
                ledger.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                ledger.code.toLowerCase().includes(searchQuery.toLowerCase());
              
              if (!matchesLedger) return null;

              return (
                <Box
                  key={ledger.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 0.8,
                    pr: 2,
                    pl: 3,
                    borderBottom: '1px solid #f8fafc',
                    '&:hover': {
                      backgroundColor: '#f1f5f9',
                      '& .ledger-actions': { opacity: 1 }
                    }
                  }}
                >
                  <LedgerIcon fontSize="small" sx={{ color: '#64748b', mr: 1, opacity: 0.7 }} />
                  
                  {/* Ledger Details */}
                  <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'text.secondary', fontSize: '0.85rem' }}>
                      {ledger.code}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500 }}>
                      {ledger.name}
                    </Typography>
                    
                    {/* Closing stock indicator */}
                    {ledger.is_closing_stock && (
                      <Typography variant="caption" sx={{ px: 0.8, py: 0.1, backgroundColor: '#fff8e1', color: '#b78103', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                        Closing Stock
                      </Typography>
                    )}
                    {/* Sundry debtors/creditors */}
                    {ledger.sundry_type && (
                      <Typography variant="caption" sx={{ px: 0.8, py: 0.1, backgroundColor: '#f3e5f5', color: '#7b1fa2', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                        Sundry {ledger.sundry_type}
                      </Typography>
                    )}
                    {/* Partnership types */}
                    {ledger.partnership_type && (
                      <Typography variant="caption" sx={{ px: 0.8, py: 0.1, backgroundColor: '#efebe9', color: '#5d4037', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                        Partnership: {ledger.partnership_type}
                      </Typography>
                    )}
                  </Box>

                  {/* Ledger Balances */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', mr: 0.5 }}>
                      {formatCurrency(ledger.opening_bal)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: ledger.opening_bal_type === 'Dr' ? '#2d6a4f' : '#d00000' }}>
                      {ledger.opening_bal_type}
                    </Typography>
                  </Box>

                  {/* Actions */}
                  <Box
                    className="ledger-actions"
                    sx={{
                      display: 'flex',
                      gap: 0.5,
                      opacity: { xs: 1, md: 0 },
                      transition: 'opacity 0.15s ease-in-out'
                    }}
                  >
                    <Tooltip title="Edit Ledger">
                      <IconButton size="small" onClick={() => handleOpenEditLedger(ledger)}>
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Ledger">
                      <IconButton size="small" onClick={() => handleDeleteLedger(ledger)} color="error">
                        <DeleteIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Box>
      {/* Page Heading & Search */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1b4332' }}>
            Chart of Accounts
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenAddGroup()}>
            Add Group
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenAddLedger()}>
            Add Ledger
          </Button>
        </Box>
      </Box>

      {/* Opening Balances Tally verification banner */}
      {tallyInfo && (
        <Card
          sx={{
            mb: 3,
            borderLeft: `6px solid ${tallyInfo.tallies ? '#2d6a4f' : '#d00000'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
          }}
        >
          <CardContent sx={{ py: '16px !important', px: 2.5 }}>
            <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {tallyInfo.tallies ? (
                    <CheckCircleIcon sx={{ color: '#2d6a4f', fontSize: 28 }} />
                  ) : (
                    <WarningIcon sx={{ color: '#d00000', fontSize: 28 }} />
                  )}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {tallyInfo.tallies
                        ? 'Opening Balances are Balanced (Tallied)'
                        : 'Opening Balances are Out of Balance!'
                      }
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.825rem' }}>
                      Dr Total: <strong style={{ color: '#2d6a4f' }}>{formatCurrency(tallyInfo.dr_total)}</strong> | Cr Total: <strong style={{ color: '#d00000' }}>{formatCurrency(tallyInfo.cr_total)}</strong>
                      {!tallyInfo.tallies && (
                        <span> | Difference: <strong style={{ color: '#d00000' }}>{formatCurrency(tallyInfo.difference)}</strong></span>
                      )}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => validateBalances(false)}
                  disabled={tallyLoading}
                  startIcon={tallyLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                >
                  Verify Balances
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Global Error message */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Search and Node Count Banner */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2, borderRadius: '8px' }}>
        <TextField
          size="small"
          placeholder="Search Groups & Ledger Accounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {flatGroups.length} Groups loaded
        </Typography>
      </Paper>

      {/* Chart of Accounts tree structure container */}
      <Paper sx={{ p: 1, borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : coaData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="textSecondary">
              No accounts registered yet. Click "Add Group" to begin defining your COA.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {coaData.map(node => renderTreeNode(node))}
          </Box>
        )}
      </Paper>

      {/* ==========================================
          ADD/EDIT GROUP MODAL
          ========================================== */}
      <CommonModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title={selectedGroup ? 'Edit Account Group' : 'Add New Account Group'}
      >
        <form onSubmit={handleGroupSubmit(onGroupSubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormInput
              name="name"
              control={groupControl}
              label="Group Name (e.g. Current Liabilities)"
            />
            
            <FormInput
              name="parent_id"
              control={groupControl}
              label="Parent Group"
              type="select"
              options={[
                { value: '', label: '[None - Make Root Group]' },
                ...flatGroups.map(g => ({ value: g.id, label: `${g.name} (${g.nature})` }))
              ]}
            />

            <FormInput
              name="nature"
              control={groupControl}
              label="Nature (Dr/Cr)"
              type="select"
              options={[
                { value: 'Debit', label: 'Debit' },
                { value: 'Credit', label: 'Credit' }
              ]}
              disabled={!!watchedParentId} // disabled if parent group selected, inherits parent's nature
            />

            {watchedParentId && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: -1, mb: 1, display: 'block' }}>
                Note: Nature is inherited from the parent group.
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setGroupModalOpen(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Save Group
            </Button>
          </Box>
        </form>
      </CommonModal>

      {/* ==========================================
          ADD/EDIT LEDGER ACCOUNT MODAL
          ========================================== */}
      <CommonModal
        open={ledgerModalOpen}
        onClose={() => setLedgerModalOpen(false)}
        title={selectedLedger ? 'Edit Ledger Account' : 'Add New Ledger Account'}
      >
        <form onSubmit={handleLedgerSubmit(onLedgerSubmit)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormInput
              name="group_id"
              control={ledgerControl}
              label="Parent Account Group"
              type="select"
              options={flatGroups.map(g => ({ value: g.id, label: `${g.name} (${g.nature})` }))}
            />

            <FormInput
              name="code"
              control={ledgerControl}
              label="Account Code (e.g. 12101)"
              disabled={!!selectedLedger}
            />

            <Box sx={{ gridColumn: 'span 2' }}>
              <FormInput
                name="name"
                control={ledgerControl}
                label="Account Name (e.g. HDFC Current Account)"
              />
            </Box>

            <FormInput
              name="opening_bal"
              control={ledgerControl}
              label="Opening Balance"
              type="number"
            />

            <FormInput
              name="opening_bal_type"
              control={ledgerControl}
              label="Balance Type"
              type="select"
              options={[
                { value: 'Dr', label: 'Debit (Dr)' },
                { value: 'Cr', label: 'Credit (Cr)' }
              ]}
            />

            <FormInput
              name="currency"
              control={ledgerControl}
              label="Currency"
              defaultValue="INR"
            />

            <FormInput
              name="sundry_type"
              control={ledgerControl}
              label="Sundry Ledger Classification"
              type="select"
              options={[
                { value: '', label: 'None' },
                { value: 'Debtor', label: 'Sundry Debtor' },
                { value: 'Creditor', label: 'Sundry Creditor' }
              ]}
            />

            <FormInput
              name="partnership_type"
              control={ledgerControl}
              label="Partnership Account Classification"
              type="select"
              options={[
                { value: '', label: 'None' },
                { value: 'Capital', label: 'Capital Account' },
                { value: 'Current', label: 'Current Account' }
              ]}
            />

            <Box sx={{ gridColumn: 'span 2', mb: 1 }}>
              <FormControlLabel
                control={
                  <Controller
                    name="is_closing_stock"
                    control={ledgerControl}
                    render={({ field }) => (
                      <Checkbox
                        {...field}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    )}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Is Closing Stock (Used for trading account inventory valuation)
                  </Typography>
                }
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={() => setLedgerModalOpen(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Save Ledger
            </Button>
          </Box>
        </form>
      </CommonModal>
    </Box>
  );
};

export default ChartOfAccounts;
