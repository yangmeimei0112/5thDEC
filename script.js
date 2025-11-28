// --- 1. Supabase 設定與連線 ---
const SUPABASE_URL = 'https://hodalinmmhmukpjzxill.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZGFsaW5tbWhtdWtwanp4aWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTA1OTksImV4cCI6MjA3OTg2NjU5OX0.E4-HvFhuNG9p0FoXAbedTFTU5y6uFTuuZ7BnuxUn-vc'; 

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. DOM 元素 ---
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const discussView = document.getElementById('discussView'); // 新增：討論區視圖

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const msgBox = document.getElementById('msgBox');
const welcomeText = document.getElementById('welcomeText');
const guestBtn = document.getElementById('guestBtn');
const devBtn = document.getElementById('devBtn');
const userListUl = document.getElementById('userList');

// 討論區相關元素
const chatContainer = document.getElementById('chatContainer');
const msgInput = document.getElementById('msgInput');

// Bootstrap Modal
let devModal; 
document.addEventListener('DOMContentLoaded', () => {
    devModal = new bootstrap.Modal(document.getElementById('devModal'));
});

// 全域變數：紀錄目前登入者
let currentUser = "";

// --- 3. 主要功能邏輯 ---

// [A] 登入
async function handleLogin() {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    msgBox.innerText = "驗證中...";
    
    const { data, error } = await supabaseClient
        .from('users_table')
        .select('*')
        .eq('username', user)
        .eq('password', pass)
        .single();

    if (error || !data) {
        msgBox.innerText = "帳號或密碼錯誤";
        shakeCard();
    } else {
        enterDashboard(data.username);
    }
}

// [B] 訪客模式
function handleGuest() {
    enterDashboard("訪客 (Guest)");
}

// [C] 進入主畫面
function enterDashboard(name) {
    currentUser = name; // 記住是誰登入的
    loginView.classList.remove('d-flex');
    loginView.classList.add('d-none');
    dashboardView.classList.remove('d-none');
    welcomeText.innerText = `歡迎回來，${name}`;
    
    // 清除登入欄位
    usernameInput.value = "";
    passwordInput.value = "";
    msgBox.innerText = "";
}

// [D] 登出
function handleLogout() {
    currentUser = "";
    dashboardView.classList.add('d-none');
    discussView.classList.add('d-none'); // 確保討論區也關閉
    loginView.classList.remove('d-none');
    loginView.classList.add('d-flex');
}

// --- 4. 討論區功能 (新功能) ---

// 進入討論區
window.enterDiscuss = function() {
    dashboardView.classList.add('d-none'); // 隱藏主畫面
    discussView.classList.remove('d-none'); // 顯示討論區
    discussView.classList.add('d-flex');    // 加上 flex 排版
    
    loadMessages(); // 讀取留言
}

// 返回主畫面
window.backToDashboard = function() {
    discussView.classList.remove('d-flex');
    discussView.classList.add('d-none');
    dashboardView.classList.remove('d-none');
}

// 讀取留言
window.loadMessages = async function() {
    chatContainer.innerHTML = '<div class="text-center mt-3"><div class="spinner-border text-primary" role="status"></div></div>';

    // 從 Supabase 抓取最新的 50 則留言
    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true }) // 舊的在上面
        .limit(50);

    if (error) {
        chatContainer.innerHTML = '<p class="text-center text-danger">讀取失敗</p>';
        return;
    }

    renderChat(data);
}

// 渲染(顯示)留言畫面
function renderChat(messages) {
    chatContainer.innerHTML = '<div class="chat-wrapper"></div>'; // 清空並建立容器
    const wrapper = chatContainer.querySelector('.chat-wrapper');

    messages.forEach(msg => {
        const isSelf = msg.user_name === currentUser;
        
        // 建立氣泡 HTML
        const bubble = document.createElement('div');
        // 根據是否為自己，加上不同的 class (message-right 或 message-left)
        bubble.className = `message-bubble ${isSelf ? 'message-right' : 'message-left'}`;
        
        // 內容：名字 + 文字
        bubble.innerHTML = `
            <div class="message-info text-${isSelf ? 'end' : 'start'}">
                ${isSelf ? '我' : msg.user_name}
            </div>
            ${msg.content}
        `;
        
        wrapper.appendChild(bubble);
    });

    // 自動捲動到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 傳送留言
window.sendMessage = async function() {
    const content = msgInput.value.trim();
    if (!content) return;

    // 寫入 Supabase
    const { error } = await supabaseClient
        .from('messages')
        .insert([{ user_name: currentUser, content: content }]);

    if (error) {
        alert("傳送失敗");
        console.error(error);
    } else {
        msgInput.value = ""; // 清空輸入框
        loadMessages(); // 重新讀取留言
    }
}

// 監聽：在輸入框按 Enter 也可以發送
msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});


// --- 5. 開發者功能 ---
async function openDevTools() {
    const pwd = prompt("請輸入開發者管理密碼：");
    if (pwd === "wfsh") {
        await renderUserList();
        devModal.show();
    } else if (pwd !== null) {
        alert("密碼錯誤");
    }
}

async function renderUserList() {
    userListUl.innerHTML = "<li class='list-group-item'>載入中...</li>";
    const { data, error } = await supabaseClient
        .from('users_table')
        .select('username, password')
        .order('id', { ascending: true });

    if (error) {
        userListUl.innerHTML = `<li class='list-group-item text-danger'>讀取失敗</li>`; return;
    }
    userListUl.innerHTML = "";
    data.forEach(u => {
        const li = document.createElement('li');
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `<span><i class="fas fa-user me-2 text-primary"></i>${u.username}</span><span class="badge bg-secondary rounded-pill">${u.password}</span>`;
        userListUl.appendChild(li);
    });
}

window.addNewUser = async function() {
    const newU = document.getElementById('newUsername').value.trim();
    const newP = document.getElementById('newPassword').value.trim();
    if (!newU || !newP) { alert("請輸入完整"); return; }
    const { error } = await supabaseClient.from('users_table').insert([{ username: newU, password: newP }]);
    if (error) alert("新增失敗"); else { alert(`成功新增：${newU}`); renderUserList(); document.getElementById('newUsername').value = ""; document.getElementById('newPassword').value = ""; }
}

// --- 6. 綁定事件 ---
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
guestBtn.addEventListener('click', handleGuest);
devBtn.addEventListener('click', openDevTools);
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });

// 搖晃動畫
function shakeCard() {
    const card = document.querySelector('.card');
    card.classList.add('shake-animation');
    setTimeout(() => card.classList.remove('shake-animation'), 300);
}