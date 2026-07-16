# FlexPro sayt

FlexPro (BIOGENICA) uchun lead-gen landing. Forma to'ldirilganda lid Telegram guruhga tushadi.

## Ishga tushirish

Dependency yo'q — faqat Node 18+:

```
npm start
```

## Env o'zgaruvchilar (majburiy)

| Nomi | Tavsif |
|---|---|
| `BOT_TOKEN` | Telegram bot tokeni |
| `CHAT_ID` | Lidlar tushadigan guruh ID (masalan `-5206932078`) |
| `PORT` | Railway avtomatik beradi |

## Tuzilishi

- `server.js` — statik server + `POST /api/lead` → Telegram sendMessage (Range-so'rovlar qo'llanadi, iOS Safari audio uchun)
- `public/index.html` — sahifa
- `public/audio/rev1..5.mp3` — mijozlarning ovozli sharhlari
- `GET /health` — monitoring uchun
