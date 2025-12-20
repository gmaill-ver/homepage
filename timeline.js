// ==========================================
// 時系列ログ機能
// ==========================================

let timelineTrips = [];
let currentTimelineTripId = null;

// データを読み込み
async function loadTimelineData() {
    try {
        const doc = await db.collection('settings').doc('timelineLog').get();
        if (doc.exists) {
            const data = doc.data();
            timelineTrips = data.trips || [];
            currentTimelineTripId = data.currentTripId || null;
            loadTimelineTrips();
            renderTimelineEntries();
        }
    } catch (error) {
        console.error('時系列データ読み込みエラー:', error);
    }
}

// データを保存
async function saveTimelineData() {
    try {
        await db.collection('settings').doc('timelineLog').set({
            trips: timelineTrips,
            currentTripId: currentTimelineTripId
        });
    } catch (error) {
        console.error('時系列データ保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 訪問先リストを読み込み
function loadTimelineTrips() {
    const select = document.getElementById('timelineTripSelect');
    if (!select) return;

    select.innerHTML = '<option value="">新規作成...</option>';

    timelineTrips.forEach(trip => {
        const option = document.createElement('option');
        option.value = trip.id;
        option.textContent = `${trip.name} (${trip.date})`;
        select.appendChild(option);
    });

    if (currentTimelineTripId) {
        select.value = currentTimelineTripId;
    }

    select.addEventListener('change', (e) => {
        currentTimelineTripId = e.target.value || null;
        saveTimelineData();
        renderTimelineEntries();
    });
}

// 新規訪問先モーダルを表示
function showNewTimelineTripModal() {
    const modal = document.getElementById('newTimelineTripModal');
    if (modal) {
        modal.style.display = 'flex';
        const dateInput = document.getElementById('timelineTripDate');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }
    }
}

// 新規訪問先モーダルを閉じる
function closeNewTimelineTripModal() {
    const modal = document.getElementById('newTimelineTripModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 新規訪問先を作成
async function createNewTimelineTrip() {
    const name = document.getElementById('timelineTripName').value.trim();
    const date = document.getElementById('timelineTripDate').value;

    if (!name || !date) {
        alert('訪問先名と日付を入力してください');
        return;
    }

    const newTrip = {
        id: Date.now().toString(),
        name: name,
        date: date,
        entries: []
    };

    timelineTrips.push(newTrip);
    currentTimelineTripId = newTrip.id;

    await saveTimelineData();
    loadTimelineTrips();

    const select = document.getElementById('timelineTripSelect');
    if (select) {
        select.value = currentTimelineTripId;
    }
    renderTimelineEntries();
    closeNewTimelineTripModal();

    document.getElementById('timelineTripName').value = '';
}

// 現在時刻をセット
function setCurrentTimelineTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 入力行を追加
let timelineInputRowCounter = 0;
function addTimelineInputRow(time = '', location = '', memo = '') {
    const rowId = `timeline-input-row-${timelineInputRowCounter++}`;
    const container = document.getElementById('timelineInputRows');
    if (!container) return;

    const defaultTime = time || setCurrentTimelineTime();

    const rowDiv = document.createElement('div');
    rowDiv.id = rowId;
    rowDiv.style.cssText = 'margin-bottom: 0.5rem;';
    rowDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 80px 1fr 30px; gap: 0.5rem; margin-bottom: 0.25rem;">
            <input type="time" class="timeline-time-input" value="${defaultTime}" style="padding: 0.4rem; border: 2px solid #E5E7EB; border-radius: 0.375rem; font-size: 0.8rem;">
            <input type="text" class="timeline-location-input" value="${location}" placeholder="場所を入力" style="padding: 0.4rem; border: 2px solid #E5E7EB; border-radius: 0.375rem; font-size: 0.8rem;">
            <button onclick="removeTimelineInputRow('${rowId}')" style="background: transparent; border: none; cursor: pointer; font-size: 1.1rem; color: #EF4444;" title="削除">🗑️</button>
        </div>
        <textarea class="timeline-memo-input" placeholder="メモ (任意)" style="width: 100%; padding: 0.4rem; border: 2px solid #E5E7EB; border-radius: 0.375rem; font-size: 0.75rem; min-height: 40px; resize: vertical; margin-bottom: 0.25rem;">${memo}</textarea>
    `;
    container.appendChild(rowDiv);
}

// 入力行を削除
function removeTimelineInputRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
    }
}

// すべての入力行を保存
async function addAllTimelineEntries() {
    if (!currentTimelineTripId) {
        alert('まず訪問先を選択または作成してください');
        return;
    }

    const container = document.getElementById('timelineInputRows');
    if (!container) return;

    const rows = container.children;
    if (rows.length === 0) {
        alert('追加するログがありません。「➕」ボタンで行を追加してください。');
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    let hasError = false;
    const newEntries = [];

    for (let row of rows) {
        const timeInput = row.querySelector('.timeline-time-input');
        const locationInput = row.querySelector('.timeline-location-input');
        const memoInput = row.querySelector('.timeline-memo-input');

        const time = timeInput?.value || '';
        const location = locationInput?.value.trim() || '';
        const memo = memoInput?.value.trim() || '';

        if (!time || !location) {
            hasError = true;
            if (timeInput) timeInput.style.borderColor = '#EF4444';
            if (locationInput) locationInput.style.borderColor = '#EF4444';
            continue;
        }

        newEntries.push({
            id: Date.now() + Math.random(),
            time: time,
            location: location,
            memo: memo
        });
    }

    if (hasError) {
        alert('時刻と場所は必須です。赤枠の項目を入力してください。');
        return;
    }

    if (newEntries.length > 0) {
        trip.entries.push(...newEntries);
        trip.entries.sort((a, b) => a.time.localeCompare(b.time));

        await saveTimelineData();
        renderTimelineEntries();

        // 入力行をクリア
        container.innerHTML = '';
        // 新しい空行を1つ追加
        addTimelineInputRow();
    }
}

// エントリーを追加（レガシー関数として保持）
async function addTimelineEntry() {
    if (!currentTimelineTripId) {
        alert('まず訪問先を選択または作成してください');
        return;
    }

    const time = document.getElementById('timelineTime')?.value;
    const location = document.getElementById('timelineLocation')?.value.trim();
    const memo = document.getElementById('timelineMemo')?.value.trim();

    if (!time || !location) {
        alert('時刻と場所を入力してください');
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    const entry = {
        id: Date.now(),
        time: time,
        location: location,
        memo: memo
    };

    trip.entries.push(entry);
    trip.entries.sort((a, b) => a.time.localeCompare(b.time));

    await saveTimelineData();
    renderTimelineEntries();

    // フォームをリセット
    if (document.getElementById('timelineLocation')) {
        document.getElementById('timelineLocation').value = '';
    }
    if (document.getElementById('timelineMemo')) {
        document.getElementById('timelineMemo').value = '';
    }
}

// タイムラインヘッダーの折りたたみ
function toggleTimelineHeader() {
    const container = document.getElementById('timelineEntriesContainer');
    if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
    }
}

// タイムラインを表示
function renderTimelineEntries() {
    const container = document.getElementById('timelineEntriesContainer');
    const headerContainer = document.getElementById('timelineTripHeader');

    if (!container || !headerContainer) return;

    if (!currentTimelineTripId) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: #999; font-size: 0.875rem;">訪問先を選択してください</div>';
        headerContainer.innerHTML = '';
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip || trip.entries.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 1rem; color: #999; font-size: 0.875rem;">まだログがありません</div>';
        headerContainer.innerHTML = `
            <div onclick="toggleTimelineHeader()" style="position: relative; background: #E5E7EB; color: #374151; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
                <div style="position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.25rem;">
                    <button id="toggleEditModeBtn" onclick="event.stopPropagation(); toggleTimelineEditMode()" style="background: transparent; border: none; font-size: 1.25rem; cursor: pointer; padding: 0.25rem;" title="編集モード">✏️</button>
                    <button onclick="event.stopPropagation(); deleteTimelineTrip()" style="background: transparent; border: none; font-size: 1.25rem; cursor: pointer; padding: 0.25rem;" title="削除">🗑️</button>
                </div>
                <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem; font-weight: 600;">${trip.name}</h3>
                <p style="font-size: 0.875rem; opacity: 0.7;">${trip.date}</p>
            </div>
        `;
        return;
    }

    headerContainer.innerHTML = `
        <div onclick="toggleTimelineHeader()" style="position: relative; background: #E5E7EB; color: #374151; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
            <div style="position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.25rem;">
                <button id="toggleEditModeBtn" onclick="event.stopPropagation(); toggleTimelineEditMode()" style="background: transparent; border: none; font-size: 1.25rem; cursor: pointer; padding: 0.25rem;" title="編集モード">✏️</button>
                <button onclick="event.stopPropagation(); deleteTimelineTrip()" style="background: transparent; border: none; font-size: 1.25rem; cursor: pointer; padding: 0.25rem;" title="削除">🗑️</button>
            </div>
            <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem; font-weight: 600;">${trip.name}</h3>
            <p style="font-size: 0.875rem; opacity: 0.7;">${trip.date} - ${trip.entries.length}件のログ</p>
        </div>
        <div id="editModeActions" style="display: none; margin-bottom: 0.5rem; padding: 0.5rem; background: #F3F4F6; border-radius: 0.5rem;">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button onclick="cancelTimelineEditMode()" class="btn-secondary" style="padding: 0.25rem 0.8rem; font-size: 0.8rem;">キャンセル</button>
                <button onclick="saveTimelineEditMode()" class="btn-primary" style="padding: 0.25rem 0.8rem; font-size: 0.8rem; background: #667eea;">💾 保存</button>
            </div>
        </div>
    `;

    const timelineHTML = trip.entries.map((entry, index) => `
        <div class="timeline-entry-item" data-entry-id="${entry.id}" data-entry-index="${index}" style="position: relative; margin-bottom: 0.5rem; padding: 0.75rem 1rem; background: white; border-radius: 0.5rem; border-left: 4px solid #667eea; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;">
            <div class="timeline-entry-view">
                <div style="display: flex; align-items: baseline; gap: 0.75rem;">
                    <span style="font-weight: 700; color: #667eea; font-size: 0.85rem; min-width: 45px;">${entry.time}</span>
                    <span style="font-size: 1rem; font-weight: 600; color: #1F2937; flex: 1;">${entry.location}</span>
                </div>
                ${entry.memo ? `<div style="color: #6B7280; font-size: 0.85rem; line-height: 1.5; margin-top: 0.5rem; padding-left: 53px;">${entry.memo}</div>` : ''}
            </div>
            <div class="timeline-entry-edit" style="display: none;">
                <div style="display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="time" class="edit-time-input" value="${entry.time}" style="padding: 0.4rem; border: 2px solid #E5E7EB; border-radius: 0.375rem; font-size: 0.8rem;">
                    <input type="text" class="edit-location-input" value="${entry.location}" style="padding: 0.4rem; border: 2px solid #E5E7EB; border-radius: 0.375rem; font-size: 0.8rem;">
                </div>
                <textarea class="edit-memo-input" style="width: 100%; padding: 0.4rem; border: 2px solid #E5E7EB; border-radius: 0.375rem; font-size: 0.75rem; min-height: 40px; resize: vertical;">${entry.memo || ''}</textarea>
                <div class="timeline-entry-controls" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button onclick="moveTimelineEntryUp(${index})" ${index === 0 ? 'disabled' : ''} style="background: #E5E7EB; border: none; border-radius: 0.375rem; padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.85rem; ${index === 0 ? 'opacity: 0.3; cursor: not-allowed;' : ''}" title="上へ">↑ 上へ</button>
                    <button onclick="moveTimelineEntryDown(${index})" ${index === trip.entries.length - 1 ? 'disabled' : ''} style="background: #E5E7EB; border: none; border-radius: 0.375rem; padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.85rem; ${index === trip.entries.length - 1 ? 'opacity: 0.3; cursor: not-allowed;' : ''}" title="下へ">↓ 下へ</button>
                    <button onclick="deleteTimelineEntryInEditMode(${index})" style="background: #FEE2E2; color: #991B1B; border: none; border-radius: 0.375rem; padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.85rem;" title="削除">🗑️ 削除</button>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = timelineHTML;
}

// 編集モード管理
let isTimelineEditMode = false;
let originalTimelineEntries = null;

function toggleTimelineEditMode() {
    if (isTimelineEditMode) {
        cancelTimelineEditMode();
    } else {
        enterTimelineEditMode();
    }
}

function enterTimelineEditMode() {
    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    // 元のデータをバックアップ
    originalTimelineEntries = JSON.parse(JSON.stringify(trip.entries));

    isTimelineEditMode = true;

    // 編集モードUIを表示
    const editModeActions = document.getElementById('editModeActions');
    if (editModeActions) {
        editModeActions.style.display = 'block';
    }

    // すべてのエントリーを編集モードに
    document.querySelectorAll('.timeline-entry-item').forEach(item => {
        const viewDiv = item.querySelector('.timeline-entry-view');
        const editDiv = item.querySelector('.timeline-entry-edit');

        if (viewDiv) viewDiv.style.display = 'none';
        if (editDiv) editDiv.style.display = 'block';

        // エントリーのスタイルを編集モード用に変更
        item.style.background = '#F9FAFB';
        item.style.borderLeftColor = '#9CA3AF';
    });
}

async function saveTimelineEditMode() {
    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    // すべての編集内容を取得
    const items = document.querySelectorAll('.timeline-entry-item');
    const updatedEntries = [];

    for (let item of items) {
        const entryId = item.getAttribute('data-entry-id');
        const timeInput = item.querySelector('.edit-time-input');
        const locationInput = item.querySelector('.edit-location-input');
        const memoInput = item.querySelector('.edit-memo-input');

        const time = timeInput?.value || '';
        const location = locationInput?.value.trim() || '';
        const memo = memoInput?.value.trim() || '';

        if (!time || !location) {
            alert('すべての時刻と場所を入力してください');
            return;
        }

        updatedEntries.push({
            id: entryId,
            time: time,
            location: location,
            memo: memo
        });
    }

    trip.entries = updatedEntries;
    await saveTimelineData();

    isTimelineEditMode = false;
    originalTimelineEntries = null;
    renderTimelineEntries();
}

function cancelTimelineEditMode() {
    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    // 元のデータを復元
    if (originalTimelineEntries) {
        trip.entries = originalTimelineEntries;
    }

    isTimelineEditMode = false;
    originalTimelineEntries = null;
    renderTimelineEntries();
}

// エントリーを編集（レガシー - モーダル編集）
let editingEntryId = null;
function editTimelineEntry(entryId) {
    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    const entry = trip.entries.find(e => e.id == entryId);
    if (!entry) return;

    editingEntryId = entryId;
    document.getElementById('editTimelineTime').value = entry.time;
    document.getElementById('editTimelineLocation').value = entry.location;
    document.getElementById('editTimelineMemo').value = entry.memo || '';

    const modal = document.getElementById('editTimelineEntryModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeEditTimelineEntryModal() {
    const modal = document.getElementById('editTimelineEntryModal');
    if (modal) {
        modal.style.display = 'none';
    }
    editingEntryId = null;
}

async function saveEditedTimelineEntry() {
    if (!editingEntryId) return;

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    const entry = trip.entries.find(e => e.id == editingEntryId);
    if (!entry) return;

    const time = document.getElementById('editTimelineTime').value;
    const location = document.getElementById('editTimelineLocation').value.trim();
    const memo = document.getElementById('editTimelineMemo').value.trim();

    if (!time || !location) {
        alert('時刻と場所を入力してください');
        return;
    }

    entry.time = time;
    entry.location = location;
    entry.memo = memo;

    trip.entries.sort((a, b) => a.time.localeCompare(b.time));

    await saveTimelineData();
    renderTimelineEntries();
    closeEditTimelineEntryModal();
}

// エントリーを挿入
function insertTimelineEntry(index) {
    if (!currentTimelineTripId) {
        alert('まず訪問先を選択または作成してください');
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    // 前のエントリーの時間を取得して、それより後の時間をデフォルトにする
    let defaultTime = setCurrentTimelineTime();
    if (index > 0 && trip.entries[index - 1]) {
        const prevTime = trip.entries[index - 1].time;
        // 前の時間の1分後を設定
        const [hours, minutes] = prevTime.split(':').map(Number);
        let newMinutes = minutes + 1;
        let newHours = hours;
        if (newMinutes >= 60) {
            newMinutes = 0;
            newHours = (hours + 1) % 24;
        }
        defaultTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    }

    // 新しい入力行を追加
    addTimelineInputRow(defaultTime, '', '');

    // 入力フォームにスクロール
    const container = document.getElementById('timelineInputRows');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 編集モードでエントリーを並び替え
function moveTimelineEntryUp(index) {
    if (index <= 0) return;

    const container = document.getElementById('timelineEntriesContainer');
    if (!container) return;

    const items = container.querySelectorAll('.timeline-entry-item');
    if (index >= items.length) return;

    const currentItem = items[index];
    const previousItem = items[index - 1];

    container.insertBefore(currentItem, previousItem);
}

function moveTimelineEntryDown(index) {
    const container = document.getElementById('timelineEntriesContainer');
    if (!container) return;

    const items = container.querySelectorAll('.timeline-entry-item');
    if (index >= items.length - 1) return;

    const currentItem = items[index];
    const nextItem = items[index + 1];

    if (nextItem.nextSibling) {
        container.insertBefore(currentItem, nextItem.nextSibling);
    } else {
        container.appendChild(currentItem);
    }
}

// 編集モードでエントリーを削除
function deleteTimelineEntryInEditMode(index) {
    if (!confirm('このログを削除しますか?')) return;

    const container = document.getElementById('timelineEntriesContainer');
    if (!container) return;

    const items = container.querySelectorAll('.timeline-entry-item');
    if (index >= items.length) return;

    items[index].remove();
}

// エントリーを削除（通常モード）
async function deleteTimelineEntry(entryId) {
    if (!confirm('このログを削除しますか?')) return;

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    trip.entries = trip.entries.filter(e => e.id != entryId);
    await saveTimelineData();
    renderTimelineEntries();
}

// 訪問先を削除
async function deleteTimelineTrip() {
    if (!currentTimelineTripId) {
        alert('削除する訪問先を選択してください');
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    if (!confirm(`「${trip.name}」を削除しますか？\nすべてのログも削除されます。`)) return;

    timelineTrips = timelineTrips.filter(t => t.id !== currentTimelineTripId);
    currentTimelineTripId = timelineTrips.length > 0 ? timelineTrips[0].id : null;

    await saveTimelineData();
    loadTimelineTrips();

    const select = document.getElementById('timelineTripSelect');
    if (select && currentTimelineTripId) {
        select.value = currentTimelineTripId;
    }
    renderTimelineEntries();
}

// データをエクスポート
function exportTimelineData() {
    if (!currentTimelineTripId) {
        alert('エクスポートする訪問先を選択してください');
        return;
    }

    const trip = timelineTrips.find(t => t.id === currentTimelineTripId);
    if (!trip) return;

    let text = `${trip.name} - ${trip.date}\n`;
    text += '='.repeat(40) + '\n\n';

    trip.entries.forEach(entry => {
        text += `[${entry.time}] ${entry.location}\n`;
        if (entry.memo) {
            text += `  メモ: ${entry.memo}\n`;
        }
        text += '\n';
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_${trip.name}_${trip.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// 初期化
async function initializeTimeline() {
    await loadTimelineData();
    // 最初の入力行を追加
    const container = document.getElementById('timelineInputRows');
    if (container) {
        container.innerHTML = ''; // クリア
        addTimelineInputRow(); // 最初の行を追加
    }
}
