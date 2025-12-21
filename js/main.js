let currentUser = "";
let currentUserRole = ""; 
let devModal;

const views = {
    login: document.getElementById('loginView'),
    dashboard: document.getElementById('dashboardView'),
    commBook: document.getElementById('commBookView'),
    formList: document.getElementById('formListView'),
    formBuilder: document.getElementById('formBuilderView'),
    formResponder: document.getElementById('formResponderView'),
    formResult: document.getElementById('formResultView'),
    discuss: document.getElementById('discussView'),
    profile: document.getElementById('profileView'),
    adminManage: document.getElementById('adminManageView') // 新增這一行
};

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('devModal')) devModal = new bootstrap.Modal(document.getElementById('devModal'));
    
    document.getElementById('msgInput')?.addEventListener('keypress', (e)=>{if(e.key==='Enter') sendMessage()});
    document.getElementById('password')?.addEventListener('keypress', (e)=>{if(e.key==='Enter') handleLogin()});
});

function switchView(viewName) {
    Object.values(views).forEach(el => { if(el) el.classList.add('d-none'); });
    if (viewName === 'login') views.login.classList.remove('d-none');
    else if (viewName === 'discuss') { views.discuss.classList.remove('d-none'); views.discuss.classList.add('d-flex'); }
    else if(views[viewName]) views[viewName].classList.remove('d-none');
}

window.backToDashboard = () => {
    switchView('dashboard');
    // 回到儀表板時，如果身分是管理員，刷新一下數據
    if(currentUserRole === 'admin' && window.initAdminDashboard) {
        window.initAdminDashboard();
    }
}