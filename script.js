// --- 1. Supabase 設定 ---
const SUPABASE_URL = 'https://hodalinmmhmukpjzxill.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZGFsaW5tbWhtdWtwanp4aWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTA1OTksImV4cCI6MjA3OTg2NjU5OX0.E4-HvFhuNG9p0FoXAbedTFTU5y6uFTuuZ7BnuxUn-vc'; 
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. 視圖元素 ---
const views = {
    login: document.getElementById('loginView'),
    dashboard: document.getElementById('dashboardView'),
    discuss: document.getElementById('discussView'),
    formList: document.getElementById('formListView'),
    formBuilder: document.getElementById('formBuilderView'),
    formResponder: document.getElementById('formResponderView'),
    formResult: document.getElementById('formResultView')
};

let currentUser = "";
let currentUserRole = ""; // 'student' or 'admin'
let currentFormId = null;
let currentQuestions = [];
let currentSections = []; 
let currentSectionIndex = 0;
let draftAnswers = {}; 
let userResponses = [];
let currentIndivIndex = 0;
let devModal;

document.addEventListener('DOMContentLoaded', () => {
    devModal = new bootstrap.Modal(document.getElementById('devModal'));
});

// --- 3. 基礎導航 ---
function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('d-none'));
    if (viewName === 'login') views.login.classList.remove('d-none');
    else if (viewName === 'discuss') { views.discuss.classList.remove('d-none'); views.discuss.classList.add('d-flex'); }
    else views[viewName].classList.remove('d-none');
}

// 登入邏輯 (含 Role 判斷)
document.getElementById('loginBtn').addEventListener('click', handleLogin);
async function handleLogin() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const msg = document.getElementById('msgBox');
    msg.innerText = "驗證中...";
    const { data, error } = await supabaseClient.from('users_table').select('*').eq('username', u).eq('password', p).single();
    if (error || !data) { msg.innerText = "帳號或密碼錯誤"; shakeCard(); }
    else {
        currentUserRole = data.role || 'student'; // 預設學生
        enterDashboard(data.username);
    }
}
function enterDashboard(name) {
    currentUser = name;
    switchView('dashboard');
    document.getElementById('welcomeText').innerText = `${name} (${currentUserRole==='admin'?'老師':'學生'})`;
    document.getElementById('username').value = ""; document.getElementById('password').value = "";
    document.getElementById('msgBox').innerText = "";
}
document.getElementById('logoutBtn').addEventListener('click', () => { currentUser = ""; switchView('login'); });
document.getElementById('guestBtn').addEventListener('click', () => { currentUserRole='student'; enterDashboard("訪客"); });
window.backToDashboard = () => switchView('dashboard');
document.getElementById('password').addEventListener('keypress', (e)=>{if(e.key==='Enter') handleLogin()});

// --- 4. 表單大廳 ---
window.enterFormSystem = async function() {
    switchView('formList');
    // 權限控制：只有 admin 顯示建立按鈕
    const btn = document.getElementById('createFormBtn');
    if (currentUserRole === 'admin') btn.classList.remove('d-none');
    else btn.classList.add('d-none');
    await loadForms();
}
async function loadForms() {
    const container = document.getElementById('formsContainer');
    container.innerHTML = '<div class="text-center w-100 mt-5"><div class="spinner-border text-primary"></div></div>';
    const { data: forms, error } = await supabaseClient.from('forms').select('*').order('created_at', { ascending: false });
    
    container.innerHTML = "";
    if (error || !forms) return;
    if (forms.length === 0) { container.innerHTML = '<p class="text-center text-muted">目前沒有表單</p>'; return; }

    const isAdmin = (currentUserRole === 'admin');
    forms.forEach(form => {
        let actions = isAdmin ? `<div class="mt-3 border-top pt-2 d-flex justify-content-between"><button class="btn btn-sm btn-outline-primary rounded-pill" onclick="viewResults(${form.id}, '${form.title}')"><i class="fas fa-chart-pie"></i> 統計</button><button class="btn btn-sm btn-outline-danger rounded-circle" onclick="deleteForm(${form.id})"><i class="fas fa-trash"></i></button></div>` : "";
        container.innerHTML += `
            <div class="col-md-6 col-lg-4"><div class="card h-100 google-card border-0"><div class="card-body">
                <span class="badge ${form.is_active?'bg-success':'bg-secondary'} mb-2 float-end rounded-pill">${form.is_active?'進行中':'已結束'}</span>
                <h5 class="card-title fw-bold text-truncate">${form.title}</h5>
                <p class="card-text text-muted small mb-3 text-truncate">${form.description||'無說明'}</p>
                <button class="btn btn-outline-primary w-100 rounded-pill" onclick="openResponder(${form.id})" ${!form.is_active?'disabled':''}>${form.is_active?'填寫表單':'已截止'}</button>
                ${actions}
            </div></div></div>`;
    });
}
window.deleteForm = async (id) => { if(confirm("確定刪除？")) { await supabaseClient.from('forms').delete().eq('id', id); loadForms(); } }

// --- 5. 表單建立器 (Google Style - 選項編輯升級) ---
window.enterFormBuilder = function() {
    switchView('formBuilder');
    document.getElementById('buildTitle').value = "未命名表單";
    document.getElementById('headerFormTitle').innerText = "未命名表單";
    document.getElementById('buildDesc').value = "";
    document.getElementById('questionsContainer').innerHTML = ""; 
    document.getElementById('formSettingsPanel').classList.add('d-none');
    addQuestionCard('radio');
}
window.toggleFormSettings = () => document.getElementById('formSettingsPanel').classList.toggle('d-none');

window.addQuestionCard = function(defaultType = 'radio') {
    const div = document.createElement('div');
    div.className = 'card google-card question-card mb-3';
    div.dataset.type = defaultType;
    div.innerHTML = `
        <div class="card-body">
            <div class="row g-3 align-items-center mb-3">
                <div class="col-md-8"><input type="text" class="form-control form-control-lg bg-light border-0 build-label" placeholder="未命名的問題" style="border-bottom: 1px solid #ccc !important; border-radius: 0;"></div>
                <div class="col-md-4">
                    <select class="form-select build-type" onchange="changeCardType(this)">
                        <option value="text" ${defaultType=='text'?'selected':''}>簡答</option>
                        <option value="textarea" ${defaultType=='textarea'?'selected':''}>詳答</option>
                        <option value="radio" ${defaultType=='radio'?'selected':''}>選擇題</option>
                        <option value="check" ${defaultType=='check'?'selected':''}>核取方塊</option>
                        <option value="select" ${defaultType=='select'?'selected':''}>下拉選單</option>
                        <option value="grid_radio" ${defaultType=='grid_radio'?'selected':''}>單選方格</option>
                        <option value="scale" ${defaultType=='scale'?'selected':''}>線性量表</option>
                        <option value="date" ${defaultType=='date'?'selected':''}>日期</option>
                        <option value="time" ${defaultType=='time'?'selected':''}>時間</option>
                    </select>
                </div>
            </div>
            <div class="options-area mt-3"></div>
            <div class="d-flex justify-content-end align-items-center mt-4 pt-3 border-top gap-3">
                <button class="btn btn-icon text-secondary" title="複製" onclick="duplicateCard(this)"><i class="far fa-copy"></i></button>
                <button class="btn btn-icon text-secondary" title="刪除" onclick="this.closest('.question-card').remove()"><i class="far fa-trash-alt"></i></button>
                <div class="vr mx-2"></div>
                <div class="form-check form-switch"><input class="form-check-input build-required" type="checkbox"><label class="form-check-label small">必填</label></div>
            </div>
        </div>
    `;
    document.getElementById('questionsContainer').appendChild(div);
    renderOptionsArea(div.querySelector('.options-area'), defaultType);
}

window.changeCardType = function(select) {
    const card = select.closest('.question-card');
    card.dataset.type = select.value;
    renderOptionsArea(card.querySelector('.options-area'), select.value);
}

// [重點] 動態選項渲染 (Google Style)
function renderOptionsArea(container, type) {
    container.innerHTML = "";
    if(['radio','check','select'].includes(type)) {
        const list = document.createElement('div');
        list.className = 'option-list';
        container.appendChild(list);
        addOptionRow(list, type); // 預設一行

        const footer = document.createElement('div');
        footer.className = 'mt-2 d-flex align-items-center gap-2';
        footer.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="${type==='radio'?'far fa-circle':(type==='check'?'far fa-square':'fas fa-caret-down')} text-secondary me-2 disabled"></i>
                <span class="add-option-link text-muted" onclick="addOptionRow(this.closest('.options-area').querySelector('.option-list'), '${type}')">新增選項</span>
            </div>
            <span class="text-muted">或</span>
            <span class="add-option-link add-other-link" onclick="toggleOtherOption(this, true)">新增「其他」</span>
        `;
        container.appendChild(footer);
    } else if (type === 'grid_radio') {
        container.innerHTML = `<div class="row"><div class="col-6"><label class="small text-muted">列 (問題)</label><input type="text" class="form-control build-grid-rows" placeholder="列1, 列2..."></div><div class="col-6"><label class="small text-muted">欄 (選項)</label><input type="text" class="form-control build-grid-cols" placeholder="欄1, 欄2..."></div></div>`;
    } else if (type === 'text') {
        container.innerHTML = `<div class="text-muted border-bottom w-50 pb-2">簡答文字</div>`;
    } else if (type === 'textarea') {
        container.innerHTML = `<div class="text-muted border-bottom w-75 pb-2">詳答文字</div>`;
    }
}

// 新增單一選項輸入框
window.addOptionRow = function(list, type, value = "") {
    const count = list.children.length + 1;
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center mb-2 option-row';
    const iconClass = type==='radio'?'far fa-circle':(type==='check'?'far fa-square':'fas fa-caret-down');
    row.innerHTML = `
        <i class="${iconClass} text-secondary me-2 fa-lg"></i>
        <input type="text" class="form-control dynamic-option flex-grow-1" value="${value}" placeholder="選項 ${count}">
        <button class="btn btn-icon text-secondary ms-2 remove-opt-btn" onclick="this.closest('.option-row').remove()"><i class="fas fa-times"></i></button>
    `;
    list.appendChild(row);
    if(!value) row.querySelector('input').focus();
}

window.toggleOtherOption = function(btn, show) {
    const container = btn.closest('.options-area');
    let otherRow = container.querySelector('.other-option-row');
    if(show && !otherRow) {
        otherRow = document.createElement('div');
        otherRow.className = 'd-flex align-items-center mb-2 other-option-row';
        otherRow.innerHTML = `<i class="far fa-circle text-secondary me-2 fa-lg"></i><div class="text-muted border-bottom flex-grow-1 pb-1">其他...</div><button class="btn btn-icon text-secondary ms-2" onclick="this.closest('.other-option-row').remove()"><i class="fas fa-times"></i></button><input type="hidden" class="build-other-real" value="true">`;
        container.querySelector('.option-list').appendChild(otherRow);
        btn.style.display = 'none'; container.querySelector('span:nth-child(2)').style.display = 'none';
    }
}

window.duplicateCard = function(btn) {
    const original = btn.closest('.question-card');
    const clone = original.cloneNode(true);
    clone.querySelector('.build-label').value = original.querySelector('.build-label').value;
    clone.querySelector('.build-type').value = original.querySelector('.build-type').value;
    const origOpts = original.querySelectorAll('.dynamic-option');
    const cloneOpts = clone.querySelectorAll('.dynamic-option');
    origOpts.forEach((input, i) => { if(cloneOpts[i]) cloneOpts[i].value = input.value; });
    original.after(clone);
}

window.addSectionBreak = function() {
    const div = document.createElement('div');
    div.className = 'card google-card mb-3 border-start border-5 border-warning';
    div.dataset.type = 'section';
    div.innerHTML = `<div class="card-body d-flex justify-content-between align-items-center"><span class="fw-bold text-warning"><i class="fas fa-grip-lines me-2"></i>分頁區段</span><button class="btn btn-icon" onclick="this.closest('.card').remove()"><i class="fas fa-times"></i></button></div>`;
    document.getElementById('questionsContainer').appendChild(div);
}

window.saveNewForm = async function() {
    const title = document.getElementById('buildTitle').value.trim();
    if (!title) return alert("請輸入標題");
    
    const settings = {
        limit_one: document.getElementById('setLimitOne').checked,
        allow_edit: document.getElementById('setAllowEdit').checked,
        collect_email: document.getElementById('setCollectEmail').checked,
        start_time: document.getElementById('setStartTime').value || null,
        end_time: document.getElementById('setEndTime').value || null
    };

    const { data: formData, error } = await supabaseClient.from('forms').insert([{ title, description: document.getElementById('buildDesc').value, settings }]).select().single();
    if (error) return alert("建立失敗");

    const cards = document.querySelectorAll('#questionsContainer > div');
    const questions = [];
    let pageNum = 1;

    cards.forEach((card, idx) => {
        if(card.dataset.type === 'section') pageNum++;
        else {
            const label = card.querySelector('.build-label').value.trim();
            if (label) {
                // 收集動態選項
                let opts = null;
                const optInputs = card.querySelectorAll('.dynamic-option');
                if(optInputs.length > 0) opts = Array.from(optInputs).map(input => input.value.trim()).filter(v=>v).join(',');

                questions.push({
                    form_id: formData.id,
                    label: label,
                    type: card.dataset.type,
                    options: opts, 
                    grid_rows: card.querySelector('.build-grid-rows')?.value || null,
                    grid_cols: card.querySelector('.build-grid-cols')?.value || null,
                    has_other: !!card.querySelector('.build-other-real'), 
                    is_required: card.querySelector('.build-required').checked,
                    page_num: pageNum,
                    order: idx
                });
            }
        }
    });

    if (questions.length > 0) await supabaseClient.from('questions').insert(questions);
    alert("發布成功！"); enterFormSystem();
}

// --- 6. 表單填寫 (含暫存與分頁) ---
window.openResponder = async function(formId) {
    currentFormId = formId;
    switchView('formResponder');
    draftAnswers = {}; 
    const { data: form } = await supabaseClient.from('forms').select('*').eq('id', formId).single();
    if(form.settings?.limit_one) {
        const { data: ex } = await supabaseClient.from('responses').select('id').eq('form_id', formId).eq('user_name', currentUser);
        if(ex.length > 0) { alert("您已填寫過"); return enterFormSystem(); }
    }
    document.getElementById('viewFormTitle').innerText = form.title;
    document.getElementById('viewFormDesc').innerText = form.description || "";
    const { data: qs } = await supabaseClient.from('questions').select('*').eq('form_id', formId).order('order');
    currentQuestions = qs;
    currentSections = [];
    let maxPage = 0;
    qs.forEach(q => maxPage = Math.max(maxPage, q.page_num || 1));
    for(let i=1; i<=maxPage; i++) currentSections.push(qs.filter(q => (q.page_num || 1) === i));
    currentSectionIndex = 0;
    renderSection();
}

function saveCurrentSectionState() {
    const qs = currentSections[currentSectionIndex];
    if(!qs) return;
    qs.forEach(q => {
        const name = `q-${q.id}`;
        let val = null;
        if (['text','textarea','date','time','select','scale'].includes(q.type)) {
            const el = document.querySelector(`[name="${name}"]`) || document.querySelector(`[name="${name}"]:checked`);
            if(el) val = el.value;
        } else if (q.type === 'radio' || q.type === 'check') {
            const els = document.querySelectorAll(`[name="${name}"]:checked`);
            let arr = Array.from(els).map(e => e.value);
            const otherText = document.querySelector(`[name="${name}-other-text"]`);
            if(otherText && document.querySelector(`[name="${name}"][value="其他"]:checked`)) {
                arr = arr.filter(v=>v!=='其他'); arr.push('其他: ' + otherText.value);
            }
            if(arr.length > 0) val = arr.join(', ');
        } else if (q.type === 'grid_radio') {
            const rows = q.grid_rows.split(',');
            let gridAns = {};
            rows.forEach(r => {
                const el = document.querySelector(`[name="${name}-${r}"]:checked`);
                if(el) gridAns[r] = el.value;
            });
            if(Object.keys(gridAns).length > 0) val = gridAns;
        }
        if(val) draftAnswers[q.label] = val;
    });
}

function renderSection() {
    const area = document.getElementById('viewQuestionsArea');
    area.innerHTML = "";
    document.getElementById('formProgressBar').style.width = `${((currentSectionIndex+1)/currentSections.length)*100}%`;
    const qs = currentSections[currentSectionIndex];
    qs.forEach(q => {
        const div = document.createElement('div');
        div.className = "card google-card mb-3 p-3";
        const req = q.is_required ? '<span class="text-danger">*</span>' : '';
        const saved = draftAnswers[q.label];
        let inputHtml = "";

        if(q.type === 'text') inputHtml = `<input class="form-control border-0 border-bottom rounded-0 bg-light" name="q-${q.id}" value="${saved||''}" placeholder="您的回答">`;
        else if(q.type === 'textarea') inputHtml = `<textarea class="form-control border-0 border-bottom rounded-0 bg-light" name="q-${q.id}" rows="1" placeholder="您的回答">${saved||''}</textarea>`;
        else if (q.type === 'radio' || q.type === 'check') {
            const opts = q.options ? q.options.split(',') : [];
            const isChecked = (v) => (!saved ? false : (q.type === 'radio' ? saved === v : saved.split(', ').includes(v)));
            inputHtml = opts.map(o => `<div class="form-check py-1"><input class="form-check-input" type="${q.type==='radio'?'radio':'checkbox'}" name="q-${q.id}" value="${o.trim()}" ${isChecked(o.trim())?'checked':''}> <label class="form-check-label">${o.trim()}</label></div>`).join('');
            if(q.has_other) {
                let otherVal = ""; let otherChecked = false;
                if(saved && saved.includes("其他: ")) { otherChecked = true; otherVal = saved.split("其他: ")[1]; }
                inputHtml += `<div class="form-check d-flex align-items-center mt-1"><input class="form-check-input me-2" type="${q.type==='radio'?'radio':'checkbox'}" name="q-${q.id}" value="其他" ${otherChecked?'checked':''}><input type="text" name="q-${q.id}-other-text" class="form-control border-0 border-bottom rounded-0 py-0" placeholder="其他..." value="${otherVal}" oninput="this.previousElementSibling.checked=true"></div>`;
            }
        } else if (q.type === 'grid_radio') {
            const rows = q.grid_rows.split(','), cols = q.grid_cols.split(',');
            inputHtml = `<div class="table-responsive"><table class="table table-borderless grid-table mb-0 bg-light rounded"><thead><tr><th></th>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td class="fw-bold">${r}</td>${cols.map(c => `<td><input class="form-check-input" type="radio" name="q-${q.id}-${r}" value="${c}" ${saved&&saved[r]===c?'checked':''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        } else if (q.type === 'scale') {
            inputHtml = `<div class="scale-group">${[1,2,3,4,5].map(n=>`<div class="scale-item"><label>${n}</label><input class="form-check-input" type="radio" name="q-${q.id}" value="${n}" ${saved==n?'checked':''}></div>`).join('')}</div>`;
        } else if (q.type === 'date') inputHtml = `<input type="date" class="form-control w-50" name="q-${q.id}" value="${saved||''}">`;
        else if (q.type === 'time') inputHtml = `<input type="time" class="form-control w-50" name="q-${q.id}" value="${saved||''}">`;
        else if (q.type === 'select') {
            const opts = q.options ? q.options.split(',') : [];
            inputHtml = `<select class="form-select w-50" name="q-${q.id}"><option value="" disabled ${!saved?'selected':''}>請選擇</option>${opts.map(o=>`<option value="${o.trim()}" ${saved===o.trim()?'selected':''}>${o.trim()}</option>`).join('')}</select>`;
        }
        div.innerHTML = `<h5 class="fw-bold mb-3 fs-5">${q.label} ${req}</h5>${inputHtml}`;
        area.appendChild(div);
    });
    document.getElementById('prevSectionBtn').classList.toggle('d-none', currentSectionIndex === 0);
    document.getElementById('nextSectionBtn').classList.toggle('d-none', currentSectionIndex === currentSections.length - 1);
    document.getElementById('submitFormBtn').classList.toggle('d-none', currentSectionIndex !== currentSections.length - 1);
}

window.navSection = (dir) => { saveCurrentSectionState(); currentSectionIndex += dir; renderSection(); window.scrollTo(0,0); }
window.submitFormResponse = async function() {
    saveCurrentSectionState();
    let missing = false;
    currentQuestions.forEach(q => {
        if(q.is_required) {
            const val = draftAnswers[q.label];
            if(!val || (typeof val==='object' && Object.keys(val).length < (q.grid_rows?.split(',').length||0))) missing = true;
        }
    });
    if(missing) return alert("有必填欄位未完成");
    if (confirm("確定提交？")) {
        await supabaseClient.from('responses').insert([{ form_id: currentFormId, user_name: currentUser, answers: draftAnswers }]);
        alert("提交成功"); enterFormSystem();
    }
}

// --- 7. 結果統計 (同上) ---
window.viewResults = async (id, title) => { 
    switchView('formResult');
    document.getElementById('resultTitle').innerText = title;
    const { data: qs } = await supabaseClient.from('questions').select('*').eq('form_id', id).order('order');
    const { data: resps } = await supabaseClient.from('responses').select('*').eq('form_id', id).order('submitted_at', {ascending: false});
    userResponses = resps; currentIndivIndex = 0;
    const container = document.getElementById('chartsContainer'); container.innerHTML = "";
    qs.forEach(q => {
        if(['text','textarea','grid_radio','date','time'].includes(q.type)) return;
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
    for(let[q,a] of Object.entries(r.answers)) html+=`<div class="mb-3"><strong>${q}</strong><div>${typeof a==='object'?JSON.stringify(a):a}</div></div>`;
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

// --- 8. 其他 ---
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

// [升級] 顯示使用者與身分
async function renderUserList() {
    const ul=document.getElementById('userList');ul.innerHTML="Loading...";
    const {data}=await supabaseClient.from('users_table').select('*');
    ul.innerHTML="";
    data.forEach(u=>{
        const roleBadge = u.role === 'admin' ? '<span class="badge bg-danger">老師</span>' : '<span class="badge bg-secondary">學生</span>';
        ul.innerHTML+=`<li class="list-group-item d-flex justify-content-between"><span>${u.username}</span><div>${roleBadge} <span class="badge bg-light text-dark">${u.password}</span></div></li>`;
    });
}

// [升級] 新增使用者 (含 Role)
window.addNewUser = async () => {
    const u=document.getElementById('newUsername').value, p=document.getElementById('newPassword').value;
    const r=document.getElementById('newRole').value;
    if(u&&p) { 
        await supabaseClient.from('users_table').insert([{username:u, password:p, role:r}]); 
        renderUserList(); 
        document.getElementById('newUsername').value=""; 
        document.getElementById('newPassword').value=""; 
    }
}
document.getElementById('msgInput').addEventListener('keypress', (e)=>{if(e.key==='Enter') sendMessage()});
function shakeCard() { const c=document.querySelector('.card'); c.classList.add('shake-animation'); setTimeout(()=>c.classList.remove('shake-animation'),300); }