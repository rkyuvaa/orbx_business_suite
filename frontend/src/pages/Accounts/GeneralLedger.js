import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Chip
} from '@mui/material';
import { FileDownload as ExportIcon, ReceiptLong as LedgerIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const GeneralLedger = () => {
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [ledgersLoading, setLedgersLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize dates with current Indian Financial Year and load ledgers
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

    const loadLedgerAccounts = async () => {
      setLedgersLoading(true);
      try {
        const res = await apiClient.get('/accounts/ledgers');
        setLedgers(res.data);
      } catch (err) {
        setError('Failed to load ledger accounts list.');
      } finally {
        setLedgersLoading(false);
      }
    };
    loadLedgerAccounts();
  }, []);

  const loadReport = async () => {
    if (!selectedLedgerId || !startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/reports/general-ledger/${selectedLedgerId}`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          limit: 1000
        }
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch General Ledger report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLedgerId && startDate && endDate) {
      loadReport();
    }
  }, [selectedLedgerId, startDate, endDate]);

  const handleExportExcel = async () => {
    if (!selectedLedgerId || !startDate || !endDate) return;
    try {
      const response = await apiClient.get(`/reports/general-ledger/${selectedLedgerId}`, {
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
      
      const ledgerCode = data ? data.code : 'ledger';
      link.setAttribute('download', `General_Ledger_${ledgerCode}_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export General Ledger to Excel.');
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
        title="General Ledger"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'General Ledger' },
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

      {/* Date Range & Ledger Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Ledger Account"
              fullWidth
              value={selectedLedgerId}
              onChange={(e) => setSelectedLedgerId(e.target.value)}
              disabled={ledgersLoading}
            >
              {ledgersLoading ? (
                <MenuItem value="" disabled>Loading ledgers...</MenuItem>
              ) : ledgers.length === 0 ? (
                <MenuItem value="" disabled>No ledgers found</MenuItem>
              ) : (
                ledgers.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    [{l.code}] {l.name}
                  </MenuItem>
                ))
              )}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              variant="outlined"
              fullWidth
              onClick={loadReport}
              disabled={loading || !selectedLedgerId}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Ledger'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Ledger Header & KPI Card Preview */}
      {data && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LedgerIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1b4332' }}>
                [{data.code}] {data.name}
              </Typography>
              <Chip label={data.group_name} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            </Box>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={3}>
              <Box sx={{ p: 2, borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Opening Balance</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  {formatCurrency(data.opening_balance)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>({data.opening_balance_type})</span>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Box sx={{ p: 2, borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Total Debits</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {formatCurrency(data.total_debit)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Box sx={{ p: 2, borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Total Credits</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formatCurrency(data.total_credit)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Box sx={{ p: 2, borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Closing Balance</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  {formatCurrency(data.closing_balance)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>({data.closing_balance_type})</span>
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Tabular Preview */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Date</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Voucher Type</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Voucher No.</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 200 }}>Particulars</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 200 }}>Narration</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Debit (Dr)</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Credit (Cr)</TableCell>
                <TableCell align="right" sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 150 }}>Running Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={36} sx={{ color: '#1b4332' }} />
                  </TableCell>
                </TableRow>
              ) : !data ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">Select an account and click "Fetch Ledger" to load the statement.</Typography>
                  </TableCell>
                </TableRow>
              ) : data.lines.length === 0 ? (
                <TableRow hover>
                  <TableCell>{startDate}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Opening Balance</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>Opening Balance</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCurrency(data.opening_balance)} ({data.opening_balance_type})
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* First row: Opening Balance */}
                  <TableRow hover sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell>{startDate}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Opening Balance</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>Opening Balance</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCurrency(data.opening_balance)} ({data.opening_balance_type})
                    </TableCell>
                  </TableRow>

                  {/* Transaction rows */}
                  {data.lines.map((line, idx) => (
                    <TableRow hover key={line.journal_entry_id || idx} sx={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                      <TableCell>{line.date}</TableCell>
                      <TableCell>{line.voucher_type}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{line.reference_no}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{line.particulars}</TableCell>
                      <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>{line.narration || '-'}</TableCell>
                      <TableCell align="right" sx={{ color: line.debit > 0 ? 'success.main' : 'text.primary' }}>
                        {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: line.credit > 0 ? 'primary.main' : 'text.primary' }}>
                        {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(line.running_balance)} <span style={{ fontSize: '0.725rem', color: '#64748b' }}>({line.running_balance_type})</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default GeneralLedger;
