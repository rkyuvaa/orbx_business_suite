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
import FormAutocomplete from '../../components/FormAutocomplete';

const Sales = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [sos, setSos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
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
      const brRes = await apiClient.get('/admin/branches');
      const compRes = await apiClient.get('/admin/company');

      setSos(soRes.data);
      setInvoices(invRes.data);
      setDeliveries(delRes.data);
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
    setSoCustomerId('');
    setSoBranchId(branches.length > 0 ? branches[0].id : '');
    setSoItems([{ product_id: '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);
    setOpenSOModal(true);
  };

  const handleAddItemRow = () => {
    setSoItems([...soItems, { product_id: '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);
  };

  const handleRemoveItemRow = (idx) => {
    setSoItems(soItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    setSoItems(
      soItems.map((item, i) => {
        if (i === idx) {
          return { ...item, [field]: value };
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

  const handleDownloadPDF = async () => {
    if (!window.html2canvas || !window.jspdf) {
      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      };

      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      } catch (err) {
        setError("Failed to load PDF generation libraries. Please try again.");
        return;
      }
    }

    try {
      const element = printRef.current;
      const { jsPDF } = window.jspdf;
      
      const originalStyle = element.style.cssText;
      element.style.width = '800px';
      
      const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Invoice_${selectedInvoice?.invoice_number || 'Tax_Invoice'}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF file.");
    }
  };

  const numberToWords = (num) => {
    if (num === 0) return 'Zero Rupees Only';
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convert = (n) => {
      if (n < 20) return units[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
      if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
      return '';
    };

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    
    let word = convert(rupees) + ' Rupees';
    if (paise > 0) {
      word += ' and ' + convert(paise) + ' Paise';
    }
    return word + ' Only';
  };

  const formatBillingDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };


  const soColumns = [
    { id: 'date', label: 'Order Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'customer_name',
      label: 'Customer',
      render: (row) => row.customer_name || 'Unknown'
    },
    { id: 'grand_total', label: 'Grand Total (₹)', render: (row) => `₹${row.grand_total.toFixed(2)}` },
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
      id: 'customer_name',
      label: 'Customer Name',
      render: (row) => row.customer_name || 'Unknown'
    },
    { id: 'total_amount', label: 'Invoice Value (₹)', render: (row) => `₹${row.total_amount.toFixed(2)}` },
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
  const printCustomer = selectedInvoice ? {
    name: selectedInvoice.customer_name,
    gstin: selectedInvoice.customer_gstin,
    billing_address: selectedInvoice.customer_billing_address,
    shipping_address: selectedInvoice.customer_shipping_address
  } : null;
  const printBranch = selectedInvoice ? branches.find((b) => b.id === selectedInvoice.branch_id) : null;

  const getHsnTaxSummary = () => {
    if (!selectedInvoice || !selectedInvoice.items) return [];
    const summary = {};
    const isIntrastate = (selectedInvoice.gst_breakup?.cgst || 0) > 0 || (selectedInvoice.gst_breakup?.sgst || 0) > 0;

    selectedInvoice.items.forEach(item => {
      const hsn = item.hsn_code || 'N/A';
      const taxableValue = (item.rate * item.qty) - (item.discount_amount || 0);
      const gstRate = item.tax_rate || 18;
      const taxAmt = item.tax_amount || 0;

      if (!summary[hsn]) {
        summary[hsn] = {
          hsn,
          taxableValue: 0,
          cgstRate: isIntrastate ? (gstRate / 2) : 0,
          cgstAmount: 0,
          sgstRate: isIntrastate ? (gstRate / 2) : 0,
          sgstAmount: 0,
          igstRate: !isIntrastate ? gstRate : 0,
          igstAmount: 0,
          totalTax: 0
        };
      }
      summary[hsn].taxableValue += taxableValue;
      if (isIntrastate) {
        summary[hsn].cgstAmount += (taxAmt / 2);
        summary[hsn].sgstAmount += (taxAmt / 2);
      } else {
        summary[hsn].igstAmount += taxAmt;
      }
      summary[hsn].totalTax += taxAmt;
    });

    return Object.values(summary);
  };


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
              condition: (row) => {
                const hasInvoice = invoices.some((inv) => inv.sales_order_id === row.id);
                return !hasInvoice && (row.status === 'Draft' || row.status === 'Delivered');
              },
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
            <FormAutocomplete
              label="Select Customer"
              endpoint="/customers/"
              value={soCustomerId}
              onChange={(val) => setSoCustomerId(val)}
            />
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
                <TableCell align="center" sx={{ fontWeight: 600, width: 130 }}>Rate (₹)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>Disc (₹)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 90 }}>GST %</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Total (₹)</TableCell>
                <TableCell align="center" sx={{ width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {soItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell sx={{ minWidth: 240 }}>
                    <FormAutocomplete
                      label="Select Product"
                      endpoint="/products/"
                      value={item.product_id}
                      onChange={(val) => handleItemChange(idx, 'product_id', val)}
                      onChangeOverride={(prodObj) => {
                        if (prodObj) {
                          setSoItems(prevItems => prevItems.map((it, i) => {
                            if (i === idx) {
                              return {
                                ...it,
                                product_id: prodObj.id,
                                rate: prodObj.selling_price,
                                tax_rate: prodObj.tax_rate
                              };
                            }
                            return it;
                          }));
                        }
                      }}
                    />
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
          <Typography variant="body1">Subtotal: <strong>₹{soTotalSum.toFixed(2)}</strong></Typography>
          <Typography variant="body1">Discount: <strong>-₹{soTotalDiscount.toFixed(2)}</strong></Typography>
          <Typography variant="body1">Taxes (GST): <strong>₹{soTotalTax.toFixed(2)}</strong></Typography>
          <Typography variant="h6" color="primary.main">Grand Total: <strong>₹{(soTotalSum - soTotalDiscount + soTotalTax).toFixed(2)}</strong></Typography>
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
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              Print Invoice
            </Button>
            <Button variant="contained" onClick={handleDownloadPDF}>
              Download PDF
            </Button>
          </Box>
        }
      >
        <Box
          ref={printRef}
          sx={{
            width: '794px',
            minHeight: '1050px',
            p: 4,
            mx: 'auto',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"Outfit", sans-serif',
            boxShadow: 'none',
            '@media print': {
              width: '100% !important',
              minHeight: 'unset !important',
              p: '0mm !important',
              margin: '0mm !important',
              boxShadow: 'none !important',
              '@page': {
                size: 'A4 portrait',
                margin: '12mm 15mm 12mm 15mm !important'
              }
            }
          }}
        >
          {/* Header */}
          <Grid container justifyContent="space-between" sx={{ mb: 3 }}>
            <Grid item>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.5 }}>
                {company?.name || 'ORBX CORPORATION'}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{company?.address}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>GSTIN: <strong>{company?.gstin}</strong></Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>Email: {company?.email} | Phone: {company?.phone}</Typography>
            </Grid>
            <Grid item sx={{ textAlign: 'right' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                TAX INVOICE
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>Invoice No: <strong>{selectedInvoice?.invoice_number}</strong></Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>Billing Date: <strong>{selectedInvoice ? formatBillingDate(selectedInvoice.date) : ''}</strong></Typography>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 2 }} />

          {/* Addresses */}
          <Grid container spacing={4} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>BILL TO:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedInvoice?.customer_name}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.85rem', color: 'text.secondary' }}>{selectedInvoice?.customer_billing_address}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem', mt: 0.5 }}>GSTIN: <strong>{selectedInvoice?.customer_gstin}</strong></Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>SHIP TO:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedInvoice?.customer_name}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.85rem', color: 'text.secondary' }}>{selectedInvoice?.customer_shipping_address}</Typography>
            </Grid>
          </Grid>

          {/* Items Grid */}
          {(() => {
            const hasDiscount = selectedInvoice?.items?.some(item => (item.discount_amount || 0) > 0) || false;
            return (
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.85rem' } }}>
                  <TableHead>
                    <TableRow sx={{ borderTop: '1.5px solid #000000', borderBottom: '1.5px solid #000000' }}>
                      <TableCell sx={{ fontWeight: 700, width: '5%', whiteSpace: 'nowrap' }}>S.No.</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: '40%', whiteSpace: 'nowrap' }}>Item Description</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, width: '12%', whiteSpace: 'nowrap' }}>HSN</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, width: '8%', whiteSpace: 'nowrap' }}>Qty</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, width: '12%', whiteSpace: 'nowrap' }}>Rate (₹)</TableCell>
                      {hasDiscount && <TableCell align="center" sx={{ fontWeight: 700, width: '10%', whiteSpace: 'nowrap' }}>Disc (₹)</TableCell>}
                      <TableCell align="center" sx={{ fontWeight: 700, width: '10%', whiteSpace: 'nowrap' }}>GST %</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, width: '13%', whiteSpace: 'nowrap' }}>Amount (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedInvoice?.items?.map((item, idx) => {
                      return (
                        <TableRow key={idx} sx={{ borderBottom: '1px solid #e2e8f0' }}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{item.product_name || 'Unknown'}</TableCell>
                          <TableCell align="center">{item.hsn_code || 'N/A'}</TableCell>
                          <TableCell align="center">{item.qty}</TableCell>
                          <TableCell align="center">{item.rate.toFixed(2)}</TableCell>
                          {hasDiscount && <TableCell align="center">{item.discount_amount.toFixed(2)}</TableCell>}
                          <TableCell align="center">{item.tax_rate}%</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{item.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}

          {/* Summary / Totals */}
          <Grid container justifyContent="space-between" sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.85rem' }}>Terms & Conditions:</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'pre-line', fontSize: '0.75rem', display: 'block', lineHeight: 1.3 }}>
                {printBranch?.invoice_terms}
              </Typography>
            </Grid>
            <Grid item xs={5} sx={{ textAlign: 'right' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, fontSize: '0.85rem' }}>
                <Typography variant="body2">Subtotal:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedInvoice?.subtotal?.toFixed(2)}</Typography>
                
                {selectedInvoice?.discount_amount > 0 && (
                  <>
                    <Typography variant="body2">Discount:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>-₹{selectedInvoice.discount_amount.toFixed(2)}</Typography>
                  </>
                )}

                {selectedInvoice?.gst_breakup?.cgst > 0 && (
                  <>
                    <Typography variant="body2">CGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedInvoice?.gst_breakup?.cgst?.toFixed(2)}</Typography>
                  </>
                )}

                {selectedInvoice?.gst_breakup?.sgst > 0 && (
                  <>
                    <Typography variant="body2">SGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedInvoice?.gst_breakup?.sgst?.toFixed(2)}</Typography>
                  </>
                )}

                {selectedInvoice?.gst_breakup?.igst > 0 && (
                  <>
                    <Typography variant="body2">IGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedInvoice?.gst_breakup?.igst?.toFixed(2)}</Typography>
                  </>
                )}
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.9rem' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Grand Total:</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  ₹{selectedInvoice?.total_amount?.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, display: 'block', color: 'text.secondary', fontSize: '0.8rem' }}>
                  Rupees: {selectedInvoice ? numberToWords(selectedInvoice.total_amount) : ''}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 2 }} />

          {/* HSN Wise Tax Summary - Relocated to bottom */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, fontSize: '0.8rem' }}>HSN-wise Tax Summary</Typography>
          <TableContainer sx={{ mb: 3 }}>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.75, fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow sx={{ borderTop: '1px solid #000000', borderBottom: '1px solid #000000', backgroundColor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700 }}>HSN Code</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Taxable Value (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>CGST Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>CGST Amt (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>SGST Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>SGST Amt (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>IGST Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>IGST Amt (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Total Tax (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getHsnTaxSummary().map((row, idx) => (
                  <TableRow key={idx} sx={{ borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell>{row.hsn}</TableCell>
                    <TableCell align="right">₹{row.taxableValue.toFixed(2)}</TableCell>
                    <TableCell align="right">{row.cgstRate}%</TableCell>
                    <TableCell align="right">₹{row.cgstAmount.toFixed(2)}</TableCell>
                    <TableCell align="right">{row.sgstRate}%</TableCell>
                    <TableCell align="right">₹{row.sgstAmount.toFixed(2)}</TableCell>
                    <TableCell align="right">{row.igstRate}%</TableCell>
                    <TableCell align="right">₹{row.igstAmount.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>₹{row.totalTax.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ mb: 3 }} />

          {/* Signatures & Footer */}
          <Grid container justifyContent="space-between" sx={{ mt: 3 }}>
            <Grid item>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Customer Signature</Typography>
              <Box sx={{ height: 35, borderBottom: '1px solid #000000', width: 150 }} />
            </Grid>
            <Grid item sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Authorized Signatory for {company?.name}</Typography>
              <Box sx={{ height: 35, borderBottom: '1px solid #000000', width: 150, ml: 'auto' }} />
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {printBranch?.invoice_footer || 'Thank you for your business!'}
            </Typography>
          </Box>
        </Box>
      </CommonModal>
    </Box>
  );
};

export default Sales;
