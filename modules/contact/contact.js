document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.target.classList.contains('homework-item')) { e.preventDefault(); addCommInput('homework'); }
            else if (e.target.classList.contains('exam-item')) { e.preventDefault(); addCommInput('exam'); }
            else if (e.target.classList.contains('other-item')) { e.preventDefault(); addCommInput('other'); }
        }
    });
});

window.enterCommBook = function() {
    switchView('commBook');
    document.getElementById('commDate').value = new Date().toISOString().split('T')[0];
    ['homeworkInputs','examInputs','otherInputs'].forEach(id=>document.getElementById(id).innerHTML="");
    addCommInput('homework'); addCommInput('exam'); addCommInput('other');
    document.getElementById('commBookAdminPanel').classList.toggle('d-none', currentUserRole !== 'admin');
    loadCommBookEntries();
}

window.addCommInput = function(type) {
    const div = document.createElement('div'); div.className = 'input-group mb-2';
    div.innerHTML = `<input type="text" class="form-control ${type}-item" placeholder="輸入事項..."><button class="btn btn-outline-secondary" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    document.getElementById(type === 'homework' ? 'homeworkInputs' : (type === 'exam' ? 'examInputs' : 'otherInputs')).appendChild(div);
    div.querySelector('input').focus();
}

window.addCommBookEntry = async function() {
    try {
        const date = document.getElementById('commDate').value; if(!date) throw new Error("請選擇日期");
        const hw = Array.from(document.querySelectorAll('.homework-item')).map(i=>(i.value||"").trim()).filter(v=>v).join('\n');
        const ex = Array.from(document.querySelectorAll('.exam-item')).map(i=>(i.value||"").trim()).filter(v=>v).join('\n');
        const ot = Array.from(document.querySelectorAll('.other-item')).map(i=>(i.value||"").trim()).filter(v=>v).join('\n');
        if (!hw && !ex && !ot) throw new Error("請至少輸入一項內容");
        const { error } = await supabaseClient.from('comm_book').insert([{ post_date: date, homework: hw, exams: ex, others: ot, teacher_name: currentUser }]);
        if (error) throw error; showSystemMessage("發布成功", "success"); enterCommBook();
    } catch(e) { handleError(e, "發布"); }
}

window.loadCommBookEntries = async function() {
    const container = document.getElementById('commBookList');
    container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-primary"></div></div>';
    try {
        const { data: books, error: err1 } = await supabaseClient.from('comm_book').select('*').order('post_date', { ascending: false });
        if (err1) throw err1;
        const { data: progress, error: err2 } = await supabaseClient.from('comm_progress').select('*').eq('user_name', currentUser);
        container.innerHTML = "";
        if (!books || books.length === 0) { container.innerHTML = '<div class="text-center py-5 text-muted"><i class="far fa-calendar-times fa-3x mb-3 opacity-50"></i><p>目前沒有聯絡事項</p></div>'; return; }
        
        const progressMap = {};
        if (progress) progress.forEach(p => { progressMap[p.comm_id] = p.checked_items || []; });

        books.forEach(item => {
            const d = new Date(item.post_date);
            const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
            const weekDay = ['週日','週一','週二','週三','週四','週五','週六'][d.getDay()];
            const checkedList = progressMap[item.id] || [];

            const renderList = (text, typeClass) => {
                if(!text || !text.trim()) return "";
                const items = text.split('\n').filter(t => t.trim());
                if(items.length === 0) return "";
                const listHtml = items.map(t => {
                    const isChecked = checkedList.includes(t.trim());
                    const safeText = t.replace(/'/g, "\\'"); 
                    return `<li class="checklist-item ${isChecked?'checked':''}" onclick="toggleCommItem(this, ${item.id}, '${safeText}')"><div class="check-circle"></div><span>${t}</span></li>`;
                }).join('');
                let title = typeClass==='tag-hw' ? "回家作業" : (typeClass==='tag-exam' ? "明日考試" : "其他事項");
                return `<div class="comm-section"><div class="comm-section-title ${typeClass.replace('tag', 'title')}">${title}</div><ul class="comm-checklist">${listHtml}</ul></div>`;
            };

            let contentHtml = "";
            contentHtml += renderList(item.homework, 'tag-hw');
            contentHtml += renderList(item.exams, 'tag-exam');
            contentHtml += renderList(item.others, 'tag-other');
            if(!contentHtml) contentHtml = `<div class="text-muted text-center py-3 small">本日無詳細內容</div>`;
            const delBtn = currentUserRole==='admin' ? `<button class="btn btn-sm text-danger delete-comm-btn border-0" onclick="deleteCommEntry(${item.id}); event.stopPropagation();"><i class="fas fa-trash"></i></button>` : '';
            container.innerHTML += `<div class="comm-modern-card" id="comm-card-${item.id}"><div class="comm-date-box"><span class="comm-month">${d.getMonth()+1}月</span><span class="comm-day">${d.getDate()}</span><span class="comm-weekday">${weekDay}</span></div><div class="comm-content-box"><div class="comm-meta"><span><i class="fas fa-user-edit me-1"></i> ${item.teacher_name}</span>${delBtn}</div>${contentHtml}</div></div>`;
        });
    } catch(e) { handleError(e, "載入"); }
}

window.toggleCommItem = async function(el, commId, itemText) {
    el.classList.toggle('checked'); 
    try {
        const { data: currentRecord } = await supabaseClient.from('comm_progress').select('checked_items').eq('comm_id', commId).eq('user_name', currentUser).single();
        let newCheckedList = currentRecord ? (currentRecord.checked_items || []) : [];
        if (newCheckedList.includes(itemText)) newCheckedList = newCheckedList.filter(t => t !== itemText);
        else newCheckedList.push(itemText);
        const { error } = await supabaseClient.from('comm_progress').upsert({ comm_id: commId, user_name: currentUser, checked_items: newCheckedList }, { onConflict: 'comm_id, user_name' });
        if(error) throw error;
    } catch (e) { handleError(e, "更新進度"); el.classList.toggle('checked'); }
}

window.deleteCommEntry = async (id) => { if(confirm("確定刪除？")) { const {error}=await supabaseClient.from('comm_book').delete().eq('id',id); if(!error) loadCommBookEntries(); } }