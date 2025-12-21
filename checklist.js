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

// 人物の定義
let people = [
    { id: 'common', icon: '📦', name: '共' },
    { id: 'me', icon: '👨', name: '英' },
    { id: 'wife', icon: '👩', name: '歩' },
    { id: 'son', icon: '👶', name: '翔' }
];

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

// 人物を読み込み
async function loadPeople() {
    try {
        const doc = await db.collection('settings').doc('checklistPeople').get();
        if (doc.exists) {
            people = doc.data().people || people;
        }
    } catch (error) {
        console.error('人物読み込みエラー:', error);
    }
}

// アイテムを読み込み
async function loadChecklistItems() {
    try {
        // カテゴリと人物を先に読み込み
        await loadCategories();
        await loadPeople();

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

                // 旧「全体」を「common」に置き換え
                if (item.person === 'all' || item.person === '全体') {
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
    const personObj = people.find(p => p.id === person);
    return personObj ? personObj.icon : '';
}

// 人物名を取得
function getPersonName(person) {
    const personObj = people.find(p => p.id === person);
    return personObj ? personObj.name : '';
}

// 人物タブのHTMLを生成
function renderPersonTabs() {
    const packingPersonTabs = document.querySelector('.packing-person-tab')?.parentElement;
    const personFilterBtns = document.querySelector('.person-filter-btn')?.parentElement;

    if (packingPersonTabs) {
        packingPersonTabs.innerHTML = people.map(person => `
            <button class="packing-person-tab ${person.id === currentPackingPersonTab ? 'active' : ''}"
                    data-person="${person.id}"
                    onclick="selectPackingPersonTab('${person.id}')">
                ${person.icon} ${person.name}
            </button>
        `).join('');
    }

    if (personFilterBtns) {
        personFilterBtns.innerHTML = people.map(person => `
            <button class="person-filter-btn ${person.id === currentPersonFilter ? 'active' : ''}"
                    data-person="${person.id}"
                    onclick="filterByPerson('${person.id}')">
                ${person.icon} ${person.name}
            </button>
        `).join('');
    }
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

    categoryList.innerHTML = categories.map((cat, index) => {
        const displayValue = (cat.icon ? cat.icon + ' ' : '') + cat.name;
        return `
            <div style="display: flex; align-items: stretch; gap: 0.2rem; margin-bottom: 0.2rem;">
                <input type="text" value="${displayValue}" onchange="updateCategoryDisplay(${index}, this.value)" placeholder="📝 カテゴリ名" style="flex: 1; font-weight: 500; padding: 0.4rem; border: 1px solid #E5E7EB; border-radius: 0.25rem; font-size: 0.8rem; background: white;">
                <button onclick="removeCategory(${index})" style="background: transparent; border: 1px solid #E5E7EB; border-radius: 0.25rem; font-size: 0.9rem; padding: 0.4rem; cursor: pointer; opacity: 0.6; display: flex; align-items: center; justify-content: center;">🗑️</button>
            </div>
        `;
    }).join('');
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

// カテゴリ表示（アイコン+名前）を更新
async function updateCategoryDisplay(index, value) {
    if (!value || value.trim() === '') {
        alert('カテゴリ名を入力してください');
        renderCategoryEditModal();
        return;
    }

    const trimmed = value.trim();
    const parts = trimmed.split(' ');

    // 最初の文字が絵文字かどうかチェック（簡易判定）
    const firstPart = parts[0];
    const isEmoji = firstPart.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(firstPart);

    if (isEmoji && parts.length > 1) {
        // 絵文字がある場合
        categories[index].icon = firstPart;
        categories[index].name = parts.slice(1).join(' ');
    } else {
        // 絵文字がない場合
        categories[index].icon = '';
        categories[index].name = trimmed;
    }

    try {
        await db.collection('settings').doc('checklistCategories').set({ categories });
        renderCategoryButtons();
        renderCategoryEditModal();
    } catch (error) {
        console.error('カテゴリ更新エラー:', error);
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

// 人物を追加
async function addPerson() {
    const input = document.getElementById('newPersonInput');
    const fullText = input.value.trim();

    if (!fullText) {
        alert('人物名を入力してください');
        return;
    }

    // 最初の文字が絵文字かチェック
    const firstChar = Array.from(fullText)[0];
    let icon = '';
    let name = '';

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}]/u;

    if (firstChar && (firstChar.length > 1 || emojiRegex.test(firstChar))) {
        icon = firstChar;
        name = fullText.slice(firstChar.length).trim();
    } else {
        icon = '';
        name = fullText;
    }

    if (!name && icon) {
        name = icon;
    }

    // 一意のIDを生成
    const id = 'person_' + Date.now();

    people.push({ id, icon, name });

    try {
        await db.collection('settings').doc('checklistPeople').set({ people });
        input.value = '';
        renderPersonEditModal();
        renderPersonTabs();
        renderPersonSelectOptions();
        renderChecklist();
    } catch (error) {
        console.error('人物追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// 人物を削除
async function removePerson(index) {
    const person = people[index];

    // commonは削除できないようにする
    if (person.id === 'common') {
        alert('「共通」は削除できません');
        return;
    }

    // この人物のアイテムがあるか確認
    const hasItems = checklistItems.some(item => item.person === person.id);
    if (hasItems) {
        if (!confirm(`「${person.name}」のアイテムが存在します。\n削除すると、この人物のアイテムはすべて「共通」に移動されます。\n削除しますか？`)) {
            return;
        }
        // この人物のアイテムをcommonに移動
        checklistItems.forEach(item => {
            if (item.person === person.id) {
                item.person = 'common';
            }
        });
    }

    people.splice(index, 1);

    // 削除した人物が選択中だった場合はcommonに切り替え
    if (currentPersonFilter === person.id) {
        currentPersonFilter = 'common';
    }
    if (currentPackingPersonTab === person.id) {
        currentPackingPersonTab = 'common';
    }

    try {
        await db.collection('settings').doc('checklistPeople').set({ people });
        if (hasItems) {
            await db.collection('settings').doc('checklistItems').set({ items: checklistItems });
        }
        renderPersonEditModal();
        renderPersonTabs();
        renderPersonSelectOptions();
        renderChecklist();
    } catch (error) {
        console.error('人物削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// 人物表示を更新
async function updatePersonDisplay(index, value) {
    if (!value || value.trim() === '') {
        alert('人物名を入力してください');
        renderPersonEditModal();
        return;
    }

    const trimmed = value.trim();
    const parts = trimmed.split(' ');

    const firstPart = parts[0];
    const isEmoji = firstPart.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(firstPart);

    if (isEmoji && parts.length > 1) {
        people[index].icon = firstPart;
        people[index].name = parts.slice(1).join(' ');
    } else {
        people[index].icon = '';
        people[index].name = trimmed;
    }

    try {
        await db.collection('settings').doc('checklistPeople').set({ people });
        renderPersonEditModal();
        renderPersonTabs();
        renderPersonSelectOptions();
    } catch (error) {
        console.error('人物更新エラー:', error);
        alert('更新に失敗しました');
    }
}

// 人物編集モーダルを描画
function renderPersonEditModal() {
    const personList = document.getElementById('personList');
    if (!personList) return;

    personList.innerHTML = people.map((person, index) => {
        const displayValue = (person.icon ? person.icon + ' ' : '') + person.name;
        const isCommon = person.id === 'common';
        return `
            <div style="display: flex; align-items: stretch; gap: 0.2rem; margin-bottom: 0.2rem;">
                <input type="text" value="${displayValue}" onchange="updatePersonDisplay(${index}, this.value)" placeholder="👤 人物名" style="flex: 1; font-weight: 500; padding: 0.4rem; border: 1px solid #E5E7EB; border-radius: 0.25rem; font-size: 0.8rem; background: white;">
                <button onclick="removePerson(${index})" style="background: transparent; border: 1px solid #E5E7EB; border-radius: 0.25rem; font-size: 0.9rem; padding: 0.4rem; cursor: pointer; opacity: ${isCommon ? '0.3' : '0.6'}; display: flex; align-items: center; justify-content: center;" ${isCommon ? 'disabled' : ''}>🗑️</button>
            </div>
        `;
    }).join('');
}

// 人物セレクトボックスのオプションを更新
function renderPersonSelectOptions() {
    const selects = document.querySelectorAll('#checklistItemPerson');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = people.map(person =>
            `<option value="${person.id}">${person.icon} ${person.name}</option>`
        ).join('');
        select.value = currentValue;
    });
}

// チェックリスト機能の初期化
async function initializeChecklist() {
    await loadChecklistItems();
    renderCategoryButtons();
    renderPersonTabs();
    renderPersonSelectOptions();
    renderChecklist();

    // モーダルを開いた時にカテゴリ一覧と人物一覧を更新
    const categoryEditModal = document.getElementById('categoryEditModal');
    if (categoryEditModal) {
        categoryEditModal.addEventListener('click', (e) => {
            if (e.target === categoryEditModal) return;
            renderCategoryEditModal();
            renderPersonEditModal();
        });
    }
}

// モーダルを開く共通関数をオーバーライド（カテゴリ編集モーダル用）
const originalOpenModal = window.openModal;
window.openModal = function(modalId) {
    if (modalId === 'categoryEditModal') {
        renderCategoryEditModal();
        renderPersonEditModal();
    }
    if (originalOpenModal) {
        originalOpenModal(modalId);
    } else {
        document.getElementById(modalId).style.display = 'flex';
    }
};
