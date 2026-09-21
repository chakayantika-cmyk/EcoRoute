import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'arijitp203@gmail.com',
    pass: 'cntc itsp tukm nhsd',
  },
});

export async function sendOtpEmail(to: string, otp: string) {
  const mailOptions = {
    from: '"EcoRoute AI" <arijitp203@gmail.com>',
    to,
    subject: 'Your EcoRoute AI Verification Code',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to EcoRoute AI</h2>
        <p>Your verification code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 4px; color: #15803d; background: #f0fdf4; padding: 16px; text-align: center; border-radius: 8px;">
          ${otp}
        </h1>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
