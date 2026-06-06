import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useReactToPrint } from 'react-to-print';
import { useLocation } from 'react-router-dom';
import {
  Button, Box, Alert, Typography, Tabs, Tab, Paper, Chip, MenuItem, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Divider, TableContainer, Grid
} from '@mui/material';
import {
  Add as AddIcon, Warning as WarningIcon, Print as PrintIcon,
  Block as CancelIcon, LocalShipping as DispatchIcon, Delete as DeleteIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormInput from '../../components/FormInput';

const schema = yup.object().shape({
  product_id: yup.string().required('Product is required'),
  branch_id: yup.string().required('Branch is required'),
  qty: yup.number().typeError('Must be a number').required('Quantity is required'),
  transaction_type: yup.string().required('Transaction type is required'),
  reason: yup.string().nullable(),
});

// Helper to load external JS scripts dynamically (for PDF download libraries)
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

const numberToWords = (num) => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += n[1] != 0 ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += n[2] != 0 ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += n[3] != 0 ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += n[4] != 0 ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += n[5] != 0 ? (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Rupees ' : '';
  
  if (str === '') {
    str = 'Zero Rupees ';
  }
  return str + 'Only';
};

const Inventory = () => {
  const location = useLocation();
  const [tabIndex, setTabIndex] = useState(0);
  const [stockPositions, setStockPositions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [company, setCompany] = useState(null);

  // Modals
  const [openModal, setOpenModal] = useState(false);
  const [openTransferModal, setOpenTransferModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  // States for Stock Transfer Form
  const [transferSourceBranch, setTransferSourceBranch] = useState('');
  const [transferType, setTransferType] = useState('branch'); // branch or customer
  const [transferDestBranch, setTransferDestBranch] = useState('');
  const [transferCustomerId, setTransferCustomerId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState([{ product_id: '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);

  // Selected Transfer for printing
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const [error, setError] = useState(null);
  const printRef = useRef();

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema),
  });

  const loadData = async () => {
    try {
      const sRes = await apiClient.get('/inventory/stock');
      const lRes = await apiClient.get('/inventory/ledger');
      const tRes = await apiClient.get('/inventory/transfers');
      const pRes = await apiClient.get('/products/');
      const bRes = await apiClient.get('/admin/branches');
      const cRes = await apiClient.get('/customers/');
      const compRes = await apiClient.get('/admin/company');

      setStockPositions(sRes.data);
      setLedger(lRes.data);
      setTransfers(tRes.data);
      setProducts(pRes.data);
      setBranches(bRes.data);
      setCustomers(cRes.data);
      setCompany(compRes.data);
    } catch (err) {
      setError('Failed to load inventory records.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync tab index with location path
  useEffect(() => {
    if (location.pathname === '/transactions/transfers') {
      setTabIndex(2);
    } else if (location.pathname === '/transactions/inventory') {
      setTabIndex(0);
    }
  }, [location.pathname]);

  const handleOpenAdjustment = () => {
    reset({
      product_id: products.length > 0 ? products[0].id : '',
      branch_id: branches.length > 0 ? branches[0].id : '',
      qty: 0,
      transaction_type: 'Adjustment',
      reason: 'Physical stock verification adjustment',
    });
    setOpenModal(true);
  };

  const onSubmit = async (data) => {
    try {
      await apiClient.post('/inventory/adjust', data);
      setOpenModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit stock adjustment.');
    }
  };

  // ==========================================
  // STOCK TRANSFER / DELIVERY CHALLAN FLOWS
  // ==========================================
  const handleOpenTransferModal = () => {
    setTransferSourceBranch(branches.length > 0 ? branches[0].id : '');
    setTransferType('branch');
    setTransferDestBranch(branches.length > 1 ? branches[1].id : '');
    setTransferCustomerId('');
    setTransferNotes('');
    setTransferItems([{ product_id: products.length > 0 ? products[0].id : '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);
    setOpenTransferModal(true);
  };

  const handleAddTransferItemRow = () => {
    setTransferItems([...transferItems, { product_id: products.length > 0 ? products[0].id : '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);
  };

  const handleRemoveTransferItemRow = (index) => {
    const updated = [...transferItems];
    updated.splice(index, 1);
    setTransferItems(updated);
  };

  const handleTransferItemChange = (index, field, value) => {
    const updated = [...transferItems];
    updated[index][field] = value;
    
    // Auto populate rate from product pricing if product selection changed
    if (field === 'product_id' && value) {
      const prod = products.find(p => p.id === value);
      if (prod && prod.pricings && prod.pricings.length > 0) {
        updated[index]['rate'] = prod.pricings[0].selling_price || 0;
      }
    }
    setTransferItems(updated);
  };

  const submitTransfer = async () => {
    try {
      if (transferItems.some(i => !i.product_id || !i.qty)) {
        setError('Please verify all transfer item rows are complete.');
        return;
      }
      const payload = {
        source_branch_id: transferSourceBranch,
        destination_branch_id: transferType === 'branch' ? transferDestBranch : null,
        customer_id: transferType === 'customer' ? transferCustomerId : null,
        notes: transferNotes,
        items: transferItems.map(i => ({
          product_id: i.product_id,
          qty: parseFloat(i.qty),
          rate: parseFloat(i.rate) || 0,
          discount_amount: parseFloat(i.discount_amount) || 0,
          tax_rate: parseFloat(i.tax_rate) || 18
        }))
      };
      await apiClient.post('/inventory/transfers', payload);
      setOpenTransferModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create Stock Transfer.');
    }
  };

  const handleDispatchTransfer = async (id) => {
    try {
      await apiClient.post(`/inventory/transfers/${id}/dispatch`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to dispatch Stock Transfer.');
    }
  };

  const handleCancelTransfer = async (id) => {
    try {
      await apiClient.post(`/inventory/transfers/${id}/cancel`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel Stock Transfer.');
    }
  };

  const handleOpenPrint = (transfer) => {
    setSelectedTransfer(transfer);
    setOpenPrintModal(true);
  };

  // Printing & PDF downloading
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: `
      @page { size: A4 portrait; margin: 0 !important; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
      }
    `
  });

  const downloadPDF = async () => {
    if (!window.html2canvas || !window.jspdf) {
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      } catch (err) {
        setError("Failed to load PDF libraries.");
        return;
      }
    }

    try {
      const element = printRef.current;
      const { jsPDF } = window.jspdf;
      
      const originalStyle = element.style.cssText;
      element.style.cssText += '; width: 800px !important; max-width: none !important; padding: 0 !important; margin: 0 !important;';
      
      const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 800
      });
      
      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const margin = 15;
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth - (margin * 2); 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, pageHeight - margin, pageWidth, margin, 'F');
      
      const heightShown = pageHeight - (margin * 2);
      heightLeft -= heightShown;

      while (heightLeft > 0) {
        position -= heightShown;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, margin, 'F'); 
        pdf.rect(0, pageHeight - margin, pageWidth, margin, 'F'); 
        heightLeft -= heightShown;
      }

      pdf.save(`DeliveryChallan_${selectedTransfer?.challan_number || 'Document'}.pdf`);
    } catch (err) {
      setError("Error creating PDF document.");
    }
  };

  // ==========================================
  // TABLE COLUMNS SETUP
  // ==========================================
  const stockColumns = [
    {
      id: 'product_id',
      label: 'Product Name',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.name : 'Unknown';
      },
    },
    {
      id: 'sku',
      label: 'SKU Code',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.sku : 'Unknown';
      },
    },
    {
      id: 'branch_id',
      label: 'Branch Location',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      },
    },
    {
      id: 'qty',
      label: 'On Hand Qty',
      render: (row) => (
        <Typography sx={{ fontWeight: 600 }}>
          {row.qty}
        </Typography>
      ),
    },
    {
      id: 'warning',
      label: 'Stock Alert',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        const low = prod ? row.qty < prod.min_stock_level : false;
        return low ? (
          <Chip
            size="small"
            icon={<WarningIcon fontSize="small" />}
            label={`Low Stock (Min: ${prod.min_stock_level})`}
            color="warning"
            sx={{ fontWeight: 600 }}
          />
        ) : (
          <Chip size="small" label="Healthy" color="success" sx={{ fontWeight: 600 }} />
        );
      },
    },
  ];

  const ledgerColumns = [
    { id: 'date', label: 'Date', render: (row) => new Date(row.date).toLocaleString() },
    {
      id: 'product_id',
      label: 'Product',
      render: (row) => {
        const prod = products.find((p) => p.id === row.product_id);
        return prod ? prod.name : 'Unknown';
      },
    },
    {
      id: 'branch_id',
      label: 'Branch',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      },
    },
    {
      id: 'qty',
      label: 'Quantity Shift',
      render: (row) => (
        <Typography sx={{ color: row.qty >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
          {row.qty >= 0 ? `+${row.qty}` : row.qty}
        </Typography>
      ),
    },
    { id: 'transaction_type', label: 'Type' },
    { id: 'reference_type', label: 'Reference Ref' },
    { id: 'reason', label: 'Reason/Notes' },
  ];

  const transferColumns = [
    { id: 'date', label: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { id: 'challan_number', label: 'Challan No.', render: (row) => <strong>{row.challan_number}</strong> },
    { id: 'source_branch_name', label: 'From Branch' },
    {
      id: 'recipient',
      label: 'To Branch / Customer',
      render: (row) => row.customer_name ? (
        <Box>
          <Chip size="small" label="Customer" color="info" sx={{ mr: 1, fontWeight: 600 }} />
          {row.customer_name}
        </Box>
      ) : (
        <Box>
          <Chip size="small" label="Branch" color="primary" sx={{ mr: 1, fontWeight: 600 }} />
          {row.destination_branch_name}
        </Box>
      )
    },
    { id: 'grand_total', label: 'Value (₹)', render: (row) => `₹${(row.grand_total || 0).toFixed(2)}` },
    {
      id: 'status',
      label: 'Status',
      render: (row) => (
        <Chip
          size="small"
          label={row.status}
          color={row.status === 'Transferred' ? 'success' : row.status === 'Draft' ? 'warning' : 'default'}
          sx={{ fontWeight: 600 }}
        />
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {row.status === 'Draft' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<DispatchIcon />}
              onClick={() => handleDispatchTransfer(row.id)}
            >
              Dispatch
            </Button>
          )}
          {row.status !== 'Cancelled' && (
            <IconButton size="small" color="error" title="Cancel Challan" onClick={() => handleCancelTransfer(row.id)}>
              <CancelIcon />
            </IconButton>
          )}
          <IconButton size="small" color="primary" title="Print Challan" onClick={() => handleOpenPrint(row)}>
            <PrintIcon />
          </IconButton>
        </Box>
      )
    }
  ];

  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
  const branchOptions = branches.map((b) => ({ value: b.id, label: b.branch_name }));
  const txTypeOptions = [
    { value: 'In', label: 'Stock In (Intake)' },
    { value: 'Out', label: 'Stock Out (Reduction)' },
    { value: 'Adjustment', label: 'Physical Adjustment (Variance Correction)' },
  ];

  // Map chosen print transfer branch
  const printSourceBranch = selectedTransfer ? branches.find(b => b.id === selectedTransfer.source_branch_id) : null;
  const printDestBranch = selectedTransfer ? branches.find(b => b.id === selectedTransfer.destination_branch_id) : null;

  // Calculators for Draft creation
  const transferSubtotal = transferItems.reduce((acc, item) => acc + (parseInt(item.qty) || 0) * (parseFloat(item.rate) || 0), 0);
  const transferDiscount = transferItems.reduce((acc, item) => acc + (parseFloat(item.discount_amount) || 0), 0);
  const transferTax = transferItems.reduce((acc, item) => {
    const amt = (parseInt(item.qty) || 0) * (parseFloat(item.rate) || 0);
    const disc = parseFloat(item.discount_amount) || 0;
    const rate = parseFloat(item.tax_rate) || 18;
    return acc + ((amt - disc) * rate / 100);
  }, 0);
  const transferGrandTotal = transferSubtotal - transferDiscount + transferTax;

  return (
    <Box>
      <PageHeader title={tabIndex === 2 ? "Stock Transfers / Delivery Challan" : "Inventory Warehouse Management"} subtitle="Manage stock balances, view logs, and issue stock delivery challans." />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={(e, idx) => setTabIndex(idx)} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Current Stock Balances" sx={{ fontWeight: 600 }} />
          <Tab label="Inventory Ledger History" sx={{ fontWeight: 600 }} />
          <Tab label="Stock Transfers (Delivery Challan)" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 && (
        <CommonTable
          columns={stockColumns}
          rows={stockPositions}
          searchKey="qty"
          tableActions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdjustment}>
              Manual Stock Adjustment
            </Button>
          }
        />
      )}

      {tabIndex === 1 && (
        <CommonTable columns={ledgerColumns} rows={ledger} searchKey="transaction_type" />
      )}

      {tabIndex === 2 && (
        <CommonTable
          columns={transferColumns}
          rows={transfers}
          searchKey="challan_number"
          tableActions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenTransferModal}>
              New Transfer / DC
            </Button>
          }
        />
      )}

      {/* ADJUSTMENT MODAL */}
      <CommonModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Manual Stock Balance Adjustment"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormInput
              name="product_id"
              control={control}
              label="Select Product SKU"
              type="select"
              options={productOptions}
            />
            <FormInput
              name="branch_id"
              control={control}
              label="Select Branch Location"
              type="select"
              options={branchOptions}
            />
            <FormInput
              name="transaction_type"
              control={control}
              label="Transaction Action"
              type="select"
              options={txTypeOptions}
            />
            <FormInput
              name="qty"
              control={control}
              label="Quantity (Enter target count if Adjustment)"
              type="number"
            />
            <FormInput
              name="reason"
              control={control}
              label="Auditing Reason Note"
              type="textarea"
              rows={2}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button onClick={() => setOpenModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Submit Stock Update
            </Button>
          </Box>
        </form>
      </CommonModal>

      {/* NEW TRANSFER / DELIVERY CHALLAN MODAL */}
      <CommonModal
        open={openTransferModal}
        onClose={() => setOpenTransferModal(false)}
        title="Issue Stock Transfer / Delivery Challan"
        maxWidth="md"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Source Branch (From)"
                value={transferSourceBranch}
                onChange={(e) => setTransferSourceBranch(e.target.value)}
              >
                {branches.map(b => (
                  <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Destination Type"
                value={transferType}
                onChange={(e) => {
                  setTransferType(e.target.value);
                  setTransferDestBranch('');
                  setTransferCustomerId('');
                }}
              >
                <MenuItem value="branch">Branch Transfer (Warehouse Move)</MenuItem>
                <MenuItem value="customer">Customer Delivery Challan (DC)</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {transferType === 'branch' ? (
            <TextField
              select
              fullWidth
              label="Destination Branch (To)"
              value={transferDestBranch}
              onChange={(e) => setTransferDestBranch(e.target.value)}
            >
              {branches.filter(b => b.id !== transferSourceBranch).map(b => (
                <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              select
              fullWidth
              label="Select Customer"
              value={transferCustomerId}
              onChange={(e) => setTransferCustomerId(e.target.value)}
            >
              {customers.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            fullWidth
            label="Internal Auditing Remarks"
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
          />

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Line Items to Transfer</Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Product Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} width="100px">Qty</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} width="110px">Rate (₹)</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} width="100px">Discount</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} width="110px">GST %</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right" width="110px">Total</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} width="60px"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transferItems.map((row, index) => {
                  const lineTotal = (parseInt(row.qty) || 0) * (parseFloat(row.rate) || 0) - (parseFloat(row.discount_amount) || 0);
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={row.product_id}
                          onChange={(e) => handleTransferItemChange(index, 'product_id', e.target.value)}
                        >
                          {products.map(p => (
                            <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          value={row.qty}
                          onChange={(e) => handleTransferItemChange(index, 'qty', e.target.value)}
                          inputProps={{ min: 1 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          value={row.rate}
                          onChange={(e) => handleTransferItemChange(index, 'rate', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          fullWidth
                          size="small"
                          value={row.discount_amount}
                          onChange={(e) => handleTransferItemChange(index, 'discount_amount', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={row.tax_rate}
                          onChange={(e) => handleTransferItemChange(index, 'tax_rate', e.target.value)}
                        >
                          <MenuItem value={0}>0%</MenuItem>
                          <MenuItem value={5}>5%</MenuItem>
                          <MenuItem value={12}>12%</MenuItem>
                          <MenuItem value={18}>18%</MenuItem>
                          <MenuItem value={28}>28%</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ₹{lineTotal.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          color="error"
                          disabled={transferItems.length === 1}
                          onClick={() => handleRemoveTransferItemRow(index)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddTransferItemRow}>
            Add Product Row
          </Button>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, borderTop: '1px solid #e2e8f0', pt: 2 }}>
            <Typography variant="body2">Subtotal: <strong>₹{transferSubtotal.toFixed(2)}</strong></Typography>
            <Typography variant="body2">Discount: <strong>-₹{transferDiscount.toFixed(2)}</strong></Typography>
            <Typography variant="body2">Taxes (GST): <strong>₹{transferTax.toFixed(2)}</strong></Typography>
            <Typography variant="subtitle1" color="primary.main">Grand Total: <strong>₹{transferGrandTotal.toFixed(2)}</strong></Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={() => setOpenTransferModal(false)} variant="outlined">
              Cancel
            </Button>
            <Button onClick={submitTransfer} variant="contained" color="primary">
              Create Draft Challan
            </Button>
          </Box>
        </Box>
      </CommonModal>

      {/* PRINT DIALOG */}
      <CommonModal
        open={openPrintModal}
        onClose={() => setOpenPrintModal(false)}
        title="Print Delivery Challan"
        maxWidth="md"
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={downloadPDF}>Download PDF</Button>
            <Button variant="contained" onClick={handlePrint}>Print Document</Button>
          </Box>
        }
      >
        <Box sx={{ p: 4, '@media print': { p: 0 } }}>
          <Box
            ref={printRef}
            sx={{
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
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'primary.main', mb: 0.5, lineHeight: 1.2 }}>
                  {company?.name ? company.name.trim() : 'ORBX CORPORATION'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{company?.address || ''}</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>GSTIN: <strong>{company?.gstin || ''}</strong></Typography>
                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                  Email: {company?.email || ''} | Phone: {company?.phone || ''}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, mb: 0.5, lineHeight: 1.2 }}>
                  DELIVERY CHALLAN
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                  Challan No: <strong>{selectedTransfer?.challan_number}</strong>
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                  Date: <strong>{selectedTransfer ? new Date(selectedTransfer.date).toLocaleDateString() : ''}</strong>
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                  Status: <strong>{selectedTransfer?.status}</strong>
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Addresses */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ width: '48%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>DISPATCHED FROM (SENDER):</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedTransfer?.source_branch_name}</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                  {printSourceBranch?.address || 'Source Branch Warehouse'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Branch Code: <strong>{printSourceBranch?.code}</strong></Typography>
              </Box>
              <Box sx={{ width: '48%', textAlign: 'right' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>DELIVER TO (RECIPIENT):</Typography>
                {selectedTransfer?.customer_name ? (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedTransfer.customer_name}</Typography>
                    {(() => {
                      const cust = customers.find(c => c.id === selectedTransfer.customer_id);
                      return cust ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{cust.billing_address || cust.shipping_address}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>GSTIN: <strong>{cust.gstin || 'N/A'}</strong></Typography>
                        </Box>
                      ) : null;
                    })()}
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedTransfer?.destination_branch_name}</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                      {printDestBranch?.address || 'Destination Warehouse'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Branch Code: <strong>{printDestBranch?.code}</strong></Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Items Table */}
            <TableContainer sx={{ mb: 4, borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }} width="50px">S.No.</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Product Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>SKU Code</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }} align="right">Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }} align="right">Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }} align="right">Discount (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }} align="right">GST %</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }} align="right">Total (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedTransfer?.items?.map((item, idx) => {
                    const totalVal = (item.qty * item.rate) - (item.discount_amount || 0);
                    return (
                      <TableRow key={item.id || idx}>
                        <TableCell sx={{ fontSize: '0.85rem' }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.product_name}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{item.sku}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 700 }} align="right">{item.qty}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem' }} align="right">₹{(item.rate || 0).toFixed(2)}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }} align="right">₹{(item.discount_amount || 0).toFixed(2)}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem' }} align="right">{item.tax_rate || 18}%</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 700 }} align="right">₹{(item.amount || totalVal).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pricing calculations layout */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
              <Box sx={{ width: '55%' }}>
                {selectedTransfer?.notes ? (
                  <Box sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 0.5 }}>Remarks / Delivery Instructions:</Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{selectedTransfer.notes}</Typography>
                  </Box>
                ) : <Box />}
                <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 700, mt: 2 }}>
                  Amount in Words: <span style={{ fontWeight: 500, color: '#475569' }}>{selectedTransfer ? numberToWords(selectedTransfer.grand_total) : ''}</span>
                </Typography>
              </Box>
              <Box sx={{ width: '40%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Subtotal:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{(selectedTransfer?.total_amount || 0).toFixed(2)}</Typography>
                </Box>
                {selectedTransfer?.discount_amount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Discount:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>-₹{selectedTransfer.discount_amount.toFixed(2)}</Typography>
                  </Box>
                )}
                {selectedTransfer?.gst_breakup?.cgst > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>CGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedTransfer.gst_breakup.cgst.toFixed(2)}</Typography>
                  </Box>
                )}
                {selectedTransfer?.gst_breakup?.sgst > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>SGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedTransfer.gst_breakup.sgst.toFixed(2)}</Typography>
                  </Box>
                )}
                {selectedTransfer?.gst_breakup?.igst > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>IGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedTransfer.gst_breakup.igst.toFixed(2)}</Typography>
                  </Box>
                )}
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Grand Total:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main' }}>₹{(selectedTransfer?.grand_total || 0).toFixed(2)}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Signature Area */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 8, pt: 4 }}>
              <Box sx={{ textAlign: 'center', width: '200px' }}>
                <Divider />
                <Typography sx={{ fontSize: '0.8rem', mt: 1, color: 'text.secondary' }}>Receiver's Signature</Typography>
              </Box>
              <Box sx={{ textAlign: 'center', width: '250px' }}>
                <Divider />
                <Typography sx={{ fontSize: '0.8rem', mt: 1, fontWeight: 600 }}>For {company?.name ? company.name.trim() : 'ORBX CORPORATION'}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Authorized Signatory</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </CommonModal>
    </Box>
  );
};

export default Inventory;
