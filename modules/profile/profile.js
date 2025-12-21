// --- 個人頁面模組 ---

/**
 * 進入個人頁面
 * 1. 切換視圖
 * 2. 顯示基本學號資訊
 * 3. 從資料庫讀取詳細資料 (暱稱、班級、自介)
 */
window.enterProfile = async function() {
    switchView('profile');
    
    // 初始化顯示 (避免畫面閃爍舊資料)
    document.getElementById('profileId').value = currentUser;
    document.getElementById('displayId').innerText = `@${currentUser}`;
    document.getElementById('displayRole').innerText = currentUserRole === 'admin' ? '管理者' : '學生';
    document.getElementById('displayRole').className = `badge rounded-pill px-3 ${currentUserRole === 'admin' ? 'bg-danger' : 'bg-primary'}`;

    try {
        // 從資料庫抓取最新資料
        const { data, error } = await supabaseClient
            .from('users_table')
            .select('*')
            .eq('username', currentUser)
            .single();

        if (error) throw error;

        // 填入右側表單
        document.getElementById('profileNickname').value = data.nickname || "";
        document.getElementById('profileRealName').value = data.real_name || "";
        document.getElementById('profileClassSeat').value = data.class_seat || "";
        document.getElementById('profileBio').value = data.bio || "";
        
        // 更新左側名片預覽
        updateProfilePreview(data.nickname, data.class_seat);

    } catch (e) {
        handleError(e, "讀取個人資料");
    }
}

/**
 * 儲存個人資料
 * 1. 抓取輸入框的值
 * 2. 更新資料庫
 * 3. 更新全域歡迎文字 (同步)
 */
window.saveProfile = async function() {
    const nickname = document.getElementById('profileNickname').value.trim();
    const real_name = document.getElementById('profileRealName').value.trim();
    const class_seat = document.getElementById('profileClassSeat').value.trim();
    const bio = document.getElementById('profileBio').value.trim();

    try {
        const { error } = await supabaseClient
            .from('users_table')
            .update({ 
                nickname: nickname, 
                real_name: real_name, 
                class_seat: class_seat, 
                bio: bio 
            })
            .eq('username', currentUser);

        if (error) throw error;

        showSystemMessage("✅ 個人資料已更新", "success");
        
        // [同步 1] 更新左側名片
        updateProfilePreview(nickname, class_seat);
        
        // [同步 2] 更新 Dashboard 歡迎文字
        const showName = nickname || currentUser;
        const welcomeEl = document.getElementById('welcomeText');
        if(welcomeEl) {
            welcomeEl.innerText = `${showName} (${currentUserRole==='admin'?'管理者':'學生'})`;
        }

    } catch (e) {
        handleError(e, "更新失敗");
    }
}

// 輔助函式：更新左側名片 UI
function updateProfilePreview(nickname, seat) {
    const nameEl = document.getElementById('displayNickname');
    const seatEl = document.getElementById('displayClassSeat');
    
    if(nameEl) nameEl.innerText = nickname || currentUser; // 沒有暱稱就顯示學號
    if(seatEl) seatEl.innerText = seat || "未設定座號";
}

// (保留原本的開發者後台邏輯，如果有的話)
if(document.getElementById('devBtn')) {
    document.getElementById('devBtn').addEventListener('click', () => { 
        if(prompt("請輸入開發者管理密碼：")==="wfsh") { 
            if(devModal) devModal.show(); 
            renderUserList(); 
        }
    });
}

async function renderUserList() { 
    const ul=document.getElementById('userList');
    if(!ul) return;
    ul.innerHTML="Loading..."; 
    const {data}=await supabaseClient.from('users_table').select('*'); 
    ul.innerHTML=""; 
    data.forEach(u=>{ 
        const roleBadge = u.role === 'admin' ? '<span class="badge bg-danger">管理者</span>' : '<span class="badge bg-secondary">學生</span>'; 
        ul.innerHTML+=`<li class="list-group-item d-flex justify-content-between"><span>${u.username}</span><div>${roleBadge} <span class="badge bg-light text-dark">${u.password}</span></div></li>`; 
    }); 
}

window.addNewUser = async () => { 
    const u=document.getElementById('newUsername').value;
    const p=document.getElementById('newPassword').value;
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