const STORAGE_KEY = 'puen-ai-chat-v1';
const $ = (selector) => document.querySelector(selector);
const chatArea = $('#chatArea');
const welcome = $('#welcome');
const messagesEl = $('#messages');
const form = $('#chatForm');
const input = $('#messageInput');
const sendButton = $('#sendButton');
const dialog = $('#settingsDialog');
let conversations = loadConversations();
let activeId = null;
let busy = false;
let engine = null;
let loadingModel = false;
const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

function loadConversations() {
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); }
function currentChat() { return conversations.find(chat => chat.id === activeId); }
function newChat() {
  activeId = null;
  messagesEl.innerHTML = '';
  welcome.hidden = false;
  renderHistory();
  input.focus();
  closeMobileSidebar();
}
function renderHistory() {
  const list = $('#historyList');
  list.innerHTML = '';
  conversations.slice().reverse().forEach(chat => {
    const row = document.createElement('button');
    row.className = `history-item${chat.id === activeId ? ' active' : ''}`;
    row.innerHTML = '<span class="history-symbol">▢</span><span></span>';
    row.querySelector('span:last-child').textContent = chat.title || 'แชตใหม่';
    row.type = 'button';
    row.addEventListener('click', () => openChat(chat.id));
    list.appendChild(row);
  });
}
function openChat(id) {
  const chat = conversations.find(item => item.id === id);
  if (!chat) return;
  activeId = id;
  welcome.hidden = true;
  messagesEl.innerHTML = '';
  chat.messages.forEach(message => addMessage(message.role, message.content, false));
  renderHistory();
  scrollBottom();
  closeMobileSidebar();
}
function addMessage(role, content, shouldScroll = true) {
  const message = document.createElement('article');
  message.className = `message ${role}`;
  if (role === 'assistant') {
    const avatar = document.createElement('div'); avatar.className = 'message-avatar assistant-avatar'; avatar.textContent = '✳';
    const bodyWrap = document.createElement('div'); bodyWrap.className = 'message-body';
    const text = document.createElement('div'); text.className = 'message-text'; text.textContent = content;
    bodyWrap.appendChild(text);
    const actions = document.createElement('div'); actions.className = 'message-actions';
    const copy = document.createElement('button'); copy.className = 'copy-button'; copy.type = 'button'; copy.textContent = 'คัดลอก';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(content); copy.textContent = 'คัดลอกแล้ว'; setTimeout(() => copy.textContent = 'คัดลอก', 1400); } catch { showToast('คัดลอกไม่สำเร็จ'); } });
    actions.appendChild(copy); bodyWrap.appendChild(actions);
    message.append(avatar, bodyWrap);
  } else {
    const body = document.createElement('div'); body.className = 'message-body'; body.textContent = content;
    message.appendChild(body);
  }
  messagesEl.appendChild(message);
  if (shouldScroll) scrollBottom();
  return message;
}
function showTyping() {
  const row = document.createElement('article'); row.className = 'message assistant'; row.id = 'typingRow';
  row.innerHTML = '<div class="message-avatar assistant-avatar">✳</div><div class="typing"><i></i><i></i><i></i></div>';
  messagesEl.appendChild(row); scrollBottom();
}
function scrollBottom() { requestAnimationFrame(() => chatArea.scrollTop = chatArea.scrollHeight); }
function showToast(text) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = text; document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}
function setModelStatus(status, ready = false) {
  const dot = document.querySelector('.status-dot');
  dot.classList.toggle('ready', ready);
  dot.classList.toggle('loading', status.includes('กำลัง'));
  $('#connectionLabel').textContent = status;
  $('#modelStatusLabel').textContent = status;
}
function openSettings() { dialog.showModal(); }
function closeMobileSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
function appendError(text) {
  const last = messagesEl.lastElementChild;
  if (last?.classList.contains('assistant')) {
    const box = document.createElement('div'); box.className = 'error-box'; box.textContent = text; last.querySelector('.message-body')?.appendChild(box);
  } else { const box = document.createElement('div'); box.className = 'error-box'; box.textContent = text; messagesEl.appendChild(box); }
  scrollBottom();
}
function titleFrom(text) { return text.length > 28 ? `${text.slice(0, 28)}…` : text; }

async function sendMessage(text) {
  const clean = text.trim();
  if (!clean || busy) return;
  welcome.hidden = true;
  if (!activeId) {
    const chat = { id: crypto.randomUUID(), title: titleFrom(clean), messages: [] };
    conversations.push(chat); activeId = chat.id;
  }
  const chat = currentChat();
  chat.messages.push({ role: 'user', content: clean });
  addMessage('user', clean);
  renderHistory(); persist();
  busy = true; sendButton.disabled = true; input.disabled = true; showTyping();
  try {
    await ensureLocalModel();
    const result = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: 'คุณคือเพื่อน AI ผู้ช่วยที่เป็นมิตร ตอบเป็นภาษาเดียวกับผู้ใช้ ใช้ภาษาไทยเมื่อผู้ใช้พิมพ์ภาษาไทย ตอบชัดเจนและเป็นประโยชน์' },
        ...chat.messages.map(item => ({ role: item.role, content: item.content }))
      ],
      temperature: 0.7,
      max_tokens: 700
    });
    const answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('โมเดลไม่ได้ส่งข้อความตอบกลับ ลองส่งอีกครั้งได้เลย');
    $('#typingRow')?.remove();
    chat.messages.push({ role: 'assistant', content: answer });
    addMessage('assistant', answer); persist();
    setModelStatus('โมเดลพร้อมใช้', true);
  } catch (error) {
    $('#typingRow')?.remove();
    const message = error.message || 'เกิดข้อผิดพลาดระหว่างโหลดโมเดล';
    appendError(message);
    setModelStatus('โหลดโมเดลไม่สำเร็จ', false);
  } finally {
    busy = false; sendButton.disabled = false; input.disabled = false; input.focus();
  }
}

async function ensureLocalModel() {
  if (engine) return engine;
  if (loadingModel) throw new Error('กำลังโหลดโมเดลอยู่ กรุณารอสักครู่แล้วลองอีกครั้ง');
  if (!navigator.gpu) throw new Error('เบราว์เซอร์นี้ยังไม่รองรับ WebGPU ลองเปิดเว็บด้วย Google Chrome หรือ Microsoft Edge รุ่นล่าสุด');
  loadingModel = true;
  $('#modelProgressWrap').hidden = false;
  $('#loadModelButton').disabled = true;
  setModelStatus('กำลังโหลดโมเดล…', false);
  try {
    const webllm = await import('https://esm.run/@mlc-ai/web-llm');
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: report => {
        const progress = Math.max(0, Math.min(100, Math.round((report.progress || 0) * 100)));
        $('#modelProgressFill').style.width = `${progress}%`;
        $('#modelProgressText').textContent = report.text || `กำลังดาวน์โหลดโมเดล ${progress}%`;
      }
    });
    setModelStatus('โมเดลพร้อมใช้', true);
    $('#modelProgressText').textContent = 'พร้อมใช้งานแล้ว';
    return engine;
  } catch (error) {
    engine = null;
    throw new Error(error.message?.includes('fetch') ? 'ดาวน์โหลดโมเดลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต แล้วลองใหม่อีกครั้ง' : `เริ่มโมเดลไม่ได้: ${error.message}`);
  } finally {
    loadingModel = false;
    $('#loadModelButton').disabled = false;
  }
}

form.addEventListener('submit', event => { event.preventDefault(); const value = input.value; input.value = ''; input.style.height = 'auto'; sendMessage(value); });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; });
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
document.querySelectorAll('.suggestion').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.prompt; input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; sendMessage(button.dataset.prompt); }));
$('#newChat').addEventListener('click', newChat);
$('#openSettings').addEventListener('click', openSettings);
$('#openSettingsTop').addEventListener('click', openSettings);
$('#openSettingsBottom').addEventListener('click', openSettings);
$('#loadModelButton').addEventListener('click', async () => {
  try { await ensureLocalModel(); showToast('โมเดลพร้อมคุยแล้ว'); }
  catch (error) { $('#modelProgressWrap').hidden = false; $('#modelProgressText').textContent = error.message; showToast('โหลดโมเดลไม่สำเร็จ'); }
});
$('#openSidebar').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); });
$('#closeSidebar').addEventListener('click', closeMobileSidebar);
$('#scrim').addEventListener('click', closeMobileSidebar);
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); newChat(); } });
renderHistory();
setModelStatus('โมเดลยังไม่โหลด', false);
