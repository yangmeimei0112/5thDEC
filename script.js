// --- 1. Supabase 設定 ---
const SUPABASE_URL = 'https://hodalinmmhmukpjzxill.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZGFsaW5tbWhtdWtwanp4aWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTA1OTksImV4cCI6MjA3OTg2NjU5OX0.E4-HvFhuNG9p0FoXAbedTFTU5y6uFTuuZ7BnuxUn-vc'; 
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. 錯誤偵測與通知 ---
const errorDictionary = {
    '404': '資料表不存在 (請執行 SQL)',
    '400': '請求格式錯誤',
    '401': '權限不足',
    '406': '帳號或密碼錯誤',
    '23505': '資料重複'
};

function handleError(error, context = "") {
    console.error(`[${context}]`, error);
    let msg = error.message || "Unknown Error";
    if (errorDictionary[error.code || error.status]) msg = errorDictionary[error.code || error.status];
    showSystemMessage(`❌ 錯誤 (${context}):<br>${msg}`, 'danger');
}

function showSystemMessage(msg, type = 'success') {
    const toastEl = document.getElementById('systemToast');
    const toastBody = document.getElementById('toastMessage');
    if(toastEl && toastBody) {
        toastEl.className = `toast align-items-center text-white border-0 bg-${type==='danger'?'danger-toast':'success-toast'}`;
        toastBody.innerHTML = msg;
        new bootstrap.Toast(toastEl).show();
    } else alert(msg.replace(/<br>/g, "\n"));
}

// --- 3. 視圖元素 ---
const views = {
    login: document.getElementById('loginView'),
    dashboard: document.getElementById('dashboardView'),
    commBook: document.getElementById('commBookView'),
    formList: document.getElementById('formListView'),
    formBuilder: document.getElementById('formBuilderView'),
    formResponder: document.getElementById('formResponderView'),
    formResult: document.getElementById('formResultView'),
    discuss: document.getElementById('discussView')
};

let currentUser = "", currentUserRole = "", currentFormId = null;
let currentQuestions = [], currentSections = [], currentSectionIndex = 0;
let draftAnswers = {}, userResponses = [], currentIndivIndex = 0;
let undoStack = [], redoStack = [];
let devModal;

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('devModal')) devModal = new bootstrap.Modal(document.getElementById('devModal'));
    
    // 聯絡簿 Enter 監聽
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target) {
            if (e.target.classList.contains('homework-item')) {
                e.preventDefault(); addCommInput('homework');
            } else if (e.target.classList.contains('exam-item')) {
                e.preventDefault(); addCommInput('exam');
            } else if (e.target.classList.contains('other-item')) {
                e.preventDefault(); addCommInput('other');
            }
        }
    });
});

function switchView(viewName) {
    Object.values(views).forEach(el => { if(el) el.classList.add('d-none'); });
    if (viewName === 'login') views.login.classList.remove('d-none');
    else if (viewName === 'discuss') { views.discuss.classList.remove('d-none'); views.discuss.classList.add('d-flex'); }
    else if(views[viewName]) views[viewName].classList.remove('d-none');
}

// --- 4. 登入 (加入動畫) ---
document.getElementById('loginBtn').addEventListener('click', handleLogin);
async function handleLogin() {
    const u = (document.getElementById('username').value || "").trim();
    const p = (document.getElementById('password').value || "").trim();
    if(!u || !p) return showSystemMessage("請輸入帳號密碼", "danger");
    try {
        const { data, error } = await supabaseClient.from('users_table').select('*').eq('username', u).eq('password', p).single();
        if (error) throw error;
        currentUserRole = data.role || 'student';
        
        // 播放歡迎動畫
        showWelcomeAnimation(data.username);
        
    } catch(err) { handleError(err, "登入"); shakeCard(); }
}

function showWelcomeAnimation(username) {
    const overlay = document.getElementById('welcomeOverlay');
    overlay.classList.remove('d-none'); // 顯示動畫層
    
    // 延遲後切換畫面
    setTimeout(() => {
        enterDashboard(username);
        // 再過一下隱藏動畫層 (讓它滑上去)
        setTimeout(() => {
            overlay.classList.add('d-none');
        }, 4500); // 配合 CSS 動畫總時間
    }, 100);
}

function enterDashboard(name) {
    currentUser = name;
    switchView('dashboard');
    document.getElementById('welcomeText').innerText = `${name} (${currentUserRole==='admin'?'管理者':'學生'})`;
}
document.getElementById('logoutBtn').addEventListener('click', () => { currentUser = ""; switchView('login'); });
document.getElementById('guestBtn').addEventListener('click', () => { currentUserRole='student'; enterDashboard("訪客"); });
window.backToDashboard = () => switchView('dashboard');
document.getElementById('password').addEventListener('keypress', (e)=>{if(e.key==='Enter') handleLogin()});

// --- H. 聯絡簿 ---
window.enterCommBook = function() {
    switchView('commBook');
    document.getElementById('commDate').value = new Date().toISOString().split('T')[0];
    ['homeworkInputs', 'examInputs', 'otherInputs'].forEach(id => document.getElementById(id).innerHTML = "");
    addCommInput('homework'); 
    addCommInput('exam');
    addCommInput('other');
    if(currentUserRole === 'admin') document.getElementById('commBookAdminPanel').classList.remove('d-none');
    else document.getElementById('commBookAdminPanel').classList.add('d-none');
    loadCommBookEntries();
}
window.addCommInput = function(type) {
    const containerId = type === 'homework' ? 'homeworkInputs' : (type === 'exam' ? 'examInputs' : 'otherInputs');
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    div.innerHTML = `<input type="text" class="form-control ${type}-item" placeholder="${type==='homework'?'作業項目':(type==='exam'?'考試科目':'其他事項')}"><button class="btn btn-outline-secondary" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    container.appendChild(div);
    div.querySelector('input').focus();
}
window.addCommBookEntry = async function() {
    try {
        const date = document.getElementById('commDate').value;
        if(!date) throw new Error("請選擇日期");
        
        const hw = Array.from(document.querySelectorAll('.homework-item')).map(i=>(i.value||"").trim()).filter(v=>v).join('\n');
        const ex = Array.from(document.querySelectorAll('.exam-item')).map(i=>(i.value||"").trim()).filter(v=>v).join('\n');
        const ot = Array.from(document.querySelectorAll('.other-item')).map(i=>(i.value||"").trim()).filter(v=>v).join('\n');
        
        if (!hw && !ex && !ot) throw new Error("請至少輸入一項內容");
        const { error } = await supabaseClient.from('comm_book').insert([{ post_date: date, homework: hw, exams: ex, others: ot, teacher_name: currentUser }]);
        if (error) throw error;
        showSystemMessage("發布成功", "success");
        enterCommBook();
    } catch(err) { handleError(err, "發布聯絡簿"); }
}
window.loadCommBookEntries = async function() {
    const container = document.getElementById('commBookList');
    container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-warning"></div></div>';
    try {
        const { data, error } = await supabaseClient.from('comm_book').select('*').order('post_date', { ascending: false });
        if (error) throw error;
        
        container.innerHTML = "";
        if (!data || data.length === 0) { container.innerHTML = '<p class="text-muted text-center mt-5">📭 無聯絡事項</p>'; return; }
        
        data.forEach(item => {
            const dateObj = new Date(item.post_date);
            const day = dateObj.getDate();
            const month = dateObj.getMonth() + 1;
            const weekDay = ['週日','週一','週二','週三','週四','週五','週六'][dateObj.getDay()];

            let contentHtml = "";
            if(item.homework && item.homework.trim()) {
                const list = item.homework.split('\n').filter(t=>t.trim()).map(h=>`<li>${h}</li>`).join('');
                contentHtml += `<div class="comm-section"><div class="section-tag tag-hw">回家作業</div><ul class="comm-list comm-list-homework">${list}</ul></div>`;
            }
            if(item.exams && item.exams.trim()) {
                const list = item.exams.split('\n').filter(t=>t.trim()).map(e=>`<li>${e}</li>`).join('');
                contentHtml += `<div class="comm-section"><div class="section-tag tag-exam">明日考試</div><ul class="comm-list comm-list-exam">${list}</ul></div>`;
            }
            if(item.others && item.others.trim()) {
                const list = item.others.split('\n').filter(t=>t.trim()).map(o=>`<li>${o}</li>`).join('');
                contentHtml += `<div class="comm-section"><div class="section-tag tag-other">其他事項</div><ul class="comm-list comm-list-other">${list}</ul></div>`;
            }
            
            if(!contentHtml) contentHtml = `<div class="text-muted text-center py-3 small">本日無詳細內容</div>`;

            container.innerHTML += `
                <div class="comm-modern-card">
                    <div class="comm-date-box">
                        <span class="comm-month">${month}月</span>
                        <span class="comm-day">${day}</span>
                        <span class="comm-weekday">${weekDay}</span>
                    </div>
                    <div class="comm-content-box">
                        <div class="comm-meta">
                            <span class="comm-teacher"><i class="fas fa-user-edit me-1"></i> ${item.teacher_name} 老師</span>
                            ${currentUserRole==='admin'?`<button class="btn btn-sm btn-light text-danger" onclick="deleteCommEntry(${item.id})"><i class="fas fa-trash"></i></button>`:''}
                        </div>
                        ${contentHtml}
                    </div>
                </div>`;
        });
    } catch(err) { handleError(err, "載入聯絡簿"); }
}
window.deleteCommEntry = async (id) => { if(confirm("確定刪除？")) { try { const {error} = await supabaseClient.from('comm_book').delete().eq('id',id); if(error) throw error; showSystemMessage("刪除成功","success"); loadCommBookEntries(); } catch(e){ handleError(e,"刪除失敗"); } } }

// --- 5. 表單系統 ---
window.enterFormSystem = async () => {
    switchView('formList');
    document.getElementById('createFormBtn').classList.toggle('d-none', currentUserRole !== 'admin');
    await loadForms();
}
async function loadForms() {
    const container = document.getElementById('formsContainer');
    container.innerHTML = '<div class="text-center w-100 mt-5"><div class="spinner-border text-primary"></div></div>';
    try {
        const { data: forms, error } = await supabaseClient.from('forms').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        container.innerHTML = "";
        if (!forms || forms.length === 0) { container.innerHTML = '<p class="text-center text-muted">無表單</p>'; return; }
        forms.forEach(form => {
            const theme = form.theme || { primaryColor: '#673ab7' };
            const actions = currentUserRole === 'admin' ? `<div class="mt-3 border-top pt-2 d-flex justify-content-between"><button class="btn btn-sm btn-outline-primary rounded-pill" onclick="viewResults(${form.id}, '${form.title}')"><i class="fas fa-chart-pie"></i> 統計</button><button class="btn btn-sm btn-outline-danger rounded-circle" onclick="deleteForm(${form.id})"><i class="fas fa-trash"></i></button></div>` : "";
            container.innerHTML += `<div class="col-md-6 col-lg-4"><div class="card h-100 google-card border-0"><div class="card-body"><span class="badge ${form.is_active?'bg-success':'bg-secondary'} mb-2 float-end rounded-pill" style="background-color:${form.is_active?'#34a853':'#6c757d'}!important">${form.is_active?'進行中':'已結束'}</span><h5 class="card-title fw-bold text-truncate" style="color:${theme.primaryColor}">${form.title}</h5><p class="card-text text-muted small mb-3 text-truncate">${form.description||'無說明'}</p><button class="btn btn-outline-primary w-100 rounded-pill" style="color:${theme.primaryColor};border-color:${theme.primaryColor}" onclick="openResponder(${form.id})" ${!form.is_active?'disabled':''}>${form.is_active?'填寫表單':'已截止'}</button>${actions}</div></div></div>`;
        });
    } catch(err) { handleError(err, "載入表單"); }
}
window.deleteForm = async (id) => { if(confirm("確定刪除？")) { const {error} = await supabaseClient.from('forms').delete().eq('id', id); if(error) handleError(error); else loadForms(); } }

// --- 6. 表單建立 ---
window.enterFormBuilder = function() {
    switchView('formBuilder');
    document.getElementById('buildTitle').value = "未命名表單";
    document.getElementById('headerFormTitle').innerText = "未命名表單";
    document.getElementById('buildDesc').value = "";
    document.getElementById('questionsContainer').innerHTML = ""; 
    switchBuilderTab('questions');
    document.getElementById('setLimitOne').checked = false;
    document.getElementById('setAllowEdit').checked = false;
    document.getElementById('setStartTime').value = "";
    document.getElementById('setEndTime').value = "";
    undoStack = []; redoStack = [];
    updateThemeColor('#673ab7', '#f0ebf8');
    addQuestionCard('radio'); recordHistory();
}
window.switchBuilderTab = (tab) => {
    document.getElementById('tabQuestions').classList.toggle('active', tab==='questions');
    document.getElementById('tabResponses').classList.toggle('active', tab==='responses');
    document.getElementById('tabSettings').classList.toggle('active', tab==='settings');
    document.getElementById('builderQuestionsPanel').classList.toggle('d-none', tab!=='questions');
    document.getElementById('builderSettingsPanel').classList.toggle('d-none', tab!=='settings');
    document.getElementById('builderResponsesPanel').classList.toggle('d-none', tab!=='responses');
    document.getElementById('floatingToolbar').style.display = (tab==='questions') ? 'flex' : 'none';
}
window.toggleFormSettings = () => switchBuilderTab('settings');
window.toggleThemeSidebar = () => document.getElementById('themeSidebar').classList.toggle('show');
window.updateThemeColor = (color, bg) => { document.documentElement.style.setProperty('--theme-color', color); document.documentElement.style.setProperty('--theme-bg', bg); };
function recordHistory() { undoStack.push({ html: document.getElementById('questionsContainer').innerHTML, title: document.getElementById('buildTitle').value, desc: document.getElementById('buildDesc').value }); redoStack = []; }
window.performUndo = () => { if(undoStack.length>1) { redoStack.push(undoStack.pop()); const s=undoStack[undoStack.length-1]; restoreState(s); } }
window.performRedo = () => { if(redoStack.length>0) { const s=redoStack.pop(); undoStack.push(s); restoreState(s); } }
function restoreState(s) { document.getElementById('questionsContainer').innerHTML = s.html; document.getElementById('buildTitle').value = s.title; document.getElementById('buildDesc').value = s.desc; }
window.previewForm = () => showSystemMessage("預覽功能開發中...", "success");

window.addQuestionCard = function(defaultType = 'radio') {
    const div = document.createElement('div');
    div.className = 'card google-card question-card mb-3';
    div.dataset.type = defaultType;
    div.innerHTML = `<div class="card-body"><div class="row g-3 align-items-center mb-3"><div class="col-md-8"><input type="text" class="form-control form-control-lg bg-light border-0 build-label" placeholder="未命名的問題" style="border-bottom: 1px solid #ccc !important; border-radius: 0;"></div><div class="col-md-4"><select class="form-select build-type" onchange="changeCardType(this)"><option value="text" ${defaultType=='text'?'selected':''}>簡答</option><option value="radio" ${defaultType=='radio'?'selected':''}>選擇題</option><option value="check" ${defaultType=='check'?'selected':''}>核取方塊</option><option value="select" ${defaultType=='select'?'selected':''}>下拉選單</option></select></div></div><div class="options-area mt-3"></div><div class="d-flex justify-content-end align-items-center mt-4 pt-3 border-top gap-3"><button class="btn btn-icon text-secondary" onclick="duplicateCard(this)"><i class="far fa-copy"></i></button><button class="btn btn-icon text-secondary" onclick="this.closest('.question-card').remove(); recordHistory();"><i class="far fa-trash-alt"></i></button><div class="vr mx-2"></div><div class="form-check form-switch"><input class="form-check-input build-required" type="checkbox"><label class="form-check-label small">必填</label></div></div></div>`;
    document.getElementById('questionsContainer').appendChild(div);
    renderOptionsArea(div.querySelector('.options-area'), defaultType);
    recordHistory();
}
window.changeCardType = (select) => { const card=select.closest('.question-card'); card.dataset.type=select.value; renderOptionsArea(card.querySelector('.options-area'), select.value); recordHistory(); }
function renderOptionsArea(container, type) {
    container.innerHTML = "";
    if(['radio','check','select'].includes(type)) {
        const list = document.createElement('div'); list.className = 'option-list'; container.appendChild(list); addOptionRow(list, type);
        const footer = document.createElement('div'); footer.className = 'mt-2 d-flex align-items-center gap-2';
        footer.innerHTML = `<div class="d-flex align-items-center"><i class="${type==='radio'?'far fa-circle':(type==='check'?'far fa-square':'fas fa-caret-down')} text-secondary me-2 disabled"></i><span class="add-option-link text-muted" onclick="addOptionRow(this.closest('.options-area').querySelector('.option-list'), '${type}')">新增選項</span></div><span class="text-muted">或</span><span class="add-option-link add-other-link" onclick="toggleOtherOption(this, true)">新增「其他」</span>`;
        container.appendChild(footer);
    } else if (type === 'text') container.innerHTML = `<div class="text-muted border-bottom w-50 pb-2">簡答文字</div>`;
}
window.addOptionRow = (list, type, value="") => { const row=document.createElement('div'); row.className='d-flex align-items-center mb-2 option-row'; row.innerHTML=`<i class="${type==='radio'?'far fa-circle':(type==='check'?'far fa-square':'fas fa-caret-down')} text-secondary me-2 fa-lg"></i><input type="text" class="form-control dynamic-option flex-grow-1" value="${value}" placeholder="選項"><button class="btn btn-icon text-secondary ms-2 remove-opt-btn" onclick="this.closest('.option-row').remove()"><i class="fas fa-times"></i></button>`; list.appendChild(row); if(!value) row.querySelector('input').focus(); }
window.toggleOtherOption = (btn, show) => { const c=btn.closest('.options-area'); if(show && !c.querySelector('.other-option-row')) { const r=document.createElement('div'); r.className='d-flex align-items-center mb-2 other-option-row'; r.innerHTML=`<i class="far fa-circle text-secondary me-2 fa-lg"></i><div class="text-muted border-bottom flex-grow-1 pb-1">其他...</div><button class="btn btn-icon text-secondary ms-2" onclick="this.closest('.other-option-row').remove()"><i class="fas fa-times"></i></button><input type="hidden" class="build-other-real" value="true">`; c.querySelector('.option-list').appendChild(r); btn.style.display='none'; c.querySelector('span:nth-child(2)').style.display='none'; recordHistory(); } }
window.duplicateCard = (btn) => { const o=btn.closest('.question-card'); const c=o.cloneNode(true); c.querySelector('.build-label').value=o.querySelector('.build-label').value; c.querySelector('.build-type').value=o.querySelector('.build-type').value; const opts=o.querySelectorAll('.dynamic-option'); const copts=c.querySelectorAll('.dynamic-option'); opts.forEach((ip,i)=>{if(copts[i])copts[i].value=ip.value}); o.after(c); recordHistory(); }
window.addSectionBreak = () => { const d=document.createElement('div'); d.className='card google-card mb-3 border-start border-5 border-warning'; d.dataset.type='section'; d.innerHTML=`<div class="card-body d-flex justify-content-between align-items-center"><span class="fw-bold text-warning"><i class="fas fa-grip-lines me-2"></i>分頁區段</span><button class="btn btn-icon" onclick="this.closest('.card').remove(); recordHistory();"><i class="fas fa-times"></i></button></div>`; document.getElementById('questionsContainer').appendChild(d); recordHistory(); }
window.saveNewForm = async function() { const title = (document.getElementById('buildTitle').value||"").trim(); if (!title) return alert("請輸入標題"); const settings = { limit_one: document.getElementById('setLimitOne').checked, allow_edit: document.getElementById('setAllowEdit').checked, start_time: document.getElementById('setStartTime').value || null, end_time: document.getElementById('setEndTime').value || null }; const theme = { primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim(), bgColor: getComputedStyle(document.documentElement).getPropertyValue('--theme-bg').trim() }; const { data: formData, error } = await supabaseClient.from('forms').insert([{ title, description: document.getElementById('buildDesc').value, settings, theme }]).select().single(); if (error) return alert("建立失敗"); const cards = document.querySelectorAll('#questionsContainer > div'); const questions = []; let pageNum = 1; cards.forEach((card, idx) => { if(card.dataset.type === 'section') pageNum++; else { const label = (card.querySelector('.build-label').value||"").trim(); if (label) { let opts = null; const optInputs = card.querySelectorAll('.dynamic-option'); if(optInputs.length > 0) opts = Array.from(optInputs).map(input => (input.value||"").trim()).filter(v=>v).join(','); questions.push({ form_id: formData.id, label, type: card.dataset.type, options: opts, has_other: !!card.querySelector('.build-other-real'), is_required: card.querySelector('.build-required').checked, page_num: pageNum, order: idx }); } } }); if (questions.length > 0) await supabaseClient.from('questions').insert(questions); alert("發布成功！"); enterFormSystem(); }

// --- 7. 表單填寫 ---
window.openResponder = async (formId) => {
    currentFormId = formId; switchView('formResponder'); draftAnswers = {};
    const { data: form } = await supabaseClient.from('forms').select('*').eq('id', formId).single();
    if(form.theme) updateThemeColor(form.theme.primaryColor, form.theme.bgColor);
    if(form.settings?.limit_one) {
        const { data: ex } = await supabaseClient.from('responses').select('id').eq('form_id', formId).eq('user_name', currentUser);
        if(ex.length > 0) return alert("已填寫過"), enterFormSystem();
    }
    document.getElementById('viewFormTitle').innerText = form.title;
    document.getElementById('viewFormDesc').innerText = form.description || "";
    const { data: qs } = await supabaseClient.from('questions').select('*').eq('form_id', formId).order('order');
    currentQuestions = qs; currentSections = []; let maxPage = 0;
    qs.forEach(q => maxPage = Math.max(maxPage, q.page_num || 1));
    for(let i=1; i<=maxPage; i++) currentSections.push(qs.filter(q => (q.page_num || 1) === i));
    currentSectionIndex = 0; renderSection();
}
function renderSection() {
    const area = document.getElementById('viewQuestionsArea'); area.innerHTML = "";
    document.getElementById('formProgressBar').style.width = `${((currentSectionIndex+1)/currentSections.length)*100}%`;
    const qs = currentSections[currentSectionIndex];
    qs.forEach(q => {
        const div = document.createElement('div'); div.className = "card google-card mb-3 p-3";
        const req = q.is_required ? '<span class="text-danger">*</span>' : '';
        const saved = draftAnswers[q.label];
        let inputHtml = "";
        if(q.type === 'text') inputHtml = `<input class="form-control border-0 border-bottom rounded-0 bg-light" name="q-${q.id}" value="${saved||''}" placeholder="您的回答">`;
        else if (['radio','check','select'].includes(q.type)) {
            const opts = q.options ? q.options.split(',') : [];
            if(q.type === 'select') inputHtml = `<select class="form-select w-50" name="q-${q.id}"><option value="" disabled ${!saved?'selected':''}>請選擇</option>${opts.map(o=>`<option value="${o.trim()}" ${saved===o.trim()?'selected':''}>${o.trim()}</option>`).join('')}</select>`;
            else {
                const isChecked = (v) => (!saved ? false : (q.type === 'radio' ? saved === v : saved.split(', ').includes(v)));
                inputHtml = opts.map(o => `<div class="form-check py-1"><input class="form-check-input" type="${q.type==='radio'?'radio':'checkbox'}" name="q-${q.id}" value="${o.trim()}" ${isChecked(o.trim())?'checked':''}> <label class="form-check-label">${o.trim()}</label></div>`).join('');
                if(q.has_other) {
                    let otherVal="", otherChecked=false; if(saved && saved.includes("其他: ")) { otherChecked=true; otherVal=saved.split("其他: ")[1]; }
                    inputHtml += `<div class="form-check d-flex align-items-center mt-1"><input class="form-check-input me-2" type="${q.type==='radio'?'radio':'checkbox'}" name="q-${q.id}" value="其他" ${otherChecked?'checked':''}><input type="text" name="q-${q.id}-other-text" class="form-control border-0 border-bottom rounded-0 py-0" placeholder="其他..." value="${otherVal}" oninput="this.previousElementSibling.checked=true"></div>`;
                }
            }
        }
        div.innerHTML = `<h5 class="fw-bold mb-3 fs-5">${q.label} ${req}</h5>${inputHtml}`; area.appendChild(div);
    });
    document.getElementById('prevSectionBtn').classList.toggle('d-none', currentSectionIndex === 0);
    document.getElementById('nextSectionBtn').classList.toggle('d-none', currentSectionIndex === currentSections.length - 1);
    document.getElementById('submitFormBtn').classList.toggle('d-none', currentSectionIndex !== currentSections.length - 1);
}
window.navSection = (dir) => { 
    // Save state
    currentSections[currentSectionIndex].forEach(q => {
        const name=`q-${q.id}`; let val=null;
        if(q.type==='text') val=document.querySelector(`[name="${name}"]`).value;
        else if(q.type==='select') val=document.querySelector(`[name="${name}"]`).value;
        else {
            const els=document.querySelectorAll(`[name="${name}"]:checked`);
            let arr=Array.from(els).map(e=>e.value);
            const other=document.querySelector(`[name="${name}-other-text"]`);
            if(other && document.querySelector(`[name="${name}"][value="其他"]:checked`)) { arr=arr.filter(v=>v!=='其他'); arr.push('其他: '+other.value); }
            if(arr.length) val=arr.join(', ');
        }
        if(val) draftAnswers[q.label]=val;
    });
    currentSectionIndex += dir; renderSection(); window.scrollTo(0,0); 
}
window.submitFormResponse = async () => {
    window.navSection(0); // Save current
    let missing = false;
    currentQuestions.forEach(q => { if(q.is_required && !draftAnswers[q.label]) missing = true; });
    if(missing) return alert("有必填欄位未完成");
    if(confirm("確定提交？")) {
        await supabaseClient.from('responses').insert([{ form_id: currentFormId, user_name: currentUser, answers: draftAnswers }]);
        alert("提交成功"); enterFormSystem();
    }
}

// --- 8. 結果 & 其他 ---
window.viewResults = async (id, title) => { 
    switchView('formResult'); document.getElementById('resultTitle').innerText = title;
    const { data: qs } = await supabaseClient.from('questions').select('*').eq('form_id', id).order('order');
    const { data: resps } = await supabaseClient.from('responses').select('*').eq('form_id', id).order('submitted_at', {ascending: false});
    userResponses = resps; currentIndivIndex = 0;
    const container = document.getElementById('chartsContainer'); container.innerHTML = "";
    qs.forEach(q => {
        if(['text'].includes(q.type)) return;
        const div = document.createElement('div'); div.className = "col-md-6";
        div.innerHTML = `<div class="card google-card"><div class="card-body"><h6 class="fw-bold">${q.label}</h6><div class="chart-container"><canvas id="chart-${q.id}"></canvas></div></div></div>`;
        container.appendChild(div);
        let counts = {};
        resps.forEach(r => { let a=r.answers[q.label]; if(a) (typeof a==='string'?a.split(', '):[a]).forEach(v=>counts[v]=(counts[v]||0)+1); });
        new Chart(document.getElementById(`chart-${q.id}`), { type: 'pie', data: { labels: Object.keys(counts), datasets: [{data: Object.values(counts), backgroundColor: ['#4285f4','#ea4335','#fbbc04','#34a853']}] }});
    });
}
window.switchResultTab = (t) => {
    document.getElementById('btnViewSummary').classList.toggle('active', t==='summary');
    document.getElementById('btnViewIndividual').classList.toggle('active', t==='individual');
    document.getElementById('resultSummaryArea').classList.toggle('d-none', t!=='summary');
    document.getElementById('resultIndividualArea').classList.toggle('d-none', t!=='individual');
    if(t==='individual') renderIndividual();
}
function renderIndividual() {
    if(!userResponses.length) return document.getElementById('individualContent').innerHTML="無資料";
    document.getElementById('indivTotal').innerText = userResponses.length; document.getElementById('indivIndex').innerText = currentIndivIndex+1;
    const r=userResponses[currentIndivIndex];
    let html=`<h5 class="text-primary">${r.user_name} <small class="text-muted">(${new Date(r.submitted_at).toLocaleString()})</small></h5><hr>`;
    for(let[q,a] of Object.entries(r.answers)) html+=`<div class="mb-3"><strong>${q}</strong><div>${a}</div></div>`;
    document.getElementById('individualContent').innerHTML=html;
}
window.navIndividual = (d) => { if(currentIndivIndex+d>=0 && currentIndivIndex+d<userResponses.length) { currentIndivIndex+=d; renderIndividual(); } }
window.exportToExcel = () => {
    if(!userResponses.length) return alert("無資料");
    let csv = "\uFEFF填寫人,時間,回答內容(JSON)\n";
    userResponses.forEach(r => {
        let jsonStr = JSON.stringify(r.answers).replace(/"/g, '""');
        csv += `${r.user_name},${new Date(r.submitted_at).toLocaleString()},"${jsonStr}"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"}));
    link.download = "表單回應數據.csv";
    link.click();
}

// --- 9. 討論區 & 後台 ---
window.enterDiscuss = () => { switchView('discuss'); loadMessages(); }
window.loadMessages = async () => {
    const box = document.getElementById('chatContainer');
    box.innerHTML = '<div class="text-center mt-3"><div class="spinner-border text-warning"></div></div>';
    const {data} = await supabaseClient.from('messages').select('*').order('created_at').limit(50);
    if(data) {
        box.innerHTML = '<div class="chat-wrapper"></div>';
        const wrap = box.querySelector('.chat-wrapper');
        data.forEach(m => {
            const isMe = m.user_name === currentUser;
            const d = document.createElement('div');
            d.className = `message-bubble ${isMe?'message-right':'message-left'}`;
            d.innerHTML = `<div class="message-info text-${isMe?'end':'start'}">${isMe?'我':m.user_name}</div>${m.content}`;
            wrap.appendChild(d);
        });
        box.scrollTop = box.scrollHeight;
    }
}
window.sendMessage = async () => {
    const v = document.getElementById('msgInput').value.trim();
    if(v) { await supabaseClient.from('messages').insert([{user_name:currentUser, content:v}]); document.getElementById('msgInput').value=""; loadMessages(); }
}
document.getElementById('devBtn').addEventListener('click', () => { if(prompt("請輸入開發者管理密碼：")==="wfsh") { devModal.show(); renderUserList(); }});
async function renderUserList() {
    const ul=document.getElementById('userList');ul.innerHTML="Loading...";
    const {data}=await supabaseClient.from('users_table').select('*');
    ul.innerHTML="";
    data.forEach(u=>{
        const roleBadge = u.role === 'admin' ? '<span class="badge bg-danger">管理者</span>' : '<span class="badge bg-secondary">學生</span>';
        ul.innerHTML+=`<li class="list-group-item d-flex justify-content-between"><span>${u.username}</span><div>${roleBadge} <span class="badge bg-light text-dark">${u.password}</span></div></li>`;
    });
}
window.addNewUser = async () => {
    const u=document.getElementById('newUsername').value, p=document.getElementById('newPassword').value;
    const r=document.getElementById('newRole').value;
    if(u&&p) { 
        try {
            await supabaseClient.from('users_table').insert([{username:u, password:p, role:r}]); 
            renderUserList(); 
            document.getElementById('newUsername').value=""; 
            document.getElementById('newPassword').value=""; 
            showSystemMessage("新增成功", "success");
        } catch(e) { handleError(e, "新增失敗"); }
    }
}
document.getElementById('msgInput').addEventListener('keypress', (e)=>{if(e.key==='Enter') sendMessage()});
function shakeCard() { const c=document.querySelector('.card'); c.classList.add('shake-animation'); setTimeout(()=>c.classList.remove('shake-animation'),300); }