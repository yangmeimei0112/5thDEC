// --- 表單系統模組 ---

// 變數初始化
window.currentFormId = null;
window.currentQuestions = [];
window.currentSections = [];
window.currentSectionIndex = 0;
window.draftAnswers = {};
window.userResponses = [];
window.currentIndivIndex = 0;
window.undoStack = [];
window.redoStack = [];

// 1. 進入表單大廳
window.enterFormSystem = async function() {
    switchView('formList');
    // 只有管理員能看到建立按鈕
    const btn = document.getElementById('createFormBtn');
    if(btn) btn.classList.toggle('d-none', currentUserRole !== 'admin');
    await loadForms();
}

// 2. 載入表單列表
async function loadForms() {
    const container = document.getElementById('formsContainer');
    container.innerHTML = '<div class="text-center w-100 mt-5"><div class="spinner-border text-primary"></div></div>';
    
    try {
        const { data: forms, error } = await supabaseClient.from('forms').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        container.innerHTML = "";
        if (!forms || forms.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted mt-5"><i class="fas fa-folder-open fa-3x mb-3 opacity-50"></i><p>目前沒有表單</p></div>';
            return;
        }

        forms.forEach(form => {
            const theme = form.theme || { primaryColor: '#673ab7' };
            const isAdmin = currentUserRole === 'admin';
            const actionBtns = isAdmin ? 
                `<div class="mt-3 pt-3 border-top d-flex justify-content-between">
                    <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="viewResults(${form.id}, '${form.title}')"><i class="fas fa-chart-pie me-1"></i>統計</button>
                    <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="deleteForm(${form.id})"><i class="fas fa-trash"></i></button>
                 </div>` : '';
            
            const statusBadge = form.is_active 
                ? `<span class="badge bg-success rounded-pill mb-2">進行中</span>` 
                : `<span class="badge bg-secondary rounded-pill mb-2">已截止</span>`;

            container.innerHTML += `
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100 google-card border-0">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="card-title fw-bold text-truncate mb-0" style="color:${theme.primaryColor}">${form.title}</h5>
                                ${statusBadge}
                            </div>
                            <p class="card-text text-muted small mb-4 text-truncate">${form.description || '無說明'}</p>
                            <button class="btn btn-outline-primary w-100 rounded-pill mt-auto" 
                                style="color:${theme.primaryColor}; border-color:${theme.primaryColor}" 
                                onclick="openResponder(${form.id})" ${!form.is_active ? 'disabled' : ''}>
                                ${form.is_active ? '填寫表單' : '已截止'}
                            </button>
                            ${actionBtns}
                        </div>
                    </div>
                </div>`;
        });
    } catch (err) { handleError(err, "載入表單列表"); }
}

window.deleteForm = async (id) => { if(confirm("確定刪除此表單？")) { const {error} = await supabaseClient.from('forms').delete().eq('id', id); if(error) handleError(error); else loadForms(); } }

// 3. 表單建立器
window.enterFormBuilder = function() {
    switchView('formBuilder');
    // 初始化 UI
    document.getElementById('buildTitle').value = "未命名表單";
    document.getElementById('headerFormTitle').innerText = "未命名表單";
    document.getElementById('buildDesc').value = "";
    document.getElementById('questionsContainer').innerHTML = "";
    switchBuilderTab('questions');
    
    // 重置設定
    document.getElementById('setLimitOne').checked = false;
    document.getElementById('setAllowEdit').checked = false;
    document.getElementById('setStartTime').value = "";
    document.getElementById('setEndTime').value = "";
    
    // 重置變數
    undoStack = []; redoStack = [];
    updateThemeColor('#673ab7', '#f0ebf8');
    
    // 預設新增一個問題
    addQuestionCard('radio');
    recordHistory();
}

window.switchBuilderTab = (tab) => {
    document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
    document.getElementById(tab === 'questions' ? 'tabQuestions' : (tab === 'responses' ? 'tabResponses' : 'tabSettings')).classList.add('active');
    document.getElementById('builderQuestionsPanel').classList.toggle('d-none', tab !== 'questions');
    document.getElementById('builderSettingsPanel').classList.toggle('d-none', tab !== 'settings');
    document.getElementById('builderResponsesPanel').classList.toggle('d-none', tab !== 'responses');
    const toolbar = document.getElementById('floatingToolbar');
    if(toolbar) toolbar.style.display = tab === 'questions' ? 'flex' : 'none';
}

window.toggleThemeSidebar = () => document.getElementById('themeSidebar').classList.toggle('show');

window.updateThemeColor = (color, bg) => {
    document.documentElement.style.setProperty('--theme-color', color);
    document.documentElement.style.setProperty('--theme-bg', bg);
}

// 歷史紀錄功能
function recordHistory() {
    const state = {
        html: document.getElementById('questionsContainer').innerHTML,
        title: document.getElementById('buildTitle').value,
        desc: document.getElementById('buildDesc').value
    };
    undoStack.push(state);
    if (undoStack.length > 20) undoStack.shift();
    redoStack = [];
}

window.performUndo = () => { if(undoStack.length > 1) { redoStack.push(undoStack.pop()); const s = undoStack[undoStack.length - 1]; restoreState(s); } }
window.performRedo = () => { if(redoStack.length > 0) { const s = redoStack.pop(); undoStack.push(s); restoreState(s); } }

function restoreState(s) {
    document.getElementById('questionsContainer').innerHTML = s.html;
    document.getElementById('buildTitle').value = s.title;
    document.getElementById('buildDesc').value = s.desc;
    // 重新綁定事件監聽器 (因為 innerHTML 重寫會遺失 event listeners)
    // 簡單解法：對於動態產生的元素，我們在 HTML 中使用 onclick="..." 屬性，這樣就不怕重寫
}

window.previewForm = () => showSystemMessage("預覽模式開發中...", "success");

// 新增問題卡片
window.addQuestionCard = function(defaultType = 'radio') {
    const div = document.createElement('div');
    div.className = 'card google-card question-card mb-3';
    div.dataset.type = defaultType;
    div.innerHTML = `
        <div class="card-body">
            <div class="row g-3 align-items-center mb-3">
                <div class="col-md-8">
                    <input type="text" class="form-control form-control-lg bg-light border-0 build-label" placeholder="問題" oninput="recordHistory()">
                </div>
                <div class="col-md-4">
                    <select class="form-select build-type" onchange="changeCardType(this)">
                        <option value="text" ${defaultType=='text'?'selected':''}>簡答</option>
                        <option value="radio" ${defaultType=='radio'?'selected':''}>選擇題</option>
                        <option value="check" ${defaultType=='check'?'selected':''}>核取方塊</option>
                        <option value="select" ${defaultType=='select'?'selected':''}>下拉選單</option>
                    </select>
                </div>
            </div>
            <div class="options-area mt-3"></div>
            <div class="d-flex justify-content-end align-items-center mt-4 pt-3 border-top gap-3">
                <button class="btn btn-icon text-secondary" onclick="duplicateCard(this)"><i class="far fa-copy"></i></button>
                <button class="btn btn-icon text-secondary" onclick="this.closest('.question-card').remove(); recordHistory();"><i class="far fa-trash-alt"></i></button>
                <div class="vr mx-2"></div>
                <div class="form-check form-switch">
                    <input class="form-check-input build-required" type="checkbox" onchange="recordHistory()">
                    <label class="small">必填</label>
                </div>
            </div>
        </div>`;
    document.getElementById('questionsContainer').appendChild(div);
    renderOptionsArea(div.querySelector('.options-area'), defaultType);
    recordHistory();
}

window.changeCardType = (select) => {
    const card = select.closest('.question-card');
    card.dataset.type = select.value;
    renderOptionsArea(card.querySelector('.options-area'), select.value);
    recordHistory();
}

function renderOptionsArea(container, type) {
    container.innerHTML = "";
    if(['radio','check','select'].includes(type)) {
        const list = document.createElement('div');
        list.className = 'option-list';
        container.appendChild(list);
        addOptionRow(list, type);
        
        const footer = document.createElement('div');
        footer.className = 'mt-2 d-flex align-items-center gap-2';
        footer.innerHTML = `
            <div class="d-flex align-items-center cursor-pointer" onclick="addOptionRow(this.closest('.options-area').querySelector('.option-list'), '${type}'); recordHistory()">
                <i class="${type==='radio'?'far fa-circle':(type==='check'?'far fa-square':'fas fa-caret-down')} text-secondary me-2 disabled"></i>
                <span class="add-option-link text-muted">新增選項</span>
            </div>
            <span class="text-muted">或</span>
            <span class="add-option-link add-other-link" onclick="toggleOtherOption(this, true)">新增「其他」</span>
        `;
        container.appendChild(footer);
    } else if (type === 'text') {
        container.innerHTML = `<div class="text-muted border-bottom w-50 pb-2">簡答文字</div>`;
    }
}

window.addOptionRow = (list, type, value = "") => {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center mb-2 option-row';
    const icon = type==='radio'?'far fa-circle':(type==='check'?'far fa-square':'fas fa-caret-down');
    row.innerHTML = `
        <i class="${icon} text-secondary me-2 fa-lg"></i>
        <input type="text" class="form-control dynamic-option flex-grow-1" value="${value}" placeholder="選項" oninput="recordHistory()">
        <button class="btn btn-icon text-secondary ms-2 remove-opt-btn" onclick="this.closest('.option-row').remove(); recordHistory()"><i class="fas fa-times"></i></button>
    `;
    list.appendChild(row);
    if(!value) row.querySelector('input').focus();
}

window.toggleOtherOption = (btn, show) => {
    const container = btn.closest('.options-area');
    if(show && !container.querySelector('.other-option-row')) {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center mb-2 other-option-row';
        row.innerHTML = `
            <i class="far fa-circle text-secondary me-2 fa-lg"></i>
            <div class="text-muted border-bottom flex-grow-1 pb-1">其他...</div>
            <button class="btn btn-icon text-secondary ms-2" onclick="this.closest('.other-option-row').remove(); this.closest('.options-area').querySelector('.add-other-link').style.display='inline'; recordHistory()"><i class="fas fa-times"></i></button>
            <input type="hidden" class="build-other-real" value="true">
        `;
        container.querySelector('.option-list').appendChild(row);
        btn.style.display = 'none'; // 隱藏按鈕
        recordHistory();
    }
}

window.duplicateCard = (btn) => {
    const original = btn.closest('.question-card');
    const clone = original.cloneNode(true);
    // 複製 input 值 (cloneNode 不會複製輸入值)
    clone.querySelector('.build-label').value = original.querySelector('.build-label').value;
    clone.querySelector('.build-type').value = original.querySelector('.build-type').value;
    const origOpts = original.querySelectorAll('.dynamic-option');
    const cloneOpts = clone.querySelectorAll('.dynamic-option');
    origOpts.forEach((inp, i) => { if(cloneOpts[i]) cloneOpts[i].value = inp.value; });
    original.after(clone);
    recordHistory();
}

window.addSectionBreak = () => {
    const div = document.createElement('div');
    div.className = 'card google-card mb-3 border-start border-5 border-warning';
    div.dataset.type = 'section';
    div.innerHTML = `
        <div class="card-body d-flex justify-content-between align-items-center">
            <span class="fw-bold text-warning"><i class="fas fa-grip-lines me-2"></i>分頁區段</span>
            <button class="btn btn-icon" onclick="this.closest('.card').remove(); recordHistory();"><i class="fas fa-times"></i></button>
        </div>`;
    document.getElementById('questionsContainer').appendChild(div);
    recordHistory();
}

// 4. 儲存表單
window.saveNewForm = async function() {
    const title = document.getElementById('buildTitle').value.trim();
    if (!title) return alert("請輸入標題");
    
    const settings = {
        limit_one: document.getElementById('setLimitOne').checked,
        allow_edit: document.getElementById('setAllowEdit').checked,
        start_time: document.getElementById('setStartTime').value || null,
        end_time: document.getElementById('setEndTime').value || null
    };
    
    const theme = {
        primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim(),
        bgColor: getComputedStyle(document.documentElement).getPropertyValue('--theme-bg').trim()
    };

    const { data: formData, error } = await supabaseClient
        .from('forms')
        .insert([{ 
            title, 
            description: document.getElementById('buildDesc').value, 
            settings, 
            theme 
        }])
        .select()
        .single();
    
    if (error) return alert("建立失敗");

    // 儲存問題
    const cards = document.querySelectorAll('#questionsContainer > div');
    const questions = [];
    let pageNum = 1;

    cards.forEach((card, idx) => {
        if(card.dataset.type === 'section') {
            pageNum++;
        } else {
            const label = card.querySelector('.build-label').value.trim();
            if (label) {
                let opts = null;
                const optInputs = card.querySelectorAll('.dynamic-option');
                if(optInputs.length > 0) opts = Array.from(optInputs).map(i => i.value.trim()).join(',');
                
                questions.push({
                    form_id: formData.id,
                    label,
                    type: card.dataset.type,
                    options: opts,
                    has_other: !!card.querySelector('.build-other-real'),
                    is_required: card.querySelector('.build-required').checked,
                    page_num: pageNum,
                    order: idx
                });
            }
        }
    });

    if (questions.length > 0) await supabaseClient.from('questions').insert(questions);
    
    alert("發布成功！");
    enterFormSystem();
}

// 5. 填寫表單
window.openResponder = async function(formId) {
    currentFormId = formId;
    switchView('formResponder');
    draftAnswers = {};
    
    const { data: form } = await supabaseClient.from('forms').select('*').eq('id', formId).single();
    if(form.theme) updateThemeColor(form.theme.primaryColor, form.theme.bgColor);
    
    // 檢查限制
    if(form.settings?.limit_one) {
        const { data: ex } = await supabaseClient.from('responses').select('id').eq('form_id', formId).eq('user_name', currentUser);
        if(ex.length > 0) { alert("您已填寫過此表單"); return enterFormSystem(); }
    }

    document.getElementById('viewFormTitle').innerText = form.title;
    document.getElementById('viewFormDesc').innerText = form.description || "";
    
    const { data: qs } = await supabaseClient.from('questions').select('*').eq('form_id', formId).order('order');
    currentQuestions = qs;
    
    // 分頁處理
    currentSections = [];
    let maxPage = 0;
    qs.forEach(q => maxPage = Math.max(maxPage, q.page_num || 1));
    for(let i=1; i<=maxPage; i++) currentSections.push(qs.filter(q => (q.page_num || 1) === i));
    
    currentSectionIndex = 0;
    renderSection();
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
        if(q.type === 'text') {
            inputHtml = `<input class="form-control border-0 border-bottom rounded-0 bg-light" name="q-${q.id}" value="${saved||''}" placeholder="您的回答">`;
        } else if (['radio','check'].includes(q.type)) {
            const opts = q.options ? q.options.split(',') : [];
            const isRadio = q.type === 'radio';
            
            inputHtml = opts.map(o => {
                const isChecked = saved ? (isRadio ? saved===o : saved.includes(o)) : false;
                return `<div class="form-check py-1">
                    <input class="form-check-input" type="${q.type}" name="q-${q.id}" value="${o}" ${isChecked?'checked':''}>
                    <label class="form-check-label">${o}</label>
                </div>`;
            }).join('');
            
            if(q.has_other) {
                inputHtml += `<div class="form-check d-flex align-items-center mt-1">
                    <input class="form-check-input me-2" type="${q.type}" name="q-${q.id}" value="其他">
                    <input type="text" name="q-${q.id}-other-text" class="form-control border-0 border-bottom rounded-0 py-0" placeholder="其他...">
                </div>`;
            }
        } else if (q.type === 'select') {
            const opts = q.options ? q.options.split(',') : [];
            inputHtml = `<select class="form-select w-50" name="q-${q.id}">
                <option value="" disabled ${!saved?'selected':''}>請選擇</option>
                ${opts.map(o => `<option value="${o}" ${saved===o?'selected':''}>${o}</option>`).join('')}
            </select>`;
        }
        
        div.innerHTML = `<h5 class="fw-bold mb-3 fs-5">${q.label} ${req}</h5>${inputHtml}`;
        area.appendChild(div);
    });

    document.getElementById('prevSectionBtn').classList.toggle('d-none', currentSectionIndex === 0);
    document.getElementById('nextSectionBtn').classList.toggle('d-none', currentSectionIndex === currentSections.length - 1);
    document.getElementById('submitFormBtn').classList.toggle('d-none', currentSectionIndex !== currentSections.length - 1);
}

window.navSection = (dir) => {
    // 儲存當前頁面答案
    currentSections[currentSectionIndex].forEach(q => {
        const name = `q-${q.id}`;
        let val = null;
        if(q.type === 'text' || q.type === 'select') {
            const el = document.querySelector(`[name="${name}"]`);
            if(el) val = el.value;
        } else {
            const els = document.querySelectorAll(`[name="${name}"]:checked`);
            let arr = Array.from(els).map(e => e.value);
            // 處理「其他」
            if(arr.includes('其他')) {
                const otherText = document.querySelector(`[name="${name}-other-text"]`).value;
                arr = arr.filter(v => v !== '其他');
                if(otherText) arr.push(`其他: ${otherText}`);
            }
            if(arr.length > 0) val = q.type==='radio' ? arr[0] : arr.join(', ');
        }
        if(val) draftAnswers[q.label] = val;
    });
    
    currentSectionIndex += dir;
    renderSection();
    window.scrollTo(0,0);
}

window.submitFormResponse = async () => {
    window.navSection(0); // 觸發一次儲存
    
    // 檢查必填
    let missing = false;
    currentQuestions.forEach(q => {
        if(q.is_required && !draftAnswers[q.label]) missing = true;
    });
    if(missing) return alert("尚有必填欄位未完成");
    
    if(confirm("確定提交表單？")) {
        await supabaseClient.from('responses').insert([{
            form_id: currentFormId,
            user_name: currentUser,
            answers: draftAnswers
        }]);
        alert("提交成功！");
        enterFormSystem();
    }
}

// 6. 結果統計
window.viewResults = async (id, title) => {
    switchView('formResult');
    document.getElementById('resultTitle').innerText = title;
    
    const { data: qs } = await supabaseClient.from('questions').select('*').eq('form_id', id).order('order');
    const { data: resps } = await supabaseClient.from('responses').select('*').eq('form_id', id).order('submitted_at', {ascending: false});
    
    userResponses = resps;
    currentIndivIndex = 0;
    
    const container = document.getElementById('chartsContainer');
    container.innerHTML = "";
    
    qs.forEach(q => {
        if(q.type === 'text') return; // 簡答題不做圖表
        
        const div = document.createElement('div');
        div.className = "col-md-6";
        div.innerHTML = `
            <div class="card google-card">
                <div class="card-body">
                    <h6 class="fw-bold">${q.label}</h6>
                    <div class="chart-container"><canvas id="chart-${q.id}"></canvas></div>
                </div>
            </div>`;
        container.appendChild(div);
        
        // 統計數據
        let counts = {};
        resps.forEach(r => {
            let ans = r.answers[q.label];
            if(ans) {
                // 如果是複選，可能用逗號分隔
                const items = q.type === 'check' ? ans.split(', ') : [ans];
                items.forEach(item => counts[item] = (counts[item] || 0) + 1);
            }
        });
        
        new Chart(document.getElementById(`chart-${q.id}`), {
            type: 'pie',
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    data: Object.values(counts),
                    backgroundColor: ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#673ab7', '#ff6d00']
                }]
            }
        });
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
    if(!userResponses.length) return document.getElementById('individualContent').innerHTML = "尚無回應";
    
    document.getElementById('indivIndex').innerText = currentIndivIndex + 1;
    document.getElementById('indivTotal').innerText = userResponses.length;
    
    const r = userResponses[currentIndivIndex];
    let html = `<h5 class="text-primary mb-3">${r.user_name} <small class="text-muted fs-6">(${new Date(r.submitted_at).toLocaleString()})</small></h5><hr>`;
    
    for(let [q, a] of Object.entries(r.answers)) {
        html += `<div class="mb-3"><strong>${q}</strong><div class="p-2 bg-light rounded">${a}</div></div>`;
    }
    document.getElementById('individualContent').innerHTML = html;
}

window.navIndividual = (dir) => {
    if(currentIndivIndex + dir >= 0 && currentIndivIndex + dir < userResponses.length) {
        currentIndivIndex += dir;
        renderIndividual();
    }
}

window.exportToExcel = () => {
    if(!userResponses.length) return alert("無資料");
    let csv = "\uFEFF填寫人,時間,回答內容(JSON)\n";
    userResponses.forEach(r => {
        // 將 JSON 物件轉為字串並處理引號
        let jsonStr = JSON.stringify(r.answers).replace(/"/g, '""'); 
        csv += `${r.user_name},${new Date(r.submitted_at).toLocaleString()},"${jsonStr}"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"}));
    link.download = "表單回應數據.csv";
    link.click();
}