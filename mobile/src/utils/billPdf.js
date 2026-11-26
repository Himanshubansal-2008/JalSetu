/**
 * billPdf.js
 * Crisp, print-ready HTML-to-PDF generation and native sharing utility for
 * JalKosh water bills and payment receipts using expo-print and expo-sharing.
 *
 * Safe on both Android and iOS WebView print engines (pure inline CSS,
 * no external fonts or remote URLs, offline-ready).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { formatPaiseToRupees } from './currency';
import { useAuthStore } from '../store/authStore';

// Helper to escape HTML characters
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Formats "YYYY-MM" to "Month Year" (e.g., "November 2026")
export function formatMonthName(monthStr) {
  if (!monthStr || typeof monthStr !== 'string' || !monthStr.includes('-')) {
    return monthStr || '';
  }
  const [year, month] = monthStr.split('-');
  const date = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1));
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Formats payment timestamp to display date string (e.g. "26 Nov 2026")
export function formatPaymentDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Generates print-ready HTML string for a JalKosh water bill or receipt.
 */
export function generateBillHtml({ bill, consumer, gp } = {}) {
  if (!bill) return '';

  const authState = useAuthStore.getState();
  const resolvedGp = gp || bill.gp || authState.gp || authState.user?.gp || {};
  const resolvedConsumer = consumer || bill.consumer || {};

  const isPaid = bill.status === 'PAID';
  const documentBanner = isPaid
    ? 'WATER TAX PAYMENT RECEIPT'
    : 'WATER SUPPLY BILL';
  const gpName = resolvedGp.name || 'Gram Panchayat Water Board';
  const gpVillage = resolvedGp.village ? `Village: ${resolvedGp.village}` : '';
  const gpLocation = [gpVillage, resolvedGp.district, resolvedGp.state]
    .filter(Boolean)
    .join(' • ');

  const billIdShort = bill.id ? bill.id.slice(0, 8).toUpperCase() : '00000000';
  const billNumber = bill.billNumber || `BILL-${billIdShort}`;
  const billingMonth = formatMonthName(bill.month);
  const consumerName = resolvedConsumer.name || 'Consumer';
  const houseNumber = resolvedConsumer.houseNumber || '-';
  const phone = resolvedConsumer.phone || '';
  const amountFormatted = formatPaiseToRupees(bill.amountPaise || 0);

  const statusLabel = isPaid ? 'PAID' : 'PENDING';
  const statusBg = isPaid ? '#E8F5E9' : '#FFF4E0';
  const statusFg = isPaid ? '#2E7D32' : '#B26A00';
  const statusBorder = isPaid ? '#2E7D32' : '#B26A00';

  const paidDateFormatted = isPaid ? formatPaymentDate(bill.paidAt) : '';
  const paymentMode = bill.mode || 'Cash';
  const paymentRef = bill.reference ? escapeHtml(bill.reference) : '';

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentBanner)} - ${escapeHtml(billNumber)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      padding: 20px;
      font-size: 13px;
      line-height: 1.5;
    }
    .sheet {
      max-width: 620px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: #0B6BCB;
      color: #ffffff;
      padding: 24px 24px 20px 24px;
      text-align: center;
    }
    .header .doc-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 8px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
      letter-spacing: 0.3px;
    }
    .header .gp-sub {
      font-size: 12px;
      opacity: 0.9;
    }
    .content {
      padding: 24px;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .meta-bar .bill-no {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-bar .month-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .status-pill {
      display: inline-block;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      background-color: ${statusBg};
      color: ${statusFg};
      border: 1.5px solid ${statusBorder};
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 10px;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .table tr {
      border-bottom: 1px solid #f1f5f9;
    }
    .table tr:last-child {
      border-bottom: none;
    }
    .table td {
      padding: 10px 14px;
      font-size: 13px;
    }
    .table .label-col {
      width: 40%;
      color: #64748b;
      font-weight: 500;
      background: #f8fafc;
    }
    .table .value-col {
      width: 60%;
      color: #0f172a;
      font-weight: 600;
    }
    .amount-box {
      background: #f0f7ff;
      border: 1.5px solid #0B6BCB;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .amount-box .amount-label {
      font-size: 13px;
      font-weight: 700;
      color: #0B6BCB;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .amount-box .amount-value {
      font-size: 24px;
      font-weight: 800;
      color: #0B6BCB;
    }
    .payment-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .payment-box .pay-title {
      font-size: 12px;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .payment-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 24px;
    }
    .payment-item {
      font-size: 12px;
    }
    .payment-item .p-label {
      color: #166534;
      font-weight: 500;
    }
    .payment-item .p-val {
      color: #0f172a;
      font-weight: 700;
      margin-left: 4px;
    }
    .footer {
      border-top: 1px dashed #cbd5e1;
      padding-top: 16px;
      margin-top: 10px;
      text-align: center;
      color: #64748b;
      font-size: 11px;
    }
    .footer .appName {
      font-weight: 700;
      color: #0B6BCB;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <!-- Header -->
    <div class="header">
      <div class="doc-badge">${escapeHtml(documentBanner)}</div>
      <h1>${escapeHtml(gpName)}</h1>
      ${gpLocation ? `<div class="gp-sub">${escapeHtml(gpLocation)}</div>` : ''}
    </div>

    <div class="content">
      <!-- Meta & Status Bar -->
      <div class="meta-bar">
        <div>
          <div class="bill-no">${escapeHtml(billNumber)}</div>
          <div class="month-label">Billing Period: <strong>${escapeHtml(billingMonth)}</strong></div>
        </div>
        <div class="status-pill">${statusLabel}</div>
      </div>

      <!-- Consumer & Bill Details -->
      <div class="section-title">Consumer & Supply Details</div>
      <table class="table">
        <tr>
          <td class="label-col">Consumer Name</td>
          <td class="value-col">${escapeHtml(consumerName)}</td>
        </tr>
        <tr>
          <td class="label-col">House Number</td>
          <td class="value-col">${escapeHtml(houseNumber)}</td>
        </tr>
        ${
          phone
            ? `<tr>
          <td class="label-col">Contact Phone</td>
          <td class="value-col">${escapeHtml(phone)}</td>
        </tr>`
            : ''
        }
        <tr>
          <td class="label-col">Billing Month</td>
          <td class="value-col">${escapeHtml(billingMonth)}</td>
        </tr>
        <tr>
          <td class="label-col">Bill Reference ID</td>
          <td class="value-col">${escapeHtml(billNumber)}</td>
        </tr>
      </table>

      <!-- Amount Box -->
      <div class="amount-box">
        <div class="amount-label">${isPaid ? 'Total Amount Paid' : 'Total Amount Due'}</div>
        <div class="amount-value">${amountFormatted}</div>
      </div>

      <!-- Payment Details Section (PAID only) -->
      ${
        isPaid
          ? `
      <div class="payment-box">
        <div class="pay-title">✓ Payment Confirmation Details</div>
        <div class="payment-grid">
          <div class="payment-item">
            <span class="p-label">Paid On:</span>
            <span class="p-val">${escapeHtml(paidDateFormatted || generatedDate)}</span>
          </div>
          <div class="payment-item">
            <span class="p-label">Payment Mode:</span>
            <span class="p-val">${escapeHtml(paymentMode)}</span>
          </div>
          ${
            paymentRef
              ? `<div class="payment-item">
            <span class="p-label">Reference / UTR:</span>
            <span class="p-val">${paymentRef}</span>
          </div>`
              : ''
          }
        </div>
      </div>`
          : ''
      }

      <!-- Footer -->
      <div class="footer">
        <div>Generated via <span class="appName">JalKosh</span> • Gram Panchayat Water Supply O&M</div>
        <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">Printed on ${generatedDate}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates an A4/receipt PDF using expo-print and opens the native WhatsApp-ready share sheet.
 *
 * @param {Object} params
 * @param {Object} params.bill - The bill object ({ id, month, amountPaise, status, paidAt, mode, reference, billNumber })
 * @param {Object} [params.consumer] - Optional consumer metadata ({ name, houseNumber, phone })
 * @param {Object} [params.gp] - Optional GP metadata ({ name, village, district, state })
 * @returns {Promise<{ success: boolean, uri?: string, error?: any }>}
 */
export async function generateAndShareBillPdf({ bill, consumer, gp } = {}) {
  if (!bill) {
    Alert.alert('Error', 'No bill data provided to generate PDF.');
    return { success: false };
  }

  try {
    const isPaid = bill.status === 'PAID';
    const html = generateBillHtml({ bill, consumer, gp });

    // Print to file in application cache
    const { uri } = await Print.printToFileAsync({ html });

    // Check if device supports native sharing
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${isPaid ? 'Receipt' : 'Bill'} PDF`,
        UTI: 'com.adobe.pdf',
      });
      return { success: true, uri };
    } else {
      Alert.alert(
        'Sharing Unavailable',
        `PDF generated at: ${uri}\nSharing is not supported on this platform.`
      );
      return { success: false, uri, reason: 'unsupported' };
    }
  } catch (err) {
    Alert.alert(
      'PDF Generation Failed',
      err?.message || 'Could not generate or share the PDF. Please try again.'
    );
    return { success: false, error: err };
  }
}

export default {
  generateBillHtml,
  generateAndShareBillPdf,
  formatMonthName,
  formatPaymentDate,
};
