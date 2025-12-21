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

function shakeCard() { 
    const c = document.querySelector('.card'); 
    if(c) {
        c.classList.add('shake-animation'); 
        setTimeout(()=>c.classList.remove('shake-animation'), 300);
    }
}