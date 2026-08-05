import React, { useState, useEffect, useRef } from 'react';
import { Button, Box, Alert, Typography, Tabs, Tab, Paper, Grid, MenuItem, TextField, Chip, Table, TableHead, TableRow, TableCell, TableBody, IconButton, TableContainer, Divider, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, AssignmentTurnedIn as ReceiveIcon, Receipt as BillIcon, Edit as EditIcon, Block as CancelIcon, Print as PrintIcon, NoteAdd as DebitNoteIcon } from '@mui/icons-material';
import { useReactToPrint } from 'react-to-print';
import { useSelector } from 'react-redux';

import apiClient from '../../api/client';
import PageHeader from '../../components/PageHeader';
import CommonTable from '../../components/CommonTable';
import CommonModal from '../../components/CommonModal';
import FormAutocomplete from '../../components/FormAutocomplete';

const Purchase = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [pos, setPos] = useState([]);
  const [grns, setGrns] = useState([]);
  const [bills, setBills] = useState([]);
  const [branches, setBranches] = useState([]);
  // Debit Notes
  const [debitNotes, setDebitNotes] = useState([]);
  const [openDNModal, setOpenDNModal] = useState(false);
  const [dnBillId, setDnBillId] = useState('');
  const [dnSupplierId, setDnSupplierId] = useState('');
  const [dnBranchId, setDnBranchId] = useState('');
  const [dnReason, setDnReason] = useState('');
  const [dnDate, setDnDate] = useState('');
  const [dnItems, setDnItems] = useState([{ product_id: '', qty: 1, rate: 0, tax_rate: 18 }]);
  const [dnError, setDnError] = useState(null);
  
  const [openPOModal, setOpenPOModal] = useState(false);
  const [openGRNModal, setOpenGRNModal] = useState(false);
  const [openBillModal, setOpenBillModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [company, setCompany] = useState(null);
  
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const printRef = useRef();
  
  // Purchase Order form local states
  const [poSupplierId, setPoSupplierId] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [poBranchId, setPoBranchId] = useState('');
  const [poDate, setPoDate] = useState('');
  const [poItems, setPoItems] = useState([{ product_id: '', qty: 1, rate: 0, tax_rate: 18 }]);
  
  // GRN received quantities local state
  const [grnItems, setGrnItems] = useState([]);
  const [grnDate, setGrnDate] = useState('');
  
  // Bill local states
  const [billInvoiceNo, setBillInvoiceNo] = useState('');
  const [billDate, setBillDate] = useState('');
  const [billDueDate, setBillDueDate] = useState('');

  const [error, setError] = useState(null);

  const { user } = useSelector((state) => state.auth);
  const isSuperAdmin = user?.role_name === 'Super Admin';

  const loadData = async () => {
    try {
      const poRes = await apiClient.get('/purchase/po');
      const grnRes = await apiClient.get('/purchase/grn');
      const billRes = await apiClient.get('/purchase/bills');
      const brRes = await apiClient.get('/admin/branches');
      const compRes = await apiClient.get('/admin/company');
      const dnRes = await apiClient.get('/purchase/debit-notes');

      setPos(poRes.data);
      setGrns(grnRes.data);
      setBills(billRes.data);
      setBranches(brRes.data);
      setCompany(compRes.data);
      setDebitNotes(dnRes.data);
    } catch (err) {
      setError('Failed to load transaction data records.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPrint = (po) => {
    setSelectedPO(po);
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

      pdf.save(`PurchaseOrder_${selectedPO?.po_number || 'Document'}.pdf`);
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
      
      if (val >= 10000000) {
        const crores = Math.floor(val / 10000000);
        parts.push(convertLessThanOneThousand(crores) + ' Crore');
        val %= 10000000;
      }
      
      if (val >= 100000) {
        const lakhs = Math.floor(val / 100000);
        parts.push(convertLessThanOneThousand(lakhs) + ' Lakh');
        val %= 100000;
      }
      
      if (val >= 1000) {
        const thousands = Math.floor(val / 1000);
        parts.push(convertLessThanOneThousand(thousands) + ' Thousand');
        val %= 1000;
      }
      
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

  const handleCancelPO = async (po) => {
    if (window.confirm(`Are you sure you want to cancel Purchase Order ${po.po_number || `PO-${po.id.substring(0, 6).toUpperCase()}`}?`)) {
      try {
        await apiClient.post(`/purchase/po/${po.id}/cancel`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to cancel Purchase Order.');
      }
    }
  };

  const handleDeletePO = async (po) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete Purchase Order ${po.po_number || `PO-${po.id.substring(0, 6).toUpperCase()}`}? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/purchase/po/${po.id}`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete Purchase Order.');
      }
    }
  };

  const handleCancelGRN = async (grn) => {
    if (window.confirm(`Are you sure you want to cancel GRN ${grn.grn_number || `GRN-${grn.id.substring(0, 6).toUpperCase()}`}?`)) {
      try {
        await apiClient.post(`/purchase/grn/${grn.id}/cancel`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to cancel Goods Receipt Note.');
      }
    }
  };

  const handleDeleteGRN = async (grn) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete GRN ${grn.grn_number || `GRN-${grn.id.substring(0, 6).toUpperCase()}`}? This action cannot be undone and will reverse stock levels.`)) {
      try {
        await apiClient.delete(`/purchase/grn/${grn.id}`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete GRN.');
      }
    }
  };

  const handleCancelBill = async (bill) => {
    if (window.confirm(`Are you sure you want to cancel Purchase Bill ${bill.invoice_number}?`)) {
      try {
        await apiClient.post(`/purchase/bills/${bill.id}/cancel`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to cancel Purchase Entry Bill.');
      }
    }
  };

  const handleDeleteBill = async (bill) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete Purchase Bill ${bill.invoice_number}? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/purchase/bills/${bill.id}`);
        loadData();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete Purchase Bill.');
      }
    }
  };

  const handleOpenAddPO = () => {
    setSelectedPO(null);
    setPoSupplierId('');
    setSelectedSupplier(null);
    setPoBranchId(branches.length > 0 ? branches[0].id : '');
    setPoDate(new Date().toISOString().split('T')[0]);
    setPoItems([{ product_id: '', qty: 1, rate: 0, tax_rate: 18 }]);
    setOpenPOModal(true);
  };

  const handleOpenEditPO = (po) => {
    setSelectedPO(po);
    setPoSupplierId(po.supplier_id);
    setSelectedSupplier({
      id: po.supplier_id,
      name: po.supplier_name
    });
    setPoBranchId(po.branch_id);
    setPoDate(po.date ? new Date(po.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setPoItems(
      po.items.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
        rate: item.rate,
        tax_rate: item.tax_rate,
        product_name: item.product_name,
        sku: item.sku
      }))
    );
    setOpenPOModal(true);
  };

  const handleAddItemRow = () => {
    setPoItems([...poItems, { product_id: '', qty: 1, rate: 0, tax_rate: 18 }]);
  };

  const handleRemoveItemRow = (idx) => {
    setPoItems(poItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    setPoItems(
      poItems.map((item, i) => {
        if (i === idx) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const submitPO = async () => {
    try {
      const payload = {
        supplier_id: poSupplierId,
        branch_id: poBranchId,
        date: poDate ? new Date(poDate).toISOString() : null,
        items: poItems.map(item => ({
          product_id: item.product_id,
          qty: item.qty,
          rate: item.rate,
          tax_rate: item.tax_rate
        }))
      };
      if (selectedPO) {
        await apiClient.put(`/purchase/po/${selectedPO.id}`, payload);
      } else {
        await apiClient.post('/purchase/po', payload);
      }
      setOpenPOModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit Purchase Order.');
    }
  };

  // ==========================================
  // GRN FLOWS
  // ==========================================
  const handleOpenReceive = (po) => {
    setSelectedPO(po);
    const items = po.items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      po_item_id: item.id,
      qty_ordered: item.qty,
      qty_received: item.qty,
      warehouse_location: 'Main Rack A'
    }));
    setGrnItems(items);
    setGrnDate(new Date().toISOString().split('T')[0]);
    setOpenGRNModal(true);
  };

  const handleGRNQtyChange = (idx, qty) => {
    setGrnItems(grnItems.map((item, i) => (i === idx ? { ...item, qty_received: parseFloat(qty) || 0 } : item)));
  };

  const handleGRNRackChange = (idx, val) => {
    setGrnItems(grnItems.map((item, i) => (i === idx ? { ...item, warehouse_location: val } : item)));
  };

  const submitGRN = async () => {
    try {
      const payload = {
        purchase_order_id: selectedPO.id,
        branch_id: selectedPO.branch_id,
        date: grnDate ? new Date(grnDate).toISOString() : null,
        items: grnItems
      };
      await apiClient.post('/purchase/grn', payload);
      setOpenGRNModal(false);
      loadData();
    } catch (err) {
      setError('Failed to log Goods Receipt Note.');
    }
  };

  // ==========================================
  // VENDOR BILL FLOWS
  // ==========================================
  const handleOpenBill = (grn) => {
    setSelectedGRN(grn);
    setBillInvoiceNo(`INV-${grn.grn_number || grn.id.substring(0, 6).toUpperCase()}`);
    setBillDate(new Date().toISOString().split('T')[0]);
    setBillDueDate(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
    setOpenBillModal(true);
  };

  const submitBill = async () => {
    try {
      // Find corresponding PO total amount
      const po = pos.find((p) => p.id === selectedGRN.purchase_order_id);
      const payload = {
        grn_id: selectedGRN.id,
        supplier_id: selectedGRN.purchase_order_id ? po.supplier_id : '',
        branch_id: selectedGRN.branch_id,
        invoice_number: billInvoiceNo,
        billing_date: billDate ? new Date(billDate).toISOString() : null,
        due_date: new Date(billDueDate).toISOString(),
        payment_terms: "15 Days Net",
        subtotal: po ? po.total_amount : 0,
        tax_amount: po ? po.tax_amount : 0,
        total_amount: po ? po.grand_total : 0
      };

      await apiClient.post('/purchase/bills', payload);
      setOpenBillModal(false);
      loadData();
    } catch (err) {
      setError('Failed to log Supplier Invoice Bill.');
    }
  };

  const poColumns = [
    { id: 'po_number', label: 'PO Number', render: (row) => row.po_number || `PO-${row.id.substring(0, 6).toUpperCase()}` },
    { id: 'date', label: 'Order Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'supplier_name',
      label: 'Supplier Vendor',
      render: (row) => row.supplier_name || 'Unknown'
    },
    {
      id: 'branch_id',
      label: 'Branch Office',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      }
    },
    { id: 'grand_total', label: 'Total Value (₹)', render: (row) => `₹${row.grand_total.toFixed(2)}` },
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
      )
    }
  ];

  const grnColumns = [
    { id: 'grn_number', label: 'GRN Number', render: (row) => row.grn_number || `GRN-${row.id.substring(0, 6).toUpperCase()}` },
    { id: 'date', label: 'Received Date', render: (row) => new Date(row.date).toLocaleDateString() },
    {
      id: 'purchase_order_id',
      label: 'Linked PO Ref',
      render: (row) => row.po_number || `PO-${row.purchase_order_id.substring(0, 6).toUpperCase()}`
    },
    {
      id: 'branch_id',
      label: 'Branch',
      render: (row) => {
        const b = branches.find((br) => br.id === row.branch_id);
        return b ? b.branch_name : 'Global';
      }
    },
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
            backgroundColor: row.status === 'Cancelled' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(45, 106, 79, 0.1)',
            color: row.status === 'Cancelled' ? '#64748b' : '#2d6a4f',
          }}
        >
          {row.status}
        </Typography>
      )
    }
  ];

  const billColumns = [
    { id: 'billing_date', label: 'Bill Date', render: (row) => new Date(row.billing_date).toLocaleDateString() },
    { id: 'invoice_number', label: 'Supplier Invoice #' },
    {
      id: 'supplier_name',
      label: 'Supplier Name',
      render: (row) => row.supplier_name || 'Unknown'
    },
    { id: 'total_amount', label: 'Bill Value (₹)', render: (row) => `₹${row.total_amount.toFixed(2)}` },
    {
      id: 'status',
      label: 'Payment Status',
      render: (row) => (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontWeight: 600,
            backgroundColor: row.status === 'Paid' ? 'rgba(45, 106, 79, 0.1)' : row.status === 'Cancelled' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(217, 4, 41, 0.1)',
            color: row.status === 'Paid' ? '#2d6a4f' : row.status === 'Cancelled' ? '#64748b' : '#d90429',
          }}
        >
          {row.status}
        </Typography>
      )
    }
  ];

  const poTotalAmountSum = poItems.reduce((acc, item) => acc + (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0), 0);
  const poTotalTaxSum = poItems.reduce((acc, item) => acc + ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) * (parseFloat(item.tax_rate) || 18) / 100), 0);
  const printBranch = selectedPO ? branches.find((b) => b.id === selectedPO.branch_id) : null;

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderRadius: '8px' }}>
        <Tabs value={tabIndex} onChange={(e, idx) => setTabIndex(idx)} sx={{ px: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Tab label="Purchase Orders" sx={{ fontWeight: 600 }} />
          <Tab label="Goods Receipt Notes (GRN)" sx={{ fontWeight: 600 }} />
          <Tab label="Purchase Entries (Bills)" sx={{ fontWeight: 600 }} />
          <Tab label="Debit Notes" sx={{ fontWeight: 600 }} icon={<DebitNoteIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {tabIndex === 0 && (
        <CommonTable
          columns={poColumns}
          rows={pos}
          actions={[
            {
              icon: <EditIcon />,
              label: 'Edit Purchase Order',
              onClick: handleOpenEditPO,
              color: 'secondary'
            },
            {
              icon: <PrintIcon />,
              label: 'Print Purchase Order',
              onClick: handleOpenPrint,
              color: 'primary'
            },
            {
              icon: <ReceiveIcon />,
              label: 'Goods Receipt Note (GRN)',
              condition: (row) => row.status === 'Draft',
              onClick: handleOpenReceive,
              color: 'success'
            },
            {
              icon: <CancelIcon />,
              label: 'Cancel Purchase Order',
              condition: (row) => row.status !== 'Cancelled',
              onClick: handleCancelPO,
              color: 'error'
            },
            ...(isSuperAdmin ? [{
              icon: <DeleteIcon />,
              label: 'Delete Purchase Order',
              onClick: handleDeletePO,
              color: 'error'
            }] : [])
          ]}
          searchKey="status"
          tableActions={
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddPO}>
              Create Purchase Order
            </Button>
          }
        />
      )}

      {tabIndex === 1 && (
        <CommonTable
          columns={grnColumns}
          rows={grns}
          actions={[
            {
              icon: <BillIcon />,
              label: 'Purchase Entry Bill',
              condition: (row) => row.status !== 'Cancelled' && !bills.some(b => b.grn_id === row.id && b.status !== 'Cancelled'),
              onClick: handleOpenBill,
              color: 'primary'
            },
            {
              icon: <CancelIcon />,
              label: 'Cancel GRN',
              condition: (row) => row.status !== 'Cancelled',
              onClick: handleCancelGRN,
              color: 'error'
            },
            ...(isSuperAdmin ? [{
              icon: <DeleteIcon />,
              label: 'Delete GRN',
              onClick: handleDeleteGRN,
              color: 'error'
            }] : [])
          ]}
          searchKey="status"
        />
      )}

      {tabIndex === 2 && (
        <CommonTable
          columns={billColumns}
          rows={bills}
          actions={[
            {
              icon: <CancelIcon />,
              label: 'Cancel Purchase Bill',
              condition: (row) => row.status !== 'Cancelled',
              onClick: handleCancelBill,
              color: 'error'
            },
            ...(isSuperAdmin ? [{
              icon: <DeleteIcon />,
              label: 'Delete Purchase Bill',
              onClick: handleDeleteBill,
              color: 'error'
            }] : [])
          ]}
          searchKey="invoice_number"
        />
      )}

      {tabIndex === 3 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Debit Notes (Purchase Returns)</Typography>
            <Button variant="contained" color="error" startIcon={<AddIcon />} onClick={() => { setDnError(null); setDnItems([{ product_id: '', qty: 1, rate: 0, tax_rate: 18 }]); setDnBillId(''); setDnSupplierId(''); setDnBranchId(''); setDnReason(''); setDnDate(''); setOpenDNModal(true); }}>
              New Debit Note
            </Button>
          </Box>
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#fff5f5' }}>
                  <TableCell sx={{ fontWeight: 700 }}>DN Number</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Bill Ref.</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Tax (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Total (₹)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {debitNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No Debit Notes found. Create one when returning goods to a supplier.
                    </TableCell>
                  </TableRow>
                ) : debitNotes.map((dn) => (
                  <TableRow key={dn.id} hover>
                    <TableCell><strong>{dn.debit_note_number}</strong></TableCell>
                    <TableCell>{new Date(dn.date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{dn.purchase_entry_number || '—'}</TableCell>
                    <TableCell>{dn.supplier_name || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}><Typography noWrap variant="body2">{dn.reason || '—'}</Typography></TableCell>
                    <TableCell align="right">₹{(dn.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">₹{(dn.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right"><strong>₹{(dn.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></TableCell>
                    <TableCell>
                      <Chip label={dn.status} size="small" color={dn.status === 'Issued' ? 'warning' : 'default'} />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={async () => { if (window.confirm(`Delete Debit Note ${dn.debit_note_number}? This will reverse stock.`)) { try { await apiClient.delete(`/purchase/debit-notes/${dn.id}`); loadData(); } catch(e) { setError(e.response?.data?.detail || 'Failed to delete Debit Note.'); } } }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* DEBIT NOTE MODAL */}
      <Dialog open={openDNModal} onClose={() => setOpenDNModal(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)', color: '#fff' }}>New Debit Note</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {dnError && <Alert severity="error" sx={{ mb: 2 }}>{dnError}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3, mt: 1 }}>
            <TextField
              select label="Linked Purchase Bill (optional)" size="small" sx={{ flex: '1 1 280px' }}
              value={dnBillId} onChange={(e) => {
                setDnBillId(e.target.value);
                const bill = bills.find(b => b.id === e.target.value);
                if (bill) { setDnSupplierId(bill.supplier_id); setDnBranchId(bill.branch_id); }
              }}
            >
              <MenuItem value="">— No linked bill —</MenuItem>
              {bills.filter(b => b.status !== 'Cancelled').map(b => (
                <MenuItem key={b.id} value={b.id}>{b.invoice_number} — {b.supplier_name} (₹{(b.total_amount || 0).toLocaleString('en-IN')})</MenuItem>
              ))}
            </TextField>
            <Box sx={{ flex: '1 1 250px' }}>
              <FormAutocomplete
                label="Supplier"
                endpoint="/suppliers/"
                value={dnSupplierId}
                size="small"
                onChange={(val) => setDnSupplierId(val)}
              />
            </Box>
            <TextField
              select label="Branch" size="small" sx={{ flex: '1 1 160px' }}
              value={dnBranchId} onChange={(e) => setDnBranchId(e.target.value)}
            >
              {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
            </TextField>
            <TextField type="date" label="Date" size="small" sx={{ flex: '1 1 150px' }} InputLabelProps={{ shrink: true }} value={dnDate} onChange={(e) => setDnDate(e.target.value)} />
            <TextField label="Reason for Return" size="small" sx={{ flex: '1 1 100%' }} value={dnReason} onChange={(e) => setDnReason(e.target.value)} placeholder="e.g. Defective goods, over-supply..." />
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'error.main' }}>Return Items (Stock will be removed)</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#fef2f2' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>Qty</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 120 }}>Rate (₹)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 90 }}>GST %</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Amount (₹)</TableCell>
                  <TableCell sx={{ width: 50 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {dnItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ py: 0.5 }}>
                      <FormAutocomplete
                        label="Product"
                        endpoint="/products/"
                        value={item.product_id}
                        size="small"
                        onChange={(val) => { const updated = [...dnItems]; updated[idx].product_id = val; setDnItems(updated); }}
                        onChangeOverride={(p) => { if (p) { const updated = [...dnItems]; updated[idx].product_id = p.id; updated[idx].rate = p.cost_price || p.base_price || 0; setDnItems(updated); } }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField type="number" size="small" value={item.qty} inputProps={{ min: 0 }} onChange={(e) => { const updated = [...dnItems]; updated[idx].qty = parseFloat(e.target.value) || 0; setDnItems(updated); }} />
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField type="number" size="small" value={item.rate} inputProps={{ min: 0 }} onChange={(e) => { const updated = [...dnItems]; updated[idx].rate = parseFloat(e.target.value) || 0; setDnItems(updated); }} />
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField type="number" size="small" value={item.tax_rate} inputProps={{ min: 0, max: 28 }} onChange={(e) => { const updated = [...dnItems]; updated[idx].tax_rate = parseFloat(e.target.value) || 0; setDnItems(updated); }} />
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      ₹{((item.qty * item.rate) * (1 + item.tax_rate / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <IconButton size="small" onClick={() => setDnItems(dnItems.filter((_, i) => i !== idx))} disabled={dnItems.length === 1}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setDnItems([...dnItems, { product_id: '', qty: 1, rate: 0, tax_rate: 18 }])}>Add Item</Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setOpenDNModal(false)} variant="outlined">Cancel</Button>
          <Button variant="contained" color="error" onClick={async () => {
            if (!dnSupplierId) { setDnError('Please select a supplier.'); return; }
            if (!dnBranchId) { setDnError('Please select a branch.'); return; }
            if (dnItems.some(it => !it.product_id)) { setDnError('All items must have a product selected.'); return; }
            try {
              await apiClient.post('/purchase/debit-notes', {
                purchase_entry_id: dnBillId || null,
                supplier_id: dnSupplierId,
                branch_id: dnBranchId,
                date: dnDate || undefined,
                reason: dnReason || undefined,
                items: dnItems.map(it => ({ product_id: it.product_id, qty: it.qty, rate: it.rate, tax_rate: it.tax_rate }))
              });
              setOpenDNModal(false);
              loadData();
            } catch (e) {
              setDnError(e.response?.data?.detail || 'Failed to create Debit Note.');
            }
          }}>Issue Debit Note</Button>
        </DialogActions>
      </Dialog>

      {/* PO CREATE MODAL */}
      <CommonModal
        open={openPOModal}
        onClose={() => setOpenPOModal(false)}
        title={selectedPO ? "Edit Purchase Order" : "Create Purchase Order"}
        maxWidth="md"
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 3 }}>
          <Box sx={{ flex: '1 1 250px' }}>
            <FormAutocomplete
              label="Select Supplier"
              endpoint="/suppliers/"
              value={poSupplierId}
              size="small"
              onChange={(val) => setPoSupplierId(val)}
              initialOption={selectedSupplier}
            />
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <TextField
              select
              label="Ordering Branch"
              fullWidth
              size="small"
              value={poBranchId}
              onChange={(e) => setPoBranchId(e.target.value)}
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
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button onClick={() => setOpenPOModal(false)} variant="outlined" size="small">Cancel</Button>
            <Button onClick={submitPO} variant="contained" size="small">Submit PO</Button>
          </Box>
        </Box>

        <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
          Purchase Order Line Items
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ py: 1, px: 1, fontWeight: 600 }}>Product</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, fontWeight: 600, width: 80 }}>Qty</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, fontWeight: 600, width: 130 }}>Rate (₹)</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, fontWeight: 600, width: 90 }}>GST %</TableCell>
                <TableCell align="right" sx={{ py: 1, px: 1, fontWeight: 600 }}>Total (₹)</TableCell>
                <TableCell align="center" sx={{ py: 1, px: 1, width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {poItems.map((item, idx) => (
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
                          setPoItems(prevItems => prevItems.map((it, i) => {
                            if (i === idx) {
                              return {
                                ...it,
                                product_id: prodObj.id,
                                rate: prodObj.purchase_price,
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
                      value={item.tax_rate}
                      onChange={(e) => handleItemChange(idx, 'tax_rate', parseFloat(e.target.value) || 0)}
                      inputProps={{ style: { padding: '4px 6px', textAlign: 'center' } }}
                      sx={{ '& .MuiInputBase-root': { height: 32 } }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5, px: 0.5, fontWeight: 600 }}>
                    {((item.qty * item.rate) * (1 + item.tax_rate / 100)).toFixed(2)}
                  </TableCell>
                  <TableCell align="center" sx={{ py: 0.5, px: 0.5 }}>
                    <IconButton color="error" size="small" onClick={() => handleRemoveItemRow(idx)} disabled={poItems.length === 1}>
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
          <Typography variant="body2">Subtotal: <strong>₹{poTotalAmountSum.toFixed(2)}</strong></Typography>
          <Typography variant="body2">Taxes (GST): <strong>₹{poTotalTaxSum.toFixed(2)}</strong></Typography>
          <Typography variant="subtitle1" color="primary.main">Grand Total: <strong>₹{(poTotalAmountSum + poTotalTaxSum).toFixed(2)}</strong></Typography>
        </Box>
      </CommonModal>

      {/* GRN RECORD MODAL */}
      <CommonModal
        open={openGRNModal}
        onClose={() => setOpenGRNModal(false)}
        title="Record Goods Receipt Note"
        maxWidth="md"
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
          <Typography variant="body1">
            Order reference: <strong>{selectedPO?.po_number || `PO-${selectedPO?.id.substring(0, 6).toUpperCase()}`}</strong>
          </Typography>
          <TextField
            type="date"
            label="GRN Date"
            size="small"
            value={grnDate}
            onChange={(e) => setGrnDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200, ml: 'auto' }}
          />
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Ordered Qty</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 140 }}>Received Qty</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Warehouse Rack</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grnItems.map((item, idx) => {
                return (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontWeight: 600 }}>{item.product_name || 'Unknown'}</TableCell>
                    <TableCell align="center">{item.qty_ordered}</TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        value={item.qty_received}
                        onChange={(e) => handleGRNQtyChange(idx, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        value={item.warehouse_location}
                        onChange={(e) => handleGRNRackChange(idx, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
          <Button onClick={() => setOpenGRNModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitGRN} variant="contained">Post GRN Stock</Button>
        </Box>
      </CommonModal>

      {/* BILL LOG MODAL */}
      <CommonModal
        open={openBillModal}
        onClose={() => setOpenBillModal(false)}
        title="Finalize Supplier Invoice Bill"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Supplier Invoice Number"
            fullWidth
            value={billInvoiceNo}
            onChange={(e) => setBillInvoiceNo(e.target.value)}
          />
          <TextField
            label="Bill Date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
          />
          <TextField
            label="Payment Due Date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={billDueDate}
            onChange={(e) => setBillDueDate(e.target.value)}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 4 }}>
          <Button onClick={() => setOpenBillModal(false)} variant="outlined">Cancel</Button>
          <Button onClick={submitBill} variant="contained">Post Vendor Bill</Button>
        </Box>
      </CommonModal>

      {/* PRINT-READY PURCHASE ORDER PRINT MODAL */}
      <CommonModal
        open={openPrintModal}
        onClose={() => setOpenPrintModal(false)}
        title="Print Purchase Order"
        maxWidth="md"
        actions={
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              Print PO
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
              fontFamily: 'sans-serif',
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
                  {company?.name ? company.name.trim() : 'OrbX Corporation'}
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
                  PURCHASE ORDER{' '}
                  <span style={{ fontWeight: 600, color: '#334155', fontSize: '1.15rem', marginLeft: '6px' }}>
                    {selectedPO?.po_number || `PO-${selectedPO?.id?.substring(0, 6).toUpperCase()}`}
                  </span>
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#475569', mt: 0.5 }}>
                  Date: <strong>{selectedPO ? formatBillingDate(selectedPO.date) : ''}</strong>
                </Typography>
                {selectedPO?.expected_delivery && (
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#475569', mt: 0.5 }}>
                    Expected Delivery: <strong>{formatBillingDate(selectedPO.expected_delivery)}</strong>
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Addresses */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ width: '48%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>VENDOR / SUPPLIER:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedPO?.supplier_name}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.85rem', color: 'text.secondary' }}>{selectedPO?.supplier?.address}</Typography>
                {selectedPO?.supplier?.phone && (
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Phone: {selectedPO.supplier.phone}</Typography>
                )}
                <Typography variant="body2" sx={{ fontSize: '0.9rem', mt: 0.5 }}>GSTIN: <strong>{selectedPO?.supplier?.gstin || 'N/A'}</strong></Typography>
              </Box>
              <Box sx={{ width: '48%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.9rem' }}>SHIP TO / BILL TO:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{printBranch ? printBranch.branch_name : (company?.name || 'OrbX Corporation')}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.85rem', color: 'text.secondary' }}>
                  {printBranch ? printBranch.address : (company?.address || 'N/A')}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.9rem', mt: 0.5 }}>GSTIN: <strong>{company?.gstin || 'N/A'}</strong></Typography>
              </Box>
            </Box>

            {/* Items Grid */}
            <TableContainer sx={{ mb: 6 }}>
              <Table size="small" sx={{ 
                '& .MuiTableCell-root': { py: 0.25, px: 1, fontSize: '0.85rem' },
                '& .MuiTableCell-root:first-of-type': { paddingLeft: '0 !important' },
                '& .MuiTableCell-root:last-of-type': { paddingRight: '0 !important' }
              }}>
                <TableHead>
                  <TableRow sx={{ borderTop: '1.5px solid #000000', borderBottom: '1.5px solid #000000' }}>
                    <TableCell sx={{ fontWeight: 700, width: '5%', whiteSpace: 'nowrap' }}>S.No.</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '45%', whiteSpace: 'nowrap' }}>Item Description</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: '15%', whiteSpace: 'nowrap' }}>SKU</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: '10%', whiteSpace: 'nowrap' }}>Qty</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: '12%', whiteSpace: 'nowrap' }}>Rate (₹)</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: '10%', whiteSpace: 'nowrap' }}>GST %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: '13%', whiteSpace: 'nowrap' }}>Amount (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedPO?.items?.map((item, idx) => (
                    <TableRow key={idx} sx={{ borderBottom: '1px solid #e2e8f0' }}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{item.product_name || 'Unknown'}</TableCell>
                      <TableCell align="center">{item.sku || 'N/A'}</TableCell>
                      <TableCell align="center">{item.qty}</TableCell>
                      <TableCell align="center">{item.rate.toFixed(2)}</TableCell>
                      <TableCell align="center">{item.tax_rate}%</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{item.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Summary / Totals */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box sx={{ width: '50%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.85rem' }}>Instructions / Terms:</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'pre-line', fontSize: '0.75rem', display: 'block', lineHeight: 1.3, mb: 2 }}>
                  {printBranch?.invoice_terms || "1. Goods should be as per specification.\n2. Verify quality before delivery.\n3. Send copy of invoice with delivery."}
                </Typography>
              </Box>
              <Box sx={{ width: '42%', textAlign: 'right' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, fontSize: '0.85rem' }}>
                  <Typography variant="body2" sx={{ textAlign: 'left' }}>Subtotal:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{selectedPO?.total_amount?.toFixed(2)}</Typography>
                  
                  {(() => {
                    const companyState = company?.gstin ? company.gstin.substring(0, 2) : '33';
                    const supplierGstin = selectedPO?.supplier?.gstin;
                    const hasSupplierGst = supplierGstin && supplierGstin !== 'N/A' && supplierGstin.trim() !== '';
                    const supplierState = hasSupplierGst ? supplierGstin.substring(0, 2) : companyState;
                    const isIntrastate = companyState === supplierState;
                    const taxAmt = selectedPO?.tax_amount || 0;
                    if (isIntrastate && taxAmt > 0) {
                      return (
                        <>
                          <Typography variant="body2" sx={{ textAlign: 'left' }}>CGST:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{(taxAmt / 2).toFixed(2)}</Typography>
                          <Typography variant="body2" sx={{ textAlign: 'left' }}>SGST:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{(taxAmt / 2).toFixed(2)}</Typography>
                        </>
                      );
                    } else if (taxAmt > 0) {
                      return (
                        <>
                          <Typography variant="body2" sx={{ textAlign: 'left' }}>IGST:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{taxAmt.toFixed(2)}</Typography>
                        </>
                      );
                    }
                    return null;
                  })()}
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.9rem' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'left' }}>Grand Total:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    ₹{selectedPO?.grand_total?.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 600, display: 'block', color: 'text.secondary', fontSize: '0.8rem' }}>
                    Rupees: {selectedPO ? numberToWords(selectedPO.grand_total) : ''}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Signatures & Footer */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 4 }}>
              <Box>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Prepared By</Typography>
                <Box sx={{ height: 35, borderBottom: '1px solid #000000', width: 150 }} />
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Authorized Signatory for {company?.name ? company.name.trim() : 'OrbX Corporation'}</Typography>
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

export default Purchase;
