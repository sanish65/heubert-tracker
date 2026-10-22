import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getNepalDateStr } from '@/lib/attendanceTime';
import { appUrl, sendEmail } from '@/lib/mailer';
import { anniversaryEmail, birthdayEmail } from '@/lib/emailTemplates';

// Sends a birthday or work-anniversary wish from the Dashboard (web and mobile).
//
// The callers send no sign-in token today, so this route can't check who is asking.
// What it can stop is being used to mail anyone else: the address must belong to an
// active employee, and the name in the email comes from that employee's record, never
// from the request, so nobody can put their own text in a mail sent from the company.

const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function yearsSince(joined, todayStr) {
  const [jy, jm, jd] = String(joined).slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  if (!jy) return null;
  let years = ty - jy;
  if (tm < jm || (tm === jm && td < jd)) years -= 1;
  return years;
}

export async function POST(req) {
  try {
    const { email, type, years } = await req.json();
    const address = String(email || '').trim();
    if (!address) {
      return NextResponse.json({ success: false, error: 'Recipient details missing' }, { status: 400 });
    }
    if (type !== 'birthday' && type !== 'anniversary') {
      return NextResponse.json({ success: false, error: 'Unknown wish type' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const pattern = escapeLike(address);
    const [work, personal] = await Promise.all([
      supabase.from('employees').select('name, status, joined_date').ilike('work_email', pattern),
      supabase.from('employees').select('name, status, joined_date').ilike('personal_email', pattern),
    ]);
    const employee = [...(work.data || []), ...(personal.data || [])].find((e) => e.status === 'active');
    if (!employee) {
      return NextResponse.json({ success: false, error: 'That address is not an active employee.' }, { status: 403 });
    }

    const today = getNepalDateStr(new Date());
    const url = appUrl();
    // The anniversary count comes from the join date on file when there is one, so the
    // email can't claim a number the record doesn't support.
    const recordedYears = employee.joined_date ? yearsSince(employee.joined_date, today) : null;
    const mail =
      type === 'anniversary'
        ? anniversaryEmail({ name: employee.name, years: recordedYears || years, date: today, appUrl: url })
        : birthdayEmail({ name: employee.name, date: today, appUrl: url });

    await sendEmail({
      to: address,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    return NextResponse.json({ success: true, message: 'Wish sent successfully!' });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to send email. Check the mail settings (Gmail service account or SMTP).'
    }, { status: 500 });
  }
}
