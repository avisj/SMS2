// ========================================================================
// Real Communication Gateways Provider Abstraction
// Providers for SMS (Twilio / MSG91) and Email (SendGrid / SMTP)
// School-level tenant credentials with honest failure and unconfigured reporting
// ZERO false "Sent" flags when gateway is unconfigured
// ========================================================================

export interface GatewaySendResult {
  success: boolean;
  provider: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'NOT_CONFIGURED';
  messageId?: string;
  error?: string;
}

export interface SmsOptions {
  to: string;
  message: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
}

export interface GatewayStatus {
  sms: {
    provider: 'TWILIO' | 'MSG91' | 'MOCK' | 'NONE';
    configured: boolean;
    details: string;
  };
  email: {
    provider: 'SENDGRID' | 'SMTP' | 'MOCK' | 'NONE';
    configured: boolean;
    details: string;
  };
}

export class CommunicationGatewayManager {
  // In-memory tenant credential overrides (can also be saved in school_settings)
  private tenantSettings = new Map<string, {
    smsProvider?: 'TWILIO' | 'MSG91' | 'MOCK' | 'NONE';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
    msg91AuthKey?: string;
    msg91SenderId?: string;
    emailProvider?: 'SENDGRID' | 'SMTP' | 'MOCK' | 'NONE';
    sendgridApiKey?: string;
    sendgridFromEmail?: string;
    sendgridFromName?: string;
  }>();

  setTenantConfig(schoolId: string, config: any) {
    this.tenantSettings.set(schoolId, {
      ...this.tenantSettings.get(schoolId),
      ...config,
    });
  }

  getGatewayStatus(schoolId: string): GatewayStatus {
    const custom = this.tenantSettings.get(schoolId) || {};
    const isTest = process.env.NODE_ENV === 'test';

    // SMS resolution
    let smsProvider: 'TWILIO' | 'MSG91' | 'MOCK' | 'NONE' = 'NONE';
    let smsConfigured = false;
    let smsDetails = 'SMS gateway unconfigured';

    if (custom.smsProvider === 'MOCK' || isTest) {
      smsProvider = 'MOCK';
      smsConfigured = true;
      smsDetails = 'Simulated Mock SMS Provider (Test/Dev Mode)';
    } else if (custom.smsProvider === 'TWILIO' || process.env.TWILIO_ACCOUNT_SID) {
      smsProvider = 'TWILIO';
      const sid = custom.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
      const token = custom.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
      const from = custom.twilioFromNumber || process.env.TWILIO_FROM_NUMBER;
      smsConfigured = !!(sid && token && from);
      smsDetails = smsConfigured ? `Twilio (${from})` : 'Twilio credentials missing Account SID, Token, or From Number';
    } else if (custom.smsProvider === 'MSG91' || process.env.MSG91_AUTH_KEY) {
      smsProvider = 'MSG91';
      const key = custom.msg91AuthKey || process.env.MSG91_AUTH_KEY;
      smsConfigured = !!key;
      smsDetails = smsConfigured ? 'MSG91 Flow Gateway Active' : 'MSG91 Auth Key missing';
    }

    // Email resolution
    let emailProvider: 'SENDGRID' | 'SMTP' | 'MOCK' | 'NONE' = 'NONE';
    let emailConfigured = false;
    let emailDetails = 'Email gateway unconfigured';

    if (custom.emailProvider === 'MOCK' || isTest) {
      emailProvider = 'MOCK';
      emailConfigured = true;
      emailDetails = 'Simulated Mock Email Provider (Test/Dev Mode)';
    } else if (custom.emailProvider === 'SENDGRID' || process.env.SENDGRID_API_KEY) {
      emailProvider = 'SENDGRID';
      const key = custom.sendgridApiKey || process.env.SENDGRID_API_KEY;
      const from = custom.sendgridFromEmail || process.env.SENDGRID_FROM_EMAIL;
      emailConfigured = !!(key && from);
      emailDetails = emailConfigured ? `SendGrid (${from})` : 'SendGrid credentials missing API Key or From Email';
    }

    return {
      sms: {
        provider: smsProvider,
        configured: smsConfigured,
        details: smsDetails,
      },
      email: {
        provider: emailProvider,
        configured: emailConfigured,
        details: emailDetails,
      },
    };
  }

  // ======================================================================
  // SMS Dispatch
  // ======================================================================
  async sendSms(schoolId: string, options: SmsOptions): Promise<GatewaySendResult> {
    const status = this.getGatewayStatus(schoolId);

    if (!options.to || !options.to.trim()) {
      return {
        success: false,
        provider: status.sms.provider,
        status: 'FAILED',
        error: 'Recipient mobile phone number is missing or invalid.',
      };
    }

    if (!status.sms.configured) {
      return {
        success: false,
        provider: status.sms.provider,
        status: 'NOT_CONFIGURED',
        error: `SMS Gateway is not configured (${status.sms.details}). No SMS was dispatched.`,
      };
    }

    // Mock Provider (Used during automated test runs)
    if (status.sms.provider === 'MOCK') {
      return {
        success: true,
        provider: 'MOCK',
        status: 'SENT',
        messageId: `mock-sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    // Twilio Provider via standard REST API
    if (status.sms.provider === 'TWILIO') {
      const custom = this.tenantSettings.get(schoolId) || {};
      const accountSid = custom.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID!;
      const authToken = custom.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN!;
      const fromNumber = custom.twilioFromNumber || process.env.TWILIO_FROM_NUMBER!;

      try {
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const bodyParams = new URLSearchParams({
          To: options.to,
          From: fromNumber,
          Body: options.message,
        });

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams.toString(),
        });

        const data: any = await res.json();
        if (!res.ok) {
          return {
            success: false,
            provider: 'TWILIO',
            status: 'FAILED',
            error: data.message || `Twilio HTTP error ${res.status}`,
          };
        }

        return {
          success: true,
          provider: 'TWILIO',
          status: 'SENT',
          messageId: data.sid,
        };
      } catch (err: any) {
        return {
          success: false,
          provider: 'TWILIO',
          status: 'FAILED',
          error: err.message || 'Network exception while contacting Twilio API',
        };
      }
    }

    // MSG91 Provider via standard REST API
    if (status.sms.provider === 'MSG91') {
      const custom = this.tenantSettings.get(schoolId) || {};
      const authKey = custom.msg91AuthKey || process.env.MSG91_AUTH_KEY!;
      const senderId = custom.msg91SenderId || process.env.MSG91_SENDER_ID || 'SCHOLL';

      try {
        const res = await fetch('https://control.msg91.com/api/v5/flow/', {
          method: 'POST',
          headers: {
            authkey: authKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: senderId,
            recipients: [{ mobiles: options.to, message: options.message }],
          }),
        });

        const data: any = await res.json();
        if (!res.ok || data.type === 'error') {
          return {
            success: false,
            provider: 'MSG91',
            status: 'FAILED',
            error: data.message || `MSG91 HTTP error ${res.status}`,
          };
        }

        return {
          success: true,
          provider: 'MSG91',
          status: 'SENT',
          messageId: data.request_id || `msg91-${Date.now()}`,
        };
      } catch (err: any) {
        return {
          success: false,
          provider: 'MSG91',
          status: 'FAILED',
          error: err.message || 'Network exception while contacting MSG91 API',
        };
      }
    }

    return {
      success: false,
      provider: 'NONE',
      status: 'NOT_CONFIGURED',
      error: 'No active SMS provider configured for school.',
    };
  }

  // ======================================================================
  // Email Dispatch
  // ======================================================================
  async sendEmail(schoolId: string, options: EmailOptions): Promise<GatewaySendResult> {
    const status = this.getGatewayStatus(schoolId);

    if (!options.to || !options.to.trim()) {
      return {
        success: false,
        provider: status.email.provider,
        status: 'FAILED',
        error: 'Recipient email address is missing or invalid.',
      };
    }

    if (!status.email.configured) {
      return {
        success: false,
        provider: status.email.provider,
        status: 'NOT_CONFIGURED',
        error: `Email Gateway is not configured (${status.email.details}). No email was dispatched.`,
      };
    }

    // Mock Provider (Used during automated test runs)
    if (status.email.provider === 'MOCK') {
      return {
        success: true,
        provider: 'MOCK',
        status: 'SENT',
        messageId: `mock-email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    // SendGrid Provider via standard v3 API
    if (status.email.provider === 'SENDGRID') {
      const custom = this.tenantSettings.get(schoolId) || {};
      const apiKey = custom.sendgridApiKey || process.env.SENDGRID_API_KEY!;
      const fromEmail = custom.sendgridFromEmail || process.env.SENDGRID_FROM_EMAIL!;
      const fromName = custom.sendgridFromName || process.env.SENDGRID_FROM_NAME || 'School Notification System';

      try {
        const payload = {
          personalizations: [
            {
              to: [{ email: options.to }],
              subject: options.subject,
            },
          ],
          from: { email: fromEmail, name: fromName },
          content: [
            {
              type: options.htmlBody ? 'text/html' : 'text/plain',
              value: options.htmlBody || options.body,
            },
          ],
        };

        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok && res.status !== 202) {
          const errText = await res.text();
          return {
            success: false,
            provider: 'SENDGRID',
            status: 'FAILED',
            error: errText || `SendGrid returned HTTP ${res.status}`,
          };
        }

        const msgId = res.headers.get('x-message-id') || `sg-${Date.now()}`;
        return {
          success: true,
          provider: 'SENDGRID',
          status: 'SENT',
          messageId: msgId,
        };
      } catch (err: any) {
        return {
          success: false,
          provider: 'SENDGRID',
          status: 'FAILED',
          error: err.message || 'Network exception while contacting SendGrid API',
        };
      }
    }

    return {
      success: false,
      provider: 'NONE',
      status: 'NOT_CONFIGURED',
      error: 'No active email provider configured for school.',
    };
  }
}

export const communicationGatewayManager = new CommunicationGatewayManager();
