const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendContactEmail = async ({ name, email, subject, message,emailTo }) => {
  try {
    const recipient = emailTo || process.env.EMAIL_USER || 'asarslansaeed1678@gmail.com';
    const response = await resend.emails.send({
      from: 'onboarding@resend.dev', 
      to: recipient,
      replyTo: email,                
      subject: subject || `New Contact Us Message from ${name}`, 
     html: `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 30px; color: #334155;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">New Contact Message</h2>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Online Craft Shopping Support</p>
      </div>

      <!-- Body Content -->
      <div style="padding: 32px 24px;">
        <p style="margin-top: 0; font-size: 16px; color: #1e293b;">You have received a new inquiry from your website contact form:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #64748b; width: 100px;">Name:</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 15px;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #64748b;">Email:</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 15px;"><a href="mailto:${email}" style="color: #4f46e5; text-decoration: none;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #64748b;">Subject:</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 15px;">${subject || 'N/A'}</td>
          </tr>
        </table>

        <!-- Message Box -->
        <div style="margin-top: 20px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Message:</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 0 8px 8px 0; color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">This email was sent automatically from your Online Craft Shopping application.</p>
      </div>

    </div>
  </div>
`,
    });
    console.log('Resend response:', response);
  } catch (error) {
    console.error('Resend API error:', error);
  }
};
module.exports = sendContactEmail;