// ============================================================
// server.js — сердце мессенджера.
//
// Что делает этот файл (по шагам, для понимания):
// 1. Поднимает веб-сервер (Express), который отдаёт браузеру
//    файлы интерфейса из папки /public (HTML, CSS, JS).
// 2. Поднимает поверх него Socket.IO — это то, что даёт
//    "реальное время": сервер и браузер держат постоянное
//    соединение и мгновенно обмениваются событиями,
//    вместо того чтобы браузер каждые N секунд спрашивал
//    "а есть новые сообщения?" (это называется polling).
// 3. Хранит список подключённых пользователей и историю
//    сообщений ПРЯМО В ПАМЯТИ (в обычных JS-переменных).
//    Это самое важное ограничение прототипа: как только
//    сервер перезапускается — вся история и все пользователи
//    исчезают. Настоящий мессенджер вместо этого пишет всё
//    в базу данных (PostgreSQL/MongoDB), которая переживает
//    перезапуски. Это следующий шаг после этого прототипа.
//
// Регистрации нет: пользователь просто вводит имя при входе.
// Все, кто открыл страницу, попадают в одну общую комнату.
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ─── Хранилище в памяти ────────────────────────────────────
// В реальном проекте это были бы таблицы в базе данных.
const onlineUsers = new Map(); // socket.id -> { name }
const messageHistory = [];     // последние сообщения (для тех, кто только зашёл)
const HISTORY_LIMIT = 50;

// Отдаём статические файлы интерфейса (index.html, style.css, client.js)
app.use(express.static('public'));

// ─── Обработка WebSocket-соединений ────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Новое подключение: ${socket.id}`);

  // Клиент присылает своё имя после того, как ввёл его на странице
  socket.on('join', (name) => {
    const cleanName = String(name || 'Гость').trim().slice(0, 30) || 'Гость';
    onlineUsers.set(socket.id, { name: cleanName });

    // Отправляем новому пользователю историю сообщений,
    // чтобы он видел, что было до его входа
    socket.emit('history', messageHistory);

    // Сообщаем всем (включая нового пользователя), кто сейчас онлайн
    io.emit('online_users', Array.from(onlineUsers.values()).map(u => u.name));

    // Системное сообщение о том, что кто-то присоединился
    const systemMsg = {
      type: 'system',
      text: `${cleanName} присоединился к чату`,
      time: Date.now(),
    };
    messageHistory.push(systemMsg);
    io.emit('message', systemMsg);
  });

  // Клиент отправил сообщение
  socket.on('send_message', (text) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return; // если человек не представился — игнорируем

    const trimmed = String(text || '').trim().slice(0, 2000);
    if (!trimmed) return;

    const message = {
      type: 'message',
      author: user.name,
      text: trimmed,
      time: Date.now(),
    };

    messageHistory.push(message);
    if (messageHistory.length > HISTORY_LIMIT) {
      messageHistory.shift(); // не даём истории расти бесконечно
    }

    // Рассылаем сообщение вообще всем подключённым клиентам —
    // это и есть суть "реального времени": получатель видит
    // сообщение мгновенно, без обновления страницы.
    io.emit('message', message);
  });

  // Пользователь печатает — покажем остальным индикатор "печатает..."
  socket.on('typing', () => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.broadcast.emit('typing', user.name);
  });

  // Разрыв соединения (закрыл вкладку, потерял интернет и т.д.)
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      const systemMsg = {
        type: 'system',
        text: `${user.name} вышел из чата`,
        time: Date.now(),
      };
      messageHistory.push(systemMsg);
      io.emit('message', systemMsg);
      io.emit('online_users', Array.from(onlineUsers.values()).map(u => u.name));
    }
    console.log(`❌ Отключение: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});
