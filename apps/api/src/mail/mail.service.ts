import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

/** Brand teal used across PDFNexus UI */
const BRAND = {
  teal: '#0f766e',
  tealDark: '#0d5f59',
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  surface: '#f8fafc',
  white: '#ffffff',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;

  constructor(private readonly config: ConfigService) {
    const provider = this.config.get<string>('MAIL_PROVIDER') ?? 'smtp';
    if (provider === 'resend') {
      const key = this.config.get<string>('RESEND_API_KEY');
      if (key) {
        this.resend = new Resend(key);
      } else {
        this.logger.warn('MAIL_PROVIDER=resend but RESEND_API_KEY missing');
      }
    }

    const user = this.config.get<string>('SMTP_USER')?.trim() || '';
    const pass = this.config.get<string>('SMTP_PASS')?.trim() || '';
    this.smtpTransporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: this.config.get<number>('SMTP_PORT') ?? 1025,
      secure: Boolean(this.config.get<boolean>('SMTP_SECURE')),
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private get from(): string {
    return (
      this.config.get<string>('MAIL_FROM') ?? 'PDFNexus <noreply@localhost>'
    );
  }

  private get appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  async send(options: SendMailOptions): Promise<void> {
    const provider = this.config.get<string>('MAIL_PROVIDER') ?? 'smtp';

    if (provider === 'resend' && this.resend) {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });
      return;
    }

    if (!this.smtpTransporter) {
      throw new Error('SMTP transporter not configured');
    }

    await this.smtpTransporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  }

  async sendOtp(email: string, code: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your PDFNexus verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  }

  /**
   * Professional branded download email — CTA button verifies email (first time)
   * and starts the file download.
   */
  async sendFileEmail(
    email: string,
    filename: string,
    downloadUrl: string,
  ): Promise<void> {
    const safeName = filename.replace(/[<>&"]/g, '');
    const html = this.buildDownloadEmailHtml({
      filename: safeName,
      downloadUrl,
      recipientEmail: email,
    });
    const text = [
      `Your PDFNexus file is ready: ${safeName}`,
      ``,
      `Download (one click — also verifies your email for future free downloads):`,
      downloadUrl,
      ``,
      `This link expires in 24 hours.`,
      `— PDFNexus`,
    ].join('\n');

    await this.send({
      to: email,
      subject: `Your file is ready — ${safeName}`,
      text,
      html,
    });
  }

  private buildDownloadEmailHtml(opts: {
    filename: string;
    downloadUrl: string;
    recipientEmail: string;
  }): string {
    const { filename, downloadUrl, recipientEmail } = opts;
    const logoUrl = `${this.appUrl}/favicon.ico`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your PDFNexus download</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">
          <tr>
            <td style="background:${BRAND.teal};padding:28px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="${logoUrl}" alt="" width="28" height="28" style="display:block;border-radius:6px;background:${BRAND.white};" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.white};">PDFNexus</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 16px;text-align:center;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:${BRAND.ink};letter-spacing:-0.02em;">Your file is ready</h1>
              <p style="margin:0;font-size:14px;line-height:1.55;color:${BRAND.muted};">
                Thanks for using PDFNexus. Downloads are <strong style="color:${BRAND.ink};">free</strong> —
                we only ask you to verify your email once. Future downloads will start instantly.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.muted};">File</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.ink};word-break:break-all;">${filename}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 36px;text-align:center;">
              <a href="${downloadUrl}" style="display:inline-block;background:${BRAND.teal};color:${BRAND.white};font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;box-shadow:0 4px 14px rgba(15,118,110,0.35);">
                Download your file
              </a>
              <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                Sent to ${recipientEmail}. This secure link expires in 24 hours.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND.border};text-align:center;">
              <p style="margin:0;font-size:11px;color:${BRAND.muted};">
                © PDFNexus · Merge &amp; organize PDFs in your browser
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
