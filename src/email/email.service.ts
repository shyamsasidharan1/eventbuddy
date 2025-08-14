import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as sgMail from '@sendgrid/mail'

interface SendMemberInviteParams {
  to: string
  firstName: string
  token: string
  orgId: number
}

interface SendRegistrationRequestConfirmationParams {
  to: string
  firstName: string
  organizationName: string
  requestId: number
}

interface SendNewRegistrationNotificationParams {
  to: string
  organizationName: string
  applicantName: string
  applicantEmail: string
  requestMessage?: string
  memberId: number
}

interface SendRegistrationApprovalParams {
  to: string
  firstName: string
  organizationName: string
  message?: string
}

interface SendRegistrationDenialParams {
  to: string
  firstName: string
  organizationName: string
  denialReason: string
  message?: string
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY')
    if (apiKey) {
      sgMail.setApiKey(apiKey)
    } else {
      this.logger.warn('SENDGRID_API_KEY not configured - emails will be logged instead of sent')
    }
  }

  /**
   * Send member invitation email
   */
  async sendMemberInvite(params: SendMemberInviteParams): Promise<void> {
    const { to, firstName, token, orgId } = params

    const webOrigin = this.configService.get<string>('WEB_ORIGIN', 'http://localhost:3000')
    const fromEmail = this.configService.get<string>('INVITE_EMAIL_FROM', 'no-reply@eventbuddy.local')
    const acceptUrl = `${webOrigin}/accept-invite?token=${token}`

    const msg = {
      to,
      from: fromEmail,
      subject: 'Welcome to EventBuddy - Complete Your Membership',
      text: this.getInviteTextContent(firstName, acceptUrl),
      html: this.getInviteHtmlContent(firstName, acceptUrl)
    }

    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY')
      
      if (apiKey) {
        await sgMail.send(msg)
        this.logger.log(`Invitation email sent successfully to ${to}`)
      } else {
        // Development mode - log the email instead of sending
        this.logger.log('EMAIL PREVIEW (SendGrid not configured):')
        this.logger.log(`To: ${to}`)
        this.logger.log(`Subject: ${msg.subject}`)
        this.logger.log(`Accept URL: ${acceptUrl}`)
        this.logger.log(`Content: ${msg.text}`)
      }
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${to}:`, error)
      throw error
    }
  }

  private getInviteTextContent(firstName: string, acceptUrl: string): string {
    return `
Hello ${firstName},

You've been invited to join EventBuddy! 

To complete your membership and set up your account, please click the link below:

${acceptUrl}

This invitation will expire in 72 hours.

If you have any questions, please contact your organization administrator.

Welcome aboard!

The EventBuddy Team
    `.trim()
  }

  private getInviteHtmlContent(firstName: string, acceptUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to EventBuddy</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .button { 
      display: inline-block; 
      background-color: #4f46e5; 
      color: white; 
      padding: 12px 24px; 
      text-decoration: none; 
      border-radius: 6px; 
      margin: 20px 0; 
    }
    .footer { 
      background-color: #f8f9fa; 
      padding: 20px; 
      text-align: center; 
      font-size: 12px; 
      color: #666; 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to EventBuddy!</h1>
    </div>
    
    <div class="content">
      <h2>Hello ${firstName},</h2>
      
      <p>You've been invited to join EventBuddy! We're excited to have you as part of our community.</p>
      
      <p>To complete your membership and set up your account, please click the button below:</p>
      
      <div style="text-align: center;">
        <a href="${acceptUrl}" class="button">Complete Your Registration</a>
      </div>
      
      <p><strong>Important:</strong> This invitation will expire in 72 hours.</p>
      
      <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
        ${acceptUrl}
      </p>
      
      <p>If you have any questions, please contact your organization administrator.</p>
      
      <p>Welcome aboard!</p>
      <p><strong>The EventBuddy Team</strong></p>
    </div>
    
    <div class="footer">
      <p>You received this email because you were invited to join EventBuddy.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Send registration request confirmation email to applicant
   */
  async sendRegistrationRequestConfirmation(params: SendRegistrationRequestConfirmationParams): Promise<void> {
    const { to, firstName, organizationName, requestId } = params
    const fromEmail = this.configService.get<string>('INVITE_EMAIL_FROM', 'no-reply@eventbuddy.local')

    const msg = {
      to,
      from: fromEmail,
      subject: `Registration Request Received - ${organizationName}`,
      text: `Hello ${firstName},

Thank you for your interest in joining ${organizationName}!

We have received your membership registration request (ID: ${requestId}) and it is currently under review by our administrators.

You will receive another email once your application has been reviewed. This typically takes 2-3 business days.

If you have any questions, please contact the organization administrators.

Thank you for your patience.

The EventBuddy Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Request Received</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Registration Request Received</h1>
    </div>
    
    <div class="content">
      <h2>Hello ${firstName},</h2>
      
      <p>Thank you for your interest in joining <strong>${organizationName}</strong>!</p>
      
      <p>We have received your membership registration request (ID: <strong>${requestId}</strong>) and it is currently under review by our administrators.</p>
      
      <p>You will receive another email once your application has been reviewed. This typically takes 2-3 business days.</p>
      
      <p>If you have any questions, please contact the organization administrators.</p>
      
      <p>Thank you for your patience.</p>
      <p><strong>The EventBuddy Team</strong></p>
    </div>
    
    <div class="footer">
      <p>You received this email because you submitted a membership registration request.</p>
    </div>
  </div>
</body>
</html>`
    }

    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY')
      
      if (apiKey) {
        await sgMail.send(msg)
        this.logger.log(`Registration confirmation email sent successfully to ${to}`)
      } else {
        this.logger.log('EMAIL PREVIEW (SendGrid not configured):')
        this.logger.log(`To: ${to}`)
        this.logger.log(`Subject: ${msg.subject}`)
        this.logger.log(`Content: ${msg.text}`)
      }
    } catch (error) {
      this.logger.error(`Failed to send registration confirmation email to ${to}:`, error)
      throw error
    }
  }

  /**
   * Send new registration notification to organization admins
   */
  async sendNewRegistrationNotification(params: SendNewRegistrationNotificationParams): Promise<void> {
    const { to, organizationName, applicantName, applicantEmail, requestMessage, memberId } = params
    const fromEmail = this.configService.get<string>('INVITE_EMAIL_FROM', 'no-reply@eventbuddy.local')
    const webOrigin = this.configService.get<string>('WEB_ORIGIN', 'http://localhost:3000')
    const reviewUrl = `${webOrigin}/admin/members/pending`

    const msg = {
      to,
      from: fromEmail,
      subject: `New Membership Registration Request - ${organizationName}`,
      text: `New membership registration request received for ${organizationName}

Applicant Details:
- Name: ${applicantName}
- Email: ${applicantEmail}
- Request ID: ${memberId}
${requestMessage ? `- Message: ${requestMessage}` : ''}

Please review this application in your admin dashboard: ${reviewUrl}

The EventBuddy Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Registration Request</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .button { 
      display: inline-block; 
      background-color: #f59e0b; 
      color: white; 
      padding: 12px 24px; 
      text-decoration: none; 
      border-radius: 6px; 
      margin: 20px 0; 
    }
    .details { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Membership Registration</h1>
    </div>
    
    <div class="content">
      <h2>New registration request received for ${organizationName}</h2>
      
      <div class="details">
        <h3>Applicant Details:</h3>
        <p><strong>Name:</strong> ${applicantName}</p>
        <p><strong>Email:</strong> ${applicantEmail}</p>
        <p><strong>Request ID:</strong> ${memberId}</p>
        ${requestMessage ? `<p><strong>Message:</strong> ${requestMessage}</p>` : ''}
      </div>
      
      <p>Please review this application in your admin dashboard:</p>
      
      <div style="text-align: center;">
        <a href="${reviewUrl}" class="button">Review Application</a>
      </div>
      
      <p><strong>The EventBuddy Team</strong></p>
    </div>
    
    <div class="footer">
      <p>You received this email because you are an administrator for ${organizationName}.</p>
    </div>
  </div>
</body>
</html>`
    }

    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY')
      
      if (apiKey) {
        await sgMail.send(msg)
        this.logger.log(`Admin notification email sent successfully to ${to}`)
      } else {
        this.logger.log('EMAIL PREVIEW (SendGrid not configured):')
        this.logger.log(`To: ${to}`)
        this.logger.log(`Subject: ${msg.subject}`)
        this.logger.log(`Review URL: ${reviewUrl}`)
        this.logger.log(`Content: ${msg.text}`)
      }
    } catch (error) {
      this.logger.error(`Failed to send admin notification email to ${to}:`, error)
      throw error
    }
  }

  /**
   * Send registration approval email to applicant
   */
  async sendRegistrationApproval(params: SendRegistrationApprovalParams): Promise<void> {
    const { to, firstName, organizationName, message } = params
    const fromEmail = this.configService.get<string>('INVITE_EMAIL_FROM', 'no-reply@eventbuddy.local')
    const webOrigin = this.configService.get<string>('WEB_ORIGIN', 'http://localhost:3000')
    const loginUrl = `${webOrigin}/login`

    const msg = {
      to,
      from: fromEmail,
      subject: `Registration Approved - Welcome to ${organizationName}!`,
      text: `Hello ${firstName},

Congratulations! Your membership registration for ${organizationName} has been approved.

${message ? `Message from the administrator: ${message}` : ''}

You can now log in to your account using your email address and the password you provided during registration.

Login here: ${loginUrl}

Welcome to the community!

The EventBuddy Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Approved</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .button { 
      display: inline-block; 
      background-color: #10b981; 
      color: white; 
      padding: 12px 24px; 
      text-decoration: none; 
      border-radius: 6px; 
      margin: 20px 0; 
    }
    .message { background-color: #f0f9ff; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Registration Approved!</h1>
    </div>
    
    <div class="content">
      <h2>Hello ${firstName},</h2>
      
      <p>Congratulations! Your membership registration for <strong>${organizationName}</strong> has been approved.</p>
      
      ${message ? `<div class="message"><strong>Message from the administrator:</strong><br>${message}</div>` : ''}
      
      <p>You can now log in to your account using your email address and the password you provided during registration.</p>
      
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">Log In to Your Account</a>
      </div>
      
      <p>Welcome to the community!</p>
      <p><strong>The EventBuddy Team</strong></p>
    </div>
    
    <div class="footer">
      <p>You received this email because your membership registration was approved.</p>
    </div>
  </div>
</body>
</html>`
    }

    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY')
      
      if (apiKey) {
        await sgMail.send(msg)
        this.logger.log(`Registration approval email sent successfully to ${to}`)
      } else {
        this.logger.log('EMAIL PREVIEW (SendGrid not configured):')
        this.logger.log(`To: ${to}`)
        this.logger.log(`Subject: ${msg.subject}`)
        this.logger.log(`Login URL: ${loginUrl}`)
        this.logger.log(`Content: ${msg.text}`)
      }
    } catch (error) {
      this.logger.error(`Failed to send registration approval email to ${to}:`, error)
      throw error
    }
  }

  /**
   * Send registration denial email to applicant
   */
  async sendRegistrationDenial(params: SendRegistrationDenialParams): Promise<void> {
    const { to, firstName, organizationName, denialReason, message } = params
    const fromEmail = this.configService.get<string>('INVITE_EMAIL_FROM', 'no-reply@eventbuddy.local')

    const msg = {
      to,
      from: fromEmail,
      subject: `Registration Update - ${organizationName}`,
      text: `Hello ${firstName},

Thank you for your interest in joining ${organizationName}.

After careful review, we are unable to approve your membership registration at this time.

Reason: ${denialReason}

${message ? `Additional message from the administrator: ${message}` : ''}

If you have questions about this decision, please contact the organization administrators.

Thank you for your understanding.

The EventBuddy Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Update</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #6b7280; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .reason { background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
    .message { background-color: #f0f9ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Registration Update</h1>
    </div>
    
    <div class="content">
      <h2>Hello ${firstName},</h2>
      
      <p>Thank you for your interest in joining <strong>${organizationName}</strong>.</p>
      
      <p>After careful review, we are unable to approve your membership registration at this time.</p>
      
      <div class="reason">
        <strong>Reason:</strong> ${denialReason}
      </div>
      
      ${message ? `<div class="message"><strong>Additional message from the administrator:</strong><br>${message}</div>` : ''}
      
      <p>If you have questions about this decision, please contact the organization administrators.</p>
      
      <p>Thank you for your understanding.</p>
      <p><strong>The EventBuddy Team</strong></p>
    </div>
    
    <div class="footer">
      <p>You received this email in response to your membership registration request.</p>
    </div>
  </div>
</body>
</html>`
    }

    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY')
      
      if (apiKey) {
        await sgMail.send(msg)
        this.logger.log(`Registration denial email sent successfully to ${to}`)
      } else {
        this.logger.log('EMAIL PREVIEW (SendGrid not configured):')
        this.logger.log(`To: ${to}`)
        this.logger.log(`Subject: ${msg.subject}`)
        this.logger.log(`Content: ${msg.text}`)
      }
    } catch (error) {
      this.logger.error(`Failed to send registration denial email to ${to}:`, error)
      throw error
    }
  }
}