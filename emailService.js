const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // or 587
  secure: true, // true for port 465, false for port 587
  auth: {
    user: "satyadattakallepalli@gmail.com",
    pass: "imuiczvgfbbrmojp",
  },
  tls: {
    rejectUnauthorized: false, // Bypass certificate validation (NOT recommended for production)
  },
});

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const info = await transporter.sendMail({
      from: '"Satya Datta" <satyadattakallepalli@gmail.com>', 
      to, // Recipient email
      subject, // Email subject
      html: htmlContent, // Email content
    });

    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

module.exports = sendEmail;