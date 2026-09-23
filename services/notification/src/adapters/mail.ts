import nodemailer from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class SmtpMailer implements Mailer {
  constructor(
    private readonly transport: nodemailer.Transporter,
    private readonly from: string,
  ) {}

  static fromUrl(smtpUrl: string, from: string): SmtpMailer {
    return new SmtpMailer(nodemailer.createTransport(smtpUrl), from);
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

export class RecordingMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}
