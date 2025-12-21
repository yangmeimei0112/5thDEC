document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('logoutBtn').addEventListener('click', () => { currentUser=""; switchView('login'); });
document.getElementById('guestBtn').addEventListener('click', () => { currentUserRole='student'; enterDashboard("訪客"); });

async function handleLogin() {
    const u = (document.getElementById('username').value||"").trim();
    const p = (document.getElementById('password').value||"").trim();
    if(!u||!p) return showSystemMessage("請輸入帳號密碼", "danger");
    try {
        const { data, error } = await supabaseClient.from('users_table').select('*').eq('username', u).eq('password', p).single();
        if (error) throw error;
        currentUserRole = data.role || 'student'; 
        showWelcomeAnimation(data.username);
    } catch(e) { handleError(e, "登入"); shakeCard(); }
}

function showWelcomeAnimation(username) {
    const overlay = document.getElementById('welcomeOverlay');
    overlay.classList.remove('d-none');
    setTimeout(() => {
        enterDashboard(username);
        setTimeout(() => { overlay.classList.add('d-none'); }, 4500);
    }, 100);
}

function enterDashboard(n) {
    currentUser = n;
    switchView('dashboard');
    document.getElementById('welcomeText').innerText = `${n} (${currentUserRole==='admin'?'管理者':'學生'})`;
}