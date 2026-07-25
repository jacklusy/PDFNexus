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

    this.smtpTransporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: this.config.get<number>('SMTP_PORT') ?? 1025,
      secure: Boolean(this.config.get<boolean>('SMTP_SECURE')),
    });
  }

  private get from(): string {
    return (
      this.config.get<string>('MAIL_FROM') ?? 'PDFNexus <noreply@localhost>'
    );
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

  async sendFileEmail(
    email: string,
    filename: string,
    downloadUrl: string,
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `Your PDFNexus file: ${filename}`,
      text: `Your file "${filename}" is ready. Download: ${downloadUrl}`,
      html: `<p>Your file <strong>${filename}</strong> is ready.</p><p><a href="${downloadUrl}">Download file</a></p>`,
    });
  }
}
