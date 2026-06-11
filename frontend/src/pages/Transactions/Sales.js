import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
  Button, Box, Alert, Typography, Tabs, Tab, Paper, Grid, MenuItem, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Divider, TableContainer
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon,
  Receipt as InvoiceIcon, Print as PrintIcon,
  Edit as EditIcon, Block as CancelIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormAutocomplete from '../../components/FormAutocomplete';

const Sales = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [sos, setSos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [company, setCompany] = useState(null);

  const [openSOModal, setOpenSOModal] = useState(false);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  const [selectedSO, setSelectedSO] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [printDocType, setPrintDocType] = useState('Invoice');
  const [availableDCs, setAvailableDCs] = useState([]);
  const [selectedDCId, setSelectedDCId] = useState('');

  // Sales Order Form Local States
  const [soCustomerId, setSoCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [soBranchId, setSoBranchId] = useState('');
  const [soDate, setSoDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [soItems, setSoItems] = useState([{ product_id: '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);

  const [error, setError] = useState(null);
  const printRef = useRef();

  const { user } = useSelector((state) => state.auth);
  const isSuperAdmin = user?.role_name === 'Super Admin';

  const loadData = async () => {
    try {
      const soRes = await apiClient.get('/sales/so');
      const invRes = await apiClient.get('/sales/invoices');
      const brRes = await apiClient.get('/admin/branches');
      const compRes = await apiClient.get('/admin/company');

      setSos(soRes.data);
      setInvoices(invRes.data);
      setBranches(brRes.data);
      setCompany(compRes.data);
    } catch (err) {
      setError('Failed to load transaction sales documents.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelSO = async (so) => {
    if (window.confirm(`Are you sure you want to cancel Sales Order ${so.so_number || `SO-${so.id.substring(0, 6).toUpperCase()}`}?`)) {
      try {
        await apiClient.post(`/sales/so/${so.id}/cancel`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to cancel Sales Order.');
      }
    }
  };

  const handleDeleteSO = async (so) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete Sales Order ${so.so_number || `SO-${so.id.substring(0, 6).toUpperCase()}`}? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/sales/so/${so.id}`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete Sales Order.');
      }
    }
  };

  const handleCancelInvoice = async (inv) => {
    if (window.confirm(`Are you sure you want to cancel Tax Invoice ${inv.invoice_number}?`)) {
      try {
        await apiClient.post(`/sales/invoices/${inv.id}/cancel`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to cancel Tax Invoice.');
      }
    }
  };

  const handleDeleteInvoice = async (inv) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete Tax Invoice ${inv.invoice_number}? This action cannot be undone and will reverse stock levels.`)) {
      try {
        await apiClient.delete(`/sales/invoices/${inv.id}`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete Tax Invoice.');
      }
    }
  };

  const handleOpenAddSO = () => {
    setSelectedSO(null);
    setSoCustomerId('');
    setSelectedCustomer(null);
    setSoBranchId(branches.length > 0 ? branches[0].id : '');
    setSoDate(new Date().toISOString().split('T')[0]);
    setSoItems([{ product_id: '', qty: 1, rate: 0, discount_amount: 0, tax_rate: 18 }]);
    setOpenSOModal(true);
  };

  const handleOpenEditSO = (so) => {
    setSelectedSO(so);
    setSoCustomerId(so.customer_id);
    setSelectedCustomer({
      id: so.customer_id,
      name: so.customer_name,
      gstin: so.customer_gstin,
      billing_address: so.customer_billing_address,
      shipping_address: so.customer_shipping_address
    });
    setSoBranchId(so.branch_id);
    setSoDate(so.date ? new Date(so.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setSoItems(
      so.items.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
        rate: item.rate,
        discount_amount: item.discount_amount,
        tax_rate: item.tax_rate,
        product_name: item.product_name,
        sku: item.sku
      }))
    );
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
        date: soDate ? new Date(soDate).toISOString() : null,
        items: soItems.map(item => ({
          product_id: item.product_id,
          qty: item.qty,
          rate: item.rate,
          discount_amount: item.discount_amount,
          tax_rate: item.tax_rate
        }))
      };
      if (selectedSO && selectedSO.status === 'Draft') {
        await apiClient.put(`/sales/so/${selectedSO.id}`, payload);
      } else {
        await apiClient.post('/sales/so', payload);
      }
      setOpenSOModal(false);
      loadData();
    } catch (err) {
      setError('Failed to submit Sales Order.');
    }
  };



  // ==========================================
  // INVOICE MANAGEMENT FLOWS
  // ==========================================
  const handleOpenInvoice = (so) => {
    setSelectedSO(so);
    setSelectedDCId('');
    setAvailableDCs([]);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    
    // Fetch transferred DCs for this customer
    apiClient.get(`/inventory/transfers?customer_id=${so.customer_id}`)
      .then(res => {
        const activeDCs = res.data.filter(dc => dc.status === 'Transferred');
        setAvailableDCs(activeDCs);
      })
      .catch(err => console.error('Error fetching delivery challans', err));

    setOpenInvoiceModal(true);
  };

  const submitInvoice = async () => {
    try {
      const payload = {
        sales_order_id: selectedSO.id,
        delivery_challan_id: selectedDCId || null,
        date: invoiceDate ? new Date(invoiceDate).toISOString() : null,
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
    setPrintDocType('Invoice');
    setOpenPrintModal(true);
  };

  const handleOpenPrintSO = (so) => {
    setSelectedSO(so);
    setPrintDocType('SalesOrder');
    setOpenPrintModal(true);
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: `
      @page { size: A4 portrait; margin: 0 !important; }
      body { margin: 0 !important; padding: 0 !important; }
    `
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
      // Force a wide capture frame to prevent any text wrapping or cutoff due to screen constraints
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
      
      // A4 dimensions: 210 x 297 mm
      const margin = 15;
      const pageWidth = 210;
      const pageHeight = 297;
      
      const imgWidth = pageWidth - (margin * 2); // 180mm printable width
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;

      // Draw first page
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      
      // Hide bottom bleed to create bottom margin
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, pageHeight - margin, pageWidth, margin, 'F');
      
      const heightShown = pageHeight - (margin * 2);
      heightLeft -= heightShown;

      // Handle multi-page overflow
      while (heightLeft > 0) {
        position -= heightShown;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        
        // Hide top and bottom bleed to maintain margins
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, margin, 'F'); // Top margin cover
        pdf.rect(0, pageHeight - margin, pageWidth, margin, 'F'); // Bottom margin cover
        
        heightLeft -= heightShown;
      }

      pdf.save(`${printDocType}_${printData?.invoice_number || 'Document'}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF file.");
    }
  };

  const numberToWords = (num) => {
    if (num === undefined || num === null || isNaN(num)) return 'Zero Rupees Only';
    let n = parseFloat(num);
    if (n === 0) return 'Zero Rupees Only';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertLessThanOneThousand = (val) => {
      if (val < 20) return units[val];
      if (val < 100) return tens[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + units[val % 10] : '');
      return units[Math.floor(val / 100)] + ' Hundred' + (val % 100 !== 0 ? ' and ' + convertLessThanOneThousand(val % 100) : '');
    };

    const convert = (val) => {
      if (val === 0) return '';
      let parts = [];
      
      // Crores
      if (val >= 10000000) {
        const crores = Math.floor(val / 10000000);
        parts.push(convertLessThanOneThousand(crores) + ' Crore');
        val %= 10000000;
      }
      
      // Lakhs
      if (val >= 100000) {
        const lakhs = Math.floor(val / 100000);
        parts.push(convertLessThanOneThousand(lakhs) + ' Lakh');
        val %= 100000;
      }
      
      // Thousands
      if (val >= 1000) {
        const thousands = Math.floor(val / 1000);
        parts.push(convertLessThanOneThousand(thousands) + ' Thousand');
        val %= 1000;
      }
      
      // Remainder under 1000
      if (val > 0) {
        parts.push(convertLessThanOneThousand(val));
      }
      
      return parts.join(' ').trim();
    };

    const rupees = Math.floor(n);
    const paise = Math.round((n - rupees) * 100);
    
    let word = '';
    if (rupees > 0) {
      word += convert(rupees) + ' Rupees';
    } else {
      word += 'Zero Rupees';
    }
    
    if (paise > 0) {
      word += ' and ' + convertLessThanOneThousand(paise) + ' Paise';
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
    { id: 'so_number', label: 'SO Number', render: (row) => row.so_number || `SO-${row.id.substring(0, 6).toUpperCase()}` },
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
              row.status === 'Invoiced' ? 'rgba(45, 106, 79, 0.1)' :
              row.status === 'Delivered' ? 'rgba(45, 106, 79, 0.1)' :
              row.status === 'Draft' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(255, 143, 0, 0.1)',
            color:
              row.status === 'Invoiced' ? '#2d6a4f' :
              row.status === 'Delivered' ? '#2d6a4f' :
              row.status === 'Draft' ? '#64748b' : '#ff8f00',
          }}
        >
          {row.status}
        </Typography>
      )
    }
  ];

  const invoiceColumns = [
    { id: 'invoice_number', label: 'Invoice No.' },
    {
      id: 'delivery_challan_number',
      label: 'Ref. Challan',
      render: (row) => row.delivery_challan_number ? (
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
          {row.delivery_challan_number}
        </Typography>
      ) : '-'
    },
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

  // Unified print data mapper
  const printData = (() => {
    if (printDocType === 'Invoice') {
      return selectedInvoice;
    } else if (printDocType === 'SalesOrder') {
      if (!selectedSO) return null;
      const companyState = company?.state_code || (company?.gstin ? company.gstin.substring(0, 2) : '22');
      const customerState = selectedSO.customer_gstin ? selectedSO.customer_gstin.substring(0, 2) : '22';
      const isIntrastate = companyState === customerState;
      const cgst = isIntrastate ? selectedSO.tax_amount / 2 : 0;
      const sgst = isIntrastate ? selectedSO.tax_amount / 2 : 0;
      const igst = !isIntrastate ? selectedSO.tax_amount : 0;
      return {
        invoice_number: selectedSO.so_number || `SO-${selectedSO.id.substring(0, 6).toUpperCase()}`,
        date: selectedSO.date,
        customer_name: selectedSO.customer_name,
        customer_gstin: selectedSO.customer_gstin,
        customer_billing_address: selectedSO.customer_billing_address,
        customer_shipping_address: selectedSO.customer_shipping_address,
        subtotal: selectedSO.total_amount,
        discount_amount: selectedSO.discount_amount,
        tax_amount: selectedSO.tax_amount,
        total_amount: selectedSO.grand_total,
        items: selectedSO.items,
        gst_breakup: { cgst, sgst, igst },
        branch_id: selectedSO.branch_id
      };
    }
    return null;
  })();

  const printBranch = printData ? branches.find((b) => b.id === printData.branch_id) : null;

  const getHsnTaxSummary = () => {
    if (!printData || !printData.items) return [];
    const summary = {};
    const isIntrastate = (printData.gst_breakup?.cgst || 0) > 0 || (printData.gst_breakup?.sgst || 0) > 0;

    printData.items.forEach(item => {
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
          <Tab label="Tax Invoices" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {tabIndex === 0 && (
        <CommonTable
          columns={soColumns}
          rows={sos}
          actions={[
            {
              icon: <PrintIcon />,
              label: 'Print Sales Order',
              onClick: handleOpenPrintSO,
              color: 'primary'
            },
            {
              icon: <EditIcon />,
              label: 'Edit Sales Order',
              condition: (row) => row.status === 'Draft',
              onClick: handleOpenEditSO,
              color: 'secondary'
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
            },
            {
              icon: <CancelIcon />,
              label: 'Cancel Sales Order',
              condition: (row) => row.status !== 'Cancelled',
              onClick: handleCancelSO,
              color: 'error'
            },
            ...(isSuperAdmin ? [{
              icon: <DeleteIcon />,
              label: 'Delete Sales Order',
              onClick: handleDeleteSO,
              color: 'error'
            }] : [])
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
        <CommonTable
          columns={invoiceColumns}
          rows={invoices}
          actions={[
            {
              icon: <PrintIcon />,
              label: 'Print Tax Invoice',
              onClick: handleOpenPrint,
              color: 'primary'
            },
            {
              icon: <CancelIcon />,
              label: 'Cancel Tax Invoice',
              condition: (row) => row.status !== 'Cancelled',
              onClick: handleCancelInvoice,
              color: 'error'
            },
            ...(isSuperAdmin ? [{
              icon: <DeleteIcon />,
              label: 'Delete Tax Invoice',
              onClick: handleDeleteInvoice,
              color: 'error'
            }] : [])
          ]}
          searchKey="invoice_number"
        />
      )}

      {/* SALES ORDER MODAL */}
      <CommonModal
        open={openSOModal}
        onClose={() => setOpenSOModal(false)}
        title={selectedSO ? "Edit Sales Order" : "Create Sales Order"}
        maxWidth="md"
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 3 }}>
          <Box sx={{ flex: '1 1 250px' }}>
            <FormAutocomplete
              label="Select Customer"
              endpoint="/customers/"
              value={soCustomerId}
              size="small"
              onChange={(val) => setSoCustomerId(val)}
              onChangeOverride={(custObj) => setSelectedCustomer(custObj)}
              initialOption={selectedCustomer}
            />
            {selectedCustomer && (
              <Box sx={{ mt: 0.5, px: 0.5, fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3 }}>
                GSTIN: <strong>{selectedCustomer.gstin || 'N/A'}</strong> | Phone: <strong>{selectedCustomer.phone || 'N/A'}</strong>
                <br />
                Address: <strong>{selectedCustomer.billing_address || 'N/A'}</strong>
              </Box>
            )}
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField
              select
              label="Ordering Branch"
              fullWidth
              size="small"
              value={soBranchId}
              onChange={(e) => setSoBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.branch_name} ({b.code})</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField
              type="date"
              label="Order Date"
              fullWidth
              size="small"
              value={soDate}
              onChange={(e) => setSoDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button onClick={() => setOpenSOModal(false)} variant="outlined" size="small">Cancel</Button>
            <Button onClick={submitSO} variant="contained" size="small">Submit SO</Button>
          </Box>
        </Box>

        <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
          Sales Order Items sub-grid
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ py: 1, px: 1, fontWeight: 600 }}>Product</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, fontWeight: 600, width: 80 }}>Qty</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, fontWeight: 600, width: 130 }}>Rate (₹)</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, fontWeight: 600, width: 100 }}>Disc (₹)</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, fontWeight: 600, width: 90 }}>GST %</TableCell>
                <TableCell align="right" sx={{ py: 1, px: 1, fontWeight: 600 }}>Total (₹)</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {soItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell sx={{ py: 0.5, px: 0.5, minWidth: 240 }}>
                    <FormAutocomplete
                      label="Select Product"
                      endpoint="/products/"
                      value={item.product_id}
                      size="small"
                      onChange={(val) => handleItemChange(idx, 'product_id', val)}
                      onChangeOverride={(prodObj) => {
                        if (prodObj) {
                          setSoItems(prevItems => prevItems.map((it, i) => {
                            if (i === idx) {
                              return {
                                ...it,
                                product_id: prodObj.id,
                                rate: prodObj.selling_price,
                                tax_rate: prodObj.tax_rate,
                                product_name: prodObj.name,
                                sku: prodObj.sku
                              };
                            }
                            return it;
                          }));
                        }
                      }}
                      initialOption={item.product_id ? { id: item.product_id, name: item.product_name || 'Unknown', sku: item.sku || '' } : null}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.5 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                      inputProps={{ style: { padding: '4px 6px', textAlign: 'center' } }}
                      sx={{ '& .MuiInputBase-root': { height: 32 } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.5 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                      inputProps={{ style: { padding: '4px 6px', textAlign: 'center' } }}
                      sx={{ '& .MuiInputBase-root': { height: 32 } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.5 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={item.discount_amount}
                      onChange={(e) => handleItemChange(idx, 'discount_amount', parseFloat(e.target.value) || 0)}
                      inputProps={{ style: { padding: '4px 6px', textAlign: 'center' } }}
                      sx={{ '& .MuiInputBase-root': { height: 32 } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.5 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={item.tax_rate}
                      onChange={(e) => handleItemChange(idx, 'tax_rate', parseFloat(e.target.value) || 0)}
                      inputProps={{ style: { padding: '4px 6px', textAlign: 'center' } }}
                      sx={{ '& .MuiInputBase-root': { height: 32 } }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5, px: 0.5, fontWeight: 600 }}>
                    {(((item.qty * item.rate) - item.discount_amount) * (1 + item.tax_rate / 100)).toFixed(2)}
                  </TableCell>
                  <TableCell align="center" sx={{ py: 0.5, px: 0.5 }}>
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

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, borderTop: '1px solid #e2e8f0', pt: 2 }}>
          <Typography variant="body2">Subtotal: <strong>₹{soTotalSum.toFixed(2)}</strong></Typography>
          <Typography variant="body2">Discount: <strong>-₹{soTotalDiscount.toFixed(2)}</strong></Typography>
          <Typography variant="body2">Taxes (GST): <strong>₹{soTotalTax.toFixed(2)}</strong></Typography>
          <Typography variant="subtitle1" color="primary.main">Grand Total: <strong>₹{(soTotalSum - soTotalDiscount + soTotalTax).toFixed(2)}</strong></Typography>
        </Box>
      </CommonModal>


      {/* GENERATE INVOICE MODAL */}
      <CommonModal
        open={openInvoiceModal}
        onClose={() => setOpenInvoiceModal(false)}
        title="Create Tax Invoice"
      >
        <Typography variant="body1" sx={{ mb: 2 }}>
          Generating sequential tax invoice for order: <strong>{selectedSO?.so_number || `SO-${selectedSO?.id.substring(0, 6).toUpperCase()}`}</strong>
        </Typography>
        
        {availableDCs.length > 0 ? (
          <TextField
            select
            fullWidth
            label="Refer / Link Delivery Challan"
            value={selectedDCId}
            onChange={(e) => setSelectedDCId(e.target.value)}
            sx={{ mb: 3 }}
            helperText="Selecting a Delivery Challan will link this invoice and skip deducting inventory twice."
          >
            <MenuItem value="">
              <em>None (Deduct items directly from stock)</em>
            </MenuItem>
            {availableDCs.map((dc) => (
              <MenuItem key={dc.id} value={dc.id}>
                {dc.challan_number} (Created: {new Date(dc.date).toLocaleDateString()})
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            No pending Delivery Challans found for this customer. Stock will be deducted from inventory.
          </Typography>
        )}

        <TextField
          type="date"
          fullWidth
          label="Invoice Date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setOpenInvoiceModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitInvoice} variant="contained">Generate invoice</Button>
        </Box>
      </CommonModal>

      {/* PRINT-READY INVOICE / SALES ORDER PRINT MODAL */}
      <CommonModal
        open={openPrintModal}
        onClose={() => setOpenPrintModal(false)}
        title={printDocType === 'Invoice' ? "Print Tax Invoice" : "Print Sales Order"}
        maxWidth="md"
        actions={
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              {printDocType === 'Invoice' ? 'Print Invoice' : 'Print Sales Order'}
            </Button>
            <Button variant="contained" onClick={handleDownloadPDF}>
              Download PDF
            </Button>
          </Box>
        }
      >
        <Box sx={{ p: 4, '@media print': { p: 0 } }}>
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
          {/* Header */}
          <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2, minHeight: 90 }}>
            {company?.logo && (
              <Box
                component="img"
                src={company.logo}
                alt="Company Logo"
                sx={{
                  position: 'absolute',
                  left: 0,
                  maxHeight: 90,
                  maxWidth: 90,
                  objectFit: 'contain',
                  '@media print': {
                    printColorAdjust: 'exact',
                  }
                }}
              />
            )}
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'primary.main', mb: 0.5, lineHeight: 1.2 }}>
                {company?.name ? company.name.trim() : 'ORBX CORPORATION'}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{company?.address ? company.address.trim() : ''}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>GSTIN: <strong>{company?.gstin ? company.gstin.trim() : ''}</strong></Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                Email: {company?.email ? company.email.trim() : ''} | Phone: {company?.phone ? company.phone.trim() : ''}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Document Details (Title, Number & Date) */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                {printDocType === 'Invoice' ? 'TAX INVOICE' : 'SALES ORDER'}{' '}
                <span style={{ fontWeight: 600, color: '#334155', fontSize: '1.15rem', marginLeft: '6px' }}>
                  {printData?.invoice_number}
                </span>
              </Typography>
              {printDocType === 'Invoice' && printData?.delivery_challan_number && (
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#475569', mt: 0.5 }}>
                  Challan No: <strong>{printData.delivery_challan_number}</strong>
                </Typography>
              )}
              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#475569', mt: 0.5 }}>
                Date: <strong>{printData ? formatBillingDate(printData.date) : ''}</strong>
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Addresses */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ width: '48%' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>BILL TO:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{printData?.customer_name}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.85rem', color: 'text.secondary' }}>{printData?.customer_billing_address}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem', mt: 0.5 }}>GSTIN: <strong>{printData?.customer_gstin}</strong></Typography>
            </Box>
            <Box sx={{ width: '48%' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>SHIP TO:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{printData?.customer_name}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.85rem', color: 'text.secondary' }}>{printData?.customer_shipping_address}</Typography>
            </Box>
          </Box>

          {/* Items Grid */}
          {(() => {
            const hasDiscount = printData?.items?.some(item => (item.discount_amount || 0) > 0) || false;
            return (
              <TableContainer sx={{ mb: 6 }}>
                <Table size="small" sx={{ 
                  '& .MuiTableCell-root': { py: 0.25, px: 1, fontSize: '0.85rem' },
                  '& .MuiTableCell-root:first-of-type': { paddingLeft: '0 !important' },
                  '& .MuiTableCell-root:last-of-type': { paddingRight: '0 !important' }
                }}>
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
                    {printData?.items?.map((item, idx) => {
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ width: '50%' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.85rem' }}>Terms & Conditions:</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'pre-line', fontSize: '0.75rem', display: 'block', lineHeight: 1.3 }}>
                {printBranch?.invoice_terms}
              </Typography>
            </Box>
            <Box sx={{ width: '42%', textAlign: 'right' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, fontSize: '0.85rem' }}>
                <Typography variant="body2" sx={{ textAlign: 'left' }}>Subtotal:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{printData?.subtotal?.toFixed(2)}</Typography>
                
                {printData?.discount_amount > 0 && (
                  <>
                    <Typography variant="body2" sx={{ textAlign: 'left' }}>Discount:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>-₹{printData.discount_amount.toFixed(2)}</Typography>
                  </>
                )}

                {printData?.gst_breakup?.cgst > 0 && (
                  <>
                    <Typography variant="body2" sx={{ textAlign: 'left' }}>CGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{printData?.gst_breakup?.cgst?.toFixed(2)}</Typography>
                  </>
                )}

                {printData?.gst_breakup?.sgst > 0 && (
                  <>
                    <Typography variant="body2" sx={{ textAlign: 'left' }}>SGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{printData?.gst_breakup?.sgst?.toFixed(2)}</Typography>
                  </>
                )}

                {printData?.gst_breakup?.igst > 0 && (
                  <>
                    <Typography variant="body2" sx={{ textAlign: 'left' }}>IGST:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{printData?.gst_breakup?.igst?.toFixed(2)}</Typography>
                  </>
                )}
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.9rem' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'left' }}>Grand Total:</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  ₹{printData?.total_amount?.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, display: 'block', color: 'text.secondary', fontSize: '0.8rem' }}>
                  Rupees: {printData ? numberToWords(printData.total_amount) : ''}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Signatures & Footer */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3 }}>
            <Box>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Customer Signature</Typography>
              <Box sx={{ height: 35, borderBottom: '1px solid #000000', width: 150 }} />
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Authorized Signatory for {company?.name ? company.name.trim() : ''}</Typography>
              <Box sx={{ height: 35, borderBottom: '1px solid #000000', width: 150, ml: 'auto' }} />
            </Box>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {printBranch?.invoice_footer || 'Thank you for your business!'}
            </Typography>
          </Box>
        </Box>
        </Box>
      </CommonModal>
    </Box>
  );
};

export default Sales;
