import React, { useState, useEffect } from 'react';
import {
  Box, Button, Alert, Typography, Grid, TextField, Paper, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Chip, Stack
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  Receipt as ReportIcon,
  FilterList as FilterIcon,
  RestartAlt as ResetIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';

const formatCurrency = (val) => {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const SalesReport = () => {
  const [invoices, setInvoices] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL'); // 'ALL' | 'INVOICE' | 'CREDIT_NOTE'
  const [company, setCompany] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default to current month
  const setCurrentMonthDates = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const end = new Date(y, m + 1, 0);
    const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    setStartDate(startStr);
    setEndDate(endStr);
  };

  const setAllTimeDates = () => {
    setStartDate('');
    setEndDate('');
  };

  useEffect(() => {
    setCurrentMonthDates();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, cnRes, cRes] = await Promise.allSettled([
        apiClient.get('/sales/invoices'),
        apiClient.get('/sales/credit-notes'),
        apiClient.get('/admin/company')
      ]);

      if (invRes.status === 'fulfilled') {
        setInvoices(invRes.value.data || []);
      } else {
        console.error('Failed to load invoices:', invRes.reason);
      }

      if (cnRes.status === 'fulfilled') {
        setCreditNotes(cnRes.value.data || []);
      } else {
        console.error('Failed to load credit notes:', cnRes.reason);
      }

      if (cRes.status === 'fulfilled') {
        setCompany(cRes.value.data || null);
      }

      if (invRes.status === 'rejected' && cnRes.status === 'rejected') {
        setError('Failed to fetch sales report data.');
      }
    } catch (err) {
      setError('Failed to fetch sales report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // 1. Process itemized line items across all Tax Invoices & Credit Notes
  const getItemizedRows = () => {
    const companyState = company?.state_code || (company?.gstin ? company.gstin.substring(0, 2) : '33');
    const rows = [];

    const processDocument = (doc, isCreditNote = false) => {
      if (doc.status === 'Cancelled') return;

      // Filter by Doc Type
      if (docTypeFilter === 'INVOICE' && isCreditNote) return;
      if (docTypeFilter === 'CREDIT_NOTE' && !isCreditNote) return;

      // Safe date parsing without timezone day shifts
      const rawDate = doc.date || doc.created_at || '';
      let docDateStr = '';
      if (rawDate) {
        if (typeof rawDate === 'string' && rawDate.includes('T')) {
          docDateStr = rawDate.split('T')[0];
        } else if (typeof rawDate === 'string' && rawDate.length >= 10 && rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
          docDateStr = rawDate.substring(0, 10);
        } else {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            docDateStr = `${y}-${m}-${day}`;
          }
        }
      }

      if (docDateStr) {
        if (startDate && docDateStr < startDate) return;
        if (endDate && docDateStr > endDate) return;
      }

      const customerGstin = doc.customer_gstin || '';
      const hasCustomerGst = customerGstin && customerGstin !== 'N/A' && customerGstin.trim() !== '';
      const customerState = hasCustomerGst ? customerGstin.substring(0, 2) : companyState;
      const isIntrastate = companyState === customerState;

      const items = (doc.items && doc.items.length > 0) ? doc.items : [
        {
          id: doc.id,
          product_name: isCreditNote ? 'Sales Return' : 'General Items',
          sku: 'N/A',
          qty: 1,
          rate: doc.subtotal || doc.total_amount || 0,
          discount_amount: doc.discount_amount || 0,
          tax_rate: 18,
          tax_amount: doc.tax_amount || 0
        }
      ];

      const docNo = isCreditNote
        ? (doc.credit_note_number || `CN-${String(doc.id || '').substring(0, 6).toUpperCase()}`)
        : (doc.invoice_number || `INV-${String(doc.id || '').substring(0, 6).toUpperCase()}`);

      const custName = doc.customer_name || doc.customer?.name || (isCreditNote ? 'Walk-in Customer' : 'Walk-in Customer');

      items.forEach((item, idx) => {
        const qty = parseFloat(item.qty) || 1;
        const rate = parseFloat(item.rate) || 0;
        const discount = parseFloat(item.discount_amount) || 0;
        const itemTaxable = (item.amount !== undefined && item.amount !== null && parseFloat(item.amount) > 0)
          ? parseFloat(item.amount)
          : ((qty * rate) - discount);
        const taxRate = (item.tax_rate !== undefined && item.tax_rate !== null)
          ? parseFloat(item.tax_rate)
          : 18;

        const itemTaxAmt = (item.tax_amount !== undefined && item.tax_amount !== null && item.tax_amount > 0)
          ? parseFloat(item.tax_amount)
          : (itemTaxable * (taxRate / 100));

        // Apply negative multiplier if Credit Note (sales return)
        const sign = isCreditNote ? -1 : 1;
        const finalTaxable = itemTaxable * sign;
        const finalTaxAmt = itemTaxAmt * sign;

        const cgstPct = isIntrastate ? taxRate / 2 : 0;
        const cgstAmt = isIntrastate ? finalTaxAmt / 2 : 0;
        const sgstPct = isIntrastate ? taxRate / 2 : 0;
        const sgstAmt = isIntrastate ? finalTaxAmt / 2 : 0;
        const igstPct = !isIntrastate ? taxRate : 0;
        const igstAmt = !isIntrastate ? finalTaxAmt : 0;
        const lineTotal = finalTaxable + finalTaxAmt;

        rows.push({
          id: `${doc.id}_${item.id || idx}`,
          doc_number: docNo,
          doc_type: isCreditNote ? 'Credit Note' : 'Tax Invoice',
          date: doc.date || doc.created_at,
          customer_name: custName,
          customer_gstin: customerGstin || 'N/A',
          product_name: item.product_name || item.product?.name || (isCreditNote ? 'Return Item' : 'Product Item'),
          sku: item.sku || item.product?.sku || item.hsn_code || '-',
          qty: qty * sign,
          rate: rate,
          discount: discount * sign,
          taxable_value: finalTaxable,
          gst_rate: taxRate,
          cgst_pct: cgstPct,
          cgst_amt: cgstAmt,
          sgst_pct: sgstPct,
          sgst_amt: sgstAmt,
          igst_pct: igstPct,
          igst_amt: igstAmt,
          total_tax: finalTaxAmt,
          line_total: lineTotal,
          status: doc.status || 'Issued'
        });
      });
    };

    invoices.forEach((inv) => processDocument(inv, false));
    creditNotes.forEach((cn) => processDocument(cn, true));

    return rows;
  };

  const itemizedRows = getItemizedRows();

  // 2. Consolidate Tax Rows: GROUP BY (Doc Number, Tax Type, GST Rate)
  const getConsolidatedTaxRows = () => {
    const groupMap = {};

    itemizedRows.forEach((row) => {
      const taxType = row.cgst_pct > 0 || row.sgst_pct > 0 ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)';
      const key = `${row.doc_number}_${row.gst_rate.toFixed(1)}_${taxType}`;

      if (!groupMap[key]) {
        groupMap[key] = {
          id: key,
          doc_number: row.doc_number,
          doc_type: row.doc_type,
          date: row.date,
          customer_name: row.customer_name,
          customer_gstin: row.customer_gstin,
          gst_rate: row.gst_rate,
          tax_type: taxType,
          items_count: 0,
          taxable_value: 0,
          cgst_pct: row.cgst_pct,
          cgst_amt: 0,
          sgst_pct: row.sgst_pct,
          sgst_amt: 0,
          igst_pct: row.igst_pct,
          igst_amt: 0,
          total_tax: 0,
          line_total: 0,
          status: row.status,
          search_text: `${row.doc_number} ${row.customer_name} ${row.doc_type} ${row.customer_gstin}`.toLowerCase()
        };
      }

      groupMap[key].items_count += 1;
      groupMap[key].taxable_value += row.taxable_value;
      groupMap[key].cgst_amt += row.cgst_amt;
      groupMap[key].sgst_amt += row.sgst_amt;
      groupMap[key].igst_amt += row.igst_amt;
      groupMap[key].total_tax += row.total_tax;
      groupMap[key].line_total += row.line_total;
    });

    // Sort by date descending so latest documents / credit notes appear on the first page!
    return Object.values(groupMap).sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  };

  const consolidatedTaxRows = getConsolidatedTaxRows();

  // 3. Compute Tax Slab Summary across all transactions (0%, 5%, 12%, 18%, 28%)
  const getTaxSlabSummary = () => {
    const summaryMap = {};

    itemizedRows.forEach((row) => {
      const rateKey = `${row.gst_rate.toFixed(1)}%`;
      if (!summaryMap[rateKey]) {
        summaryMap[rateKey] = {
          gstRate: row.gst_rate,
          taxableValue: 0,
          cgstAmt: 0,
          sgstAmt: 0,
          igstAmt: 0,
          totalTax: 0,
          totalValue: 0,
          count: 0
        };
      }
      summaryMap[rateKey].taxableValue += row.taxable_value;
      summaryMap[rateKey].cgstAmt += row.cgst_amt;
      summaryMap[rateKey].sgstAmt += row.sgst_amt;
      summaryMap[rateKey].igstAmt += row.igst_amt;
      summaryMap[rateKey].totalTax += row.total_tax;
      summaryMap[rateKey].totalValue += row.line_total;
      summaryMap[rateKey].count += 1;
    });

    return Object.values(summaryMap).sort((a, b) => a.gstRate - b.gstRate);
  };

  const taxSlabs = getTaxSlabSummary();

  // Quick stats
  const totalInvoicesCount = consolidatedTaxRows.filter(r => r.doc_type === 'Tax Invoice').length;
  const totalCreditNotesCount = consolidatedTaxRows.filter(r => r.doc_type === 'Credit Note').length;
  const netSalesValue = consolidatedTaxRows.reduce((sum, r) => sum + (r.line_total || 0), 0);

  // CSV Export
  const handleExportCSV = () => {
    if (consolidatedTaxRows.length === 0) return;

    let csv = '';

    // Section 1: Overall GST Slab Summary
    csv += 'GST TAX RATE SLAB SUMMARY\n';
    csv += 'GST Rate,Line Items,Taxable Value (INR),CGST Amount (INR),SGST Amount (INR),IGST Amount (INR),Total Tax (INR),Total Sales Value (INR)\n';
    taxSlabs.forEach((slab) => {
      csv += `${slab.gstRate}%,${slab.count},${slab.taxableValue.toFixed(2)},${slab.cgstAmt.toFixed(2)},${slab.sgstAmt.toFixed(2)},${slab.igstAmt.toFixed(2)},${slab.totalTax.toFixed(2)},${slab.totalValue.toFixed(2)}\n`;
    });

    // Section 2: Invoice Tax Consolidation
    csv += '\nINVOICE TAX CONSOLIDATION (Grouped by Invoice No + Tax Rate)\n';
    csv += 'Document No,Doc Type,Date,Customer Name,GSTIN,GST Rate,Items Count,Consolidated Taxable Value (INR),CGST Amt (INR),SGST Amt (INR),IGST Amt (INR),Total Tax (INR),Total Invoice Value (INR)\n';
    consolidatedTaxRows.forEach((r) => {
      csv += `${r.doc_number},${r.doc_type},${r.date ? new Date(r.date).toLocaleDateString() : '-'},"${(r.customer_name || '').replace(/"/g, '""')}",${r.customer_gstin},${r.gst_rate}%,${r.items_count},${r.taxable_value.toFixed(2)},${r.cgst_amt.toFixed(2)},${r.sgst_amt.toFixed(2)},${r.igst_amt.toFixed(2)},${r.total_tax.toFixed(2)},${r.line_total.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sales_Tax_Consolidation_Report_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Columns for Consolidated Tax View
  const consolidatedColumns = [
    {
      id: 'doc_number',
      label: 'Invoice / Doc No.',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <strong>{row.doc_number}</strong>
          <Chip
            size="small"
            label={row.doc_type}
            color={row.doc_type === 'Credit Note' ? 'error' : 'primary'}
            variant={row.doc_type === 'Credit Note' ? 'filled' : 'outlined'}
            sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
          />
        </Box>
      )
    },
    { id: 'date', label: 'Date', render: (row) => row.date ? new Date(row.date).toLocaleDateString() : '-' },
    { id: 'customer_name', label: 'Customer Name', render: (row) => row.customer_name },
    { id: 'customer_gstin', label: 'GSTIN', render: (row) => row.customer_gstin },
    { id: 'gst_rate', label: 'GST Rate', align: 'center', render: (row) => <strong>{row.gst_rate}%</strong> },
    { id: 'items_count', label: 'Items', align: 'center', render: (row) => `${row.items_count} item(s)` },
    {
      id: 'taxable_value',
      label: 'Consolidated Taxable Value (₹)',
      align: 'right',
      render: (row) => (
        <span style={{ color: row.doc_type === 'Credit Note' ? '#d32f2f' : 'inherit', fontWeight: row.doc_type === 'Credit Note' ? 600 : 400 }}>
          {formatCurrency(row.taxable_value)}
        </span>
      )
    },
    { id: 'cgst_amt', label: 'CGST (₹)', align: 'right', render: (row) => formatCurrency(row.cgst_amt) },
    { id: 'sgst_amt', label: 'SGST (₹)', align: 'right', render: (row) => formatCurrency(row.sgst_amt) },
    { id: 'igst_amt', label: 'IGST (₹)', align: 'right', render: (row) => formatCurrency(row.igst_amt) },
    { id: 'total_tax', label: 'Total Tax (₹)', align: 'right', render: (row) => <strong>{formatCurrency(row.total_tax)}</strong> },
    {
      id: 'line_total',
      label: 'Total Net Value (₹)',
      align: 'right',
      render: (row) => (
        <strong style={{ color: row.doc_type === 'Credit Note' ? '#d32f2f' : '#1b4332' }}>
          {formatCurrency(row.line_total)}
        </strong>
      )
    },
  ];

  const renderConsolidatedSummary = (filteredRows) => {
    const totalTaxable = filteredRows.reduce((sum, row) => sum + (row.taxable_value || 0), 0);
    const totalCgst = filteredRows.reduce((sum, row) => sum + (row.cgst_amt || 0), 0);
    const totalSgst = filteredRows.reduce((sum, row) => sum + (row.sgst_amt || 0), 0);
    const totalIgst = filteredRows.reduce((sum, row) => sum + (row.igst_amt || 0), 0);
    const totalTax = filteredRows.reduce((sum, row) => sum + (row.total_tax || 0), 0);
    const totalGrand = filteredRows.reduce((sum, row) => sum + (row.line_total || 0), 0);

    return (
      <TableRow sx={{ backgroundColor: '#f8fafc', '& td': { fontWeight: 'bold', borderTop: '2px solid #cbd5e1' } }}>
        <TableCell colSpan={6} align="center">TOTAL CONSOLIDATED TAX SUMMARY</TableCell>
        <TableCell align="right">{formatCurrency(totalTaxable)}</TableCell>
        <TableCell align="right">{formatCurrency(totalCgst)}</TableCell>
        <TableCell align="right">{formatCurrency(totalSgst)}</TableCell>
        <TableCell align="right">{formatCurrency(totalIgst)}</TableCell>
        <TableCell align="right">{formatCurrency(totalTax)}</TableCell>
        <TableCell align="right" sx={{ color: '#1b4332', fontSize: '0.95rem' }}>{formatCurrency(totalGrand)}</TableCell>
      </TableRow>
    );
  };

  return (
    <Box>
      <PageHeader
        title="Sales Tax Consolidation Reports"
        subtitle="Consolidated tax reporting across Invoices and Credit Notes, grouped by Document Number, Tax Type, and GST Rate slab"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Sales Reports' },
        ]}
        actions={
          <Button variant="contained" startIcon={<ExportIcon />} onClick={handleExportCSV}>
            Export Tax Report CSV
          </Button>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary KPI Badges */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: '10px', borderLeft: '4px solid #1b4332', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Tax Invoices</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{totalInvoicesCount}</Typography>
            </Box>
            <Chip label="Tax Invoices" color="primary" size="small" variant="outlined" />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: '10px', borderLeft: '4px solid #d32f2f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Credit Notes (Returns)</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#d32f2f' }}>{totalCreditNotesCount}</Typography>
            </Box>
            <Chip label="Credit Notes" color="error" size="small" />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: '10px', borderLeft: '4px solid #0288d1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Net Consolidated Sales</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0288d1' }}>{formatCurrency(netSalesValue)}</Typography>
            </Box>
            <Chip label="Net Total" size="small" variant="outlined" />
          </Paper>
        </Grid>
      </Grid>

      {/* Date Range & Document Type Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              select
              label="Document Type"
              fullWidth
              size="small"
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Documents ({invoices.length + creditNotes.length})</MenuItem>
              <MenuItem value="INVOICE">Tax Invoices Only ({invoices.length})</MenuItem>
              <MenuItem value="CREDIT_NOTE">Credit Notes Only ({creditNotes.length})</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={2.5}>
            <TextField
              label="Start Date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={2.5}>
            <TextField
              label="End Date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                onClick={setCurrentMonthDates}
                sx={{ textTransform: 'none', flex: 1 }}
              >
                This Month
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={setAllTimeDates}
                sx={{ textTransform: 'none', flex: 1 }}
              >
                All Dates
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={loadReport}
                startIcon={<ResetIcon />}
                sx={{ textTransform: 'none', flex: 1 }}
              >
                Refresh
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Overall Tax Rate Slab Summary Table */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ReportIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            GST Tax Rate Slab Summary
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1b4332' }}>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>GST Rate</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>Line Items</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>Taxable Value (₹)</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>CGST Amount (₹)</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>SGST Amount (₹)</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>IGST Amount (₹)</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>Total Tax (₹)</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 700 }}>Total Sales Value (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {taxSlabs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                    No sales items found for selected filter.
                  </TableCell>
                </TableRow>
              ) : (
                taxSlabs.map((slab) => (
                  <TableRow key={slab.gstRate} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{slab.gstRate}% GST</TableCell>
                    <TableCell align="right">{slab.count}</TableCell>
                    <TableCell align="right">{formatCurrency(slab.taxableValue)}</TableCell>
                    <TableCell align="right">{formatCurrency(slab.cgstAmt)}</TableCell>
                    <TableCell align="right">{formatCurrency(slab.sgstAmt)}</TableCell>
                    <TableCell align="right">{formatCurrency(slab.igstAmt)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(slab.totalTax)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#1b4332' }}>{formatCurrency(slab.totalValue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Main Consolidated Tax Common Table */}
      <CommonTable
        columns={consolidatedColumns}
        rows={consolidatedTaxRows}
        loading={loading}
        searchKey="search_text"
        searchPlaceholder="Search invoice / credit note number, customer name, GSTIN..."
        renderSummary={renderConsolidatedSummary}
      />
    </Box>
  );
};

export default SalesReport;
