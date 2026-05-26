import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Setup config path for local chat ID storage
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "telegram_config.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

// Insure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default credentials from the user
const DEFAULT_BOT_TOKEN = "8754434309:AAHck5PJ7CN35P_XgqhFqALnSi3pCkVpGBI";
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

// Function to try to auto-detect Chat ID by pulling bot updates
async function autoDetectChatId(): Promise<number | string | null> {
  const token = config.botToken || DEFAULT_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  try {
    const res = await fetch(url);
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

    // Prepare Telegram Bot delivery
    let currentChatId = process.env.TELEGRAM_CHAT_ID || config.chatId;
    if (!currentChatId) {
      // Try active retrieval
      currentChatId = await autoDetectChatId();
    }

    if (!currentChatId) {
      // Inform the client that they must start the bot
      return res.status(412).json({
        error: "telegram_not_started",
        message: "Бот не активирован администратором. Пожалуйста, найдите бота @Axiomconsultbot в Telegram, нажмите 'Запустить' и попробуйте отправить заново!",
        leadSavedLocally: true
      });
    }

    const token = config.botToken || DEFAULT_BOT_TOKEN;

    // Helper to escape HTML characters from user input to prevent Telegram parsing crashes
    const escapeHtml = (unsafe: string): string => {
      if (!unsafe) return "";
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    const safeName = escapeHtml(name);
    const safeCompany = escapeHtml(company || "Не указана");
    const safePhone = escapeHtml(phone || "Не указан");
    const safeContact = escapeHtml(contact);
    const safeService = escapeHtml(service);
    const safeMessage = escapeHtml(message || "Не заполнено");

    const text = `🔥 <b>Новая заявка с сайта AXIOM</b>\n\n` +
                 `👤 <b>Имя:</b> ${safeName}\n` +
                 `🏢 <b>Организация:</b> ${safeCompany}\n` +
                 `📱 <b>Телефон:</b> ${safePhone}\n` +
                 `📞 <b>Контакты:</b> ${safeContact}\n` +
                 `💡 <b>Сфера:</b> ${safeService}\n` +
                 `💬 <b>Задача:</b>\n${safeMessage}\n\n` +
                 `🕒 <i>Отправлено: ${new Date().toLocaleString("ru-RU")}</i>`;

    try {
      const telRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: currentChatId,
          text: text,
          parse_mode: "HTML"
        })
      });

      const telData: any = await telRes.json();
      if (!telRes.ok || !telData.ok) {
        console.error("Telegram delivery error:", telData);
        // Avoid 502 status as cloud reverse proxies (Nginx/Cloud Run) intercept 5xx and overwrite with generic HTML
        return res.status(400).json({
          error: "telegram_api_error",
          message: `Ошибка доставки в Telegram: ${telData.description || telRes.statusText}`,
          leadSavedLocally: true
        });
      }

      return res.json({ success: true, message: "Заявка успешно отправлена!" });
    } catch (err: any) {
      console.error("Network error sending to Telegram:", err);
      // Avoid 500 status as cloud reverse proxies intercept 5xx and overwrite with generic HTML
      return res.status(400).json({
        error: "server_network_error",
        message: "Службы Telegram временно недоступны, но ваша заявка успешно сохранена в нашей локальной панели CRM.",
        leadSavedLocally: true
      });
    }
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
