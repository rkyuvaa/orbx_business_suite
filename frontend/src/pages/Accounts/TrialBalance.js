import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter,
  CircularProgress
} from '@mui/material';
import { FileDownload as ExportIcon, AccountBalance as ReportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const TrialBalance = () => {
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize dates with current Indian Financial Year
  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
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
      const res = await apiClient.get('/reports/trial-balance', {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch Trial Balance report.');
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
      const response = await apiClient.get('/reports/trial-balance', {
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
      link.setAttribute('download', `Trial_Balance_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Trial Balance to Excel.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <Box>
      <PageHeader
        title="Trial Balance"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Trial Balance' },
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

      {/* Date Range Filters */}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Trial Balance'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabular Preview */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Code</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 200 }}>Ledger Name</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 150 }}>Account Group</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Opening Dr</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Opening Cr</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Debit Movement</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Credit Movement</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Closing Dr</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Closing Cr</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading || !data ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    {loading ? (
                      <CircularProgress size={36} sx={{ color: '#1b4332' }} />
                    ) : (
                      <Typography color="text.secondary">Enter date parameters to fetch the report.</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No accounts found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row, idx) => (
                  <TableRow hover key={row.ledger_id || idx} sx={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.code}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                    <TableCell>{row.group_name}</TableCell>
                    <TableCell align="right" sx={{ color: row.opening_dr > 0 ? 'success.main' : 'text.primary' }}>
                      {row.opening_dr > 0 ? formatCurrency(row.opening_dr) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: row.opening_cr > 0 ? 'primary.main' : 'text.primary' }}>
                      {row.opening_cr > 0 ? formatCurrency(row.opening_cr) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {row.movement_dr > 0 ? formatCurrency(row.movement_dr) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {row.movement_cr > 0 ? formatCurrency(row.movement_cr) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: row.closing_dr > 0 ? 'success.main' : 'text.primary', fontWeight: 600 }}>
                      {row.closing_dr > 0 ? formatCurrency(row.closing_dr) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: row.closing_cr > 0 ? 'primary.main' : 'text.primary', fontWeight: 600 }}>
                      {row.closing_cr > 0 ? formatCurrency(row.closing_cr) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {data && data.rows.length > 0 && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell colSpan={3} align="center" sx={{ fontWeight: 800, color: '#0f172a' }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'success.dark' }}>{formatCurrency(data.totals.opening_dr_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatCurrency(data.totals.opening_cr_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.movement_dr_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.totals.movement_cr_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'success.dark' }}>{formatCurrency(data.totals.closing_dr_total)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatCurrency(data.totals.closing_cr_total)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default TrialBalance;
