import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, IconButton
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ChevronRightIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const ProfitLoss = () => {
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    let startYear, endYear;
    
    if (currentMonth >= 4) {
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    
    setStartDate(`${startYear}-04-01`);
    setEndDate(`${endYear}-03-31`);
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/profit-loss', {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch Profit & Loss report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    try {
      const response = await apiClient.get('/reports/profit-loss', {
        params: {
          start_date: startDate,
          end_date: endDate,
          format: 'xlsx'
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Profit_and_Loss_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Profit & Loss to Excel.');
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

  const renderCategoryRows = (cat) => {
    const isExpanded = !!expandedGroups[cat.id];
    const hasLedgers = cat.ledgers && cat.ledgers.length > 0;

    return (
      <React.Fragment key={cat.id}>
        <TableRow 
          hover 
          onClick={hasLedgers ? () => toggleGroup(cat.id) : undefined}
          sx={{ 
            cursor: hasLedgers ? 'pointer' : 'default',
            backgroundColor: '#f8fafc'
          }}
        >
          <TableCell sx={{ pl: 3, py: 1.5, fontWeight: 600 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {hasLedgers && (
                <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                  {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
              )}
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {cat.name}
              </Typography>
            </Box>
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 600 }}>
            {formatCurrency(cat.balance)}
          </TableCell>
        </TableRow>

        {hasLedgers && isExpanded && (
          cat.ledgers.map(ledg => (
            <TableRow key={ledg.id} sx={{ backgroundColor: '#ffffff' }}>
              <TableCell sx={{ pl: 6, py: 1, color: 'text.secondary' }}>
                <Typography variant="body2">
                  {ledg.name} ({ledg.code})
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                {formatCurrency(ledg.balance)}
              </TableCell>
            </TableRow>
          ))
        )}
      </React.Fragment>
    );
  };

  return (
    <Box>
      <PageHeader
        title="Schedule III Profit & Loss"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Profit & Loss' },
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

      {/* Date Range Filter */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Profit & Loss'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading || !data ? (
        <Paper sx={{ py: 6, display: 'flex', justifyContent: 'center', borderRadius: '12px' }}>
          {loading ? (
            <CircularProgress size={36} sx={{ color: '#1b4332' }} />
          ) : (
            <Typography color="text.secondary">Enter date parameters to load the Profit & Loss statement.</Typography>
          )}
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600 }}>
                    Income & Expense Line Items
                  </TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, width: 200 }}>
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Income Category */}
                <TableRow sx={{ backgroundColor: '#cbd5e1' }}>
                  <TableCell sx={{ fontWeight: 800, py: 1.5 }}>1. REVENUE / INCOME</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    {formatCurrency(data.income.total)}
                  </TableCell>
                </TableRow>
                {data.income.categories.map(cat => renderCategoryRows(cat))}

                {/* Expense Category */}
                <TableRow sx={{ backgroundColor: '#cbd5e1' }}>
                  <TableCell sx={{ fontWeight: 800, py: 1.5 }}>2. EXPENSES</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    {formatCurrency(data.expense.total)}
                  </TableCell>
                </TableRow>
                {data.expense.categories.map(cat => renderCategoryRows(cat))}

                {/* Net Profit Summary */}
                <TableRow sx={{ backgroundColor: data.net_profit >= 0 ? '#dcfce7' : '#fee2e2' }}>
                  <TableCell sx={{ fontWeight: 800, py: 2.5, fontSize: '1.05rem' }}>
                    {data.net_profit >= 0 ? 'NET PROFIT FOR THE PERIOD' : 'NET LOSS FOR THE PERIOD'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.05rem', color: data.net_profit >= 0 ? 'success.dark' : 'error.dark' }}>
                    {formatCurrency(data.net_profit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default ProfitLoss;
