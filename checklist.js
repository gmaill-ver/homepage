// ==========================================
// 持ち物チェックリスト機能
// ==========================================

let checklistItems = []; // 全アイテムリスト

// アイテムを読み込み
async function loadChecklistItems() {
    try {
        const doc = await db.collection('settings').doc('checklistItems').get();
        if (doc.exists) {
            checklistItems = doc.data().items || [];
        } else {
            // デフォルトアイテム
            checklistItems = [
                { name: '水筒', checked: false },
                { name: 'タオル', checked: false },
                { name: '帽子', checked: false },
                { name: '着替え', checked: false },
                { name: 'おむつ', checked: false },
                { name: 'おしりふき', checked: false },
                { name: 'ビニール袋', checked: false },
                { name: '日焼け止め', checked: false }
            ];
            await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        }
    } catch (error) {
        console.error('チェックリスト読み込みエラー:', error);
        checklistItems = [
            { name: '水筒', checked: false },
            { name: 'タオル', checked: false },
            { name: '帽子', checked: false }
        ];
    }
}

// チェックリストを表示
function renderChecklist() {
    const packingList = document.getElementById('packingList');
    const allItemsList = document.getElementById('allItemsList');
    const emptyMessage = document.getElementById('packingEmptyMessage');

    if (!packingList || !allItemsList) return;

    const checkedItems = checklistItems.filter(item => item.checked);
    const uncheckedItems = checklistItems.filter(item => !item.checked);

    // 持っていくものリスト
    if (checkedItems.length === 0) {
        packingList.innerHTML = '';
        if (emptyMessage) emptyMessage.style.display = 'block';
    } else {
        if (emptyMessage) emptyMessage.style.display = 'none';
        packingList.innerHTML = checkedItems.map((item, index) => {
            const realIndex = checklistItems.findIndex(i => i.name === item.name);
            return `
                <div class="checklist-item checked">
                    <input type="checkbox"
                           id="packing_${realIndex}"
                           checked
                           onchange="toggleChecklistItem(${realIndex})">
                    <label for="packing_${realIndex}">${item.name}</label>
                </div>
            `;
        }).join('');
    }

    // 全アイテムリスト
    allItemsList.innerHTML = checklistItems.map((item, index) => `
        <div class="checklist-item ${item.checked ? 'checked' : ''}">
            <input type="checkbox"
                   id="all_${index}"
                   ${item.checked ? 'checked' : ''}
                   onchange="toggleChecklistItem(${index})">
            <label for="all_${index}">${item.name}</label>
            <button class="remove-btn" onclick="removeChecklistItem(${index})">🗑️</button>
        </div>
    `).join('');
}

// チェック状態を切り替え
async function toggleChecklistItem(index) {
    checklistItems[index].checked = !checklistItems[index].checked;

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('チェック状態保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// アイテムを削除
async function removeChecklistItem(index) {
    if (!confirm(`「${checklistItems[index].name}」を削除しますか？`)) return;

    checklistItems.splice(index, 1);

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('アイテム削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// アイテムを追加
async function addChecklistItem() {
    const input = document.getElementById('checklistItemName');
    if (!input) return;

    const name = input.value.trim();

    if (!name) {
        alert('アイテム名を入力してください');
        return;
    }

    if (checklistItems.some(item => item.name === name)) {
        alert('このアイテムは既に存在します');
        return;
    }

    checklistItems.push({ name: name, checked: false });

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        input.value = '';
        closeModal('checklistItemModal');
        renderChecklist();
    } catch (error) {
        console.error('アイテム追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// チェックリスト機能の初期化
async function initializeChecklist() {
    await loadChecklistItems();
    renderChecklist();
}
