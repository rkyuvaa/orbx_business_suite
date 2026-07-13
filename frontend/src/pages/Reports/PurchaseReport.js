import React, { useState, useEffect } from 'react';
import { Box, Button, Alert, Typography, Grid, TextField, Paper, TableRow, TableCell } from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';

const PurchaseReport = () => {
  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [company, setCompany] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const end = new Date(y, m + 1, 0);
    const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    setStartDate(startStr);
    setEndDate(endStr);
  }, []);

  const loadReport = async () => {
    try {
      const res = await apiClient.get('/purchase/po');
      const sRes = await apiClient.get('/suppliers/');
      const cRes = await apiClient.get('/admin/company');
      setPos(res.data);
      setSuppliers(sRes.data);
      setCompany(cRes.data);
    } catch (err) {
      setError('Failed to fetch purchase reports.');
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const getTaxDetails = (row) => {
    const companyState = company?.state_code || (company?.gstin ? company.gstin.substring(0, 2) : '33');
    const s = suppliers.find((sup) => sup.id === row.supplier_id);
    const supplierGstin = s ? s.gstin : '';
    const hasSupplierGst = supplierGstin && supplierGstin !== 'N/A' && supplierGstin.trim() !== '';
    const supplierState = hasSupplierGst ? supplierGstin.substring(0, 2) : companyState;
    const isIntrastate = companyState === supplierState;

    const gstRate = row.items && row.items.length > 0 ? (row.items[0].tax_rate || 18) : 18;

    const cgstPct = isIntrastate ? gstRate / 2 : 0;
    const sgstPct = isIntrastate ? gstRate / 2 : 0;
    const igstPct = !isIntrastate ? gstRate : 0;

    const cgstAmt = isIntrastate ? row.tax_amount / 2 : 0;
    const sgstAmt = isIntrastate ? row.tax_amount / 2 : 0;
    const igstAmt = !isIntrastate ? row.tax_amount : 0;

    return { 
      cgstPct, 
      cgstAmt, 
      sgstPct, 
      sgstAmt, 
      igstPct, 
      igstAmt, 
      supplierName: s ? s.name : 'Unknown', 
      supplierGstin: supplierGstin || 'N/A' 
    };
  };

  const handleExportCSV = () => {
    if (pos.length === 0) return;
    const headers = [
      'Order Number', 'Order Date', 'Vendor Name', 'GSTIN', 'Taxable Value',
      'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'IGST %', 'IGST Amt',
      'Total Tax', 'Total Purchase', 'Status'
    ];
    const rows = pos.map((po) => {
      const { cgstPct, cgstAmt, sgstPct, sgstAmt, igstPct, igstAmt, supplierName, supplierGstin } = getTaxDetails(po);
      return [
        po.po_number || 'N/A',
        new Date(po.date).toLocaleDateString(),
        supplierName,
        supplierGstin,
        po.total_amount,
        `${cgstPct}%`,
        cgstAmt.toFixed(2),
        `${sgstPct}%`,
        sgstAmt.toFixed(2),
        `${igstPct}%`,
        igstAmt.toFixed(2),
        po.tax_amount,
        po.grand_total,
        po.status,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PurchaseReport_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { id: 'po_number', label: 'Order No.', render: (row) => row.po_number || 'N/A' },
    { id: 'date', label: 'Order Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { id: 'supplier_name', label: 'Vendor Name', render: (row) => getTaxDetails(row).supplierName },
    { id: 'supplier_gstin', label: 'GSTIN', render: (row) => getTaxDetails(row).supplierGstin },
    { id: 'total_amount', label: 'Taxable Value (₹)', render: (row) => `₹${row.total_amount.toFixed(2)}` },
    { id: 'cgst_pct', label: 'CGST %', render: (row) => `${getTaxDetails(row).cgstPct}%` },
    { id: 'cgst_amt', label: 'CGST Amt (₹)', render: (row) => `₹${getTaxDetails(row).cgstAmt.toFixed(2)}` },
    { id: 'sgst_pct', label: 'SGST %', render: (row) => `${getTaxDetails(row).sgstPct}%` },
    { id: 'sgst_amt', label: 'SGST Amt (₹)', render: (row) => `₹${getTaxDetails(row).sgstAmt.toFixed(2)}` },
    { id: 'igst_pct', label: 'IGST %', render: (row) => `${getTaxDetails(row).igstPct}%` },
    { id: 'igst_amt', label: 'IGST Amt (₹)', render: (row) => `₹${getTaxDetails(row).igstAmt.toFixed(2)}` },
    { id: 'tax_amount', label: 'Total Tax (₹)', render: (row) => `₹${row.tax_amount.toFixed(2)}` },
    { id: 'grand_total', label: 'Total Purchase (₹)', render: (row) => `₹${row.grand_total.toFixed(2)}` },
    {
      id: 'status',
      label: 'Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor:
              row.status === 'Received' ? 'rgba(45, 106, 79, 0.1)' :
              row.status === 'Draft' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(255, 143, 0, 0.1)',
            color:
              row.status === 'Received' ? '#2d6a4f' :
              row.status === 'Draft' ? '#64748b' : '#ff8f00',
          }}
        >
          {row.status}
        </Typography>
      ),
    },
  ];

  const filteredPos = pos.filter((po) => {
    if (!po.date) return false;
    const poDate = new Date(po.date);
    const year = poDate.getFullYear();
    const month = String(poDate.getMonth() + 1).padStart(2, '0');
    const day = String(poDate.getDate()).padStart(2, '0');
    const poDateStr = `${year}-${month}-${day}`;
    
    const start = startDate || '1970-01-01';
    const end = endDate || '9999-12-31';
    
    return poDateStr >= start && poDateStr <= end;
  });

  const renderSummary = (filteredRows) => {
    const totalSubtotal = filteredRows.reduce((sum, row) => sum + (row.total_amount || 0), 0);
    const totalTax = filteredRows.reduce((sum, row) => sum + (row.tax_amount || 0), 0);
    const totalGrand = filteredRows.reduce((sum, row) => sum + (row.grand_total || 0), 0);

    let totalCgstAmt = 0;
    let totalSgstAmt = 0;
    let totalIgstAmt = 0;

    filteredRows.forEach((row) => {
      const { cgstAmt, sgstAmt, igstAmt } = getTaxDetails(row);
      totalCgstAmt += cgstAmt;
      totalSgstAmt += sgstAmt;
      totalIgstAmt += igstAmt;
    });

    return (
      <TableRow sx={{ backgroundColor: '#f8fafc', '& td': { fontWeight: 'bold', borderTop: '2px solid #cbd5e1' } }}>
        <TableCell>Total</TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell>₹{totalSubtotal.toFixed(2)}</TableCell>
        <TableCell></TableCell>
        <TableCell>₹{totalCgstAmt.toFixed(2)}</TableCell>
        <TableCell></TableCell>
        <TableCell>₹{totalSgstAmt.toFixed(2)}</TableCell>
        <TableCell></TableCell>
        <TableCell>₹{totalIgstAmt.toFixed(2)}</TableCell>
        <TableCell>₹{totalTax.toFixed(2)}</TableCell>
        <TableCell>₹{totalGrand.toFixed(2)}</TableCell>
        <TableCell></TableCell>
      </TableRow>
    );
  };

  return (
    <Box>
      <PageHeader
        title="Purchase Reports"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Purchase Reports' },
        ]}
        actions={
          <Button variant="contained" startIcon={<ExportIcon />} onClick={handleExportCSV}>
            Export to CSV
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px' }}>
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
            <Button variant="outlined" fullWidth onClick={loadReport} sx={{ py: 1.5 }}>
              Apply Date Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <CommonTable columns={columns} rows={filteredPos} searchKey="status" renderSummary={renderSummary} />
    </Box>
  );
};

export default PurchaseReport;
