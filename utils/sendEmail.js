import nodemailer from "nodemailer";

const sendEmail = async (to, subject, message) => {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // smtp.gmail.com
      port: process.env.SMTP_PORT, // 587 for TLS, 465 for SSL
      secure: false, // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER, // email address
        pass: process.env.SMTP_PASS, // email password or app password
      },
    });

    // Email options
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text: message,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log(` Email sent to ${to}`);
  } catch (error) {
    console.error(" Email sending error:", error);
    throw new Error("Email could not be sent");
  }
};

export default sendEmail;
