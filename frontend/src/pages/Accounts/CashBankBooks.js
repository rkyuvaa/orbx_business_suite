import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter,
  CircularProgress, Tabs, Tab, Card, CardContent
} from '@mui/material';
import { FileDownload as ExportIcon, AccountBalanceWallet as BookIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';

const CashBankBooks = () => {
  const [tabValue, setTabValue] = useState(0);
  const [ledgers, setLedgers] = useState([]);
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState('');
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [ledgersLoading, setLedgersLoading] = useState(false);
  const [error, setError] = useState(null);

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

    const loadLedgersList = async () => {
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
    loadLedgersList();
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      if (tabValue === 0) {
        const res = await apiClient.get('/reports/cash-book', {
          params: { start_date: startDate, end_date: endDate, limit: 1000 }
        });
        setData(res.data);
      } else {
        const res = await apiClient.get('/reports/bank-book', {
          params: {
            bank_ledger_id: selectedBankLedgerId || undefined,
            start_date: startDate,
            end_date: endDate,
            limit: 1000
          }
        });
        setData(res.data);
      }
    } catch (err) {
      setError('Failed to fetch cash/bank book data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate, tabValue, selectedBankLedgerId]);

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return;
    const path = tabValue === 0 ? '/reports/cash-book' : '/reports/bank-book';
    const filename = tabValue === 0 ? `Cash_Book_${startDate}_to_${endDate}.xlsx` : `Bank_Book_${startDate}_to_${endDate}.xlsx`;
    try {
      const response = await apiClient.get(path, {
        params: {
          bank_ledger_id: tabValue === 1 ? (selectedBankLedgerId || undefined) : undefined,
          start_date: startDate,
          end_date: endDate,
          format: 'xlsx'
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export Cash/Bank book to Excel.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  // Filter ledgers list to get bank ledgers for selector
  const bankLedgers = ledgers.filter(l => 
    l.name.toLowerCase().includes('bank') || 
    l.name.toLowerCase().includes('saving') || 
    l.name.toLowerCase().includes('current a/c')
  );

  return (
    <Box>
      <PageHeader
        title="Cash & Bank Books"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Accounts', to: '/accounts/chart-of-accounts' },
          { label: 'Cash & Bank Books' },
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

      {/* Filters & Tabs */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={3}>
            <Tabs
              value={tabValue}
              onChange={(e, val) => {
                setTabValue(val);
                setData(null);
              }}
              textColor="primary"
              indicatorColor="primary"
              variant="fullWidth"
            >
              <Tab label="Cash Book" sx={{ textTransform: 'none', fontWeight: 600 }} />
              <Tab label="Bank Book" sx={{ textTransform: 'none', fontWeight: 600 }} />
            </Tabs>
          </Grid>
          <Grid item xs={12} sm={3}>
            {tabValue === 1 ? (
              <TextField
                select
                label="Bank Account"
                fullWidth
                value={selectedBankLedgerId}
                onChange={(e) => setSelectedBankLedgerId(e.target.value)}
                disabled={ledgersLoading}
              >
                <MenuItem value="">-- All Bank Accounts --</MenuItem>
                {bankLedgers.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    [{l.code}] {l.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Cash Mode"
                fullWidth
                value="Standard Cash Ledgers"
                disabled
              />
            )}
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Book'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* KPI summaries */}
      {data && !loading && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1.5, borderRadius: '8px', backgroundColor: '#f8fafc', color: 'text.secondary' }}>
                  <BookIcon />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Opening Balance</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{formatCurrency(data.opening_balance)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1.5, borderRadius: '8px', backgroundColor: '#eefef6', color: 'success.main' }}>
                  <BookIcon />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Inflow (Dr)</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'success.dark' }}>{formatCurrency(data.total_debit)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1.5, borderRadius: '8px', backgroundColor: '#fee2e2', color: 'error.main' }}>
                  <BookIcon />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Outflow (Cr)</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'error.dark' }}>{formatCurrency(data.total_credit)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabular Preview */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 100 }}>Date</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 120 }}>Voucher No.</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 200 }}>Particulars/Ledgers</TableCell>
                <TableCell sx={{ backgroundColor: '#1b4332', color: '#ffffff', fontWeight: 600, minWidth: 150 }}>Account Name</TableCell>
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
                    <Typography color="text.secondary">Load transactions list.</Typography>
                  </TableCell>
                </TableRow>
              ) : data.records.length === 0 ? (
                <>
                  <TableRow hover sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell>{startDate}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Opening Balance</TableCell>
                    <TableCell colSpan={3}>No transactions posted during this period</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(data.opening_balance)}</TableCell>
                  </TableRow>
                </>
              ) : (
                <>
                  <TableRow hover sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell>{startDate}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Opening Balance</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(data.opening_balance)}</TableCell>
                  </TableRow>
                  {data.records.map((row, idx) => (
                    <TableRow hover key={idx} sx={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.voucher_number}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{row.particulars}</TableCell>
                      <TableCell>{row.ledger_name}</TableCell>
                      <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>{row.narration || '-'}</TableCell>
                      <TableCell align="right" sx={{ color: row.debit > 0 ? 'success.main' : 'text.primary' }}>
                        {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: row.credit > 0 ? 'primary.main' : 'text.primary' }}>
                        {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(row.running_balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
            {data && data.records.length > 0 && (
              <TableFooter>
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell colSpan={3} align="center" sx={{ fontWeight: 800, color: '#0f172a' }}>TOTAL MOVEMENT</TableCell>
                  <TableCell colSpan={2} />
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'success.dark' }}>{formatCurrency(data.total_debit)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatCurrency(data.total_credit)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(data.closing_balance)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default CashBankBooks;
