const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendContactEmail = async ({ name, email, subject, message,emailTo }) => {
  try {
    const recipient = email || process.env.EMAIL_USER;
    console.log("recipent",recipient);
    const response = await resend.emails.send({
      from: 'onboarding@resend.dev', 
      to: emailTo,
      replyTo: emailTo,                
      subject: subject || `New Contact Us Message from ${name}`, 
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });
    console.log('Resend response:', response);
  } catch (error) {
    console.error('Resend API error:', error);
  }
};
module.exports = sendContactEmail;