document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('logoutBtn').addEventListener('click', () => { currentUser=""; switchView('login'); });
document.getElementById('guestBtn').addEventListener('click', () => { currentUserRole='student'; enterDashboard("訪客"); });

// ... (保留上方的 Event Listeners)

async function handleLogin() {
    const u = (document.getElementById('username').value||"").trim();
    const p = (document.getElementById('password').value||"").trim();
    if(!u||!p) return showSystemMessage("請輸入帳號密碼", "danger");
    try {
        const { data, error } = await supabaseClient.from('users_table').select('*').eq('username', u).eq('password', p).single();
        if (error) throw error;
        
        currentUserRole = data.role || 'student';
        
        // 優先顯示暱稱，如果沒有則顯示學號
        const displayName = data.nickname || data.username;
        
        showWelcomeAnimation(displayName); // 動畫顯示暱稱
        
        // 為了讓 enterDashboard 也能用到正確的名字，可以考慮傳入整個 user 物件，或只傳名字
        // 這裡我們稍微修改 enterDashboard 讓它接受顯示名稱
        setTimeout(() => enterDashboard(data.username, displayName), 4600); // 配合動畫時間

    } catch(e) { handleError(e, "登入"); shakeCard(); }
}

function showWelcomeAnimation(name) {
    const overlay = document.getElementById('welcomeOverlay');
    
    // 更新動畫層的文字
    overlay.querySelector('.welcome-text').innerText = `歡迎回來，${name}`;
    
    overlay.classList.remove('d-none');
    setTimeout(() => { overlay.classList.add('d-none'); }, 4500);
}

// 修改函式簽名，加入 displayName
function enterDashboard(username, displayName) {
    currentUser = username; // 系統邏輯仍使用學號 (唯一 ID)
    switchView('dashboard');
    
    const showName = displayName || username;
    document.getElementById('welcomeText').innerText = `${showName} (${currentUserRole==='admin'?'管理者':'學生'})`;
}