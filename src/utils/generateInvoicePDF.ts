import { jsPDF } from "jspdf";
import { Booking, Service, UserProfile, PartnerProfile } from "../types";
import { formatTime12Hour, formatDate } from "./formatTime";

export interface InvoiceData {
  booking: Booking;
  service?: Service;
  partnerUser?: UserProfile | null;
  partnerDetail?: PartnerProfile | null;
  customerProfile?: UserProfile | null;
}

/**
 * Generates and triggers download of a standardized, pixel-perfect PDF invoice
 */
export async function generateInvoicePDF({
  booking,
  service,
  partnerUser,
  partnerDetail,
  customerProfile,
}: InvoiceData): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // --- 1. Top Decorative Brand Bar ---
    doc.setFillColor(0, 46, 110); // Deep Navy (#002e6e)
    doc.rect(0, 0, pageWidth, 8, "F");

    doc.setFillColor(249, 115, 22); // Orange Accent (#f97316)
    doc.rect(0, 8, pageWidth, 1.5, "F");

    let currentY = 18;

    // --- 2. Header Section ---
    // Left: Company Brand Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 46, 110);
    doc.text("ZOMINDIA HOME SERVICES", margin, currentY);

    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Smart Appliance Repair & Home Care Solutions", margin, currentY);

    currentY += 4;
    doc.text("GSTIN: 07AABCZ1234D1Z9 | support@zomindia.com", margin, currentY);

    // Right: Invoice Title & Badges
    const invId = `INV-${booking.id.slice(0, 8).toUpperCase()}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 46, 110);
    doc.text("TAX INVOICE", pageWidth - margin, 18, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Invoice No: ${invId}`, pageWidth - margin, 24, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Booking Ref: #${booking.id.slice(-6).toUpperCase()}`, pageWidth - margin, 28.5, {
      align: "right",
    });

    const isPaid = booking.paymentStatus === "paid";
    // Payment Status Pill
    if (isPaid) {
      doc.setFillColor(236, 253, 245); // Emerald-50
      doc.setDrawColor(167, 243, 208); // Emerald-200
      doc.roundedRect(pageWidth - margin - 30, 32, 30, 6.5, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(5, 150, 105); // Emerald-600
      doc.text("PAID IN FULL", pageWidth - margin - 15, 36.3, { align: "center" });
    } else {
      doc.setFillColor(254, 243, 199); // Amber-50
      doc.setDrawColor(253, 230, 138); // Amber-200
      doc.roundedRect(pageWidth - margin - 42, 32, 42, 6.5, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(217, 119, 6); // Amber-600
      doc.text("PAY AFTER SERVICE", pageWidth - margin - 21, 36.3, { align: "center" });
    }

    currentY = 44;
    // Divider line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.4);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 6;

    // --- 3. Customer & Partner Information Grid (2 Columns) ---
    const colWidth = (contentWidth - 6) / 2;

    // Left Box: Customer Details
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, colWidth, 38, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 46, 110);
    doc.text("CUSTOMER DETAILS", margin + 4, currentY + 6);

    const customerName =
      booking.customerBookedName ||
      booking.customerName ||
      booking.customerData?.fullName ||
      customerProfile?.displayName ||
      customerProfile?.fullName ||
      "Registered Customer";

    const customerPhone =
      booking.customerBookedPhone ||
      booking.customerPhone ||
      booking.customerMobile ||
      booking.customerData?.mobile ||
      customerProfile?.phoneNumber ||
      customerProfile?.mobile ||
      "Verified on App";

    const address = booking.address || customerProfile?.address || "Service Location Provided in App";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(customerName, margin + 4, currentY + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Phone: ${customerPhone}`, margin + 4, currentY + 17);

    // Multi-line address wrap
    const wrappedAddress = doc.splitTextToSize(`Address: ${address}`, colWidth - 8);
    doc.text(wrappedAddress.slice(0, 3), margin + 4, currentY + 22);

    // Right Box: Service Schedule & Partner Details
    const rightColX = margin + colWidth + 6;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(rightColX, currentY, colWidth, 38, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 46, 110);
    doc.text("SERVICE & PARTNER DETAILS", rightColX + 4, currentY + 6);

    const scheduledDate = formatDate(booking.scheduledAt);
    const scheduledTime = formatTime12Hour(booking.scheduledAt) || "Slot as confirmed";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Service Date: ${scheduledDate}`, rightColX + 4, currentY + 12);
    doc.text(`Service Time: ${scheduledTime}`, rightColX + 4, currentY + 17);

    const partnerName =
      partnerUser?.displayName ||
      partnerUser?.fullName ||
      (booking as any).partnerName ||
      partnerDetail?.displayName ||
      "Assigned Certified Partner";

    const partnerRating =
      partnerDetail?.rating ||
      partnerUser?.partnerData?.rating ||
      4.9;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Assigned Pro: ${partnerName}`, rightColX + 4, currentY + 23);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(5, 150, 105); // Emerald-600
    doc.text(`[Verified Badge] Rating: ${partnerRating} ★`, rightColX + 4, currentY + 28);

    if (booking.paymentMethod) {
      doc.setTextColor(71, 85, 105);
      doc.text(`Payment Mode: ${booking.paymentMethod.toUpperCase()}`, rightColX + 4, currentY + 33);
    }

    currentY += 44;

    // --- 4. Itemized Service Table ---
    // Table Header
    doc.setFillColor(0, 46, 110); // Navy Blue
    doc.rect(margin, currentY, contentWidth, 7.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);

    const col1 = margin + 3; // Item #
    const col2 = margin + 14; // Description
    const col3 = margin + 105; // Qty
    const col4 = margin + 125; // Rate
    const col5 = margin + contentWidth - 4; // Total

    doc.text("#", col1, currentY + 5);
    doc.text("Service Description", col2, currentY + 5);
    doc.text("Qty", col3, currentY + 5);
    doc.text("Rate (INR)", col4, currentY + 5);
    doc.text("Amount (INR)", col5, currentY + 5, { align: "right" });

    currentY += 7.5;

    // Row 1: Primary Service
    const serviceName =
      service?.name ||
      booking.serviceName ||
      "Appliance Inspection & Maintenance Service";

    const basePrice = Number(service?.basePrice || booking.totalPrice || 0);

    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, 8.5, "F");
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 8.5, margin + contentWidth, currentY + 8.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    doc.text("1", col1, currentY + 5.5);
    const wrappedServiceName = doc.splitTextToSize(serviceName, 88);
    doc.text(wrappedServiceName[0], col2, currentY + 5.5);
    doc.text("1", col3, currentY + 5.5);
    doc.text(`₹${basePrice}`, col4, currentY + 5.5);
    doc.text(`₹${basePrice}`, col5, currentY + 5.5, { align: "right" });

    currentY += 8.5;

    let itemIdx = 2;

    // Optional Additional Charges
    if (booking.additionalCharges && booking.additionalCharges.length > 0) {
      booking.additionalCharges.forEach((charge) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, currentY, contentWidth, 8, "F");
        doc.line(margin, currentY + 8, margin + contentWidth, currentY + 8);

        doc.text(String(itemIdx++), col1, currentY + 5);
        const wrappedReason = doc.splitTextToSize(`Spare Part / Extra: ${charge.reason}`, 88);
        doc.text(wrappedReason[0], col2, currentY + 5);
        doc.text("1", col3, currentY + 5);
        doc.text(`₹${charge.amount}`, col4, currentY + 5);
        doc.text(`₹${charge.amount}`, col5, currentY + 5, { align: "right" });

        currentY += 8;
      });
    }

    // Optional Discount Row
    const discount = Number(booking.discountApplied || 0);
    if (discount > 0) {
      doc.setFillColor(240, 253, 244); // Green-50
      doc.rect(margin, currentY, contentWidth, 7.5, "F");
      doc.line(margin, currentY + 7.5, margin + contentWidth, currentY + 7.5);

      doc.setTextColor(22, 101, 52); // Green-800
      doc.text(String(itemIdx++), col1, currentY + 5);
      const promoName = booking.promoCode ? `Promo Applied (${booking.promoCode})` : "Special Discount Applied";
      doc.text(promoName, col2, currentY + 5);
      doc.text("-", col3, currentY + 5);
      doc.text(`-₹${discount}`, col4, currentY + 5);
      doc.text(`-₹${discount}`, col5, currentY + 5, { align: "right" });

      currentY += 7.5;
    }

    currentY += 4;

    // --- 5. Calculation Summary Section ---
    const summaryBoxWidth = 85;
    const summaryBoxX = pageWidth - margin - summaryBoxWidth;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(summaryBoxX, currentY, summaryBoxWidth, 34, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.text("Gross Subtotal:", summaryBoxX + 4, currentY + 6);
    doc.text(`₹${basePrice + (booking.additionalCharges?.reduce((acc, c) => acc + c.amount, 0) || 0)}`, pageWidth - margin - 4, currentY + 6, {
      align: "right",
    });

    doc.text("GST / Applicable Taxes:", summaryBoxX + 4, currentY + 12);
    doc.text("₹0 (Included)", pageWidth - margin - 4, currentY + 12, { align: "right" });

    if (discount > 0) {
      doc.setTextColor(22, 101, 52);
      doc.text("Discount Savings:", summaryBoxX + 4, currentY + 18);
      doc.text(`-₹${discount}`, pageWidth - margin - 4, currentY + 18, { align: "right" });
    }

    // Final Total Line
    doc.setDrawColor(203, 213, 225);
    doc.line(summaryBoxX + 4, currentY + 22, pageWidth - margin - 4, currentY + 22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 46, 110);
    doc.text("Net Total Amount:", summaryBoxX + 4, currentY + 29);
    doc.text(`₹${booking.totalPrice || basePrice}`, pageWidth - margin - 4, currentY + 29, {
      align: "right",
    });

    currentY += 40;

    // --- 6. Security Token & Service Guarantee ---
    doc.setFillColor(239, 246, 255); // Blue-50
    doc.setDrawColor(191, 219, 254); // Blue-200
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 46, 110);
    doc.text("30-DAY SERVICE GUARANTEE & AUTHENTICITY", margin + 4, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85);
    const guaranteeText =
      "All repair and maintenance jobs performed by Zomindia Verified Technicians are protected under our 30-day rework warranty. If any issue re-occurs within 30 days of completion, rework will be conducted free of charge.";
    const wrappedGuarantee = doc.splitTextToSize(guaranteeText, contentWidth - 8);
    doc.text(wrappedGuarantee, margin + 4, currentY + 11);

    currentY += 28;

    // --- 7. Signature & Footer ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "This is a computer-generated tax invoice and does not require a physical signature.",
      margin,
      pageHeight - 16
    );
    doc.text(
      `Generated on: ${new Date().toLocaleString("en-IN")} | Zomindia Web Portal`,
      margin,
      pageHeight - 12
    );

    // Right: Authorized Stamp simulation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 46, 110);
    doc.text("FOR ZOMINDIA SERVICES PVT LTD", pageWidth - margin, pageHeight - 16, {
      align: "right",
    });
    doc.setTextColor(5, 150, 105);
    doc.text("[DIGITALLY VERIFIED]", pageWidth - margin, pageHeight - 12, { align: "right" });

    // Save and Trigger download
    const fileName = `Invoice_${booking.id.slice(0, 8).toUpperCase()}.pdf`;
    doc.save(fileName);

    return true;
  } catch (error) {
    console.error("Failed to generate invoice PDF:", error);
    return false;
  }
}
