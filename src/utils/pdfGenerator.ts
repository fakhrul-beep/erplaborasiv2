import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, PurchaseOrder } from '../types';
import { format } from 'date-fns';

// Helper to load image as base64 (if needed, but for now we might use text or simple shapes)
// Assuming logo is at /logo.png. In client-side JS, we can drawImage with an HTMLImageElement or base64.
// For robustness, we will try to load it.

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

const COMPANY_INFO = {
  name: 'Ternakmart',
  address: 'Jl. Manyar Jaya Tengah 31 Surabaya, Indonesia',
  phone: '+62 896 0380 9123',
  email: 'sales@ternakmart.com',
  website: 'www.ternakmart.com',
  colors: {
    primary: '#2D3F50', // Charcoal Blue
    secondary: '#B1DF19', // Lime Green
    text: '#1F2937',
    muted: '#6B7280',
    light: '#F3F4F6'
  }
};

// Helper to format currency safely
const formatCurrency = (amount: number, currency = 'IDR') => {
  try {
    const locale = currency === 'IDR' ? 'id-ID' : 'id-ID';
    return new Intl.NumberFormat(locale, { 
      style: 'currency', 
      currency: currency,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2
    }).format(amount);
  } catch (e) {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

export const generateInvoicePDF = async (order: Order) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // --- Header Background ---
  doc.setFillColor(COMPANY_INFO.colors.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // --- Header Content ---
  // Logo
  try {
    const logoImg = await loadImage('/logo-putih.png');
    doc.addImage(logoImg, 'PNG', 15, 10, 35, 20); // Adjust dimensions
  } catch (e) {
    // Fallback if logo fails
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor('#FFFFFF');
    doc.text(COMPANY_INFO.name.toUpperCase(), 15, 25);
  }

  // Company Info (Right Side)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');
  doc.text(COMPANY_INFO.address, pageWidth - 15, 15, { align: 'right' });
  doc.text(COMPANY_INFO.phone, pageWidth - 15, 20, { align: 'right' });
  doc.text(COMPANY_INFO.email, pageWidth - 15, 25, { align: 'right' });
  doc.text(COMPANY_INFO.website, pageWidth - 15, 30, { align: 'right' });

  // --- Document Title & Status ---
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COMPANY_INFO.colors.primary);
  doc.text('INVOICE', 15, 60);

  // Status Badge
  const status = order.payment_status.toUpperCase();
  const statusColor = status === 'PAID' ? '#10B981' : (status === 'UNPAID' ? '#EF4444' : '#F59E0B');
  doc.setFillColor(statusColor);
  doc.roundedRect(pageWidth - 45, 52, 30, 8, 1, 1, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(10);
  doc.text(status, pageWidth - 30, 57.5, { align: 'center' });

  // --- Divider ---
  doc.setDrawColor(COMPANY_INFO.colors.secondary);
  doc.setLineWidth(1);
  doc.line(15, 65, pageWidth - 15, 65);

  // --- Invoice & Client Details ---
  doc.setTextColor(COMPANY_INFO.colors.text);
  doc.setFontSize(10);
  
  // Left: Invoice Details
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details:', 15, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice No: INV-${order.id.slice(0, 8).toUpperCase()}`, 15, 82);
  doc.text(`Date: ${format(new Date(order.order_date || new Date()), 'dd MMMM yyyy')}`, 15, 88);
  
  // Right: Bill To
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', pageWidth - 15, 75, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer?.name || 'Guest Customer', pageWidth - 15, 82, { align: 'right' });
  doc.text(order.customer?.address || 'No Address Provided', pageWidth - 15, 88, { align: 'right' });
  if (order.customer?.phone) {
    doc.text(order.customer.phone, pageWidth - 15, 94, { align: 'right' });
  }

  // --- Items Table ---
  const tableColumn = ["Item Description", "Qty", "Unit Price", "Total"];
  const tableRows = order.items?.map(item => [
    item.product?.name ?? 'Unknown Item',
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.total_price)
  ]) || [];

  autoTable(doc, {
    startY: 105,
    head: [tableColumn],
    body: tableRows,
    theme: 'striped',
    headStyles: { 
      fillColor: COMPANY_INFO.colors.primary,
      textColor: '#FFFFFF',
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    },
    styles: { 
      fontSize: 9,
      cellPadding: 4
    },
    alternateRowStyles: {
      fillColor: '#F9FAFB'
    }
  });

  // --- Totals ---
  const finalY = (doc as any).lastAutoTable.finalY || 105;
  const totalsX = pageWidth - 15;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COMPANY_INFO.colors.muted);
  doc.text('Subtotal', totalsX - 40, finalY + 10);
  doc.setTextColor(COMPANY_INFO.colors.text);
  doc.text(formatCurrency(order.total_amount), totalsX, finalY + 10, { align: 'right' });

  doc.setTextColor(COMPANY_INFO.colors.muted);
  doc.text('Tax (0%)', totalsX - 40, finalY + 17);
  doc.setTextColor(COMPANY_INFO.colors.text);
  doc.text(formatCurrency(0), totalsX, finalY + 17, { align: 'right' });

  // Total Box
  doc.setFillColor(COMPANY_INFO.colors.primary);
  doc.rect(totalsX - 60, finalY + 23, 60, 12, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', totalsX - 55, finalY + 31);
  doc.text(formatCurrency(order.total_amount), totalsX - 5, finalY + 31, { align: 'right' });

  // --- Watermark (if unpaid) ---
  if (order.payment_status === 'unpaid') {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
      doc.setTextColor('#EF4444');
      doc.setFontSize(100);
      doc.setFont('helvetica', 'bold');
      doc.text("UNPAID", pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
  }

  // --- Footer ---
  const footerY = pageHeight - 20;
  doc.setDrawColor(COMPANY_INFO.colors.light);
  doc.line(15, footerY, pageWidth - 15, footerY);
  
  doc.setFontSize(8);
  doc.setTextColor(COMPANY_INFO.colors.muted);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for choosing Ternakmart. We appreciate your business!', pageWidth / 2, footerY + 8, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, footerY + 13, { align: 'center' });

  doc.save(`Invoice_${order.id.slice(0, 8).toUpperCase()}.pdf`);
};

export const generatePurchaseOrderPDF = async (po: PurchaseOrder) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // --- Header Background ---
  doc.setFillColor(COMPANY_INFO.colors.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // --- Header Content ---
  try {
    const logoImg = await loadImage('/logo.png');
    doc.addImage(logoImg, 'PNG', 15, 10, 35, 20);
  } catch (e) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor('#FFFFFF');
    doc.text(COMPANY_INFO.name.toUpperCase(), 15, 25);
  }

  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');
  doc.text(COMPANY_INFO.address, pageWidth - 15, 15, { align: 'right' });
  doc.text(COMPANY_INFO.phone, pageWidth - 15, 20, { align: 'right' });
  doc.text(COMPANY_INFO.email, pageWidth - 15, 25, { align: 'right' });

  // --- Document Title ---
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COMPANY_INFO.colors.primary);
  doc.text('PURCHASE ORDER', 15, 60);

  // --- Divider ---
  doc.setDrawColor(COMPANY_INFO.colors.secondary);
  doc.setLineWidth(1);
  doc.line(15, 65, pageWidth - 15, 65);

  // --- PO & Vendor Details ---
  doc.setTextColor(COMPANY_INFO.colors.text);
  doc.setFontSize(10);
  
  // Left: PO Details
  doc.setFont('helvetica', 'bold');
  doc.text('Order Details:', 15, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO Number: PO-${po.id.slice(0, 8).toUpperCase()}`, 15, 82);
  doc.text(`Order Date: ${format(new Date(po.order_date || new Date()), 'dd MMMM yyyy')}`, 15, 88);
  
  // Right: Vendor Info
  doc.setFont('helvetica', 'bold');
  doc.text('Vendor Info:', pageWidth - 15, 75, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(po.supplier?.name || 'Unknown Supplier', pageWidth - 15, 82, { align: 'right' });
  doc.text(po.supplier?.address || 'No Address Provided', pageWidth - 15, 88, { align: 'right' });

  // --- Items Table ---
  const tableColumn = ["Item Description", "Qty", "Unit Cost", "Total"];
  const tableRows = po.items?.map(item => [
    item.product?.name || 'Unknown Item',
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.total_price)
  ]) || [];

  autoTable(doc, {
    startY: 105,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: COMPANY_INFO.colors.primary,
      textColor: '#FFFFFF',
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    },
    styles: { 
      fontSize: 9,
      cellPadding: 4
    }
  });

  // --- Totals ---
  const finalY = (doc as any).lastAutoTable.finalY || 105;
  const totalsX = pageWidth - 15;
  
  doc.setFillColor(COMPANY_INFO.colors.primary);
  doc.rect(totalsX - 60, finalY + 10, 60, 12, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', totalsX - 55, finalY + 18);
  doc.text(formatCurrency(po.total_amount), totalsX - 5, finalY + 18, { align: 'right' });

  // --- Approval Section ---
  const approvalY = finalY + 45;
  doc.setTextColor(COMPANY_INFO.colors.text);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Authorized Approval", 15, approvalY);
  
  doc.setDrawColor(COMPANY_INFO.colors.muted);
  doc.setLineWidth(0.5);
  doc.line(15, approvalY + 25, 75, approvalY + 25); // Signature line
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text("Name & Designation", 15, approvalY + 30);
  doc.text("Date:", 100, approvalY + 25);
  doc.line(110, approvalY + 25, 150, approvalY + 25);

  // --- Footer ---
  const footerY = pageHeight - 20;
  doc.setDrawColor(COMPANY_INFO.colors.light);
  doc.line(15, footerY, pageWidth - 15, footerY);
  doc.setFontSize(8);
  doc.setTextColor(COMPANY_INFO.colors.muted);
  doc.text(`Official Purchase Order - ${COMPANY_INFO.name}`, pageWidth / 2, footerY + 8, { align: 'center' });

  doc.save(`PO_${po.id.slice(0, 8).toUpperCase()}.pdf`);
};
