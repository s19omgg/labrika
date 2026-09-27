import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.POSTBOX_SMTP_HOST,
  port: Number(process.env.POSTBOX_SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.POSTBOX_SMTP_USER,
    pass: process.env.POSTBOX_SMTP_PASSWORD,
  },
});

try {
  const info = await transporter.sendMail({
    from: `"${process.env.POSTBOX_FROM_NAME}" <${process.env.POSTBOX_FROM_EMAIL}>`,

    // СЮДА ПОСТАВЬ СВОЮ ПОЧТУ ДЛЯ ТЕСТА
    to: "baigot15@mail.ru",

    subject: "Код подтверждения — LABRICA",

    text: `
Ваш код подтверждения: 583194

Код действует 10 минут.

Если вы не запрашивали этот код, просто проигнорируйте письмо.

LABRICA
labrica.pro
`,

    html: `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Код подтверждения — LABRICA</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f5f5f3;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
  color:#111111;
">

  <div style="
    display:none;
    max-height:0;
    overflow:hidden;
    opacity:0;
    color:transparent;
  ">
    Ваш код подтверждения LABRICA — 583 194
  </div>

  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background:#f5f5f3;"
  >
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:560px;
            background:#ffffff;
            border-radius:24px;
            border:1px solid #e8e8e5;
          "
        >

          <tr>
            <td style="padding:32px 36px 0 36px;">
              <div style="
                font-size:22px;
                line-height:1;
                font-weight:700;
                letter-spacing:-0.6px;
              ">
                LABRICA
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:64px 36px 48px 36px;">

              <div style="
                font-size:28px;
                line-height:1.25;
                font-weight:600;
                letter-spacing:-0.8px;
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
                Введите этот код в LABRICA, чтобы завершить регистрацию.
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
                  line-height:1;
                  font-weight:700;
                  letter-spacing:10px;
                  color:#111111;
                ">
                  583 194
                </div>
              </div>

              <div style="
                font-size:14px;
                line-height:1.5;
                color:#8a8a85;
              ">
                Код действует 10 минут.
              </div>

            </td>
          </tr>

          <tr>
            <td style="padding:0 36px;">
              <div style="
                height:1px;
                background:#eeeeeb;
              "></div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 36px 34px 36px;">

              <div style="
                font-size:13px;
                line-height:1.6;
                color:#999994;
                margin-bottom:20px;
              ">
                Если вы не пытались зарегистрироваться в LABRICA,
                просто проигнорируйте это письмо.
              </div>

              <a
                href="https://labrica.pro"
                style="
                  font-size:13px;
                  color:#111111;
                  text-decoration:none;
                  font-weight:500;
                "
              >
                labrica.pro
              </a>

            </td>
          </tr>

        </table>

        <div style="
          max-width:560px;
          padding:20px 24px 0 24px;
          font-size:12px;
          line-height:1.5;
          color:#aaa9a4;
          text-align:center;
        ">
          Автоматическое сообщение LABRICA
        </div>

      </td>
    </tr>
  </table>

</body>
</html>
`,
  });

  console.log("✅ Письмо отправлено");
  console.log(info.messageId);
} catch (error) {
  console.error("❌ Ошибка:");
  console.error(error);
}
