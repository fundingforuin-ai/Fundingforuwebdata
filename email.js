const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Fundings4U <support@fundings4u.com>';

const sendEmail = async (to, subject, htmlContent) => {
  if (!process.env.RESEND_API_KEY) {
    console.log('\n--- EMAIL SIMULATION ---');
    console.log(`To: ${to}\nSubject: ${subject}\n`);
    console.log('HTML Body (Preview):', htmlContent.substring(0, 150) + '...\n------------------------\n');
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlContent
    });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
};

const getBaseStyles = () => `
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0E14; color: #E2E8F0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background-color: #121822; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #6366F1 0%, #3B82F6 100%); padding: 30px; text-align: center; }
    .header h1 { color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 40px; }
    .content p { font-size: 16px; line-height: 1.6; color: #CBD5E1; margin-bottom: 20px; }
    .content strong { color: #F8FAFC; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #3B82F6 100%); color: #FFFFFF !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-top: 10px; margin-bottom: 20px; text-align: center; }
    .footer { background-color: #0B0E14; padding: 20px; text-align: center; font-size: 13px; color: #64748B; border-top: 1px solid #1E293B; }
    .footer a { color: #3B82F6; text-decoration: none; }
    .credentials-box { background-color: #0F131A; border: 1px solid #3B82F6; border-radius: 8px; padding: 20px; margin: 25px 0; }
    .credentials-box p { margin: 10px 0; font-family: monospace; font-size: 15px; color: #94A3B8; }
    .credentials-box span { color: #6366F1; font-weight: 700; }
    .alert-box { background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin: 25px 0; }
    .alert-box h3 { color: #EF4444; margin-top: 0; }
    .alert-box p { color: #FCA5A5; margin-bottom: 0; }
  </style>
`;

module.exports = {
  sendWelcomeEmail: async (to, name) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        ${getBaseStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Fundings4U 🚀</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Welcome to the elite club! Your account at Fundings4U has been successfully created. We provide the capital, you provide the skill.</p>
            <p>You can now access your dashboard to purchase challenges, track your progress, and manage your payouts.</p>
            <center>
              <a href="https://fundings4u.com/login" class="btn">Go to Dashboard</a>
            </center>
            <p>If you have any questions or need assistance, our support team is always here to help.</p>
            <p>Best Regards,<br><strong>The Fundings4U Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Fundings4U. All rights reserved.<br>
            <a href="https://fundings4u.com/help-center">Help Center</a> | <a href="https://fundings4u.com/trading-rules">Trading Rules</a>
          </div>
        </div>
      </body>
      </html>
    `;
    return sendEmail(to, 'Welcome to Fundings4U! 🚀', html);
  },

  sendAccountProvisionedEmail: async (to, name, planType, accountSize, mt5Login, mt5Password, mt5Server) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        ${getBaseStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Account is Ready ⚡️</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Great news! Your <strong>${accountSize} ${planType}</strong> trading account has been fully provisioned and is ready to trade.</p>
            <p>Here are your MetaTrader 5 credentials. Please keep these secure:</p>
            
            <div class="credentials-box">
              <p>Platform: <span>MetaTrader 5</span></p>
              <p>Login: <span>${mt5Login}</span></p>
              <p>Password: <span>${mt5Password}</span></p>
              <p>Server: <span>${mt5Server}</span></p>
            </div>
            
            <p>You can track all your live metrics, trades, and drawdown limits directly from your dashboard.</p>
            <center>
              <a href="https://fundings4u.com/dashboard" class="btn">View Dashboard</a>
            </center>
            <p>Good luck with your trading!</p>
            <p>Best Regards,<br><strong>The Fundings4U Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Fundings4U. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
    return sendEmail(to, `Your ${accountSize} MT5 Account is Ready! ⚡️`, html);
  },

  sendViolationEmail: async (to, name, accountSize, reason) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        ${getBaseStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #EF4444 0%, #B91C1C 100%);">
            <h1>Rule Violation Alert ⚠️</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We are writing to inform you that your <strong>${accountSize}</strong> account has breached our risk management parameters and has been suspended.</p>
            
            <div class="alert-box">
              <h3>Reason for Violation</h3>
              <p>${reason}</p>
            </div>
            
            <p>We know this is disappointing, but risk management is the core of our business model. You can view the full details of the violation in your dashboard.</p>
            <center>
              <a href="https://fundings4u.com/dashboard" class="btn" style="background: #1E293B;">View Dashboard</a>
            </center>
            <p>If you believe this was an error, please reach out to our support team.</p>
            <p>Best Regards,<br><strong>The Fundings4U Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Fundings4U. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
    return sendEmail(to, `Rule Violation Alert: ${accountSize} Account Suspended ⚠️`, html);
  }
};
