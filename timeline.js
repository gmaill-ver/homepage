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
            <div onclick="toggleTimelineHeader()" style="position: relative; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
                <button onclick="event.stopPropagation(); deleteTimelineTrip()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: transparent; border: none; font-size: 1.25rem; cursor: pointer; padding: 0.25rem;">🗑️</button>
                <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem;">${trip.name}</h3>
                <p style="font-size: 0.875rem; opacity: 0.9;">${trip.date}</p>
            </div>
        `;
        return;
    }

    headerContainer.innerHTML = `
        <div onclick="toggleTimelineHeader()" style="position: relative; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
            <button onclick="event.stopPropagation(); deleteTimelineTrip()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: transparent; border: none; font-size: 1.25rem; cursor: pointer; padding: 0.25rem;">🗑️</button>
            <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem;">${trip.name}</h3>
            <p style="font-size: 0.875rem; opacity: 0.9;">${trip.date} - ${trip.entries.length}件のログ</p>
        </div>
    `;

    const timelineHTML = trip.entries.map((entry, index) => `
        ${index > 0 ? `<div style="text-align: center; margin: 0.25rem 0;"><button onclick="insertTimelineEntry(${index})" style="background: #667eea; color: white; border: none; border-radius: 50%; width: 1.75rem; height: 1.75rem; cursor: pointer; font-size: 1rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">➕</button></div>` : ''}
        <div style="position: relative; margin-bottom: 0.5rem; padding: 0.65rem; background: #F9FAFB; border-radius: 0.5rem; border-left: 4px solid #667eea;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <div style="display: flex; align-items: baseline; gap: 0.5rem;">
                    <span style="font-weight: bold; color: #667eea; font-size: 0.8rem;">${entry.time}</span>
                    <span style="font-size: 0.95rem; font-weight: 600; color: #212529;">${entry.location}</span>
                </div>
                <div style="display: flex; gap: 0.25rem;">
                    <button onclick="editTimelineEntry('${entry.id}')" style="background: transparent; border: none; font-size: 1.1rem; cursor: pointer; padding: 0.25rem;" title="編集">✏️</button>
                    <button onclick="deleteTimelineEntry('${entry.id}')" style="background: transparent; border: none; font-size: 1.1rem; cursor: pointer; padding: 0.25rem;" title="削除">🗑️</button>
                </div>
            </div>
            ${entry.memo ? `<div style="color: #6B7280; font-size: 0.8rem; line-height: 1.4; padding-left: 0.25rem;">${entry.memo}</div>` : ''}
        </div>
    `).join('');

    container.innerHTML = timelineHTML;
}

// エントリーを編集
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

// エントリーを削除
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
