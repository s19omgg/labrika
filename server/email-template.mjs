export function verificationEmail(code) {
  const prettyCode = `${code.slice(0, 3)} ${code.slice(3)}`;

  return {
    subject: 'Код подтверждения — LABRICA',

    text: `Ваш код подтверждения: ${prettyCode}

Код действует 10 минут.

Если вы не пытались зарегистрироваться в LABRICA, просто проигнорируйте это письмо.

LABRICA
labrica.pro`,

    html: `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Код подтверждения — LABRICA</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111111;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Код подтверждения LABRICA — ${prettyCode}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f1;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #e9e9e5;border-radius:26px;">

          <tr>
            <td style="padding:30px 32px 0 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="11" height="11" style="width:11px;height:11px;background:#20e88b;border-radius:50%;"></td>
                  <td style="padding-left:10px;font-size:20px;line-height:1;font-weight:800;letter-spacing:-0.4px;color:#111111;">
                    LABRICA
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:54px 32px 0 32px;">
              <div style="font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.9px;color:#111111;">
                Подтвердите почту
              </div>

              <div style="margin-top:14px;font-size:16px;line-height:1.55;color:#74746f;">
                Введите этот код в LABRICA,<br>
                чтобы завершить регистрацию.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ecfbf4;border:1px solid #d9f4e6;border-radius:22px;">
                <tr>
                  <td align="center" style="padding:30px 16px 27px 16px;">
                    <div style="font-size:12px;line-height:1;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#5d7669;margin-bottom:16px;">
                      КОД ПОДТВЕРЖДЕНИЯ
                    </div>

                    <div style="font-family:'Arial Rounded MT Bold','Segoe UI',Arial,sans-serif;font-size:46px;line-height:1;font-weight:900;letter-spacing:8px;color:#12392a;white-space:nowrap;">
                      ${prettyCode}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#eeeeea;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 32px 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:22px;">
                <tr>
                  <td style="background:#f3f3f0;border-radius:100px;padding:7px 11px;font-size:12px;line-height:1;font-weight:600;color:#686864;">
                    Действует 10 минут
                  </td>
                </tr>
              </table>

              <div style="font-size:13px;line-height:1.6;color:#999994;margin-bottom:18px;">
                Если вы не пытались зарегистрироваться в LABRICA,
                просто проигнорируйте это письмо.
              </div>

              <a href="https://labrica.pro" style="font-size:13px;line-height:1;font-weight:600;color:#111111;text-decoration:none;">
                labrica.pro
              </a>
            </td>
          </tr>
        </table>

        <div style="max-width:520px;padding:18px 20px 0 20px;font-size:11px;line-height:1.5;color:#aaa9a4;text-align:center;">
          Автоматическое сообщение LABRICA
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  };
}
