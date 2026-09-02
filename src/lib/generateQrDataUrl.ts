import QRCode from 'qrcode';

/** Renders a QR code as a data: URL PNG — used on printed slips/labels so a
 * patient wristband, specimen label, or ID card can be scanned instead of
 * manually typed back in (registration desk, lab sample intake, attendance). */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 180 });
}
