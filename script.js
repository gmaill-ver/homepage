// グローバル変数
let currentUser = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarView = 'today';

// 月の名前
const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// ローカルストレージから設定を読み込む
function loadSettings() {
    const firebaseConfig = JSON.parse(localStorage.getItem('firebaseConfig') || '{}');
    const calendarConfig = JSON.parse(localStorage.getItem('calendarConfig') || '{}');
    const allowedEmails = JSON.parse(localStorage.getItem('allowedEmails') || '[]');
    
    document.getElementById('firebaseApiKey').value = firebaseConfig.apiKey || '';
    document.getElementById('firebaseAuthDomain').value = firebaseConfig.authDomain || '';
    document.getElementById('firebaseProjectId').value = firebaseConfig.projectId || '';
    document.getElementById('firebaseStorageBucket').value = firebaseConfig.storageBucket || '';
    document.getElementById('calendarApiKey').value = calendarConfig.apiKey || '';
    document.getElementById('calendarId').value = calendarConfig.calendarId || 'primary';
    
    renderEmailList(allowedEmails);
    
    return { firebaseConfig, calendarConfig, allowedEmails };
}

// 設定を保存
function saveSettings() {
    const firebaseConfig = {
        apiKey: document.getElementById('firebaseApiKey').value,
        authDomain: document.getElementById('firebaseAuthDomain').value,
        projectId: document.getElementById('firebaseProjectId').value,
        storageBucket: document.getElementById('firebaseStorageBucket').value
    };
    
    const calendarConfig = {
        apiKey: document.getElementById('calendarApiKey').value,
        calendarId: document.getElementById('calendarId').value
    };
    
    const allowedEmails = JSON.parse(localStorage.getItem('allowedEmails') || '[]');
    
    localStorage.setItem('firebaseConfig', JSON.stringify(firebaseConfig));
    localStorage.setItem('calendarConfig', JSON.stringify(calendarConfig));
    
    alert('設定を保存しました');
    closeModal('settingsModal');
}

// メールアドレスリストを表示
function renderEmailList(emails) {
    const emailList = document.getElementById('emailList');
    emailList.innerHTML = '';
    
    emails.forEach((email, index) => {
        const div = document.createElement('div');
        div.className = 'email-item';
        div.innerHTML = `
            <span>${email}</span>
            <button class="email-remove" onclick="removeEmail(${index})">✕</button>
        `;
        emailList.appendChild(div);
    });
}

// メールアドレスを追加
function addEmail() {
    const input = document.getElementById('emailInput');
    const email = input.value.trim();
    
    if (!email) return;
    
    const allowedEmails = JSON.parse(localStorage.getItem('allowedEmails') || '[]');
    
    if (!allowedEmails.includes(email)) {
        allowedEmails.push(email);
        localStorage.setItem('allowedEmails', JSON.stringify(allowedEmails));
        renderEmailList(allowedEmails);
        input.value = '';
    }
}

// メールアドレスを削除
function removeEmail(index) {
    const allowedEmails = JSON.parse(localStorage.getItem('allowedEmails') || '[]');
    allowedEmails.splice(index, 1);
    localStorage.setItem('allowedEmails', JSON.stringify(allowedEmails));
    renderEmailList(allowedEmails);
}

// ログイン処理
function login() {
    const email = prompt('メールアドレスを入力してください:');
    
    if (!email) return;
    
    const allowedEmails = JSON.parse(localStorage.getItem('allowedEmails') || '[]');
    
    if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
        alert('このメールアドレスはアクセスが許可されていません。');
        return;
    }
    
    currentUser = {
        email: email,
        displayName: email.split('@')[0]
    };
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showMainApp();
}

// ログアウト処理
function logout() {
    if (confirm('ログアウトしますか?')) {
        currentUser = null;
        localStorage.removeItem('currentUser');
        showLoginScreen();
    }
}

// ログイン画面を表示
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// メインアプリを表示
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userName').textContent = currentUser.displayName;
    
    renderPhotos();
    renderCalendar();
    renderNotices();
    renderContacts();
    updateMonthDisplay();
}

// モーダルを開く
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

// モーダルを閉じる
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 月の表示を更新
function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = `${currentYear}年 ${months[currentMonth]}`;
    renderPhotos();
}

// 前の月へ
function previousMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateMonthDisplay();
}

// 次の月へ
function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateMonthDisplay();
}

// 写真をアップロード
function uploadPhotos(files) {
    const monthKey = `${currentYear}-${currentMonth}`;
    const photos = JSON.parse(localStorage.getItem('photos') || '{}');
    
    if (!photos[monthKey]) {
        photos[monthKey] = [];
    }
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            photos[monthKey].push({
                id: Date.now() + Math.random(),
                url: e.target.result,
                date: new Date().toISOString()
            });
            localStorage.setItem('photos', JSON.stringify(photos));
            renderPhotos();
        };
        reader.readAsDataURL(file);
    });
}

// 写真を表示
function renderPhotos() {
    const monthKey = `${currentYear}-${currentMonth}`;
    const photos = JSON.parse(localStorage.getItem('photos') || '{}');
    const currentPhotos = photos[monthKey] || [];
    
    const photoGrid = document.getElementById('photoGrid');
    
    if (currentPhotos.length === 0) {
        photoGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📷</div>
                <p>写真がありません</p>
            </div>
        `;
        return;
    }
    
    photoGrid.innerHTML = currentPhotos.map(photo => `
        <div class="photo-item">
            <img src="${photo.url}" alt="家族の写真">
            <button class="photo-delete" onclick="deletePhoto('${photo.id}')">✕</button>
        </div>
    `).join('');
}

// 写真を削除
function deletePhoto(photoId) {
    const monthKey = `${currentYear}-${currentMonth}`;
    const photos = JSON.parse(localStorage.getItem('photos') || '{}');
    
    if (photos[monthKey]) {
        photos[monthKey] = photos[monthKey].filter(p => p.id !== parseFloat(photoId));
        localStorage.setItem('photos', JSON.stringify(photos));
        renderPhotos();
    }
}

// カレンダーを表示
async function renderCalendar() {
    const calendarConfig = JSON.parse(localStorage.getItem('calendarConfig') || '{}');
    const eventsDiv = document.getElementById('calendarEvents');
    
    if (!calendarConfig.apiKey) {
        eventsDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <p>Google Calendar未設定</p>
                <p style="font-size: 0.75rem;">設定から連携してください</p>
            </div>
        `;
        return;
    }
    
    try {
        const events = await loadCalendarEvents(calendarConfig);
        
        if (events.length === 0) {
            eventsDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <p>予定がありません</p>
                </div>
            `;
            return;
        }
        
        eventsDiv.innerHTML = events.map(event => {
            const startDate = new Date(event.start.dateTime || event.start.date);
            const endDate = new Date(event.end.dateTime || event.end.date);
            const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
            const timeStr = event.start.dateTime 
                ? `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')} - ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`
                : '終日';
            
            return `
                <div class="event-item">
                    <div class="event-date">${dateStr}</div>
                    <div class="event-info">
                        <h3>${event.summary || '(タイトルなし)'}</h3>
                        <p>${timeStr}</p>
                        ${event.location ? `<p>📍 ${event.location}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('カレンダー読み込みエラー:', error);
        eventsDiv.innerHTML = `
            <div class="empty-state">
                <p>カレンダーの読み込みに失敗しました</p>
            </div>
        `;
    }
}

// Googleカレンダーからイベントを取得
async function loadCalendarEvents(config) {
    const now = new Date();
    let timeMin, timeMax;
    
    if (calendarView === 'today') {
        timeMin = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        timeMax = new Date(now.setHours(23, 59, 59, 999)).toISOString();
    } else if (calendarView === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        timeMin = new Date(weekStart.setHours(0, 0, 0, 0)).toISOString();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        timeMax = new Date(weekEnd.setHours(23, 59, 59, 999)).toISOString();
    } else {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        timeMin = new Date(monthStart.setHours(0, 0, 0, 0)).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        timeMax = new Date(monthEnd.setHours(23, 59, 59, 999)).toISOString();
    }
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${config.calendarId}/events?key=${config.apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('カレンダーAPI呼び出し失敗');
    
    const data = await response.json();
    return data.items || [];
}

// カレンダービューを変更
function changeCalendarView(view) {
    calendarView = view;
    
    document.querySelectorAll('.cal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderCalendar();
}

// お知らせを表示
function renderNotices() {
    const notices = JSON.parse(localStorage.getItem('notices') || '[]');
    const noticeList = document.getElementById('noticeList');
    
    if (notices.length === 0) {
        noticeList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <p>お知らせはありません</p>
            </div>
        `;
        return;
    }
    
    noticeList.innerHTML = notices.map(notice => `
        <div class="notice-item">
            <div class="notice-header">
                <div class="notice-title">${notice.title}</div>
                <button class="notice-delete" onclick="deleteNotice(${notice.id})">✕</button>
            </div>
            <div class="notice-content">${notice.content}</div>
            <div class="notice-date">${new Date(notice.date).toLocaleDateString('ja-JP')}</div>
            ${notice.image ? `<img src="${notice.image}" alt="お知らせ画像" class="notice-image">` : ''}
        </div>
    `).join('');
}

// お知らせを追加
function addNotice() {
    const title = document.getElementById('noticeTitle').value;
    const content = document.getElementById('noticeContent').value;
    const imageInput = document.getElementById('noticeImage');
    
    if (!title || !content) {
        alert('タイトルと内容を入力してください');
        return;
    }
    
    const notice = {
        id: Date.now(),
        title: title,
        content: content,
        date: new Date().toISOString(),
        image: null
    };
    
    if (imageInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (e) => {
            notice.image = e.target.result;
            saveNotice(notice);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        saveNotice(notice);
    }
}

// お知らせを保存
function saveNotice(notice) {
    const notices = JSON.parse(localStorage.getItem('notices') || '[]');
    notices.unshift(notice);
    localStorage.setItem('notices', JSON.stringify(notices));
    
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeContent').value = '';
    document.getElementById('noticeImage').value = '';
    document.getElementById('noticeImagePreview').innerHTML = '';
    
    closeModal('noticeModal');
    renderNotices();
}

// お知らせを削除
function deleteNotice(id) {
    const notices = JSON.parse(localStorage.getItem('notices') || '[]');
    const filtered = notices.filter(n => n.id !== id);
    localStorage.setItem('notices', JSON.stringify(filtered));
    renderNotices();
}

// 連絡先を表示
function renderContacts() {
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    const contactList = document.getElementById('contactList');
    
    if (contacts.length === 0) {
        contactList.innerHTML = `
            <div class="contact-empty">
                <p>連絡先を追加してください</p>
            </div>
        `;
        return;
    }
    
    contactList.innerHTML = contacts.map(contact => `
        <div class="contact-item">
            <button class="contact-delete" onclick="deleteContact(${contact.id})">✕</button>
            <div class="contact-name">${contact.name}</div>
            <a href="tel:${contact.phone}" class="contact-phone">📞 ${contact.phone}</a>
        </div>
    `).join('');
}

// 連絡先を追加
function addContact() {
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    
    if (!name || !phone) {
        alert('名前と電話番号を入力してください');
        return;
    }
    
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    contacts.push({
        id: Date.now(),
        name: name,
        phone: phone
    });
    
    localStorage.setItem('contacts', JSON.stringify(contacts));
    
    document.getElementById('contactName').value = '';
    document.getElementById('contactPhone').value = '';
    
    closeModal('contactModal');
    renderContacts();
}

// 連絡先を削除
function deleteContact(id) {
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    const filtered = contacts.filter(c => c.id !== id);
    localStorage.setItem('contacts', JSON.stringify(filtered));
    renderContacts();
}

// お知らせ画像プレビュー
document.getElementById('noticeImage').addEventListener('change', function(e) {
    const preview = document.getElementById('noticeImagePreview');
    const file = e.target.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="width: 100%; height: 10rem; object-fit: cover; border-radius: 0.5rem; margin-top: 0.5rem;">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
});

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    // ログイン状態チェック
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    } else {
        showLoginScreen();
    }
    
    // 設定を読み込み
    loadSettings();
    
    // イベントリスナー設定
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('settingsBtn').addEventListener('click', () => {
        loadSettings();
        openModal('settingsModal');
    });
    document.getElementById('headerSettingsBtn').addEventListener('click', () => {
        loadSettings();
        openModal('settingsModal');
    });
    
    // 設定モーダル
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', () => closeModal('settingsModal'));
    document.getElementById('addEmailBtn').addEventListener('click', addEmail);
    document.getElementById('emailInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addEmail();
    });
    
    // 写真
    document.getElementById('photoInput').addEventListener('change', (e) => uploadPhotos(e.target.files));
    document.getElementById('prevMonth').addEventListener('click', previousMonth);
    document.getElementById('nextMonth').addEventListener('click', nextMonth);
    
    // カレンダー
    document.querySelectorAll('.cal-tab').forEach(tab => {
        tab.addEventListener('click', (e) => changeCalendarView(e.target.dataset.view));
    });
    
    // お知らせ
    document.getElementById('addNoticeBtn').addEventListener('click', () => openModal('noticeModal'));
    document.getElementById('saveNoticeBtn').addEventListener('click', addNotice);
    document.getElementById('closeNoticeBtn').addEventListener('click', () => closeModal('noticeModal'));
    
    // 連絡先
    document.getElementById('addContactBtn').addEventListener('click', () => openModal('contactModal'));
    document.getElementById('saveContactBtn').addEventListener('click', addContact);
    document.getElementById('closeContactBtn').addEventListener('click', () => closeModal('contactModal'));
});
