document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('logoutBtn').addEventListener('click', handleLogout); // 修改這裡
document.getElementById('guestBtn').addEventListener('click', () => { currentUserRole='student'; enterDashboard("訪客"); });

async function handleLogin() {
    const u = (document.getElementById('username').value||"").trim();
    const p = (document.getElementById('password').value||"").trim();
    if(!u||!p) return showSystemMessage("請輸入帳號密碼", "danger");
    try {
        const { data, error } = await supabaseClient.from('users_table').select('*').eq('username', u).eq('password', p).single();
        if (error) throw error;
        
        currentUserRole = data.role || 'student';
        
        // 更新上線狀態
        await supabaseClient.from('users_table').update({ is_online: true }).eq('username', u);
        
        const displayName = data.nickname || data.username;
        showWelcomeAnimation(displayName);
        
        setTimeout(() => enterDashboard(data.username, displayName), 4600);

    } catch(e) { handleError(e, "登入"); shakeCard(); }
}

async function handleLogout() {
    if (currentUser) {
        // 更新下線狀態
        await supabaseClient.from('users_table').update({ is_online: false }).eq('username', currentUser);
    }
    currentUser = ""; 
    switchView('login');
}

function showWelcomeAnimation(name) {
    const overlay = document.getElementById('welcomeOverlay');
    overlay.querySelector('.welcome-text').innerText = `歡迎回來，${name}`;
    overlay.classList.remove('d-none');
    setTimeout(() => { overlay.classList.add('d-none'); }, 4500);
}

function enterDashboard(username, displayName) {
    currentUser = username;
    switchView('dashboard');
    
    const showName = displayName || username;
    document.getElementById('welcomeText').innerText = `${showName} (${currentUserRole==='admin'?'管理者':'學生'})`;
    
    // 如果是管理員，初始化後台卡片
    if(window.initAdminDashboard) window.initAdminDashboard();
}