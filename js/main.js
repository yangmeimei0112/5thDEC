// 定義全域變數供其他模組使用
let currentUser = "";
let currentUserRole = ""; 
let devModal;

// 視圖對照表
const views = {
    login: document.getElementById('loginView'),
    dashboard: document.getElementById('dashboardView'),
    commBook: document.getElementById('commBookView'),
    formList: document.getElementById('formListView'),
    formBuilder: document.getElementById('formBuilderView'),
    formResponder: document.getElementById('formResponderView'),
    formResult: document.getElementById('formResultView'),
    discuss: document.getElementById('discussView'),
    profile: document.getElementById('profileView')
};

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('devModal')) devModal = new bootstrap.Modal(document.getElementById('devModal'));
    
    // 全域 Enter 監聽 (如有需要可放在這裡或各模組)
    document.getElementById('msgInput')?.addEventListener('keypress', (e)=>{if(e.key==='Enter') sendMessage()});
    document.getElementById('password')?.addEventListener('keypress', (e)=>{if(e.key==='Enter') handleLogin()});
});

function switchView(viewName) {
    Object.values(views).forEach(el => { if(el) el.classList.add('d-none'); });
    if (viewName === 'login') views.login.classList.remove('d-none');
    else if (viewName === 'discuss') { views.discuss.classList.remove('d-none'); views.discuss.classList.add('d-flex'); }
    else if(views[viewName]) views[viewName].classList.remove('d-none');
}

window.backToDashboard = () => switchView('dashboard');