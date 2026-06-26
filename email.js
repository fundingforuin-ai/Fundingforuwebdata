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
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0F172A; margin: 0; padding: 0; }
    .container { max-width: 650px; margin: 0 auto; background-color: #FFFFFF; }
    .header { background-color: #000000; padding: 20px 30px; display: table; width: 100%; box-sizing: border-box; }
    .header-left { display: table-cell; vertical-align: middle; }
    .header-right { display: table-cell; text-align: right; vertical-align: middle; }
    .header h1 { color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 500; letter-spacing: 2px; }
    .header img { height: 60px; width: auto; border-radius: 8px; }
    .hero { background-color: #111111; color: #FFFFFF; text-align: center; position: relative; overflow: hidden; padding: 40px 0 50px 0; }
    .hero-title { font-size: 42px; font-weight: 300; letter-spacing: 6px; margin: 0 0 10px 0; }
    .hero-subtitle { font-size: 32px; font-weight: 800; background-color: #FFFFFF; color: #000000; display: inline-block; padding: 8px 24px; border-radius: 8px; margin-bottom: 20px; }
    .hero-tagline { font-size: 16px; color: #A1A1AA; font-weight: 400; padding: 12px 30px; background-color: rgba(0,0,0,0.5); border-radius: 20px; display: inline-block; }
    .content { padding: 50px 40px; text-align: center; }
    .content h2 { font-size: 28px; font-weight: 800; margin-top: 0; margin-bottom: 25px; color: #000000; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px; text-align: left; }
    .highlight { background-color: #FEF08A; padding: 2px 6px; font-weight: 600; color: #000000; }
    .separator { border-top: 1px solid #E2E8F0; margin: 40px 0; }
    .support-box { background-color: #FEF08A; display: inline-block; padding: 8px 16px; font-weight: 700; font-size: 18px; margin-bottom: 20px; color: #000000; }
    .content-footer { text-align: left; margin-top: 30px; font-size: 15px; color: #334155; }
    .footer { background-color: #000000; padding: 30px; text-align: left; color: #FFFFFF; font-size: 13px; display: table; width: 100%; box-sizing: border-box; }
    .footer-left { display: table-cell; vertical-align: middle; font-weight: bold; font-size: 18px; letter-spacing: 2px; }
    .footer-right { display: table-cell; text-align: right; vertical-align: middle; }
    .footer-right a { color: #FFFFFF; text-decoration: none; margin-left: 15px; font-size: 16px; }
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
            <div class="header-left">
              <h1>FUNDINGS 4U</h1>
            </div>
            <div class="header-right">
              <img src="https://fundings4u.com/email-hero.png" alt="Logo" />
            </div>
          </div>
          
          <div class="hero">
            <div class="hero-title">WELCOME</div>
            <div class="hero-subtitle">FUNDINGS 4U</div>
            <br>
            <div class="hero-tagline">Your Skill, Our Capital</div>
          </div>

          <div class="content">
            <h2>Made By Traders For Traders</h2>
            
            <p>Looking to get funded as a trader? <span class="highlight">Fundings 4U</span> is the best place to start. We offer the best services to traders and aim to build the best community of funded traders. If you have what it takes to be among the best, <span class="highlight">Fundings 4U</span> is the recipe for success.</p>
            
            <p>Over the next few days we'll send you a short series of emails to help you get started. We look forward to helping you close the gap between practice and theory.</p>
            
            <div class="separator"></div>
            
            <div style="text-align: center;">
              <div class="support-box">Fundings 4U</div>
            </div>
            
            <p>If you require additional assistance, our support team is always available to help at <a href="mailto:support@fundings4u.com" style="color: #000000; font-weight: 500;">support@fundings4u.com</a> or through the support page on the website.</p>
            
            <div class="content-footer">
              Kind regards,<br>
              <span class="highlight">Fundings 4U</span> Team
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-left">FUNDINGS 4U</div>
            <div class="footer-right">
              <a href="#">Discord</a>
              <a href="#">Insta</a>
              <a href="#">YT</a>
              <a href="#">X</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    return sendEmail(to, 'Welcome to Fundings 4U! 🚀', html);
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
