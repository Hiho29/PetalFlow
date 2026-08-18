// ============================================================
// client.js — то, что выполняется в браузере пользователя.
//
// Задача этого файла:
// 1. Установить соединение с сервером через Socket.IO.
// 2. Отправлять то, что печатает пользователь.
// 3. Получать сообщения от сервера и рисовать их на экране.
//
// Ключевая идея: браузер НИЧЕГО не решает про то, кому что
// отправлять — он просто говорит серверу "вот моё сообщение",
// а сервер уже сам рассылает его всем. Браузер только рисует
// то, что ему прислали.
// ============================================================

const socket = io(); // подключаемся к серверу, который раздал эту страницу

let myName = '';

// ─── Элементы интерфейса ────────────────────────────────────
const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');
const meName = document.getElementById('me-name');

const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

const onlineList = document.getElementById('online-list');
const connDot = document.getElementById('conn-dot');
const connText = document.getElementById('conn-text');
const typingIndicator = document.getElementById('typing-indicator');

// ─── Вход в чат ──────────────────────────────────────────────
function joinChat() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  myName = name;
  meName.textContent = myName;

  joinScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');

  // Сообщаем серверу, под каким именем мы заходим
  socket.emit('join', myName);
  messageInput.focus();
}

joinBtn.addEventListener('click', joinChat);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinChat();
});

// ─── Отправка сообщений ─────────────────────────────────────
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit('send_message', text);
  messageInput.value = '';
});

// Индикатор "печатает…" — оповещаем сервер при вводе текста
let typingTimeout;
messageInput.addEventListener('input', () => {
  socket.emit('typing');
});

// ─── Приём событий от сервера ───────────────────────────────

socket.on('connect', () => {
  connDot.classList.add('online');
  connText.textContent = 'на связи';
});

socket.on('disconnect', () => {
  connDot.classList.remove('online');
  connText.textContent = 'соединение потеряно';
});

// История сообщений при входе
socket.on('history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach(renderMessage);
  scrollToBottom();
});

// Новое сообщение (своё или чужое, системное или обычное)
socket.on('message', (message) => {
  renderMessage(message);
  scrollToBottom();
});

// Список тех, кто сейчас на связи
socket.on('online_users', (names) => {
  onlineList.innerHTML = '';
  names.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name === myName ? `${name} (вы)` : name;
    onlineList.appendChild(li);
  });
});

// Кто-то печатает
socket.on('typing', (name) => {
  typingIndicator.textContent = `${name} печатает…`;
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingIndicator.textContent = '';
  }, 1500);
});

// ─── Отрисовка одного сообщения ─────────────────────────────
function renderMessage(message) {
  const el = document.createElement('div');

  if (message.type === 'system') {
    el.className = 'msg system';
    el.textContent = message.text;
    messagesEl.appendChild(el);
    return;
  }

  const isOwn = message.author === myName;
  el.className = 'msg' + (isOwn ? ' own' : '');

  const authorEl = document.createElement('span');
  authorEl.className = 'msg-author';
  authorEl.textContent = isOwn ? 'вы' : message.author;

  const textEl = document.createElement('span');
  textEl.textContent = message.text;

  const timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = formatTime(message.time);

  el.appendChild(authorEl);
  el.appendChild(textEl);
  el.appendChild(timeEl);
  messagesEl.appendChild(el);
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
