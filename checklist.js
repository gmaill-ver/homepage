// ==========================================
// 持ち物チェックリスト機能
// ==========================================

let checklistItems = []; // 全アイテムリスト { name, person, categories: {travel: {checked: false, quantity: 1, packed: false}, outing: {...}, nursery: {...}} }
let currentCategory = 'travel'; // 現在選択中のカテゴリ
let currentPersonFilter = 'common'; // 現在選択中の人物フィルター（アイテム一覧用）
let currentPackingPersonTab = 'common'; // 現在選択中の人物タブ（持っていくものリスト用）
let isReorderMode = false; // 並び替えモード
let isEditMode = false; // 編集モード

// カテゴリの定義
let categories = [
    { id: 'travel', icon: '✈️', name: '旅行' },
    { id: 'outing', icon: '🚶', name: '通常外出' },
    { id: 'nursery', icon: '🏫', name: '保育園' }
];

// 人物名のマッピング
const personNames = {
    'common': '共',
    'me': '英',
    'wife': '歩',
    'son': '翔'
};

// カテゴリを読み込み
async function loadCategories() {
    try {
        const doc = await db.collection('settings').doc('checklistCategories').get();
        if (doc.exists) {
            categories = doc.data().categories || categories;
        }
    } catch (error) {
        console.error('カテゴリ読み込みエラー:', error);
    }
}

// アイテムを読み込み
async function loadChecklistItems() {
    try {
        // カテゴリを先に読み込み
        await loadCategories();

        const doc = await db.collection('settings').doc('checklistItems').get();
        if (doc.exists) {
            checklistItems = doc.data().items || [];

            // 旧データ形式から新データ形式へのマイグレーション
            let needsMigration = false;
            checklistItems = checklistItems.map(item => {
                // categoriesが存在しない場合は初期化
                if (!item.categories) {
                    item.categories = {};
                    needsMigration = true;
                }

                // すべてのカテゴリを確保
                const itemCategories = {};

                for (const category of categories) {
                    const catId = category.id;
                    const value = item.categories[catId];

                    if (typeof value === 'boolean') {
                        // 旧形式: boolean → 新形式: {checked, quantity, packed}
                        itemCategories[catId] = { checked: value, quantity: 1, packed: false };
                        needsMigration = true;
                    } else if (value && typeof value === 'object' && 'checked' in value) {
                        // 新形式: そのまま使用（packedがない場合は追加）
                        itemCategories[catId] = {
                            checked: value.checked,
                            quantity: value.quantity || 1,
                            packed: value.packed || false
                        };
                        if (!('packed' in value)) needsMigration = true;
                    } else {
                        // 不正なデータまたは存在しない: 初期化
                        itemCategories[catId] = { checked: false, quantity: 1, packed: false };
                        needsMigration = true;
                    }
                }

                item.categories = itemCategories;

                // personが存在しない場合はデフォルト値を設定
                if (!item.person) {
                    item.person = 'common';
                    needsMigration = true;
                }

                return item;
            });

            // マイグレーションが必要な場合は保存
            if (needsMigration) {
                await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
            }
        } else {
            // デフォルトアイテム（すべてのカテゴリに対応）
            const defaultCats = {};
            categories.forEach(cat => {
                defaultCats[cat.id] = { checked: false, quantity: 1, packed: false };
            });

            checklistItems = [
                { name: '水筒', person: 'common', categories: {...defaultCats} },
                { name: 'タオル', person: 'common', categories: {...defaultCats} },
                { name: '帽子', person: 'son', categories: {...defaultCats} },
                { name: '着替え', person: 'son', categories: {...defaultCats} },
                { name: 'おむつ', person: 'son', categories: {...defaultCats} },
                { name: 'おしりふき', person: 'son', categories: {...defaultCats} },
                { name: 'ビニール袋', person: 'common', categories: {...defaultCats} },
                { name: '日焼け止め', person: 'common', categories: {...defaultCats} }
            ];
            await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        }
    } catch (error) {
        console.error('チェックリスト読み込みエラー:', error);
        checklistItems = [];
    }
}

// カテゴリを選択
function selectCategory(category) {
    currentCategory = category;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.category-btn[data-category="${category}"]`).classList.add('active');

    renderChecklist();
}

// 人物フィルターを選択
function filterByPerson(person) {
    currentPersonFilter = person;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.person-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.person-filter-btn[data-person="${person}"]`).classList.add('active');

    renderChecklist();
}

// 人物ラベルを取得
function getPersonLabel(person) {
    const labels = {
        'me': '👨',
        'wife': '👩',
        'son': '👶',
        'common': '🔗'
    };
    return labels[person] || '';
}

// 持っていくものリストの人物タブを切り替え
function selectPackingPersonTab(person) {
    currentPackingPersonTab = person;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.packing-person-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.packing-person-tab[data-person="${person}"]`)?.classList.add('active');

    renderChecklist();
}

// チェックリストを表示
function renderChecklist() {
    const packingList = document.getElementById('packingList');
    const allItemsList = document.getElementById('allItemsList');
    const emptyMessage = document.getElementById('packingEmptyMessage');

    if (!packingList || !allItemsList) return;

    // 現在のカテゴリでチェックされているアイテム
    let checkedItems = checklistItems.filter(item =>
        item.categories[currentCategory]?.checked &&
        item.person === currentPackingPersonTab
    );

    // 人物フィルターでフィルタリングされたアイテム（アイテム一覧用）
    let filteredItems = checklistItems.filter(item => item.person === currentPersonFilter);

    // 持っていくものリスト
    if (checkedItems.length === 0) {
        packingList.innerHTML = '';
        if (emptyMessage) emptyMessage.style.display = 'block';
    } else {
        if (emptyMessage) emptyMessage.style.display = 'none';
        packingList.innerHTML = checkedItems.map((item) => {
            const realIndex = checklistItems.findIndex(i => i.name === item.name && i.person === item.person);
            const quantity = item.categories[currentCategory]?.quantity || 1;
            const packed = item.categories[currentCategory]?.packed || false;
            return `
                <div class="checklist-item ${packed ? 'checked' : ''}" onclick="togglePackedStatus(${realIndex})">
                    <span style="flex: 1; font-size: 0.75rem;">${item.name} ${quantity > 1 ? `×${quantity}` : ''}</span>
                </div>
            `;
        }).join('');
    }

    // 全アイテムリスト（人物フィルター適用）
    allItemsList.innerHTML = filteredItems.map((item, filterIndex) => {
        const realIndex = checklistItems.findIndex(i => i.name === item.name && i.person === item.person);
        const isChecked = item.categories[currentCategory]?.checked;
        const quantity = item.categories[currentCategory]?.quantity || 1;

        // 数量選択肢を生成（1〜50）
        const quantityOptions = Array.from({length: 50}, (_, i) => i + 1)
            .map(n => `<option value="${n}" ${n === quantity ? 'selected' : ''}>×${n}</option>`)
            .join('');

        if (isReorderMode) {
            // 並び替えモード
            return `
                <div class="checklist-item" style="display: flex; align-items: center; gap: 0.5rem; cursor: default;">
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <button class="reorder-btn" onclick="moveItemUp(${realIndex})" ${filterIndex === 0 ? 'disabled' : ''} style="font-size: 0.75rem; padding: 0.1rem 0.3rem;">▲</button>
                        <button class="reorder-btn" onclick="moveItemDown(${realIndex})" ${filterIndex === filteredItems.length - 1 ? 'disabled' : ''} style="font-size: 0.75rem; padding: 0.1rem 0.3rem;">▼</button>
                    </div>
                    <span style="flex: 1; font-size: 0.75rem;">${item.name}</span>
                </div>
            `;
        } else if (isEditMode) {
            // 編集モード
            return `
                <div style="display: flex; align-items: center; gap: 0.2rem; padding: 0.35rem; background: white; border: 1px solid #E5E7EB; border-radius: 0.25rem; min-width: 0; overflow: hidden;">
                    <input type="text" value="${item.name}" onchange="updateItemName(${realIndex}, this.value)" style="flex: 1; padding: 0.25rem; border: none; outline: none; font-size: 0.7rem; min-width: 0;">
                    <button onclick="event.stopPropagation(); removeChecklistItem(${realIndex})" style="background: transparent; border: none; font-size: 0.95rem; padding: 0; cursor: pointer; line-height: 1; flex-shrink: 0;">🗑️</button>
                </div>
            `;
        } else {
            // 通常モード
            return `
                <div class="checklist-item ${isChecked ? 'checked' : ''}" onclick="toggleChecklistItem(${realIndex})">
                    <span style="flex: 1; font-size: 0.75rem;">${item.name}</span>
                    ${isChecked ? `
                        <select class="quantity-select" onclick="event.stopPropagation()" onchange="setQuantity(${realIndex}, this.value)" style="font-size: 0.75rem;">
                            ${quantityOptions}
                        </select>
                    ` : ''}
                </div>
            `;
        }
    }).join('');
}

// チェック状態を切り替え（アイテム一覧用）
async function toggleChecklistItem(index) {
    const currentState = checklistItems[index].categories[currentCategory];

    if (currentState?.checked) {
        // チェックを外す（持っていくものリストから削除）
        checklistItems[index].categories[currentCategory] = { checked: false, quantity: 1, packed: false };
    } else {
        // チェックを入れる（持っていくものリストに追加）
        checklistItems[index].categories[currentCategory] = {
            checked: true,
            quantity: currentState?.quantity || 1,
            packed: false
        };
    }

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('チェック状態保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 準備完了状態を切り替え（持っていくものリスト用）
async function togglePackedStatus(index) {
    const currentState = checklistItems[index].categories[currentCategory];
    if (!currentState?.checked) return;

    checklistItems[index].categories[currentCategory].packed = !currentState.packed;

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('準備完了状態保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 数量を設定
async function setQuantity(index, quantity) {
    const currentState = checklistItems[index].categories[currentCategory];
    if (!currentState?.checked) return;

    checklistItems[index].categories[currentCategory].quantity = parseInt(quantity);

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('数量変更エラー:', error);
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
    const personSelect = document.getElementById('checklistItemPerson');
    if (!input || !personSelect) return;

    const name = input.value.trim();
    const person = personSelect.value;

    if (!name) {
        alert('アイテム名を入力してください');
        return;
    }

    if (checklistItems.some(item => item.name === name && item.person === person)) {
        alert('このアイテムは既に存在します');
        return;
    }

    // すべてのカテゴリに対応
    const newItemCategories = {};
    categories.forEach(cat => {
        newItemCategories[cat.id] = { checked: false, quantity: 1, packed: false };
    });

    checklistItems.push({
        name: name,
        person: person,
        categories: newItemCategories
    });

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        input.value = '';
        personSelect.value = 'me';
        closeModal('checklistItemModal');
        renderChecklist();
    } catch (error) {
        console.error('アイテム追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// カテゴリ編集モーダルからアイテムを追加（モーダルを閉じない）
async function addChecklistItemFromModal() {
    const input = document.getElementById('checklistItemName');
    const personSelect = document.getElementById('checklistItemPerson');
    if (!input || !personSelect) return;

    const name = input.value.trim();
    const person = personSelect.value;

    if (!name) {
        alert('アイテム名を入力してください');
        return;
    }

    if (checklistItems.some(item => item.name === name && item.person === person)) {
        alert('このアイテムは既に存在します');
        return;
    }

    // すべてのカテゴリに対応
    const newItemCategories = {};
    categories.forEach(cat => {
        newItemCategories[cat.id] = { checked: false, quantity: 1, packed: false };
    });

    checklistItems.push({
        name: name,
        person: person,
        categories: newItemCategories
    });

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        input.value = '';
        personSelect.value = 'me';
        renderChecklist();
    } catch (error) {
        console.error('アイテム追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// カテゴリボタンを描画
function renderCategoryButtons() {
    const container = document.getElementById('categoryButtonsContainer');
    if (!container) return;

    container.innerHTML = categories.map(cat => `
        <button class="category-btn ${cat.id === currentCategory ? 'active' : ''}"
                data-category="${cat.id}"
                onclick="selectCategory('${cat.id}')">
            ${cat.icon ? cat.icon + ' ' : ''}${cat.name}
        </button>
    `).join('');
}

// カテゴリ編集モーダルを描画
function renderCategoryEditModal() {
    const categoryList = document.getElementById('categoryList');
    if (!categoryList) return;

    categoryList.innerHTML = categories.map((cat, index) => `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.75rem; background: #F9FAFB; border-radius: 0.5rem;">
            ${cat.icon ? `<span style="font-size: 1.5rem;">${cat.icon}</span>` : ''}
            <input type="text" value="${cat.name}" onchange="updateCategoryName(${index}, this.value)" style="flex: 1; font-weight: 500; padding: 0.5rem; border: 1px solid #E5E7EB; border-radius: 0.25rem; font-size: 0.875rem; background: white;">
            <button onclick="removeCategory(${index})" class="remove-btn" style="opacity: 1;">🗑️</button>
        </div>
    `).join('');
}

// カテゴリを追加
async function addCategory() {
    const input = document.getElementById('newCategoryInput');
    const fullText = input.value.trim();

    if (!fullText) {
        alert('カテゴリ名を入力してください');
        return;
    }

    // 最初の文字が絵文字かチェック（絵文字は複数バイト）
    const firstChar = Array.from(fullText)[0];
    let icon = '';
    let name = '';

    // 絵文字判定（簡易版：最初の文字が絵文字範囲にあれば分離）
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}]/u;

    if (firstChar && (firstChar.length > 1 || emojiRegex.test(firstChar))) {
        // 最初の文字が絵文字
        icon = firstChar;
        name = fullText.slice(firstChar.length).trim();
    } else {
        // 絵文字がない場合は全体をnameとして使用
        icon = '';
        name = fullText;
    }

    if (!name && icon) {
        // 絵文字のみの場合は絵文字をnameにも設定
        name = icon;
    }

    // 一意のIDを生成
    const id = 'cat_' + Date.now();

    categories.push({ id, icon, name });

    // すべてのアイテムに新しいカテゴリを追加
    checklistItems.forEach(item => {
        if (!item.categories[id]) {
            item.categories[id] = { checked: false, quantity: 1, packed: false };
        }
    });

    try {
        await db.collection('settings').doc('checklistCategories').set({ categories });
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });

        input.value = '';

        renderCategoryButtons();
        renderCategoryEditModal();
        renderChecklist();
    } catch (error) {
        console.error('カテゴリ追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// カテゴリ名を更新
async function updateCategoryName(index, newName) {
    if (!newName || newName.trim() === '') {
        alert('カテゴリ名を入力してください');
        renderCategoryEditModal();
        return;
    }

    categories[index].name = newName.trim();

    try {
        await db.collection('settings').doc('checklistCategories').set({ categories });
        renderCategoryButtons();
        renderCategoryEditModal();
    } catch (error) {
        console.error('カテゴリ名更新エラー:', error);
        alert('更新に失敗しました');
    }
}

// カテゴリを削除
async function removeCategory(index) {
    const cat = categories[index];

    if (!confirm(`「${cat.name}」カテゴリを削除しますか？\nこのカテゴリのチェック情報も削除されます。`)) {
        return;
    }

    const catId = cat.id;
    categories.splice(index, 1);

    // すべてのアイテムからこのカテゴリを削除
    checklistItems.forEach(item => {
        delete item.categories[catId];
    });

    // 削除したカテゴリが選択中だった場合は最初のカテゴリに切り替え
    if (currentCategory === catId && categories.length > 0) {
        currentCategory = categories[0].id;
    }

    try {
        await db.collection('settings').doc('checklistCategories').set({ categories });
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });

        renderCategoryButtons();
        renderCategoryEditModal();
        renderChecklist();
    } catch (error) {
        console.error('カテゴリ削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// 並び替えモードの切り替え
function toggleReorderMode() {
    isReorderMode = !isReorderMode;
    if (isReorderMode) isEditMode = false; // 編集モードを解除
    const btn = document.getElementById('toggleReorderMode');
    if (btn) {
        btn.style.opacity = isReorderMode ? '1' : '0.7';
        btn.style.background = isReorderMode ? 'rgba(59, 130, 246, 0.1)' : 'transparent';
    }
    const editBtn = document.getElementById('toggleEditMode');
    if (editBtn) {
        editBtn.style.opacity = '0.7';
        editBtn.style.background = 'transparent';
    }
    renderChecklist();
}

// 編集モードの切り替え
function toggleEditMode() {
    isEditMode = !isEditMode;
    if (isEditMode) isReorderMode = false; // 並び替えモードを解除
    const btn = document.getElementById('toggleEditMode');
    if (btn) {
        btn.style.opacity = isEditMode ? '1' : '0.7';
        btn.style.background = isEditMode ? 'rgba(59, 130, 246, 0.1)' : 'transparent';
    }
    const reorderBtn = document.getElementById('toggleReorderMode');
    if (reorderBtn) {
        reorderBtn.style.opacity = '0.7';
        reorderBtn.style.background = 'transparent';
    }
    renderChecklist();
}

// アイテム名を更新
async function updateItemName(index, newName) {
    if (!newName || newName.trim() === '') {
        alert('アイテム名を入力してください');
        renderChecklist();
        return;
    }

    checklistItems[index].name = newName.trim();

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('アイテム名更新エラー:', error);
        alert('更新に失敗しました');
    }
}

// アイテムを上に移動
async function moveItemUp(index) {
    if (index <= 0) return;

    // 現在のアイテムを取得
    const currentItem = checklistItems[index];

    // 同じ人物のアイテムの中で上に移動
    const samePersonItems = checklistItems
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.person === currentPersonFilter);

    // 現在のアイテムの位置を見つける
    const currentPositionInFiltered = samePersonItems.findIndex(({ idx }) => idx === index);

    if (currentPositionInFiltered <= 0) return; // 既に一番上

    // 入れ替える対象のインデックス
    const targetIndex = samePersonItems[currentPositionInFiltered - 1].idx;

    // 入れ替え
    const temp = checklistItems[index];
    checklistItems[index] = checklistItems[targetIndex];
    checklistItems[targetIndex] = temp;

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('並び替えエラー:', error);
        alert('並び替えに失敗しました');
    }
}

// アイテムを下に移動
async function moveItemDown(index) {
    if (index >= checklistItems.length - 1) return;

    // 現在のアイテムを取得
    const currentItem = checklistItems[index];

    // 同じ人物のアイテムの中で下に移動
    const samePersonItems = checklistItems
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.person === currentPersonFilter);

    // 現在のアイテムの位置を見つける
    const currentPositionInFiltered = samePersonItems.findIndex(({ idx }) => idx === index);

    if (currentPositionInFiltered >= samePersonItems.length - 1) return; // 既に一番下

    // 入れ替える対象のインデックス
    const targetIndex = samePersonItems[currentPositionInFiltered + 1].idx;

    // 入れ替え
    const temp = checklistItems[index];
    checklistItems[index] = checklistItems[targetIndex];
    checklistItems[targetIndex] = temp;

    try {
        await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        renderChecklist();
    } catch (error) {
        console.error('並び替えエラー:', error);
        alert('並び替えに失敗しました');
    }
}

// チェックリスト機能の初期化
async function initializeChecklist() {
    await loadChecklistItems();
    renderCategoryButtons();
    renderChecklist();

    // モーダルを開いた時にカテゴリ一覧を更新
    const categoryEditModal = document.getElementById('categoryEditModal');
    if (categoryEditModal) {
        categoryEditModal.addEventListener('click', (e) => {
            if (e.target === categoryEditModal) return;
            renderCategoryEditModal();
        });
    }
}
