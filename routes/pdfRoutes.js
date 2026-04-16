import express from "express";
import puppeteer from "puppeteer";
import DC from "../models/DeliveryChallan.js";
import dotenv from "dotenv";
import path from "path";
import os from "os";

dotenv.config();

const router = express.Router();

// Function to get Chrome executable path
function getChromeExecutablePath() {
  const username = os.userInfo().username;
  const chromePathWindows = `C:\\Users\\${username}\\.cache\\puppeteer\\chrome\\win64-127.0.6533.88\\chrome-win64\\chrome.exe`;
  return chromePathWindows;
}

router.get("/:id", async (req, res) => {
  try {
    const dc = await DC.findById(req.params.id);
    if (!dc) return res.status(404).json({ error: "DC not found" });

    const company = {
      name: process.env.COMPANY_NAME || "Your Company Name",
      address: process.env.COMPANY_ADDRESS || "Your Address",
      phone: process.env.COMPANY_PHONE || "",
      email: process.env.COMPANY_EMAIL || "",
      gst: process.env.COMPANY_GST || "",
    };

    const formattedDate = new Date(dc.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const itemRows = dc.items
      .map(
        (item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>
            <strong>${item.name}</strong>
            ${item.description ? `<br><small style="color:#888">${item.description}</small>` : ""}
          </td>
          <td>${item.unit || "Nos"}</td>
          <td style="text-align:center">${item.qty}</td>
          ${item.rate ? `<td style="text-align:right">PKR ${Number(item.rate).toFixed(2)}</td>
          <td style="text-align:right">PKR ${(item.qty * item.rate).toFixed(2)}</td>` : `<td></td><td></td>`}
        </tr>`
      )
      .join("");

    const totalQty = dc.items.reduce((sum, i) => sum + i.qty, 0);
    const totalAmount = dc.items.reduce((sum, i) => sum + (i.qty * (i.rate || 0)), 0);

    const statusColor = {
      delivered: "#16a34a",
      invoice: "#d97706",
      cancelled: "#dc2626",
    }[dc.status] || "#888";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }
    .page { padding: 30px; max-width: 794px; margin: 0 auto; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a2e; padding-bottom: 18px; margin-bottom: 20px; }
    .company-name { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
    .company-details { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.6; }
    .dc-title { text-align: right; }
    .dc-title h1 { font-size: 26px; font-weight: 900; color: #1a1a2e; letter-spacing: 2px; text-transform: uppercase; }
    .dc-number { font-size: 15px; font-weight: 700; color: #2563eb; margin-top: 4px; }
    .dc-date { font-size: 11px; color: #666; margin-top: 2px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: white; background: ${statusColor}; margin-top: 6px; }

    /* Info boxes */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-box { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .info-box h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; font-weight: 600; }
    .info-box .value { font-size: 13px; font-weight: 700; color: #1a1a2e; }
    .info-box .sub { font-size: 11px; color: #555; margin-top: 3px; line-height: 1.5; }

    /* Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #1a1a2e; color: white; }
    thead th { padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    tbody tr { border-bottom: 1px solid #e2e8f0; }
    tbody tr:nth-child(even) { background: #f8faff; }
    tbody td { padding: 10px 12px; vertical-align: top; }
    tfoot tr { background: #f1f5f9; font-weight: 700; }
    tfoot td { padding: 10px 12px; border-top: 2px solid #1a1a2e; }

    /* Notes & Footer */
    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
    .notes-box h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin-bottom: 6px; }
    .notes-box p { font-size: 11px; color: #78350f; }

    .signature-row { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc; }
    .sig-box { text-align: center; width: 160px; }
    .sig-line { border-top: 1px solid #1a1a2e; margin-top: 40px; margin-bottom: 6px; }
    .sig-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px; }

    .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #aaa; }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="company-name">${company.name}</div>
      <div class="company-details">
        ${company.address}<br>
        ${company.phone ? `📞 ${company.phone}` : ""}
        ${company.email ? ` &nbsp;|&nbsp; ✉ ${company.email}` : ""}<br>
        ${company.gst ? `GST: ${company.gst}` : ""}
      </div>
    </div>
    <div class="dc-title">
      <h1>Delivery Challan</h1>
      <div class="dc-number">${dc.dcNumber}</div>
      <div class="dc-date">Date: ${formattedDate}</div>
      <div><span class="status-badge">${dc.status}</span></div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Bill To</h3>
      <div class="value">${dc.customerName}</div>
      <div class="sub">
        ${dc.customerPhone ? `📞 ${dc.customerPhone}` : ""}
        ${dc.customerAddress ? `<br>${dc.customerAddress}` : ""}
      </div>
    </div>
    <div class="info-box">
      <h3>Delivery Details</h3>
      ${dc.deliveryDate ? `<div class="sub">Delivery Date: <strong>${new Date(dc.deliveryDate).toLocaleDateString("en-IN")}</strong></div>` : ""}
      ${dc.vehicleNumber ? `<div class="sub">Vehicle No: <strong>${dc.vehicleNumber}</strong></div>` : ""}
      ${dc.driverName ? `<div class="sub">Driver: <strong>${dc.driverName}</strong></div>` : ""}
      ${!dc.deliveryDate && !dc.vehicleNumber && !dc.driverName ? '<div class="sub" style="color:#aaa">No additional details</div>' : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Item / Description</th>
        <th style="width:60px">Unit</th>
        <th style="width:60px;text-align:center">Qty</th>
        <th style="width:80px;text-align:right">Rate</th>
        <th style="width:90px;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right;font-size:11px;color:#555">Total</td>
        <td style="text-align:center">${totalQty}</td>
        <td></td>
        <td style="text-align:right">${totalAmount > 0 ? `PKR ${totalAmount.toFixed(2)}` : "—"}</td>
      </tr>
    </tfoot>
  </table>

  ${dc.notes ? `
  <div class="notes-box">
    <h3>Notes / Instructions</h3>
    <p>${dc.notes}</p>
  </div>` : ""}

  <div class="signature-row">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Prepared By</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signatory</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Receiver's Signature</div>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated delivery challan. &nbsp;|&nbsp; Generated on ${new Date().toLocaleString("en-IN")}
  </div>
</div>
</body>
</html>`;

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: getChromeExecutablePath(),
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      });
    } catch (err) {
      console.error("Puppeteer launch error:", err);
      return res.status(500).json({ error: "PDF generation service unavailable: " + err.message });
    }
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10px", bottom: "10px" } });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=${dc.dcNumber}.pdf`,
    });
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DC Print (without pricing)
router.get("/dc/:id", async (req, res) => {
  try {
    const dc = await DC.findById(req.params.id);
    if (!dc) return res.status(404).json({ error: "DC not found" });

    const company = {
      name: process.env.COMPANY_NAME || "Your Company Name",
      address: process.env.COMPANY_ADDRESS || "Your Address",
      phone: process.env.COMPANY_PHONE || "",
      email: process.env.COMPANY_EMAIL || "",
      gst: process.env.COMPANY_GST || "",
    };

    const formattedDate = new Date(dc.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const itemRows = dc.items
      .map(
        (item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>
            <strong>${item.name}</strong>
            ${item.description ? `<br><small style="color:#888">${item.description}</small>` : ""}
          </td>
          <td>${item.unit || "Nos"}</td>
          <td style="text-align:center">${item.qty}</td>
        </tr>`
      )
      .join("");

    const totalQty = dc.items.reduce((sum, i) => sum + i.qty, 0);

    const statusColor = {
      delivered: "#16a34a",
      invoice: "#d97706",
      cancelled: "#dc2626",
    }[dc.status] || "#888";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }
    .page { padding: 30px; max-width: 794px; margin: 0 auto; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a2e; padding-bottom: 18px; margin-bottom: 20px; }
    .company-name { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
    .company-details { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.6; }
    .dc-title { text-align: right; }
    .dc-title h1 { font-size: 26px; font-weight: 900; color: #1a1a2e; letter-spacing: 2px; text-transform: uppercase; }
    .dc-number { font-size: 15px; font-weight: 700; color: #2563eb; margin-top: 4px; }
    .dc-date { font-size: 11px; color: #666; margin-top: 2px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: white; background: ${statusColor}; margin-top: 6px; }

    /* Info boxes */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-box { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .info-box h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; font-weight: 600; }
    .info-box .value { font-size: 13px; font-weight: 700; color: #1a1a2e; }
    .info-box .sub { font-size: 11px; color: #555; margin-top: 3px; line-height: 1.5; }

    /* Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #1a1a2e; color: white; }
    thead th { padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    tbody tr { border-bottom: 1px solid #e2e8f0; }
    tbody tr:nth-child(even) { background: #f8faff; }
    tbody td { padding: 10px 12px; vertical-align: top; }
    tfoot tr { background: #f1f5f9; font-weight: 700; }
    tfoot td { padding: 10px 12px; border-top: 2px solid #1a1a2e; }

    /* Notes & Footer */
    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
    .notes-box h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin-bottom: 6px; }
    .notes-box p { font-size: 11px; color: #78350f; }

    .signature-row { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc; }
    .sig-box { text-align: center; width: 160px; }
    .sig-line { border-top: 1px solid #1a1a2e; margin-top: 40px; margin-bottom: 6px; }
    .sig-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px; }

    .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #aaa; }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="company-name">${company.name}</div>
      <div class="company-details">
        ${company.address}<br>
        ${company.phone ? `📞 ${company.phone}` : ""}
        ${company.email ? ` &nbsp;|&nbsp; ✉ ${company.email}` : ""}<br>
        ${company.gst ? `GST: ${company.gst}` : ""}
      </div>
    </div>
    <div class="dc-title">
      <h1>Delivery Challan</h1>
      <div class="dc-number">${dc.dcNumber}</div>
      <div class="dc-date">Date: ${formattedDate}</div>
      <div><span class="status-badge">${dc.status}</span></div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Bill To</h3>
      <div class="value">${dc.customerName}</div>
      <div class="sub">
        ${dc.customerPhone ? `📞 ${dc.customerPhone}` : ""}
        ${dc.customerAddress ? `<br>${dc.customerAddress}` : ""}
      </div>
    </div>
    <div class="info-box">
      <h3>Delivery Details</h3>
      ${dc.deliveryDate ? `<div class="sub">Delivery Date: <strong>${new Date(dc.deliveryDate).toLocaleDateString("en-IN")}</strong></div>` : ""}
      ${dc.vehicleNumber ? `<div class="sub">Vehicle No: <strong>${dc.vehicleNumber}</strong></div>` : ""}
      ${dc.driverName ? `<div class="sub">Driver: <strong>${dc.driverName}</strong></div>` : ""}
      ${!dc.deliveryDate && !dc.vehicleNumber && !dc.driverName ? '<div class="sub" style="color:#aaa">No additional details</div>' : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Item / Description</th>
        <th style="width:60px">Unit</th>
        <th style="width:60px;text-align:center">Qty</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right;font-size:11px;color:#555">Total</td>
        <td style="text-align:center">${totalQty}</td>
      </tr>
    </tfoot>
  </table>

  ${dc.notes ? `
  <div class="notes-box">
    <h3>Notes / Instructions</h3>
    <p>${dc.notes}</p>
  </div>` : ""}

  <div class="signature-row">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Prepared By</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signatory</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Receiver's Signature</div>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated delivery challan. &nbsp;|&nbsp; Generated on ${new Date().toLocaleString("en-IN")}
  </div>
</div>
</body>
</html>`;

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: getChromeExecutablePath(),
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      });
    } catch (err) {
      console.error("Puppeteer launch error:", err);
      return res.status(500).json({ error: "PDF generation service unavailable: " + err.message });
    }
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10px", bottom: "10px" } });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=${dc.dcNumber}-DC.pdf`,
    });
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
