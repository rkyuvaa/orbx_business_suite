import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
  Box, Button, Card, CardContent, Grid, Typography, Alert,
  Divider, TextField, Autocomplete, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer
} from '@mui/material';
import {
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  AccountBalanceWallet as BalanceIcon,
  ShoppingCart as PurchaseIcon,
  CheckCircle as PaidIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import CommonTable from '../../components/CommonTable';

const SupplierLedger = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  
  const [ledgerData, setLedgerData] = useState(null);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const printRef = useRef();

  // Load supplier master & company config
  const loadInitialData = async () => {
    try {
      const suppRes = await apiClient.get('/suppliers/');
      // Filter only active suppliers
      setSuppliers(suppRes.data.filter(s => s.is_active !== false));
      
      const compRes = await apiClient.get('/admin/company');
      setCompany(compRes.data);
    } catch (err) {
      setError('Failed to initialize supplier ledger requirements.');
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch ledger data
  const handleSearch = async () => {
    if (!selectedSupplier) {
      setError('Please select a supplier first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let url = `/reports/supplier-ledger/${selectedSupplier.id}`;
      const params = [];
      if (startMonth) params.push(`start_date=${startMonth}`);
      if (endMonth) params.push(`end_date=${endMonth}`);
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const res = await apiClient.get(url);
      setLedgerData(res.data);
    } catch (err) {
      setError('Failed to load supplier ledger report.');
      setLedgerData(null);
    } finally {
      setLoading(false);
    }
  };

  // Trigger search on supplier/date change
  useEffect(() => {
    if (selectedSupplier) {
      handleSearch();
    } else {
      setLedgerData(null);
    }
  }, [selectedSupplier, startMonth, endMonth]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const handleExportCSV = () => {
    if (!ledgerData || !ledgerData.transactions || ledgerData.transactions.length === 0) return;
    
    const headers = ['Date', 'Transaction Type', 'Reference No', 'Debit (Purchased)', 'Credit (Paid)', 'Running Balance'];
    const rows = ledgerData.transactions.map((tx) => [
      new Date(tx.date).toLocaleDateString('en-IN'),
      tx.tx_type,
      tx.reference_no,
      tx.debit.toFixed(2),
      tx.credit.toFixed(2),
      tx.running_balance.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SupplierLedger_${selectedSupplier.name.replace(/\s+/g, '_')}_${startMonth || 'all'}_to_${endMonth || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      id: 'date',
      label: 'Date',
      render: (row) => new Date(row.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    { id: 'tx_type', label: 'Transaction Type' },
    { id: 'reference_no', label: 'Reference No' },
    { id: 'debit', label: 'Debit (₹)', render: (row) => row.debit > 0 ? `₹${row.debit.toFixed(2)}` : '-' },
    { id: 'credit', label: 'Credit (₹)', render: (row) => row.credit > 0 ? `₹${row.credit.toFixed(2)}` : '-' },
    { id: 'running_balance', label: 'Running Balance (₹)', render: (row) => `₹${row.running_balance.toFixed(2)}` }
  ];

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Control Filters Card */}
      <Card sx={{ mb: 4, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
            Supplier Ledger Statement Filters
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <Autocomplete
                options={suppliers}
                getOptionLabel={(option) => `${option.name} (${option.code || 'N/A'})`}
                value={selectedSupplier}
                onChange={(event, newValue) => setSelectedSupplier(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Supplier" variant="outlined" size="small" fullWidth />
                )}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                type="month"
                label="Start Month (YYYY-MM)"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                type="month"
                label="End Month (YYYY-MM)"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <Button
                variant="contained"
                onClick={handleSearch}
                fullWidth
                sx={{ height: 40 }}
              >
                <SearchIcon />
              </Button>
            </Grid>
          </Grid>

          {/* Selected Supplier Details Panel */}
          {selectedSupplier && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#475569' }}>
                Supplier Contact & Billing Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" color="textSecondary" display="block">Supplier Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedSupplier.name}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" color="textSecondary" display="block">GSTIN</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedSupplier.gstin || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" color="textSecondary" display="block">Phone</Typography>
                  <Typography variant="body2">{selectedSupplier.phone || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={5}>
                  <Typography variant="caption" color="textSecondary" display="block">Address</Typography>
                  <Typography variant="body2">{selectedSupplier.address || 'N/A'}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards and Grid */}
      {ledgerData && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* KPI 1 */}
            <Grid item xs={12} sm={4}>
              <Card sx={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
                color: '#ffffff'
              }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500 }}>Total Purchased</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>₹{ledgerData.total_purchased.toFixed(2)}</Typography>
                  </Box>
                  <PurchaseIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                </CardContent>
              </Card>
            </Grid>

            {/* KPI 2 */}
            <Grid item xs={12} sm={4}>
              <Card sx={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                background: 'linear-gradient(135deg, #028090 0%, #00a896 100%)',
                color: '#ffffff'
              }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500 }}>Total Paid</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>₹{ledgerData.total_paid.toFixed(2)}</Typography>
                  </Box>
                  <PaidIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                </CardContent>
              </Card>
            </Grid>

            {/* KPI 3 */}
            <Grid item xs={12} sm={4}>
              <Card sx={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                background: ledgerData.balance > 0 
                  ? 'linear-gradient(135deg, #d90429 0%, #ef233c 100%)'
                  : 'linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)',
                color: '#ffffff'
              }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500 }}>Outstanding Balance</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>₹{ledgerData.balance.toFixed(2)}</Typography>
                  </Box>
                  <BalanceIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Ledger Table Container */}
          <CommonTable
            columns={columns}
            rows={ledgerData.transactions}
            searchKey="reference_no"
            searchPlaceholder="Search transactions..."
            tableActions={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExportCSV}>
                  Export CSV
                </Button>
                <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
                  Print Statement
                </Button>
              </Box>
            }
          />
        </Box>
      )}

      {/* Hidden Printable Statement Document */}
      <div style={{ display: 'none' }}>
        <Box
          ref={printRef}
          sx={{
            width: '100%',
            maxWidth: '180mm',
            minHeight: '265mm',
            mx: 'auto',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"Outfit", sans-serif',
            boxShadow: 'none',
            '@media print': {
              width: '210mm !important',
              maxWidth: '210mm !important',
              minHeight: '297mm !important',
              padding: '12mm 15mm !important',
              margin: '0 !important',
              boxShadow: 'none !important',
              boxSizing: 'border-box !important',
            }
          }}
        >
          {/* Statement Header */}
          <Grid container justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
            <Grid item>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1b4332' }}>
                {company?.name || 'ORBX Corporation'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', whiteSpace: 'pre-line' }}>
                {company?.billing_address || 'ORBX Head Office'}
                {company?.phone && `\nPhone: ${company.phone}`}
                {company?.gstin && `\nGSTIN: ${company.gstin}`}
              </Typography>
            </Grid>
            <Grid item sx={{ textAlign: 'right' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#334155', mb: 0.5 }}>
                SUPPLIER STATEMENT
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Period: {startMonth || 'Beginning'} to {endMonth || 'Present'}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 3, borderBottomWidth: 2 }} />

          {/* Parties Block */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 1 }}>
                STATEMENT FOR:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {selectedSupplier?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#334155', whiteSpace: 'pre-line' }}>
                {selectedSupplier?.address}
                {selectedSupplier?.phone && `\nPhone: ${selectedSupplier.phone}`}
                {selectedSupplier?.email && `\nEmail: ${selectedSupplier.email}`}
                {selectedSupplier?.gstin && `\nGSTIN: ${selectedSupplier.gstin}`}
              </Typography>
            </Grid>
            <Grid item xs={6} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Paper variant="outlined" sx={{ p: 2, width: '80%', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="textSecondary" display="block">SUMMARY METRICS</Typography>
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={7}>
                    <Typography variant="body2" color="textSecondary">Total Purchased:</Typography>
                  </Grid>
                  <Grid item xs={5} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{ledgerData?.total_purchased.toFixed(2)}</Typography>
                  </Grid>
                  <Grid item xs={7}>
                    <Typography variant="body2" color="textSecondary">Total Paid:</Typography>
                  </Grid>
                  <Grid item xs={5} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{ledgerData?.total_paid.toFixed(2)}</Typography>
                  </Grid>
                  <Grid item xs={12}><Divider sx={{ my: 0.5 }} /></Grid>
                  <Grid item xs={7}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Outstanding Balance:</Typography>
                  </Grid>
                  <Grid item xs={5} sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: (ledgerData?.balance || 0) > 0 ? '#d90429' : 'inherit' }}>
                      ₹{ledgerData?.balance.toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          {/* Ledger Table */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Transaction Ledger Details
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference No</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Debit (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Credit (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Balance (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledgerData?.transactions.map((tx, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {new Date(tx.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>{tx.tx_type}</TableCell>
                    <TableCell>{tx.reference_no}</TableCell>
                    <TableCell align="right">{tx.debit > 0 ? `₹${tx.debit.toFixed(2)}` : '-'}</TableCell>
                    <TableCell align="right">{tx.credit > 0 ? `₹${tx.credit.toFixed(2)}` : '-'}</TableCell>
                    <TableCell align="right">₹{tx.running_balance.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Footer terms */}
          <Box sx={{ mt: 6, textAlign: 'center' }}>
            <Typography variant="caption" color="textSecondary">
              This is a computer-generated statement of accounts. No signature required.
            </Typography>
          </Box>
        </Box>
      </div>
    </Box>
  );
};

export default SupplierLedger;
