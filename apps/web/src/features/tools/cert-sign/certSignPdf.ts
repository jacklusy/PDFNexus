/**
 * Experimental certificate-intent MVP for PDF.
 *
 * Parses a PKCS#12 (.p12/.pfx) with node-forge, draws a visual signature
 * appearance (CN + timestamp), sets experimental Producer/Creator metadata,
 * and attaches the signer certificate PEM as an embedded file.
 *
 * This is NOT full CMS / PKCS#7 byte-range signing. Adobe and other viewers
 * will not treat the result as a validated digital signature.
 * Passwords are never logged (clearPassword pattern).
 */

import forge from 'node-forge';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
} from 'pdf-lib';
import { clearPassword } from '../protect/pdfToolkit';

export const CERT_SIGN_EXPERIMENTAL_NOTICE =
  'Experimental MVP: visual certificate appearance + cert PEM attachment. Full CMS byte-range signing is not implemented yet.';

export interface CertSignOptions {
  pdfBytes: ArrayBuffer;
  p12Bytes: ArrayBuffer;
  password: string;
  /** Page index (0-based). Default 0. */
  pageIndex?: number;
}

export interface CertSignResult {
  bytes: Uint8Array;
  commonName: string;
  signedAtIso: string;
  experimental: true;
}

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return binary;
}

function getCommonName(cert: forge.pki.Certificate): string {
  const attrs = cert.subject.attributes;
  const cn = attrs.find((a) => a.name === 'commonName' || a.shortName === 'CN');
  if (cn?.value) return String(cn.value);
  const org = attrs.find((a) => a.name === 'organizationName' || a.shortName === 'O');
  if (org?.value) return String(org.value);
  return 'Unknown certificate subject';
}

export function parsePkcs12(
  p12Bytes: ArrayBuffer,
  password: string
): { certificate: forge.pki.Certificate; commonName: string; pem: string } {
  let passwordCopy = password;
  try {
    const der = arrayBufferToBinaryString(p12Bytes);
    const asn1 = forge.asn1.fromDer(der);
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, passwordCopy);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/password|mac|integrity|PKCS#12/i.test(msg)) {
        throw new Error('Wrong PKCS#12 password or corrupted certificate file.');
      }
      throw new Error('Could not parse PKCS#12 file. Use a valid .p12 / .pfx.');
    }

    const bags =
      p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ??
      [];
    const certBag = bags.find((b) => b.cert)?.cert;
    if (!certBag) {
      throw new Error('No certificate found inside the PKCS#12 file.');
    }

    const pem = forge.pki.certificateToPem(certBag);
    const commonName = getCommonName(certBag);
    return { certificate: certBag, commonName, pem };
  } finally {
    clearPassword(passwordCopy);
    passwordCopy = '';
  }
}

export async function certSignPdf(
  options: CertSignOptions
): Promise<CertSignResult> {
  let password = options.password;
  try {
    const { commonName, pem } = parsePkcs12(options.p12Bytes, password);
    password = '';

    const signedAt = new Date();
    const signedAtIso = signedAt.toISOString();
    const localStamp = signedAt.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const doc = await PDFDocument.load(options.pdfBytes.slice(0));
    const pages = doc.getPages();
    const pageIndex = Math.min(
      Math.max(0, options.pageIndex ?? 0),
      Math.max(0, pages.length - 1)
    );
    const page = pages[pageIndex];
    const { width } = page.getSize();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const boxW = Math.min(260, width - 48);
    const boxH = 72;
    const margin = 36;
    const x = width - boxW - margin;
    const y = margin;

    page.drawRectangle({
      x,
      y,
      width: boxW,
      height: boxH,
      borderColor: rgb(0.15, 0.25, 0.55),
      borderWidth: 1.5,
      color: rgb(0.96, 0.97, 1),
      opacity: 0.92,
    });

    const pad = 8;
    page.drawText('Digital certificate (experimental)', {
      x: x + pad,
      y: y + boxH - 16,
      size: 8,
      font: fontBold,
      color: rgb(0.15, 0.25, 0.55),
    });
    page.drawText(truncate(commonName, 36), {
      x: x + pad,
      y: y + boxH - 32,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.15),
    });
    page.drawText(localStamp, {
      x: x + pad,
      y: y + boxH - 48,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.3),
    });
    page.drawText('Cryptographically intended — experimental', {
      x: x + pad,
      y: y + 10,
      size: 7,
      font,
      color: rgb(0.45, 0.2, 0.15),
    });

    // Light diagonal watermark label so it cannot be confused with /sign-pdf stamp
    page.drawText('CERT MVP', {
      x: x + boxW - 58,
      y: y + 28,
      size: 8,
      font: fontBold,
      color: rgb(0.7, 0.75, 0.85),
      rotate: degrees(0),
      opacity: 0.7,
    });

    doc.setProducer(
      'PDFNexus experimental cert-sign MVP (not CMS byte-range signed)'
    );
    doc.setCreator('PDFNexus cert-sign (experimental)');
    doc.setModificationDate(signedAt);
    try {
      doc.setKeywords([
        'experimental-crypto-intent',
        `signer-cn:${commonName}`,
        `signed-at:${signedAtIso}`,
      ]);
    } catch {
      // Keywords optional on some pdf-lib builds
    }
    try {
      doc.setAuthor(commonName);
    } catch {
      // optional
    }

    const pemBytes = new TextEncoder().encode(pem);
    await doc.attach(pemBytes, 'signer.pem', {
      mimeType: 'application/x-pem-file',
      description: `Signer certificate PEM for ${commonName} (experimental attachment; not a CMS signature)`,
      creationDate: signedAt,
      modificationDate: signedAt,
    });

    const bytes = await doc.save({ useObjectStreams: false });
    return {
      bytes,
      commonName,
      signedAtIso,
      experimental: true,
    };
  } finally {
    clearPassword(password);
    password = '';
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
