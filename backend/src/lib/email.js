import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(email, resetUrl) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  await transporter.sendMail({
    from: { name: "Meetify", address: process.env.EMAIL_USER },
    to: email,
    subject: "Reset your Meetify password",
    text: `Reset your Meetify password using this link:\n\n${resetUrl}\n\nThis link expires in 15 minutes and can be used once. If you did not request this, you can ignore this email.`,
  });
}
