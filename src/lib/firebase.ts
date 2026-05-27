import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Required Gmail send scope to deliver the application to ortish0@gmail.com
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Since Firebase SDK sometimes persists user but not intermediate OAuth credentials provider, 
        // we keep the user if we have user credentials but they might need pop-up to get new write access token
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Не удалось получить токен доступа Google API');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Ошибка входа через Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Transmits the application submission directly via the Gmail REST API.
 */
export async function sendApplicationEmail(
  accessToken: string,
  formData: { name: string; company: string; contact: string; service: string; message: string },
  recipientEmail: string = 'ortish0@gmail.com'
): Promise<any> {
  const subject = `AXIOM: Новая заявка на AI-аудит от ${formData.name}`;
  
  // Build raw RFC2822 email format. Use UTF-8 Base64 subject encoding to preserve Russian characters in subjects
  const subjectBase64 = btoa(
    encodeURIComponent(subject).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
  
  const emailLines = [
    `To: ${recipientEmail}`,
    `Subject: =?UTF-8?B?${subjectBase64}?=`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    ``,
    `Новая заявка на проект ИИ (AXIOM Consulting)`,
    `=============================================`,
    `Имя отправителя: ${formData.name}`,
    `Компания: ${formData.company || 'Не указана'}`,
    `Контакты для связи (Email/Контакты): ${formData.contact}`,
    `Направление экспертизы: ${formData.service}`,
    `Текст сообщения/задачи:`,
    `${formData.message || 'Без описания детализации.'}`,
    `=============================================`,
    `Данная заявка отправлена автоматически через интеграцию Gmail REST API.`
  ];

  const rawEmail = emailLines.join('\r\n');

  // Convert string to base64url safely
  const utf8Encoder = new TextEncoder();
  const bytes = utf8Encoder.encode(rawEmail);
  let binaryString = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  const base64Encoded = btoa(binaryString);
  const base64Url = base64Encoded
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: base64Url
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка отправки через Gmail API: ${errText}`);
  }

  return await response.json();
}
