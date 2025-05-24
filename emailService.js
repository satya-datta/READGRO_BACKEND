const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // or 587
  secure: true, // true for port 465, false for port 587
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail ID
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Bypass certificate validation (NOT recommended for production)
  },
});

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const info = await transporter.sendMail({
      from: '"Read Gro" <readgroofficial@gmail.com>',
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
// Function to generate OTP

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
};

// Function to send OTP email

const sendOTP = async (toEmail) => {
  const otp = generateOTP(); // Generate OTP
  const subject = "Your OTP Code";
  const htmlContent = `<p>Your OTP code is: <strong>${otp}</strong></p>`;

  try {
    const info = await transporter.sendMail({
      from: '"ReadGro" <readgroofficial@gmail.com>',
      to: toEmail,
      subject,
      html: htmlContent,
    });

    console.log("OTP sent successfully:", info.messageId);
    return otp; // Return OTP for verification
  } catch (error) {
    console.error("Error sending OTP:", error);
    return null;
  }
};
module.exports = {
  sendEmail,
  sendOTP,
};
