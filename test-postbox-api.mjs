import 'dotenv/config';

import {verificationEmail} from './server/email-template.mjs';
import {createVerificationImage} from './server/verification-image.mjs';
import {sendPostboxEmail} from './server/postbox-api.mjs';

const code = '583194';

// СЮДА ВПИШИ СВОЮ ПОЧТУ
const to = 'baigot15@mail.ru';

const emailContent = verificationEmail(code);
const verificationImage = await createVerificationImage(code);

try {
  const result = await sendPostboxEmail({
    to,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    inlineImage: verificationImage,
    imageCid: emailContent.imageCid
  });

  console.log('✅ Письмо отправлено через Postbox API');
  console.log(result);
} catch (error) {
  console.error('❌ Ошибка Postbox API:');
  console.error(error);
}
