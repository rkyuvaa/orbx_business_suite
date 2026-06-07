import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Collapse, IconButton
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ChevronRightIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const BalanceSheet = () => {
  const [data, setData] = useState(null);
  const [asOfDate, setAsOfDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    const today = new Date();
    setAsOfDate(today.toISOString().split('T')[0]);
  }, []);

  const loadReport = async () => {
    if (!asOfDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/balance-sheet', {
        params: { as_of_date: asOfDate }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch Balance Sheet report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (asOfDate) {
      loadReport();
    }
  }, [asOfDate]);

  const handleExportExcel = async () => {
    if (!asOfDate) return;
    try {
      const response = await apiClient.get('/reports/balance-sheet', {
        params: {
          as_of_date: asOfDate,
          format: 'xlsx'
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Balance_Sheet_As_Of_${asOfDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Balance Sheet to Excel.');
    }
  };

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  // Recursively render groups, subgroups and ledgers
  const renderGroupRows = (group, depth = 0) => {
    const isExpanded = !!expandedGroups[group.id];
    const hasChildren = (group.subgroups && group.subgroups.length > 0) || (group.ledgers && group.ledgers.length > 0);
    const indent = depth * 20;

    return (
      <React.Fragment key={group.id}>
        <TableRow 
          hover 
          onClick={hasChildren ? () => toggleGroup(group.id) : undefined}
          sx={{ 
            cursor: hasChildren ? 'pointer' : 'default',
            backgroundColor: depth === 0 ? '#f1f5f9' : '#ffffff',
            fontWeight: depth === 0 ? 700 : 500
          }}
        >
          <TableCell sx={{ pl: `${indent + 12}px`, py: 1.5, fontWeight: depth === 0 ? 700 : 600 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {hasChildren && (
                <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                  {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
              )}
              <Typography sx={{ fontSize: depth === 0 ? '0.95rem' : '0.875rem', fontWeight: 'inherit' }}>
                {group.name}
              </Typography>
            </Box>
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: depth === 0 ? 700 : 600 }}>
            {formatCurrency(group.balance)}
          </TableCell>
        </TableRow>
        
        {hasChildren && isExpanded && (
          <>
            {group.subgroups && group.subgroups.map(sub => renderGroupRows(sub, depth + 1))}
            {group.ledgers && group.ledgers.map(ledg => (
              <TableRow key={ledg.id} sx={{ backgroundColor: '#fafafa' }}>
                <TableCell sx={{ pl: `${indent + 36}px`, py: 1, color: 'text.secondary' }}>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    {ledg.name} ({ledg.code})
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  {formatCurrency(ledg.balance)} ({ledg.type})
                </TableCell>
              </TableRow>
            ))}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box>
      <PageHeader
        title="Schedule III Balance Sheet"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Balance Sheet' },
        ]}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            disabled={!data || loading}
            sx={{
              backgroundColor: '#1b4332',
              '&:hover': { backgroundColor: '#133024' },
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Export to Excel
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {/* Date Filter */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={8}>
            <TextField
              label="As of Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="outlined"
              fullWidth
              onClick={loadReport}
              disabled={loading}
              sx={{
                py: 1.5,
                borderColor: '#1b4332',
                color: '#1b4332',
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  borderColor: '#133024',
                  backgroundColor: 'rgba(27, 67, 50, 0.04)'
                }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Balance Sheet'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading || !data ? (
        <Paper sx={{ py: 6, display: 'flex', justifyContent: 'center', borderRadius: '12px' }}>
          {loading ? (
            <CircularProgress size={36} sx={{ color: '#1b4332' }} />
          ) : (
            <Typography color="text.secondary">Enter an as-of date to load the Balance Sheet.</Typography>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Equity & Liabilities Table */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <TableContainer sx={{ maxHeight: 650 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>
                        Equity & Liabilities
                      </TableCell>
                      <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 150 }}>
                        Amount
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.sections.equity_and_liabilities.categories.map(cat => renderGroupRows(cat))}
                    <TableRow sx={{ backgroundColor: '#cbd5e1' }}>
                      <TableCell sx={{ fontWeight: 800, py: 2 }}>TOTAL EQUITY AND LIABILITIES</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {formatCurrency(data.sections.equity_and_liabilities.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Assets Table */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <TableContainer sx={{ maxHeight: 650 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>
                        Assets
                      </TableCell>
                      <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 150 }}>
                        Amount
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.sections.assets.categories.map(cat => renderGroupRows(cat))}
                    <TableRow sx={{ backgroundColor: '#cbd5e1' }}>
                      <TableCell sx={{ fontWeight: 800, py: 2 }}>TOTAL ASSETS</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {formatCurrency(data.sections.assets.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default BalanceSheet;
