import nodemailer from "nodemailer";
import crypto from "crypto";

const transporter = nodemailer.createTransport({
  host: process.env.POSTBOX_SMTP_HOST,
  port: Number(process.env.POSTBOX_SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.POSTBOX_SMTP_USER,
    pass: process.env.POSTBOX_SMTP_PASSWORD,
  },
});

export function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function sendVerificationCode(email, code) {
  const prettyCode = `${code.slice(0, 3)} ${code.slice(3)}`;

  await transporter.sendMail({
    from: `"${process.env.POSTBOX_FROM_NAME || "LABRICA"}" <${process.env.POSTBOX_FROM_EMAIL}>`,
    to: email,
    subject: "Код подтверждения — LABRICA",

    text: `
Ваш код подтверждения: ${prettyCode}

Код действует 10 минут.

Если вы не запрашивали этот код, просто проигнорируйте письмо.

LABRICA
labrica.pro
`,

    html: `
<!doctype html>
<html lang="ru">
<body style="
  margin:0;
  padding:0;
  background:#f5f5f3;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
  color:#111111;
">

<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#f5f5f3;">
<tr>
<td align="center" style="padding:40px 16px;">

<table width="100%" cellpadding="0" cellspacing="0"
       style="
         max-width:560px;
         background:#ffffff;
         border-radius:24px;
         border:1px solid #e8e8e5;
       ">

<tr>
<td style="padding:32px 36px 0;">
  <div style="font-size:22px;font-weight:700;">
    LABRICA
  </div>
</td>
</tr>

<tr>
<td style="padding:64px 36px 48px;">

  <div style="
    font-size:28px;
    font-weight:600;
    margin-bottom:16px;
  ">
    Подтвердите почту
  </div>

  <div style="
    font-size:16px;
    line-height:1.55;
    color:#6b6b67;
    margin-bottom:32px;
  ">
    Введите этот код в LABRICA, чтобы продолжить регистрацию.
  </div>

  <div style="
    background:#f5f5f3;
    border-radius:18px;
    padding:28px 20px;
    text-align:center;
    margin-bottom:28px;
  ">
    <div style="
      font-size:38px;
      font-weight:700;
      letter-spacing:10px;
    ">
      ${prettyCode}
    </div>
  </div>

  <div style="font-size:14px;color:#8a8a85;">
    Код действует 10 минут.
  </div>

</td>
</tr>

<tr>
<td style="padding:0 36px;">
  <div style="height:1px;background:#eeeeeb;"></div>
</td>
</tr>

<tr>
<td style="padding:28px 36px 34px;">
  <div style="
    font-size:13px;
    line-height:1.6;
    color:#999994;
    margin-bottom:20px;
  ">
    Если вы не пытались зарегистрироваться в LABRICA,
    просто проигнорируйте это письмо.
  </div>

  <a href="https://labrica.pro"
     style="font-size:13px;color:#111;text-decoration:none;">
    labrica.pro
  </a>
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`,
  });
}
