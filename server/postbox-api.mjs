import {
  SESv2Client,
  SendEmailCommand
} from '@aws-sdk/client-sesv2';

const client = new SESv2Client({
  region: 'ru-central1',
  endpoint: 'https://postbox.cloud.yandex.net',

  credentials: {
    accessKeyId: process.env.POSTBOX_ACCESS_KEY_ID,
    secretAccessKey: process.env.POSTBOX_SECRET_ACCESS_KEY
  }
});

export async function sendPostboxEmail({
  to,
  subject,
  text,
  html,
  inlineImage,
  imageCid
}) {
  if (
    !process.env.POSTBOX_ACCESS_KEY_ID ||
    !process.env.POSTBOX_SECRET_ACCESS_KEY
  ) {
    throw new Error('POSTBOX_API_KEYS_MISSING');
  }

  const fromEmail =
    process.env.POSTBOX_FROM_EMAIL;

  const fromName =
    process.env.POSTBOX_FROM_NAME || 'LABRICA';

  if (!fromEmail) {
    throw new Error('POSTBOX_FROM_EMAIL_MISSING');
  }

  const command = new SendEmailCommand({
    FromEmailAddress:
      `${fromName} <${fromEmail}>`,

    Destination: {
      ToAddresses: [to]
    },

    Content: {
      Simple: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },

        Body: {
          Text: {
            Data: text,
            Charset: 'UTF-8'
          },

          Html: {
            Data: html,
            Charset: 'UTF-8'
          }
        },

        Attachments: [
          {
            FileName: 'verification-code.png',

            RawContent: inlineImage,

            ContentType: 'image/png',

            ContentDisposition: 'INLINE',

            ContentId: imageCid,

            ContentTransferEncoding: 'base64'
          }
        ]
      }
    }
  });

  const result =
    await client.send(command);

  return {
    messageId: result.MessageId
  };
}
