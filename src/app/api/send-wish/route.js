import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    const { email, name, type, years } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Recipient details missing' }, { status: 400 });
    }

    const isAnniversary = type === 'anniversary';
    const dynamicSubject = isAnniversary 
      ? `Happy ${years} Year Anniversary, ${name}! 🏆` 
      : `Happy Birthday, ${name}! 🎂`;

    const dynamicTitle = isAnniversary
      ? `Happy ${years} Year Anniversary, ${name}! 🏆`
      : `Happy Birthday, ${name}! 🎂`;

    const dynamicMessage = isAnniversary
      ? `Congratulations on your <strong>${years} year anniversary</strong> with Heubert! We are incredibly grateful for your dedication and hard work. 🎊🏆`
      : `Wishing you a very <strong>Happy Birthday</strong> from the entire team! We hope your day is filled with joy, laughter, and plenty of celebration. 🥳🎉`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Heubert Tracker" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: dynamicSubject,
      text: `Hi ${name},\n\n${dynamicMessage.replace(/<[^>]*>?/gm, '')}\n\nBest regards,\nThe Heubert Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <div style="background: linear-gradient(135deg, ${isAnniversary ? '#10b981 0%, #059669 100%' : '#6366f1 0%, #8b5cf6 100%'}); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">${dynamicTitle}</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #ffffff;">
            <p style="font-size: 16px; line-height: 1.6;">Hi ${name},</p>
            <p style="font-size: 16px; line-height: 1.6;">${dynamicMessage}</p>
            <p style="font-size: 16px; line-height: 1.6;">${isAnniversary ? 'We look forward to many more great years together!' : 'Keep shining and have a fantastic year ahead!'}</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Best regards,</p>
              <p style="margin: 4px 0 0; font-weight: 700; color: #4b5563;">The Heubert Team</p>
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Wish sent successfully!' });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to send email. Ensure SMTP credentials are configured.' 
    }, { status: 500 });
  }
}
