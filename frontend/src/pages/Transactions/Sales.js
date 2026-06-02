import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
  Button, Box, Alert, Typography, Tabs, Tab, Paper, Grid, MenuItem, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Divider, TableContainer
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, LocalShipping as ShipIcon,
  Receipt as InvoiceIcon, Print as PrintIcon
} from '@mui/icons-material';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';

const Sales = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [sos, setSos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [company, setCompany] = useState(null);

  const [openSOModal, setOpenSOModal] = useState(false);
  const [openDeliveryModal, setOpenDeliveryModal] = useState(false);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  const [selectedSO, setSelectedSO] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Sales Order Form Local States
  const [soCustomerId, setSoCustomerId] = useState('');
  const [soBranchId, setSoBranchId] = useState('');
  const [soItems, setSoItems] = useState([{ product_id: '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);

  // Delivery Form Local States
  const [delNote, setDelNote] = useState('');

  const [error, setError] = useState(null);
  const printRef = useRef();

  const loadData = async () => {
    try {
      const soRes = await apiClient.get('/sales/so');
      const invRes = await apiClient.get('/sales/invoices');
      const delRes = await apiClient.get('/sales/deliveries');
      const prodRes = await apiClient.get('/products/');
      const custRes = await apiClient.get('/customers/');
      const brRes = await apiClient.get('/admin/branches');
      const compRes = await apiClient.get('/admin/company');

      setSos(soRes.data);
      setInvoices(invRes.data);
      setDeliveries(delRes.data);
      setProducts(prodRes.data);
      setCustomers(custRes.data);
      setBranches(brRes.data);
      setCompany(compRes.data);
    } catch (err) {
      setError('Failed to load transaction sales documents.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddSO = () => {
    setSoCustomerId(customers.length > 0 ? customers[0].id : '');
    setSoBranchId(branches.length > 0 ? branches[0].id : '');
    setSoItems([{ product_id: products.length > 0 ? products[0].id : '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);
    setOpenSOModal(true);
  };

  const handleAddItemRow = () => {
    setSoItems([...soItems, { product_id: products.length > 0 ? products[0].id : '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);
  };

  const handleRemoveItemRow = (idx) => {
    setSoItems(soItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    setSoItems(
      soItems.map((item, i) => {
        if (i === idx) {
          const updated = { ...item, [field]: value };
          if (field === 'product_id') {
            const p = products.find((prod) => prod.id === value);
            if (p) {
              updated.rate = p.selling_price;
              updated.tax_rate = p.tax_rate;
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const submitSO = async () => {
    try {
      const payload = {
        customer_id: soCustomerId,
        branch_id: soBranchId,
        items: soItems
      };
      await apiClient.post('/sales/so', payload);
      setOpenSOModal(false);
      loadData();
    } catch (err) {
      setError('Failed to submit Sales Order.');
    }
  };

  // ==========================================
  // DELIVERY MANAGEMENT FLOWS
  // ==========================================
  const handleOpenDelivery = (so) => {
    setSelectedSO(so);
    setDelNote('Standard logistics shipment delivery');
    setOpenDeliveryModal(true);
  };

  const submitDelivery = async () => {
    try {
      const totalQty = selectedSO.items.reduce((acc, item) => acc + item.qty, 0);
      const payload = {
        sales_order_id: selectedSO.id,
        delivery_note: delNote,
        qty_delivered: totalQty
      };
      await apiClient.post('/sales/deliveries', payload);
      setOpenDeliveryModal(false);
      loadData();
    } catch (err) {
      setError('Failed to process shipment delivery.');
    }
  };

  // ==========================================
  // INVOICE MANAGEMENT FLOWS
  // ==========================================
  const handleOpenInvoice = (so) => {
    setSelectedSO(so);
    setOpenInvoiceModal(true);
  };

  const submitInvoice = async () => {
    try {
      const payload = {
        sales_order_id: selectedSO.id,
        due_date: new Date(Date.now() + 15 * 86400000).toISOString()
      };
      await apiClient.post('/sales/invoices', payload);
      setOpenInvoiceModal(false);
      loadData();
    } catch (err) {
      setError('Failed to generate Tax Invoice.');
    }
  };

  // ==========================================
  // PRINT LAYOUT HANDLERS
  // ==========================================
  const handleOpenPrint = (invoice) => {
    setSelectedInvoice(invoice);
    setOpenPrintModal(true);
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const soColumns = [
    { id: 'date', label: 'Order Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'customer_id',
      label: 'Customer',
      render: (row) => {
        const c = customers.find((cust) => cust.id === row.customer_id);
        return c ? c.name : 'Unknown';
      }
    },
    { id: 'grand_total', label: 'Grand Total', render: (row) => `$${row.grand_total.toFixed(2)}` },
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
              row.status === 'Delivered' ? 'rgba(45, 106, 79, 0.1)' :
              row.status === 'Draft' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(255, 143, 0, 0.1)',
            color:
              row.status === 'Delivered' ? '#2d6a4f' :
              row.status === 'Draft' ? '#64748b' : '#ff8f00',
          }}
        >
          {row.status}
        </Typography>
      )
    }
  ];

  const deliveryColumns = [
    { id: 'date', label: 'Delivery Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'sales_order_id',
      label: 'SO Ref ID',
      render: (row) => `SO-${row.sales_order_id.substring(0, 6).toUpperCase()}`
    },
    { id: 'qty_delivered', label: 'Shipped Qty' },
    { id: 'delivery_note', label: 'Logistics Notes' }
  ];

  const invoiceColumns = [
    { id: 'invoice_number', label: 'Invoice No.' },
    { id: 'date', label: 'Billing Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'customer_id',
      label: 'Customer Name',
      render: (row) => {
        // Fetch SO, then customer
        const so = sos.find((s) => s.id === row.sales_order_id);
        const c = so ? customers.find((cust) => cust.id === so.customer_id) : null;
        return c ? c.name : 'Unknown';
      }
    },
    { id: 'total_amount', label: 'Invoice Value', render: (row) => `$${row.total_amount.toFixed(2)}` },
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
      )
    }
  ];

  const soTotalSum = soItems.reduce((acc, item) => acc + (parseInt(item.qty) || 0) * (parseFloat(item.rate) || 0), 0);
  const soTotalDiscount = soItems.reduce((acc, item) => acc + (parseFloat(item.discount_amount) || 0), 0);
  const soTotalTax = soItems.reduce((acc, item) => acc + (((parseInt(item.qty) || 0) * (parseFloat(item.rate) || 0) - (parseFloat(item.discount_amount) || 0)) * (parseFloat(item.tax_rate) || 18) / 100), 0);

  // Find linked customer and branch info for active print layout
  const printSO = selectedInvoice ? sos.find((s) => s.id === selectedInvoice.sales_order_id) : null;
  const printCustomer = printSO ? customers.find((c) => c.id === printSO.customer_id) : null;
  const printBranch = selectedInvoice ? branches.find((b) => b.id === selectedInvoice.branch_id) : null;

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={(e, idx) => setTabIndex(idx)} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Sales Orders" sx={{ fontWeight: 600 }} />
          <Tab label="Shipment Deliveries" sx={{ fontWeight: 600 }} />
          <Tab label="Tax Invoices" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 && (
        <CommonTable
          columns={soColumns}
          rows={sos}
          actions={[
            {
              icon: <ShipIcon />,
              label: 'Process Cargo Delivery',
              condition: (row) => row.status === 'Draft',
              onClick: handleOpenDelivery,
              color: 'success'
            },
            {
              icon: <InvoiceIcon />,
              label: 'Generate Tax Invoice',
              condition: (row) => row.status === 'Delivered',
              onClick: handleOpenInvoice,
              color: 'primary'
            }
          ]}
          searchKey="status"
          tableActions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddSO}>
              Create Sales Order
            </Button>
          }
        />
      )}

      {tabIndex === 1 && (
        <CommonTable columns={deliveryColumns} rows={deliveries} searchKey="status" />
      )}

      {tabIndex === 2 && (
        <CommonTable
          columns={invoiceColumns}
          rows={invoices}
          actions={[
            {
              icon: <PrintIcon />,
              label: 'Print Tax Invoice',
              onClick: handleOpenPrint,
              color: 'primary'
            }
          ]}
          searchKey="invoice_number"
        />
      )}

      {/* SALES ORDER MODAL */}
      <CommonModal
        open={openSOModal}
        onClose={() => setOpenSOModal(false)}
        title="Create Sales Order"
        maxWidth="md"
      >
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Select Customer"
              fullWidth
              value={soCustomerId}
              onChange={(e) => setSoCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Ordering Branch"
              fullWidth
              value={soBranchId}
              onChange={(e) => setSoBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.branch_name} ({b.code})</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600, mb: 2 }}>
          Sales Order Items sub-grid
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>Qty</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 130 }}>Rate ($)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>Disc ($)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 90 }}>GST %</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Total ($)</TableCell>
                <TableCell align="center" sx={{ width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {soItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={item.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    >
                      {products.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.discount_amount}
                      onChange={(e) => handleItemChange(idx, 'discount_amount', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={item.tax_rate}
                      onChange={(e) => handleItemChange(idx, 'tax_rate', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {(((item.qty * item.rate) - item.discount_amount) * (1 + item.tax_rate / 100)).toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="error" size="small" onClick={() => handleRemoveItemRow(idx)} disabled={soItems.length === 1}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddItemRow} sx={{ mb: 4 }}>
          Add Item Row
        </Button>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, borderTop: '1px solid #e2e8f0', pt: 2, mb: 4 }}>
          <Typography variant="body1">Subtotal: <strong>${soTotalSum.toFixed(2)}</strong></Typography>
          <Typography variant="body1">Discount: <strong>-${soTotalDiscount.toFixed(2)}</strong></Typography>
          <Typography variant="body1">Taxes (GST): <strong>${soTotalTax.toFixed(2)}</strong></Typography>
          <Typography variant="h6" color="primary.main">Grand Total: <strong>${(soTotalSum - soTotalDiscount + soTotalTax).toFixed(2)}</strong></Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setOpenSOModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitSO} variant="contained">Submit SO</Button>
        </Box>
      </CommonModal>

      {/* PROCESS DELIVERY MODAL */}
      <CommonModal
        open={openDeliveryModal}
        onClose={() => setOpenDeliveryModal(false)}
        title="Fulfill Shipment Delivery"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body1">
            Order Ref: <strong>SO-{selectedSO?.id.substring(0, 6).toUpperCase()}</strong>
          </Typography>
          <TextField
            label="Logistics Note / Airway Bill"
            fullWidth
            value={delNote}
            onChange={(e) => setDelNote(e.target.value)}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 4 }}>
          <Button onClick={() => setOpenDeliveryModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitDelivery} variant="contained">Dispatch Cargo</Button>
        </Box>
      </CommonModal>

      {/* GENERATE INVOICE MODAL */}
      <CommonModal
        open={openInvoiceModal}
        onClose={() => setOpenInvoiceModal(false)}
        title="Create Tax Invoice"
      >
        <Typography variant="body1" sx={{ mb: 3 }}>
          Generating sequential tax invoice for order: <strong>SO-{selectedSO?.id.substring(0, 6).toUpperCase()}</strong>
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setOpenInvoiceModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitInvoice} variant="contained">Generate invoice</Button>
        </Box>
      </CommonModal>

      {/* PRINT-READY TAX INVOICE PRINT MODAL */}
      <CommonModal
        open={openPrintModal}
        onClose={() => setOpenPrintModal(false)}
        title="Print Tax Invoice"
        maxWidth="md"
        actions={
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
            Trigger Print Dialog
          </Button>
        }
      >
        <Box
          ref={printRef}
          sx={{
            p: 4,
            backgroundColor: '#ffffff',
            color: '#000000',
            '@media print': {
              p: 0,
            }
          }}
        >
          {/* Header */}
          <Grid container justifyContent="space-between" sx={{ mb: 4 }}>
            <Grid item>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>
                {company?.name || 'ORBX CORPORATION'}
              </Typography>
              <Typography variant="body2">{company?.address}</Typography>
              <Typography variant="body2">GSTIN: <strong>{company?.gstin}</strong></Typography>
              <Typography variant="body2">Email: {company?.email} | Phone: {company?.phone}</Typography>
            </Grid>
            <Grid item sx={{ textAlign: 'right' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                TAX INVOICE
              </Typography>
              <Typography variant="body2">Invoice No: <strong>{selectedInvoice?.invoice_number}</strong></Typography>
              <Typography variant="body2">Billing Date: {selectedInvoice ? new Date(selectedInvoice.date).toLocaleDateString() : ''}</Typography>
              <Typography variant="body2">Branch: {printBranch?.branch_name}</Typography>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 3 }} />

          {/* Addresses */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>BILL TO:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{printCustomer?.name}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{printCustomer?.billing_address}</Typography>
              <Typography variant="body2">GSTIN: <strong>{printCustomer?.gstin}</strong></Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>SHIP TO:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{printCustomer?.name}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{printCustomer?.shipping_address}</Typography>
            </Grid>
          </Grid>

          {/* Items Grid */}
          <TableContainer sx={{ mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ borderTop: '2px solid #000000', borderBottom: '2px solid #000000' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>HSN</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Qty</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Rate ($)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Disc ($)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>GST %</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount ($)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedInvoice?.items?.map((item, idx) => {
                  const prod = products.find((p) => p.id === item.product_id);
                  return (
                    <TableRow key={idx} sx={{ borderBottom: '1px solid #e2e8f0' }}>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{prod ? prod.name : 'Unknown'}</Typography>
                        <Typography variant="caption" color="text.secondary">SKU: {prod ? prod.sku : ''}</Typography>
                      </TableCell>
                      <TableCell align="center">{prod ? prod.hsn_code : ''}</TableCell>
                      <TableCell align="center">{item.qty}</TableCell>
                      <TableCell align="center">{item.rate.toFixed(2)}</TableCell>
                      <TableCell align="center">{item.discount_amount.toFixed(2)}</TableCell>
                      <TableCell align="center">{item.tax_rate}%</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{item.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Summary / Totals */}
          <Grid container justifyContent="space-between" sx={{ mb: 4 }}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Terms & Conditions:</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'pre-line' }}>
                {printBranch?.invoice_terms}
              </Typography>
            </Grid>
            <Grid item xs={5} sx={{ textAlign: 'right' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Typography variant="body2">Subtotal:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>${selectedInvoice?.subtotal?.toFixed(2)}</Typography>
                
                <Typography variant="body2">Discount:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>-${selectedInvoice?.discount_amount?.toFixed(2)}</Typography>

                <Typography variant="body2">CGST:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>${selectedInvoice?.gst_breakup?.cgst?.toFixed(2)}</Typography>

                <Typography variant="body2">SGST:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>${selectedInvoice?.gst_breakup?.sgst?.toFixed(2)}</Typography>

                <Typography variant="body2">IGST:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>${selectedInvoice?.gst_breakup?.igst?.toFixed(2)}</Typography>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Grand Total:</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  ${selectedInvoice?.total_amount?.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 4 }} />

          {/* Signatures & Footer */}
          <Grid container justifyContent="space-between" sx={{ mt: 5 }}>
            <Grid item>
              <Typography variant="body2">Customer Signature</Typography>
              <Box sx={{ height: 40, borderBottom: '1px solid #000000', width: 160 }} />
            </Grid>
            <Grid item sx={{ textAlign: 'right' }}>
              <Typography variant="body2">Authorized Signatory for {company?.name}</Typography>
              <Box sx={{ height: 40, borderBottom: '1px solid #000000', width: 160, ml: 'auto' }} />
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {printBranch?.invoice_footer || 'Thank you for your business!'}
            </Typography>
          </Box>
        </Box>
      </CommonModal>
    </Box>
  );
};

export default Sales;
