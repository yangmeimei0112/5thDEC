// --- 後台管理模組 ---

// 1. 初始化後台卡片 (在 Dashboard 載入時呼叫)
window.initAdminDashboard = async function() {
    // 只有管理員看得到
    if (currentUserRole !== 'admin') {
        document.getElementById('adminDashboardCard').classList.add('d-none');
        return;
    }
    
    document.getElementById('adminDashboardCard').classList.remove('d-none');
    
    // 取得統計數據
    try {
        const { data: users, error } = await supabaseClient.from('users_table').select('is_online');
        if (error) throw error;
        
        const total = users.length;
        const online = users.filter(u => u.is_online).length;
        
        document.getElementById('adminTotalUsers').innerText = total;
        document.getElementById('adminOnlineUsers').innerText = online;
    } catch (e) {
        console.error("無法載入後台數據", e);
    }
}

// 2. 進入後台詳細列表
window.enterAdminPanel = async function() {
    switchView('adminManage');
    loadUserTable();
}

// 3. 載入使用者列表
async function loadUserTable() {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-3"><div class="spinner-border text-primary"></div></td></tr>';
    
    try {
        const { data: users, error } = await supabaseClient
            .from('users_table')
            .select('*')
            .order('username', { ascending: true });
            
        if (error) throw error;
        
        tbody.innerHTML = "";
        
        users.forEach(u => {
            const statusHtml = u.is_online 
                ? `<span class="status-dot status-online"></span><span class="text-success small">線上</span>` 
                : `<span class="status-dot status-offline"></span><span class="text-muted small">離線</span>`;
            
            const roleBadge = u.role === 'admin' 
                ? `<span class="badge bg-danger">管理員</span>` 
                : `<span class="badge bg-secondary">學生</span>`;

            // 安全處理 null 值
            const safeName = u.real_name || '-';
            const safeSeat = u.class_seat || '-';
            const safeNick = u.nickname || '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="align-middle">${statusHtml}</td>
                <td class="align-middle fw-bold">${u.username}</td>
                <td class="align-middle">${safeName}</td>
                <td class="align-middle">${safeSeat}</td>
                <td class="align-middle">${safeNick}</td>
                <td class="align-middle">${roleBadge}</td>
                <td class="align-middle">
                    <button class="btn btn-sm btn-outline-primary" onclick="openEditUserModal('${u.username}')">
                        <i class="fas fa-edit"></i> 修改
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // 更新上方統計文字
        document.getElementById('adminManageTotal').innerText = users.length;
        document.getElementById('adminManageOnline').innerText = users.filter(u=>u.is_online).length;

    } catch (e) {
        handleError(e, "載入使用者列表");
    }
}

// 4. 開啟編輯視窗
let editingTargetUser = ""; // 暫存正在編輯的帳號

window.openEditUserModal = async function(targetUsername) {
    editingTargetUser = targetUsername;
    const modal = new bootstrap.Modal(document.getElementById('adminEditUserModal'));
    
    // 先填入目前的資料
    try {
        const { data, error } = await supabaseClient
            .from('users_table')
            .select('*')
            .eq('username', targetUsername)
            .single();
            
        if(error) throw error;
        
        document.getElementById('editTargetUsername').value = data.username;
        document.getElementById('editTargetRealName').value = data.real_name || "";
        document.getElementById('editTargetClassSeat').value = data.class_seat || "";
        document.getElementById('editTargetNickname').value = data.nickname || "";
        document.getElementById('editTargetRole').value = data.role || "student";
        
        modal.show();
    } catch(e) {
        handleError(e, "讀取使用者資料");
    }
}

// 5. 儲存變更
window.saveAdminUserChanges = async function() {
    const real_name = document.getElementById('editTargetRealName').value;
    const class_seat = document.getElementById('editTargetClassSeat').value;
    const nickname = document.getElementById('editTargetNickname').value;
    const role = document.getElementById('editTargetRole').value;
    
    try {
        const { error } = await supabaseClient
            .from('users_table')
            .update({ real_name, class_seat, nickname, role })
            .eq('username', editingTargetUser);
            
        if(error) throw error;
        
        showSystemMessage("使用者資料更新成功", "success");
        bootstrap.Modal.getInstance(document.getElementById('adminEditUserModal')).hide();
        loadUserTable(); // 重新載入列表
    } catch(e) {
        handleError(e, "更新失敗");
    }
}