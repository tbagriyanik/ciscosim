import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, type, message, timestamp, userAgent } = body;

    // The external contact submission endpoint should be set in environment variables
    const CONTACT_SUBMISSION_URL = process.env.GOOGLE_SHEETS_CONTACT_URL;

    if (!CONTACT_SUBMISSION_URL) {
      console.warn('GOOGLE_SHEETS_CONTACT_URL is not set. Message logged to console instead.');
      console.log('Contact Form Submission:', { name, email, type, message, timestamp, userAgent });
      
      // We return success even if the URL is not set, so the UI shows success for local testing
      // (The user can see the logs in their terminal)
      return NextResponse.json({ success: true, logged: true });
    }

    // Send data to the configured external submission endpoint
    const response = await fetch(CONTACT_SUBMISSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        type,
        message,
        timestamp,
        userAgent
      }),
      redirect: 'follow' // Apps Script uses redirects
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sheets Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to send to Sheets: ${response.status} ${response.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
