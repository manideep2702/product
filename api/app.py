import os
import ssl
import smtplib
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from flask import Flask, request, jsonify

# ENV (set these on your server; never hardcode secrets)
# SMTP_HOST=mail.sabarisastha.org
# SMTP_PORT=465
# SMTP_USER=no-reply@sabarisastha.org
# SMTP_PASS=YOUR_PASSWORD
# FROM_EMAIL=no-reply@sabarisastha.org
# FROM_NAME=Sabari Sastha Seva Samithi
# SMTP_BCC=optional-admin@yourdomain (optional)

def send_booking_confirmation(
    *,
    name: str,
    email: str,
    bookingType: str,  # "Annadanam" | "Pooja" | "Donation" | "Volunteer"
    date: str,
    slot: str,
    bookingId: str,
) -> dict:
    smtp_host = os.environ.get("SMTP_HOST", "mail.sabarisastha.org")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    from_email = os.environ.get("FROM_EMAIL", smtp_user or "no-reply@example.com")
    from_name = os.environ.get("FROM_NAME", "Sabari Sastha Seva Samithi")
    bcc = os.environ.get("SMTP_BCC", "")

    if not (smtp_user and smtp_pass):
        raise RuntimeError("Missing SMTP_USER/SMTP_PASS env")

    subject = f"Booking Confirmation - {bookingType} #{bookingId}"

    header_color = "#f97316"  # orange
    html = f"""
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;line-height:1.6">
      <div style="background:{header_color};color:white;padding:14px 16px;border-radius:10px 10px 0 0">
        <strong style="font-size:16px">{from_name}</strong>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:16px">
        <h2 style="margin:0 0 10px;font-size:18px">Booking Confirmation - {bookingType} #{bookingId}</h2>
        <p>Dear {name or "Devotee"},</p>
        <p>Thank you for your {bookingType} booking at {from_name}.</p>
        <table style="border-collapse:collapse;width:100%;margin:10px 0 14px">
          <tbody>
            <tr><td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa;width:160px"><strong>Booking Type</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb">{bookingType}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Booking ID</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb">{bookingId}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Name</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb">{name}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Email</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb">{email}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Date</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb">{date}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fafafa"><strong>Slot</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb">{slot}</td></tr>
          </tbody>
        </table>
        <p>May Lord Ayyappa bless you abundantly!</p>
        <p>Regards,<br/>{from_name}</p>
      </div>
    </div>
    """.strip()

    text = (
        f"Booking Confirmation - {bookingType} #{bookingId}\n\n"
        f"Dear {name},\n\n"
        f"Thank you for your {bookingType} booking at {from_name}.\n\n"
        f"Details:\n"
        f"- Date: {date}\n"
        f"- Slot: {slot}\n"
        f"- Booking ID: {bookingId}\n\n"
        f"May Lord Ayyappa bless you abundantly!\n\n"
        f"Regards,\n{from_name}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = email
    if bcc:
        msg["Bcc"] = bcc
    # Valid Message-ID for Gmail acceptance
    domain = (from_email.split("@")[1] or "sabarisastha.org").strip()
    msg["Message-ID"] = make_msgid(domain=domain)
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ctx) as s:
        s.login(smtp_user, smtp_pass)
        s.send_message(msg)

    return {"ok": True, "messageId": msg["Message-ID"]}


# Minimal HTTP endpoint (Flask)
app = Flask(__name__)

@app.post("/api/send-email")
def send_email_http():
    try:
        j = request.get_json(force=True, silent=False)
        required = ["name", "email", "bookingType", "date", "slot", "bookingId"]
        if not all(k in j and str(j[k]).strip() for k in required):
            return jsonify({"error": "Missing required fields"}), 400

        out = send_booking_confirmation(
            name=str(j["name"]).strip(),
            email=str(j["email"]).strip(),
            bookingType=str(j["bookingType"]).strip(),
            date=str(j["date"]).strip(),
            slot=str(j["slot"]).strip(),
            bookingId=str(j["bookingId"]).strip(),
        )
        return jsonify(out), 200
    except Exception as e:
        # Log the failure; optionally write to DB
        print("Booking email failed:", repr(e))
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    # For production, run via Gunicorn or Passenger/WSGI.
    app.run(host="0.0.0.0", port=8000)