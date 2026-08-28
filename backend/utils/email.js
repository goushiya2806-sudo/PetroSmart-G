import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Error:", error);
  } else {
    console.log("SMTP server is ready.");
  }
});

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpEmailTemplate(name, otp, type) {
  const subtitle = type === 'password_reset'
    ? 'We received a request to reset your password. Please use the verification code below to reset your password:'
    : 'Thank you for registering with PetroSmart. Please use the verification code below to complete your registration:';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 20px;text-align:center;border-bottom:1px solid #f0f0f0;">
              <h2 style="margin:0;color:#1a73e8;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                PetroSmart
              </h2>
              <p style="margin:6px 0 0;color:#888888;font-size:13px;">
                Accounts Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#333333;font-size:15px;font-weight:600;">
                Hello ${name},
              </p>
              <p style="margin:0 0 28px;color:#555555;font-size:14px;line-height:1.7;">
                ${subtitle}
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f5f5f5;border-radius:8px;padding:28px 20px;text-align:center;">
                    <span style="font-size:42px;font-weight:800;letter-spacing:12px;
                                 color:#1a73e8;font-family:'Courier New',Courier,monospace;">
                      ${otp}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Notices -->
              <p style="margin:24px 0 6px;color:#555555;font-size:13px;line-height:1.8;">
                ⏱️ This code expires in <strong>10 minutes</strong>.<br/>
                🔒 For security, please do not share this code with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 24px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;color:#aaaaaa;font-size:12px;line-height:1.6;">
                If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOTPEmail(email, name, otp, type = "registration") {
  const subject =
    type === "registration"
      ? "PetroSmart — Verify your email"
      : "PetroSmart — Password reset code";

  try {
    console.log("📧 Sending email to:", email);

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html: otpEmailTemplate(name, otp, type),
    });

    console.log("✅ Email sent successfully!");
    console.log(info);

    return info;

  } catch (err) {
    console.error("❌ Email sending failed:");
    console.error(err);
    throw err;
  }
}