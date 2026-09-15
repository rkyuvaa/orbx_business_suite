import React, { useState, useEffect } from 'react';
import { Box, Button, Alert, Typography, Grid, TextField, Paper, TableRow, TableCell } from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';

const SalesReport = () => {
  const [invoices, setInvoices] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [company, setCompany] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    try {
      const [res, cRes] = await Promise.all([
        apiClient.get('/sales/invoices'),
        apiClient.get('/admin/company')
      ]);
      setInvoices(res.data);
      setCompany(cRes.data);
    } catch (err) {
      setError('Failed to fetch sales reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const getTaxDetails = (row) => {
    const companyState = company?.state_code || (company?.gstin ? company.gstin.substring(0, 2) : '33');
    const customerGstin = row.customer_gstin;
    const hasCustomerGst = customerGstin && customerGstin !== 'N/A' && customerGstin.trim() !== '';
    const customerState = hasCustomerGst ? customerGstin.substring(0, 2) : companyState;
    const isIntrastate = companyState === customerState;

    let totalTaxable = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (row.items && row.items.length > 0) {
      row.items.forEach((item) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discount = parseFloat(item.discount_amount) || 0;
        const itemTaxable = (qty * rate) - discount;
        const taxRate = parseFloat(item.tax_rate) || 18;

        const itemTaxAmt = (item.tax_amount !== undefined && item.tax_amount !== null && item.tax_amount > 0)
          ? parseFloat(item.tax_amount)
          : (itemTaxable * (taxRate / 100));

        totalTaxable += itemTaxable;

        if (isIntrastate) {
          cgstAmt += itemTaxAmt / 2;
          sgstAmt += itemTaxAmt / 2;
        } else {
          igstAmt += itemTaxAmt;
        }
      });
    } else {
      totalTaxable = row.subtotal || row.total_amount || 0;
      const taxAmt = row.tax_amount || 0;
      if (isIntrastate) {
        cgstAmt = taxAmt / 2;
        sgstAmt = taxAmt / 2;
      } else {
        igstAmt = taxAmt;
      }
    }

    const cgstPct = isIntrastate && totalTaxable > 0 ? (cgstAmt / totalTaxable) * 100 : 0;
    const sgstPct = isIntrastate && totalTaxable > 0 ? (sgstAmt / totalTaxable) * 100 : 0;
    const igstPct = !isIntrastate && totalTaxable > 0 ? (igstAmt / totalTaxable) * 100 : 0;

    return { 
      cgstPct: Math.round(cgstPct * 100) / 100, 
      cgstAmt, 
      sgstPct: Math.round(sgstPct * 100) / 100, 
      sgstAmt, 
      igstPct: Math.round(igstPct * 100) / 100, 
      igstAmt 
    };
  };

  const handleExportCSV = () => {
    if (invoices.length === 0) return;
    
    const headers = [
      'Invoice Number', 'Date', 'Customer Name', 'GSTIN', 'Taxable Value',
      'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'IGST %', 'IGST Amt',
      'Total Tax', 'Total Invoice', 'Status'
    ];
    const rows = invoices.map((inv) => {
      const { cgstPct, cgstAmt, sgstPct, sgstAmt, igstPct, igstAmt } = getTaxDetails(inv);
      return [
        inv.invoice_number,
        new Date(inv.date).toLocaleDateString(),
        inv.customer_name || 'Unknown',
        inv.customer_gstin || 'N/A',
        inv.subtotal,
        `${cgstPct}%`,
        cgstAmt.toFixed(2),
        `${sgstPct}%`,
        sgstAmt.toFixed(2),
        `${igstPct}%`,
        igstAmt.toFixed(2),
        inv.tax_amount,
        inv.total_amount,
        inv.status,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SalesReport_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { id: 'invoice_number', label: 'Invoice No.' },
    { id: 'date', label: 'Billing Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { id: 'customer_name', label: 'Customer Name', render: (row) => row.customer_name || 'Unknown' },
    { id: 'customer_gstin', label: 'GSTIN', render: (row) => row.customer_gstin || 'N/A' },
    { id: 'subtotal', label: 'Taxable Value (₹)', render: (row) => `₹${row.subtotal.toFixed(2)}` },
    { id: 'cgst_pct', label: 'CGST %', render: (row) => `${getTaxDetails(row).cgstPct}%` },
    { id: 'cgst_amt', label: 'CGST Amt (₹)', render: (row) => `₹${getTaxDetails(row).cgstAmt.toFixed(2)}` },
    { id: 'sgst_pct', label: 'SGST %', render: (row) => `${getTaxDetails(row).sgstPct}%` },
    { id: 'sgst_amt', label: 'SGST Amt (₹)', render: (row) => `₹${getTaxDetails(row).sgstAmt.toFixed(2)}` },
    { id: 'igst_pct', label: 'IGST %', render: (row) => `${getTaxDetails(row).igstPct}%` },
    { id: 'igst_amt', label: 'IGST Amt (₹)', render: (row) => `₹${getTaxDetails(row).igstAmt.toFixed(2)}` },
    { id: 'tax_amount', label: 'Total Tax (₹)', render: (row) => `₹${row.tax_amount.toFixed(2)}` },
    { id: 'total_amount', label: 'Total Invoice (₹)', render: (row) => `₹${row.total_amount.toFixed(2)}` },
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
            backgroundColor: row.status === 'Paid' ? 'rgba(45, 106, 79, 0.1)' : 'rgba(217, 4, 41, 0.1)',
            color: row.status === 'Paid' ? '#2d6a4f' : '#d90429',
          }}
        >
          {row.status}
        </Typography>
      ),
    },
  ];

  const filteredInvoices = invoices.filter((inv) => {
    if (!inv.date) return false;
    const invDate = new Date(inv.date);
    const year = invDate.getFullYear();
    const month = String(invDate.getMonth() + 1).padStart(2, '0');
    const day = String(invDate.getDate()).padStart(2, '0');
    const invDateStr = `${year}-${month}-${day}`;
    
    const start = startDate || '1970-01-01';
    const end = endDate || '9999-12-31';
    
    return invDateStr >= start && invDateStr <= end;
  });

  const renderSummary = (filteredRows) => {
    const totalSubtotal = filteredRows.reduce((sum, row) => sum + (row.subtotal || 0), 0);
    const totalTax = filteredRows.reduce((sum, row) => sum + (row.tax_amount || 0), 0);
    const totalGrand = filteredRows.reduce((sum, row) => sum + (row.total_amount || 0), 0);

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
        title="Sales Reports"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Sales Reports' },
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

      <CommonTable columns={columns} rows={filteredInvoices} loading={loading} searchKey="invoice_number" renderSummary={renderSummary} />
    </Box>
  );
};

export default SalesReport;
