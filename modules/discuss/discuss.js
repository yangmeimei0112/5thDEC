// --- 聊天室模組 ---

window.enterDiscuss = function() {
    switchView('discuss');
    loadMessages();
    // 設定自動捲動到底部
    const chatBox = document.getElementById('chatContainer');
    if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

// 格式化時間函式
function formatChatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    
    // 取得日期部分 (用於比較)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // 計算差距天數
    const diffTime = today - msgDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 時間部分：上午/下午 hh:mm
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours < 12 ? '上午' : '下午';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0點變成12點
    const timeStr = `${period} ${hours}:${minutes}`;

    if (diffDays === 0) {
        // 當天
        return timeStr;
    } else if (diffDays === 1) {
        // 昨天
        return `昨天 ${timeStr}`;
    } else {
        // 更早之前：MM/DD (週X) 時間
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const weekDay = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()];
        return `${month}/${day} (${weekDay}) ${timeStr}`;
    }
}

window.loadMessages = async function() {
    const box = document.getElementById('chatContainer');
    // 只有第一次載入顯示 Loading，避免自動重新整理時閃爍
    if(!box.innerHTML.trim()) {
        box.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-secondary"></div></div>';
    }

    try {
        // 1. 先抓取所有使用者的暱稱對照表 (學號 -> 暱稱)
        const { data: users, error: userError } = await supabaseClient
            .from('users_table')
            .select('username, nickname');
        
        if (userError) console.error("無法讀取使用者資料", userError);

        const userMap = {};
        if (users) {
            users.forEach(u => {
                // 如果有暱稱就用暱稱，沒有就用學號
                userMap[u.username] = u.nickname || u.username;
            });
        }

        // 2. 抓取訊息
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true }) // 舊訊息在上面
            .limit(100);

        if (error) throw error;

        if (data) {
            box.innerHTML = '<div class="chat-wrapper"></div>';
            const wrap = box.querySelector('.chat-wrapper');
            
            data.forEach(m => {
                const isMe = m.user_name === currentUser;
                
                // 使用新的時間格式化函式
                const timeDisplay = formatChatTime(m.created_at);
                
                // 取得顯示名稱 (如果是自己不用顯示名字)
                const displayName = userMap[m.user_name] || m.user_name;

                const msgDiv = document.createElement('div');
                msgDiv.className = `message-row ${isMe ? 'message-right' : 'message-left'}`;
                
                if(isMe) {
                    // 自己發的訊息 (右邊)
                    msgDiv.innerHTML = `
                        <div class="message-content">
                            <div class="message-bubble me">${m.content}</div>
                            <div class="message-time">${timeDisplay}</div>
                        </div>
                    `;
                } else {
                    // 別人發的訊息 (左邊) - 顯示暱稱
                    msgDiv.innerHTML = `
                        <div class="message-sender">${displayName}</div>
                        <div class="message-content">
                            <div class="message-bubble other">${m.content}</div>
                            <div class="message-time">${timeDisplay}</div>
                        </div>
                    `;
                }
                wrap.appendChild(msgDiv);
            });
            
            // 捲動到底部
            box.scrollTop = box.scrollHeight;
        }
    } catch (err) {
        handleError(err, "載入聊天訊息");
    }
}

window.sendMessage = async function() {
    const input = document.getElementById('msgInput');
    const content = input.value.trim();
    
    if (content) {
        try {
            const { error } = await supabaseClient
                .from('messages')
                .insert([{ user_name: currentUser, content: content }]);
            
            if (error) throw error;
            
            input.value = ""; // 清空輸入框
            loadMessages();   // 重新載入訊息
        } catch (err) {
            handleError(err, "傳送訊息");
        }
    }
}