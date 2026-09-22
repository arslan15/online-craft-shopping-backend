const nodemailer = require('nodemailer');

const sendContactEmail = async ({ name, email, message }) => {
  // 1. Create the transporter using your SMTP configuration
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, 
    family: 4,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 2. Set up email data options
  const mailOptions = {
    from: `"${name}" <${email}>`, // Sender address
    to: process.env.EMAIL_USER,    // Where you want to receive the contact messages
    subject: `New Contact Us Message from ${name}`,
    text: message,
    html: `
      <h3>New Contact Form Submission</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `,
  };

  // 3. Send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendContactEmail;