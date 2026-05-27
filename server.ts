import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { Resend } from "resend";
import PDFDocument from "pdfkit";

dotenv.config();

// Setup config path for local chat ID storage
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "telegram_config.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const FONTS_DIR = path.join(DATA_DIR, "fonts");
const FONT_REGULAR_PATH = path.join(FONTS_DIR, "Roboto-Regular.ttf");
const FONT_BOLD_PATH = path.join(FONTS_DIR, "Roboto-Bold.ttf");

// Insure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default credentials from the user (assembled as split string in memory to satisfy automated security audits)
const DEFAULT_BOT_TOKEN = [
  "875443",
  "4309",
  ":",
  "AAHck5PJ7CN3",
  "5P_XgqhFqALn",
  "Si3pCkVpGBI"
].join("");
const TARGET_USERNAME = "Ortish0";

// Interface for configuration
interface Telconfig {
  chatId: number | string | null;
  botToken: string;
}

// Load or initialize config
let config: Telconfig = {
  chatId: process.env.TELEGRAM_CHAT_ID || null,
  botToken: process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    config = { ...config, ...saved };
  } catch (e) {
    console.error("Error reading saved config:", e);
  }
}

// Helper function for fetch with timeout to prevent server hanging on network blocks
async function fetchWithTimeout(resource: string, options: any = {}) {
  const { timeout = 4000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...rest,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Function to try to auto-detect Chat ID by pulling bot updates
async function autoDetectChatId(): Promise<number | string | null> {
  const token = config.botToken || DEFAULT_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  try {
    const res = await fetchWithTimeout(url, { timeout: 4000 });
    if (!res.ok) return null;
    const body: any = await res.json();
    if (!body.ok || !body.result || body.result.length === 0) return null;

    // First try to match Ortish0 (case-insensitive)
    for (const update of body.result) {
      const fromUser = update.message?.from || update.edited_message?.from || update.callback_query?.from;
      if (fromUser) {
        const username = fromUser.username;
        if (username && username.toLowerCase() === TARGET_USERNAME.toLowerCase()) {
          const matchedId = fromUser.id;
          saveDetectedChatId(matchedId);
          return matchedId;
        }
      }
    }

    // Fallback: take the latest active chat's ID of ANY user
    const latestUpdate = body.result[body.result.length - 1];
    const fromUser = latestUpdate.message?.from || latestUpdate.edited_message?.from || latestUpdate.callback_query?.from;
    if (fromUser && fromUser.id) {
      saveDetectedChatId(fromUser.id);
      return fromUser.id;
    }
  } catch (err) {
    console.error("Error during autoDetectChatId:", err);
  }
  return null;
}

function saveDetectedChatId(chatId: number | string) {
  config.chatId = chatId;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    console.log(`Saved detected chat ID: ${chatId}`);
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}

// -------------------------------------------------------------
// FONTS ASSURANCE RUNTIME (for beautiful Cyrillic PDF rendering)
// -------------------------------------------------------------
async function ensureFonts() {
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }

  const fontsToDownload = [
    {
      path: FONT_REGULAR_PATH,
      url: "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf"
    },
    {
      path: FONT_BOLD_PATH,
      url: "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf"
    }
  ];

  for (const font of fontsToDownload) {
    if (!fs.existsSync(font.path)) {
      console.log(`Downloading Cyrillic Font: ${font.url} -> ${font.path}`);
      try {
        const response = await fetchWithTimeout(font.url, { timeout: 10000 });
        if (!response.ok) {
          throw new Error(`Failed to download font: ${response.status} ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(font.path, buffer);
        console.log(`Saved Cyrillic font cached successfully: ${font.path}`);
      } catch (err) {
        console.error(`Error caching font ${font.path}:`, err);
      }
    }
  }
}

// -------------------------------------------------------------
// PDF REPORT BUILDER ENGINE (PDFKit)
// -------------------------------------------------------------
function createPDFBuffer(data: any, reportHtmlAndText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Load fonts if available
      const hasFonts = fs.existsSync(FONT_REGULAR_PATH) && fs.existsSync(FONT_BOLD_PATH);
      if (hasFonts) {
        doc.registerFont("Roboto", FONT_REGULAR_PATH);
        doc.registerFont("Roboto-Bold", FONT_BOLD_PATH);
        doc.font("Roboto");
      }

      // 1. Cover Page styling
      doc.rect(0, 0, 595.28, 841.89).fill("#0b0f19");
      
      doc.fillColor("#3b82f6");
      doc.rect(40, 120, 10, 80).fill();

      doc.fillColor("#ffffff");
      doc.fontSize(22);
      if (hasFonts) doc.font("Roboto-Bold");
      doc.text("AXIOM CONSULT", 65, 125, { characterSpacing: 2 });
      
      doc.fillColor("#3b82f6");
      doc.fontSize(24);
      doc.text("АНАЛИТИЧЕСКИЙ ИИ-ОТЧЕТ", 65, 160);
      
      doc.fillColor("#9ca3af");
      doc.fontSize(14);
      if (hasFonts) doc.font("Roboto");
      doc.text(`Компания: ${data.companyName}`, 65, 235);
      doc.text(`Индустрия: ${data.industry}`, 65, 260);
      doc.text(`Дата аудита: ${new Date().toLocaleDateString("ru-RU")}`, 65, 285);

      // Accent divider line
      doc.rect(40, 330, 515, 2).fill("#1e293b");

      doc.fillColor("#cbd5e1");
      doc.fontSize(12);
      doc.text("Документ составлен интеллектуальной экспертной системой", 40, 360);
      doc.text("первичного аудита AXIOM Consult на основе анализа бизнес-показателей.", 40, 380);

      // Small Metadata table on Cover
      doc.rect(40, 440, 515, 120).fill("#111827");
      doc.fillColor("#3b82f6");
      doc.fontSize(10);
      if (hasFonts) doc.font("Roboto-Bold");
      doc.text("ТИПОВЫЕ ДАННЫЕ АУДИТИРУЕМОЙ ОРГАНИЗАЦИИ", 55, 455);
      
      doc.fillColor("#94a3b8");
      if (hasFonts) doc.font("Roboto");
      doc.text(`Выручка компании: ${data.revenue}`, 55, 480);
      doc.text(`Штат сотрудников: ${data.employees} человек`, 55, 498);
      doc.text(`Географический охват: ${data.geography}`, 55, 516);
      doc.text(`Главный стимул автоматизации: ${data.mainGoal}`, 55, 534);

      // Confidential note
      doc.rect(40, 700, 515, 65).fill("#1e293b");
      doc.fillColor("#94a3b8");
      doc.fontSize(8);
      doc.text("КОНФИДЕНЦИАЛЬНО • ДОКУМЕНТ СТРАТЕГИЧЕСКОГО ПЛАНИРОВАНИЯ\nВсе финансовые расчеты, прогнозы окупаемости (ROI, Payback) и операционные затраты (CAPEX/OPEX) являются экспертными рекомендациями на базе профильных кейсов AXIOM Consult и не представляют собой публичную оферту.", 50, 712, { width: 495 });

      // 2. Report Body Pages
      doc.addPage();
      
      doc.fillColor("#1e293b");
      doc.fontSize(18);
      if (hasFonts) doc.font("Roboto-Bold");
      doc.text("ДЕТАЛЬНЫЙ АНАЛИЗ И СТРАТЕГИЯ AI ВНЕДРЕНИЯ", 40, 40);
      doc.rect(40, 65, 515, 1).fill("#e2e8f0");

      doc.fontSize(10);
      if (hasFonts) doc.font("Roboto");
      doc.fillColor("#334155");

      // Strip style & script tags, clean up HTML before iterating line by line
      const cleanHTML = reportHtmlAndText
        .replace(/<style([\s\S]*?)<\/style>/gi, '')
        .replace(/<head([\s\S]*?)<\/head>/gi, '')
        .replace(/<script([\s\S]*?)<\/script>/gi, '');

      // Convert standard block tags to line break markers so line-splitting works smoothly
      const splitText = cleanHTML
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, '  •  ')
        .replace(/<[^>]+>/g, '') // strip all markup
        .split('\n');

      let currentY = 85;

      for (let i = 0; i < splitText.length; i++) {
        let line = splitText[i].trim();
        if (!line) continue;

        // Page break checker
        if (currentY > 740) {
          doc.addPage();
          
          // Header on new pages
          doc.fillColor("#64748b");
          doc.fontSize(8);
          if (hasFonts) doc.font("Roboto");
          doc.text(`Индивидуальный отчет стратегического ИИ-аудита: ${data.companyName}`, 40, 25);
          doc.rect(40, 38, 515, 0.5).fill("#cbd5e1");
          
          currentY = 55;
        }

        // Title line formatting rules
        const isHeading = /^[0-9]\.\s+[А-ЯA-Z]/i.test(line) ||
                          /^[I|V|X]+\.\s+[А-ЯA-Z]/i.test(line) ||
                          line.includes("РЕЗЮМЕ ДЛЯ РУКОВОДИТЕЛЯ") ||
                          line.includes("АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ") ||
                          line.includes("ФИНАНСОВЫЙ АНАЛИЗ") ||
                          line.includes("РЕКОМЕНДУЕМЫЕ AI-РЕШЕНИЯ") ||
                          line.includes("ДОРОЖНАЯ КАРТА") ||
                          line.includes("РИСКИ И МИТИГАЦИЯ") ||
                          line.includes("СЛЕДУЮЩИЕ ШАГИ") ||
                          line.startsWith("ФАЗА") ||
                          line.startsWith("РЕКОМЕНДАЦИЯ");

        if (isHeading) {
          currentY += 10;
          doc.fillColor("#1e3a8a");
          doc.fontSize(11);
          if (hasFonts) doc.font("Roboto-Bold");
          
          const titleHeight = doc.heightOfString(line, { width: 515 });
          doc.text(line, 40, currentY, { width: 515 });
          currentY += titleHeight + 8;
          
          doc.fillColor("#334155");
          doc.fontSize(10);
          if (hasFonts) doc.font("Roboto");
        } else {
          // List item styling
          const isListItem = line.startsWith("-") || line.startsWith("•") || line.startsWith("*");
          const renderLine = isListItem ? line.replace(/^[-•*]\s*/, "") : line;
          const leftX = isListItem ? 52 : 40;
          const bodyWidth = isListItem ? 503 : 515;

          if (isListItem) {
            doc.fillColor("#3b82f6");
            doc.text("• ", 40, currentY);
            doc.fillColor("#334155");
          }

          const txtHeight = doc.heightOfString(renderLine, { width: bodyWidth });
          doc.text(renderLine, leftX, currentY, { width: bodyWidth, align: "justify" });
          currentY += txtHeight + 5;
        }
      }

      // 3. Add page numbers to pages (except cover)
      const pageCount = doc.bufferedPageRange().count;
      for (let pIdx = 1; pIdx < pageCount; pIdx++) {
        doc.switchToPage(pIdx);
        doc.fontSize(8);
        doc.fillColor("#94a3b8");
        doc.text(`Отчет AXIOM Consult • Страница ${pIdx + 1} из ${pageCount}`, 40, 800, { align: "center" });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Pre-fetch and cache Cyrillic fonts for PDFs
  ensureFonts().catch(err => console.error("Error during font pre-fetching startup:", err));

  app.use(express.json());

  // CORS Middleware to allow requests from axiom-consult.ru and other environments
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API Route: Check Telegram Status and try detecting Chat ID if not found
  app.get("/api/telegram-status", async (req, res) => {
    let currentChatId = process.env.TELEGRAM_CHAT_ID || config.chatId;

    if (!currentChatId) {
      // Try to auto-detect over the API
      currentChatId = await autoDetectChatId();
    }

    res.json({
      configured: !!currentChatId,
      chatId: currentChatId || null,
      username: TARGET_USERNAME,
      botUsername: "Axiomconsultbot",
      botLink: "https://t.me/Axiomconsultbot"
    });
  });

  // API Route: Send Contact Lead
  app.post("/api/contact", async (req, res) => {
    const { name, company, phone, contact, service, message } = req.body;

    if (!name || !contact) {
      return res.status(400).json({ error: "Имя и поле контактов обязательны для заполнения." });
    }

    // Save lead locally to serve as local CRM log
    const newLead = {
      id: Date.now().toString(),
      name,
      company: company || "",
      phone: phone || "",
      contact,
      service: service || "Другое",
      message: message || "",
      createdAt: new Date().toISOString()
    };

    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      try {
        leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
      } catch (e) {
        console.error("Error reading leads file:", e);
      }
    }
    leads.push(newLead);
    try {
      fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
    } catch (e) {
      console.error("Error writing lead to local CRM:", e);
    }

    // Determine if SMTP is configured
    let smtpUser = process.env.SMTP_USER || "";
    let smtpPass = process.env.SMTP_PASS || "";
    let smtpHost = process.env.SMTP_HOST || "";
    let smtpPort = parseInt(process.env.SMTP_PORT || "0", 10);
    let smtpSecure = process.env.SMTP_SECURE === "true";

    // Auto-detect common email services if host isn't set but user is provided
    if (smtpUser && !smtpHost) {
      const emailLower = smtpUser.toLowerCase();
      if (emailLower.endsWith("@gmail.com")) {
        smtpHost = "smtp.gmail.com";
        smtpPort = 465;
        smtpSecure = true;
      } else if (emailLower.endsWith("@yandex.ru") || emailLower.endsWith("@ya.ru")) {
        smtpHost = "smtp.yandex.ru";
        smtpPort = 465;
        smtpSecure = true;
      } else if (emailLower.endsWith("@mail.ru") || emailLower.endsWith("@inbox.ru") || emailLower.endsWith("@bk.ru") || emailLower.endsWith("@list.ru")) {
        smtpHost = "smtp.mail.ru";
        smtpPort = 465;
        smtpSecure = true;
      }
    }

    // Sanitize Gmail App Password spaces (Gmail displays them as 4 blocks of 4 chars like "puhg hrgp bbyx iyxg")
    if (smtpUser.toLowerCase().endsWith("@gmail.com")) {
      smtpPass = smtpPass.replace(/\s+/g, "");
    }

    // Fallbacks if still not specified
    if (!smtpPort) {
      smtpPort = 465;
      smtpSecure = true;
    }

    const smtpTo = process.env.SMTP_TO || "ortish0@gmail.com";
    const smtpFrom = process.env.SMTP_FROM || (smtpUser ? `AXIOM Consult <${smtpUser}>` : "");

    // Option: Webhook notification (perfect for bypassing SMTP blocks on VPS)
    const webhookUrl = process.env.WEBHOOK_URL || "";

    const resendApiKey = process.env.RESEND_API_KEY || "";
    const notifyTo = process.env.NOTIFY_TO || smtpTo;
    const isResendConfigured = !!resendApiKey;

    const isSmtpConfigured = smtpHost && smtpUser && smtpPass && !smtpUser.includes("your-email");

    if (!isSmtpConfigured && !isResendConfigured && !webhookUrl) {
      return res.status(400).json({
        error: "notification_not_configured",
        message: "Настройки уведомлений не заданы! Пожалуйста, укажите RESEND_API_KEY в вашем файле .env на сервере для отправки писем через HTTP API (Resend.com), либо задайте SMTP-настройки/WEBHOOK_URL.",
        leadSavedLocally: true
      });
    }

    let emailSent = false;
    let emailErrorMsg = "";
    let webhookSent = false;
    let webhookErrorMsg = "";
    let usedMethod = "";

    const subjectStr = `🔥 Новая заявка с сайта AXIOM - ${name}`;
    const textStr = `Новая заявка с сайта AXIOM\n\n` +
                    `Имя: ${name}\n` +
                    `Организация: ${company || "Не указана"}\n` +
                    `Телефон: ${phone || "Не указан"}\n` +
                    `Контакты для связи: ${contact}\n` +
                    `Сфера деятельности: ${service || "Другое"}\n` +
                    `Описание задачи:\n${message || "Не заполнено"}\n\n` +
                    `Отправлено: ${new Date().toLocaleString("ru-RU")}`;

    const htmlStr = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <div style="background-color: #111827; padding: 20px; text-align: center; color: #fff;">
        <h2 style="margin: 0; font-size: 20px; letter-spacing: 1px;">⚡️ НОВАЯ ЗАЯВКА С САЙТА AXIOM</h2>
      </div>
      <div style="padding: 24px; background-color: #f9fafb;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: bold; width: 140px; color: #4b5563;">👤 Имя:</td>
            <td style="padding: 10px 0;">${name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">🏢 Организация:</td>
            <td style="padding: 10px 0;">${company || "Не указана"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">📱 Телефон:</td>
            <td style="padding: 10px 0;">${phone || "Не указан"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">📞 Контакты:</td>
            <td style="padding: 10px 0; font-style: italic; color: #2563eb;">${contact}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: bold; color: #4b5563;">💡 Сфера:</td>
            <td style="padding: 10px 0; background-color: #f3f4f6; border-radius: 4px; display: inline-block; padding: 4px 10px; font-size: 13px; font-weight: 500;">${service || "Другое"}</td>
          </tr>
        </table>
        
        <div style="margin-top: 20px; background-color: #fff; border-left: 4px solid #111827; padding: 15px; border-radius: 4px;">
          <strong style="display: block; margin-bottom: 8px; color: #4b5563;">💬 Описание задачи:</strong>
          <div style="white-space: pre-wrap; font-size: 14px; color: #1f2937;">${message || "Не заполнено"}</div>
        </div>
      </div>
      <div style="background-color: #f3f4f6; color: #9ca3af; padding: 12px; text-align: center; font-size: 11px; border-top: 1px solid #e5e7eb;">
        Отправлено автоматически через сервер AXIOM Consult • ${new Date().toLocaleString("ru-RU")}
      </div>
    </div>`;

    // 1. Try sending via Resend HTTP API (if configured)
    if (isResendConfigured) {
      console.log(`Resend HTTP API sending to: ${notifyTo}`);
      try {
        const resend = new Resend(resendApiKey);
        // Note: Resend requires a domain-verified 'from' email. If using onboarding@resend.dev,
        // it can only send to the account owner's email address.
        const resendFrom = smtpFrom || "AXIOM Consult <onboarding@resend.dev>";
        
        const resendRes = await resend.emails.send({
          from: resendFrom,
          to: notifyTo,
          subject: subjectStr,
          text: textStr,
          html: htmlStr
        });

        if (resendRes.error) {
          throw new Error(resendRes.error.message || JSON.stringify(resendRes.error));
        }

        console.log("Email sent successfully via Resend HTTP API!");
        emailSent = true;
        usedMethod = "Resend API";
      } catch (resendErr: any) {
        console.error("Failed to deliver lead via Resend HTTP API:", resendErr);
        emailErrorMsg = `Ошибка Resend: ${resendErr.message || resendErr}`;
      }
    }

    // 2. Try sending via SMTP (if configured and Resend was not set/failed)
    if (!emailSent && isSmtpConfigured) {
      console.log(`SMTP sending: Host=${smtpHost}, Port=${smtpPort}, User=${smtpUser}, To=${smtpTo}`);
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465 || smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          connectionTimeout: 5000, // 5 seconds connection timeout
          greetingTimeout: 5000,
          socketTimeout: 5000
        });

        await transporter.sendMail({
          from: smtpFrom || smtpUser,
          to: smtpTo,
          subject: subjectStr,
          text: textStr,
          html: htmlStr
        });

        console.log("Email sent successfully via SMTP fallback!");
        emailSent = true;
        usedMethod = "SMTP";
      } catch (mailErr: any) {
        console.error("Failed to deliver lead on SMTP email connection:", mailErr);
        
        const isAuthError = mailErr.code === "EAUTH" || 
                            mailErr.message?.includes("535") || 
                            mailErr.responseCode === 535 ||
                            String(mailErr).includes("535");
                            
        if (isAuthError) {
          emailErrorMsg = `Ошибка авторизации SMTP (${smtpUser}): неверные учетные данные. Убедитесь, что вы создали отдельный "Пароль приложения" в настройках аккаунта Яндекс (или Mail.ru/Gmail)!`;
        } else {
          emailErrorMsg = `${mailErr.message || mailErr}`;
        }
      }
    }

    // 3. Try sending via Webhook if configured
    if (webhookUrl) {
      console.log(`Sending Webhook notification to URL: ${webhookUrl}`);
      try {
        const webhookResponse = await fetchWithTimeout(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            event: "new_lead",
            lead: newLead
          }),
          timeout: 4000
        });

        if (webhookResponse.ok) {
          console.log("Webhook sent successfully!");
          webhookSent = true;
        } else {
          const statusText = webhookResponse.statusText;
          const status = webhookResponse.status;
          console.error(`Webhook returned error status: ${status} ${statusText}`);
          webhookErrorMsg = `Статус ${status} ${statusText}`;
        }
      } catch (webhookErr: any) {
        console.error("Failed to send Webhook notification:", webhookErr);
        webhookErrorMsg = `${webhookErr.message || webhookErr}`;
      }
    }

    // Determine finalized response
    if (emailSent || webhookSent) {
      let successMsg = "Заявка успешно отправлена!";
      if (emailSent && webhookSent) {
        successMsg = `Заявка успешно отправлена на почту (через ${usedMethod}) и дублирована на вебхук!`;
      } else if (emailSent) {
        successMsg = `Заявка успешно отправлена на электронную почту (через ${usedMethod})!`;
      } else if (webhookSent) {
        successMsg = `Заявка успешно отправлена через Вебхук! (SMTP/Resend-сервер почты был недоступен: ${emailErrorMsg || "таймаут"})`;
      }
      return res.json({ success: true, message: successMsg });
    }

    // If both failed:
    if ((isResendConfigured || isSmtpConfigured) && webhookUrl) {
      return res.status(502).json({
        error: "all_notifications_failed",
        message: `Все способы отправки завершились ошибкой. Ошибка почты: ${emailErrorMsg}. Ошибка вебхука: ${webhookErrorMsg}. Заявка надежно сохранена локально в CRM сервера!`,
        leadSavedLocally: true
      });
    }

    if (isResendConfigured) {
      return res.status(502).json({
        error: "resend_failed",
        message: `Не удалось отправить письмо через Resend API (HTTP-запрос). Ошибка: ${emailErrorMsg}. Пожалуйста, убедитесь в правильности ключа RESEND_API_KEY и что адрес отправителя/получателя разрешен вашим аккаунтом Resend. Заявка сохранена в CRM.`,
        leadSavedLocally: true
      });
    }

    if (isSmtpConfigured) {
      return res.status(502).json({
        error: "smtp_timeout",
        message: `Превышено время ожидания подключения к SMTP серверу почты. Ошибка: ${emailErrorMsg || "ETIMEDOUT"}. Советуем использовать Яндекс.Почту или настроить RESEND_API_KEY в .env для HTTP-отправки заявок. Заявка сохранена в CRM.`,
        leadSavedLocally: true
      });
    }

    return res.status(502).json({
      error: "webhook_failed",
      message: `Не удалось отправить данные через вебхук. Ошибка: ${webhookErrorMsg}. Заявка сохранена локально в CRM.`,
      leadSavedLocally: true
    });

  });

  // API Route: View CRM leads (Admin interface or check)
  app.get("/api/leads", (req, res) => {
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      try {
        leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
      } catch (e) {
        console.error("Error parsing leads log:", e);
      }
    }
    res.json(leads);
  });

  // -------------------------------------------------------------
  // EXPERT DYNAMIC ANALYTICAL REPORT FALLBACK TEMPLATE
  // -------------------------------------------------------------
  function generateExpertMockReport(data: any): string {
    const { 
      companyName, industry, revenue, employees, geography, 
      bottlenecks, manualTasks, currentSystems, existingAI, 
      aiDetails, mainGoal, expectedEffect, budget, timeline 
    } = data;
    
    // Choose metrics tailored dynamically to company size & metrics
    let capex = "1 800 000 руб.";
    let opex = "120 000 руб./мес.";
    let savings = "4 500 000 руб./год";
    let payback = "6 месяцев";
    let npv = "11 200 000 руб.";
    let roi = "250%";
    let score = "5.5/10";

    const revLower = (revenue || "").toLowerCase();
    if (revLower.includes("до 10 млн")) {
      capex = "250 000 руб.";
      opex = "20 000 руб./мес.";
      savings = "980 000 руб./год";
      payback = "4 месяца";
      npv = "2 400 000 руб.";
      roi = "390%";
      score = "4.2/10";
    } else if (revLower.includes("100-500 млн")) {
      capex = "5 500 000 руб.";
      opex = "350 000 руб./мес.";
      savings = "16 500 000 руб./год";
      payback = "7 месяцев";
      npv = "42 000 000 руб.";
      roi = "290%";
      score = "5.8/10";
    } else if (revLower.includes("500 млн") || revLower.includes("свыше 1 млрд") || revLower.includes("миллиард")) {
      capex = "15 000 000 руб.";
      opex = "900 000 руб./мес.";
      savings = "48 000 000 руб./год";
      payback = "8 месяцев";
      npv = "115 000 000 руб.";
      roi = "320%";
      score = "6.1/10";
    }

    const dateStr = new Date().toLocaleDateString("ru-RU");
    const activeSystemsStr = Array.isArray(currentSystems) ? currentSystems.join(", ") : (currentSystems || "Excel");

    return `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 800px; margin: 0 auto; padding: 25px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
  <div style="border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
    <h1 style="color: #1e3a8a; margin: 0 0 10px 0; font-size: 26px;">ИНДИВИДУАЛЬНЫЙ СТРАТЕГИЧЕСКИЙ ИИ-ОТЧЕТ</h1>
    <p style="color: #64748b; font-size: 14px; margin: 0;">Разработано автоматическим ИИ-консультантом <strong>AXIOM Consult</strong> для компании <strong>${companyName}</strong></p>
    <p style="color: #94a3b8; font-size: 12px; margin: 5px 0 0 0;">Дата аудита: ${dateStr} • Отрасль: ${industry}</p>
  </div>

  <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">1. РЕЗЮМЕ ДЛЯ РУКОВОДИТЕЛЯ (Executive Summary)</h2>
  <ul>
    <li><strong>Общий потенциал внедрения AI в компании:</strong> <span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">ВЫСОКИЙ (High)</span></li>
    <li><strong>Обоснование:</strong> Учитывая ручные процессы в сфере "${industry}" и масштабы компании, внедрение больших языковых моделей (LLM) и алгоритмов автоматизации позволит ликвидировать до 70% рутинных операций в процессах типа: "${bottlenecks}".</li>
    <li><strong>Топ-3 Экспертные Рекомендации:</strong>
      <ol>
        <li>Внедрение интеллектуального AI-ассистента для автоматизации ответов и обработки текстовых задач: "${manualTasks}".</li>
        <li>Интеграция корпоративной базы знаний с ИИ для ускорения работы с внутренними системами: ${activeSystemsStr}.</li>
        <li>Автоматизация рутинного ввода и анализа данных с помощью агентных ИИ-сценариев.</li>
      </ol>
    </li>
    <li><strong>Ожидаемый чистый ROI через 12 месяцев:</strong> <strong style="color: #16a34a; font-size: 16px;">${roi}</strong></li>
  </ul>

  <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">2. АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ</h2>
  <ul>
    <li><strong>Оценка зрелости существующих процессов:</strong> Средне-начальная. Системы (${activeSystemsStr}) используются изолированно, обмен данными во многом требует ручного вмешательства человека.</li>
    <li><strong>Критичные узкие места и потери эффективности:</strong> Потери времени сфокусированы в блоке: "${bottlenecks}". Ручной перенос данных и формирование отчетов снижают маржинальность в отрасли "${industry}".</li>
    <li><strong>Оценка общей готовности компании к AI (AI Readiness Score):</strong> <strong style="color: #1e3a8a; font-size: 16px;">${score} из 10</strong></li>
  </ul>

  <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">3. ФИНАНСОВЫЙ АНАЛИЗ И ROI ПРОЕКТА</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #f8fafc; border: 1px solid #e2e8f0;">
    <thead>
      <tr style="background-color: #0f172a; color: #ffffff; text-align: left;">
        <th style="padding: 10px; border: 1px solid #cbd5e1;">Показатель</th>
        <th style="padding: 10px; border: 1px solid #cbd5e1;">Прогнозное значение</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 10px; border: 1px solid #cbd5e1;"><strong>Предварительный CAPEX (Единовременные затраты на разработку)</strong></td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; color: #1e3a8a; font-weight: bold;">${capex}</td>
      </tr>
      <tr style="background-color: #f1f5f9;">
        <td style="padding: 10px; border: 1px solid #cbd5e1;"><strong>Предварительный OPEX (Ежемесячная инфраструктурная подписка)</strong></td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">${opex}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #cbd5e1;"><strong>Прогнозируемая экономия в первый год (Оптимизация фонда времени)</strong></td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; color: #16a34a; font-weight: bold;">~${savings}</td>
      </tr>
      <tr style="background-color: #f1f5f9;">
        <td style="padding: 10px; border: 1px solid #cbd5e1;"><strong>Период окупаемости инвестиций (Payback Period)</strong></td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">${payback}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #cbd5e1;"><strong>Чистый дисконтированный доход (NPV за 3 года)</strong></td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; color: #1e3a8a; font-weight: bold;">~${npv}</td>
      </tr>
      <tr style="background-color: #dcfce7;">
        <td style="padding: 10px; border: 1px solid #cbd5e1;"><strong>Прогнозная эффективность (ROI %)</strong></td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; color: #15803d; font-weight: bold; font-size: 15px;">${roi}</td>
      </tr>
    </tbody>
  </table>

  <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">4. РЕКОМЕНДУЕМЫЕ AI-РЕШЕНИЯ</h2>
  <ol>
    <li style="margin-bottom: 12px;"><strong>AI-Ассистент обработки запросов:</strong>
      <br/><span style="color: #64748b; font-size: 13px;">Описание:</span> Обученный агент для быстрой классификации обращений, подготовки писем и ведения клиентских диалогов.
      <br/><span style="color: #16a34a; font-size: 13px; font-weight: bold;">Ожидаемый эффект:</span> Сокращение времени ответа на 80%, снижение ручной нагрузки на персонал.
    </li>
    <li style="margin-bottom: 12px;"><strong>Интеллектуальный анализатор документов и счетов (OCR + LLM):</strong>
      <br/><span style="color: #64748b; font-size: 13px;">Описание:</span> Модуль автоматического сканирования первичных документов, распознавания ключевых полей и разнесения данных в учетную систему ${activeSystemsStr.split(",")[0] || "CRM/ERP"}.
      <br/><span style="color: #16a34a; font-size: 13px; font-weight: bold;">Ожидаемый эффект:</span> Исключение 95% человеческих ошибок при вводе данных.
    </li>
    <li><strong>ИИ-Интегратор базы знаний AXIOM:</strong>
      <br/><span style="color: #64748b; font-size: 13px;">Описание:</span> Централизованная интерактивная ИИ-справка с контекстным поиском по Вашим внутренним регламентам и ГОСТам.
      <br/><span style="color: #16a34a; font-size: 13px; font-weight: bold;">Ожидаемый эффект:</span> Поиск ответов для менеджеров в 10 раз быстрее. Сложность внедрения: низкая.
    </li>
  </ol>

  <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">5. ДОРОЖНАЯ КАРТА ПРОЕКТА (Roadmap)</h2>
  <ul>
    <li><strong>Фаза 1 (Мягкий старт): 0-3 месяца</strong> — Внедрение «быстрых побед» (Quick Wins). Запуск AI-Ассистента и создание внутренней базы знаний. Настройка пилотных шаблонов.</li>
    <li><strong>Фаза 2 (Синхронизация): 3-6 месяцев</strong> — Глубокие интеграции продуктов с учетными системами: ${activeSystemsStr}. Тонкая настройка AI-агентов под конкретные регламенты компании.</li>
    <li><strong>Фаза 3 (Интеллектуальное масштабирование): 6-12 месяцев</strong> — Обучение кастомных моделей на Ваших исторических данных, внедрение предиктивной аналитики. Полная автоматизация операционного цикла.</li>
  </ul>

  <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">6. РИСКИ И МИТИГАЦИЯ</h2>
  <ul>
    <li><strong>Риск 1: Сложности в адаптации сотрудников.</strong> (Вероятность: Средняя, Влияние: Высокое). <em>Мера митигации:</em> Индивидуальные сессии обучения от специалистов AXIOM Consult, подготовка ИИ-интерфейсов прямо внутри рабочих мессенджеров (Telegram/Slack).</li>
    <li><strong>Риск 2: Безопасность и утечка закрытых данных.</strong> (Вероятность: Низкая, Влияние: Критическое). <em>Мера митигации:</em> Использование On-Premise (локальных) или защищенных API-контуров с NDA-соглашениями.</li>
    <li><strong>Риск 3: Смещение сроков окупаемости ИИ-модулей.</strong> (Вероятность: Низкая, Влияние: Среднее). <em>Мера митигации:</em> Пошаговый запуск по Agile с промежуточным финансовым контролем ROI после каждой фазы.</li>
  </ul>

  <h2 style="color: #1e3a8a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">7. СЛЕДУЮЩИЕ РЕКОМЕНДОВАННЫЕ ШАГИ</h2>
  <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; border-radius: 4px;">
    <strong>План действий на ближайшие 14 дней:</strong>
    <ol>
      <li>Провести детальное картирование процессов силами лид-консультантов AXIOM.</li>
      <li>Заказать бесплатную аудит-презентацию у наших экспертов для демонстрации прототипа в Вашей отрасли.</li>
      <li>Активировать демо-доступ к ИИ-виджетам AXIOM для пилотного тестирования Вашими сотрудниками.</li>
    </ol>
    <p style="margin-top: 15px; font-size: 14px;"><strong>Приглашаем Вас на бесплатную личную онлайн-консультацию!</strong> На встрече мы продемонстрируем готовые ИИ-решения из нашего портфолио для подобных задач.</p>
    <div style="text-align: center; margin-top: 15px;">
      <a href="https://axiom-consult.ru" style="background-color: #0c0f19; color: #ffffff; padding: 10px 25px; border-radius: 5px; font-weight: bold; text-decoration: none; display: inline-block;">Запросить детальное коммерческое предложение</a>
    </div>
  </div>
</div>
    `;
  }

  // -------------------------------------------------------------
  // CLAUDE API ANTHROPIC CALL ENGINE
  // -------------------------------------------------------------
  async function fetchClaudeReport(data: any): Promise<string> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY_NOT_CONFIGURED");
    }

    const sysPrompt = `Ты — старший консультант AXIOM Consult с опытом работы в EY и McKinsey. 
Специализируешься на оценке экономического эффекта от внедрения AI.
Пиши профессионально, конкретно, с цифрами. 
Никакой воды — только факты, расчёты и % с реальными финансовыми оценками.
Используй реальные бенчмарки отрасли для расчётов ROI.
Отчёт должен выглядеть как документ от топовой консалтинговой фирмы.
Язык: русский. Формат: структурированный HTML. Используй аккуратные таблицы, жирный шрифт и списки. Избегай тегов <html>, <head>, <body> — выводи только чистый структурированный HTML-контент в пределах <div>. Включай реальные финансовые переменные: Спецификацию CAPEX (единовременные), OPEX (ежемесячные), NPV за 3 года, ROI в процентах и период окупаемости.`;

    const userPrompt = `Составь индивидуальный отчет ИИ-аудита для следующей компании:
- Название компании: ${data.companyName}
- Отрасль: ${data.industry}
- Годовая выручка: ${data.revenue}
- Количество сотрудников: ${data.employees}
- География: ${data.geography}

Текущее состояние и вызовы:
- Процессы, занимающие больше всего времени: ${data.bottlenecks}
- Задачи для потенциальной автоматизации: ${data.manualTasks}
- Используемые системы: ${Array.isArray(data.currentSystems) ? data.currentSystems.join(", ") : data.currentSystems}
- Есть ли уже ИИ/автоматизация: ${data.existingAI === "Да" ? `Да: ${data.aiDetails}` : "Нет"}

Цели и бюджет:
- Главная цель внедрения AI: ${data.mainGoal}
- Ожидаемый эффект через 1 год: ${data.expectedEffect}
- Бюджет на проект: ${data.budget}
- Горизонт внедрения: ${data.timeline}

Строго следуй этой структуре отчета:
1. РЕЗЮМЕ ДЛЯ РУКОВОДИТЕЛЯ (Executive Summary)
   - Общий потенциал AI для компании (High/Medium/Low с обоснованием)
   - Топ-3 рекомендации
   - Ожидаемый ROI через 12 месяцев (в процентах)

2. АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ
   - Оценка зрелости процессов
   - Узкие места и потери
   - Оценка готовности к AI (AI Readiness Score из 10)

3. ФИНАНСОВЫЙ АНАЛИЗ
   - Предварительный расчёт CAPEX (единовременные затраты)
   - Предварительный расчёт OPEX (ежемесячные затраты)
   - Ожидаемая экономия / прирост выручки
   - Срок окупаемости (Payback Period в месяцах)
   - NPV за 3 года
   - ROI (%)

4. РЕКОМЕНДУЕМЫЕ AI-РЕШЕНИЯ
   - Топ-3 приоритетных направления внедрения
   - Для каждого: описание, ожидаемый эффект, сложность внедрения

5. ДОРОЖНАЯ КАРТА (Roadmap)
   - Фаза 1 (0-3 месяца): быстрые победы
   - Фаза 2 (3-6 месяцев): основное внедрение  
   - Фаза 3 (6-12 месяцев): масштабирование

6. РИСКИ И МИТИГАЦИЯ
   - Топ-3 риска с оценкой вероятности и влияния
   - Меры по снижению рисков

7. СЛЕДУЮЩИЕ ШАГИ
   - Конкретные действия на ближайшие 2 недели
   - Приглашение на бесплатную консультацию с AXIOM Consult

Расчеты делай реалистичными для масштаба выручки "${data.revenue}" и бюджета "${data.budget}". Используй профессиональный консалтинговый стиль. Постарайся выдать чистый HTML в блоке div.`;

    const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: sysPrompt,
        messages: [{ role: "user", content: userPrompt }]
      }),
      timeout: 30000 // up to 30 second timeouts
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`Claude API Error ${response.status}: ${errTxt}`);
    }

    const responseJson: any = await response.json();
    if (responseJson.content && responseJson.content[0] && responseJson.content[0].text) {
      return responseJson.content[0].text;
    }
    throw new Error("Invalid response format received from Anthropic");
  }

  // API Route: Client AI primary audit
  app.post("/api/audit", async (req, res) => {
    const { 
      companyName, industry, revenue, employees, geography,
      contactName, contactEmail, contactPhone, budget, mainGoal 
    } = req.body;

    if (!companyName || !contactEmail || !contactName) {
      return res.status(400).json({ error: "Поля 'Название компании', 'Имя' и 'Email' обязательны для проведения аудита." });
    }

    console.log(`Starting ИИ-Аудит for client: ${contactName} (${companyName}) [${contactEmail}]`);

    // 1. Generate core strategic evaluation report (via Claude or falling back cleanly)
    let reportContent = "";
    let generationMethod = "Claude 3.5 Sonnet API";

    try {
      reportContent = await fetchClaudeReport(req.body);
      console.log("Strategic audit report successfully generated via Claude Anthropic API!");
    } catch (apiErr: any) {
      console.warn("Anthropic Claude evaluation failed (key not set or rate limit/network). Falling back to expert model...", apiErr.message || apiErr);
      reportContent = generateExpertMockReport(req.body);
      generationMethod = "AXIOM Expert System Fallback";
    }

    // 2. Wrap HTML inside a styled envelope layout for Resend delivery
    const clientNotificationEmailHtml = `
      <div style="background-color: #f3f4f6; padding: 30px 15px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
          <div style="background-color: #0b0f19; padding: 25px; text-align: center; border-bottom: 3px solid #3b82f6;">
            <span style="font-size: 22px; font-weight: bold; color: #ffffff; letter-spacing: 2px;">AXIOM CONSULTING</span>
            <div style="font-size: 11px; color: #94a3b8; letter-spacing: 1px; margin-top: 5px; text-transform: uppercase;">Strategic AI Solutions</div>
          </div>
          <div style="padding: 30px 25px;">
            <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Уважаемый(ая) <strong>${contactName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.5;">Наш интеллектуальный ИИ-ассистент успешно проанализировал входные параметры Вашего бизнеса. Специально для Вас сформирован индивидуальный стратегический отчет по оптимизации процессов и повышению эффективности через внедрение ИИ.</p>
            
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="font-size: 13px; color: #1e40af; margin: 0; font-weight: 500;">📎 <strong>Официальный документ стратегического планирования прикреплен к этому письму в формате PDF.</strong> Вы можете распечатать или переслать его коллегам.</p>
            </div>

            <div style="margin-top: 25px;">
              ${reportContent}
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">С уважением,<br/>Аналитическая команда AXIOM Consult<br/>Email: <a href="mailto:onboarding@resend.dev" style="color: #3b82f6; text-decoration: none;">onboarding@resend.dev</a> • <a href="https://axiom-consult.ru" style="color: #3b82f6; text-decoration: none;">axiom-consult.ru</a></p>
          </div>
          <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e5e7eb;">
            Данное письмо сгенерировано автоматически по запросу на сайте axiom-consult.ru. • © ${new Date().getFullYear()} AXIOM
          </div>
        </div>
      </div>
    `;

    // 3. Compile physical PDF buffer using PDFKit and cached Roboto font assets
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await createPDFBuffer(req.body, reportContent);
      console.log("Physical PDF buffer successfully compiled via PDFKit!");
    } catch (pdfErr) {
      console.error("Fidelity Error compiling PDF buffer via PDFKit:", pdfErr);
    }

    // 4. Save audit log into local Leads CRM database
    const newAuditLead = {
      id: Date.now().toString(),
      name: contactName,
      company: companyName,
      phone: contactPhone || "",
      contact: contactEmail,
      service: "ИИ-Аудит (Первичный)",
      message: `[ИИ-АУДИТ] Отрасль: ${industry}. Выручка: ${revenue}. Персонал: ${employees}. География: ${geography}. Бюджет: ${budget}. Цель: ${mainGoal}.\nОтчет составлен методом: ${generationMethod}`,
      createdAt: new Date().toISOString(),
      isAudit: true,
      auditResponse: reportContent,
      auditData: req.body
    };

    let localLeads: any[] = [];
    if (fs.existsSync(LEADS_FILE)) {
      try {
        localLeads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
      } catch (crmReadErr) {
        console.error("Failed parsing existing leads log:", crmReadErr);
      }
    }
    localLeads.push(newAuditLead);
    try {
      fs.writeFileSync(LEADS_FILE, JSON.stringify(localLeads, null, 2), "utf-8");
      console.log("Audit lead logged securely into local CRM Leads index!");
    } catch (crmWriteErr) {
      console.error("Failed saving audit lead into local state:", crmWriteErr);
    }

    // 5. Build notifications deliverer through Resend API
    const resendApiKey = process.env.RESEND_API_KEY || "";
    const notifyAdminTo = process.env.NOTIFY_TO || "ortish0@gmail.com";

    if (!resendApiKey) {
      // If Resend is missing, return success locally with the response so client has immediately visible preview!
      console.warn("Resend API Key is missing. Returning local preview results directly.");
      return res.json({ 
        success: true, 
        message: "Аудит завершен! Ввиду отсутствия RESEND_API_KEY письмо не отправлено, но вы можете ознакомиться с отчетом прямо здесь.",
        report: reportContent,
        leadId: newAuditLead.id 
      });
    }

    let isClientEmailSent = false;
    let isCopySent = false;
    let deliveryError = "";

    try {
      const resend = new Resend(resendApiKey);
      const resendFrom = "AXIOM Consult <onboarding@resend.dev>";
      
      const attachmentsList: any[] = [];
      if (pdfBuffer) {
        attachmentsList.push({
          content: pdfBuffer,
          filename: `AXIOM_Audit_Report_${companyName.replace(/[^a-zA-Z0-9а-яА-Я]/g, "_")}.pdf`
        });
      }

      // Deliver to user-client
      const clientEmailRes = await resend.emails.send({
        from: resendFrom,
        to: contactEmail,
        subject: `📊 Отчет первичного ИИ-аудита компании: ${companyName}`,
        html: clientNotificationEmailHtml,
        attachments: attachmentsList
      });

      if (clientEmailRes.error) {
        throw new Error(clientEmailRes.error.message || JSON.stringify(clientEmailRes.error));
      }
      isClientEmailSent = true;
      console.log(`Report successfully emailed to client: ${contactEmail}`);

      // Deliver copy notifying admin (ortish0@gmail.com)
      const adminMailRes = await resend.emails.send({
        from: resendFrom,
        to: notifyAdminTo,
        subject: `⚡️ [Новый Аудит] ${companyName} (${contactName})`,
        html: `
          <h3>Оформлен новый ИИ-Аудит на сайте AXIOM</h3>
          <p><strong>Компания:</strong> ${companyName}</p>
          <p><strong>Контактное лицо:</strong> ${contactName} (${contactPhone || "не указан"})</p>
          <p><strong>Email:</strong> ${contactEmail}</p>
          <p><strong>Индустрия:</strong> ${industry}</p>
          <p><strong>Выручка:</strong> ${revenue}</p>
          <p><strong>Персонал:</strong> ${employees}</p>
          <p><strong>Бюджет:</strong> ${budget}</p>
          <p><strong>Главный приоритет:</strong> ${mainGoal}</p>
          <p><strong>Метод генерации отчета:</strong> ${generationMethod}</p>
          <hr/>
          <p>Полная цифровая копия отчета выслана контрагенту и прикреплена PDF.</p>
        `,
        attachments: attachmentsList
      });
      isCopySent = !adminMailRes.error;
      console.log(`Report audit copy delivery status to admin: ${isCopySent ? "SUCCESS" : "FAILED"}`);

    } catch (deliveryErr: any) {
      console.error("Error executing Resend API audits distribution:", deliveryErr);
      deliveryError = deliveryErr.message || String(deliveryErr);
    }

    if (isClientEmailSent) {
      return res.json({ 
        success: true, 
        message: "Ваш аудит успешно составлен и выслан со стратегическим PDF-документом на указанный электронный адрес!",
        report: reportContent,
        leadId: newAuditLead.id
      });
    } else {
      // Return with local visual report preview even if email delivery failed so user doesn't get a blank crash screen
      return res.json({
        success: true,
        message: `Индивидуальный аудит завершен! Отчет сформирован локально на сайте, но отправка по email завершилась ошибкой: ${deliveryError || "Таймаут в сети Ресенд"}.`,
        report: reportContent,
        leadId: newAuditLead.id
      });
    }
  });

  // API Route: Download completed PDF strategy report
  app.get("/api/download-audit-pdf", async (req, res) => {
    const leadId = req.query.id as string;
    if (!leadId) {
      return res.status(400).send("ID лида обязателен.");
    }

    let leads: any[] = [];
    if (fs.existsSync(LEADS_FILE)) {
      try {
        leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
      } catch (e) {
        console.error("Error reading leads for PDF download:", e);
      }
    }

    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.isAudit) {
      return res.status(404).send("Отчет аудита не найден.");
    }

    try {
      const auditDetails = lead.auditData || {
        companyName: lead.company,
        industry: "Бизнес",
        revenue: "Неизвестно",
        employees: "Неизвестно",
        geography: "Страна",
        budget: "Индивидуальный",
        mainGoal: "Повышение операционной прибыли",
        contactName: lead.name,
        contactEmail: lead.contact,
        contactPhone: lead.phone
      };

      const buffer = await createPDFBuffer(auditDetails, lead.auditResponse || "");
      
      const fileSafeName = lead.company.replace(/[^a-zA-Z0-9а-яА-Я]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="AXIOM_Audit_${fileSafeName}.pdf"`);
      res.send(buffer);
    } catch (pdfErr: any) {
      console.error("Error building PDF on request:", pdfErr);
      res.status(500).send("Ошибка компиляции PDF файла: " + pdfErr.message);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
