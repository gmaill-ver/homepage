// ==========================================
// 買い物リスト機能
// ==========================================

let shoppingItems = [];
let shoppingListUnsubscribe = null;

// モード管理
let isShoppingEditMode = false;
let isShoppingDeleteMode = false;
let isShoppingReorderMode = false;

// 長押し検知用
let longPressTimer = null;
let longPressItemId = null;

// データをリアルタイムで読み込み
function loadShoppingList() {
    try {
        // 既存のリスナーがあれば解除
        if (shoppingListUnsubscribe) {
            shoppingListUnsubscribe();
        }

        // リアルタイム更新を監視
        shoppingListUnsubscribe = db.collection('shoppingList')
            .onSnapshot((snapshot) => {
                shoppingItems = [];
                snapshot.forEach((doc) => {
                    shoppingItems.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                // クライアント側でソート（order優先、なければcreatedAt）
                shoppingItems.sort((a, b) => {
                    const orderA = a.order || 999999;
                    const orderB = b.order || 999999;
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }
                    // orderが同じ場合はcreatedAtで降順
                    const timeA = a.createdAt?.toMillis() || 0;
                    const timeB = b.createdAt?.toMillis() || 0;
                    return timeB - timeA;
                });
                renderShoppingList();
            }, (error) => {
                console.error('買い物リスト読み込みエラー:', error);
            });
    } catch (error) {
        console.error('買い物リスト読み込みエラー:', error);
    }
}

// 買い物リストを表示
function renderShoppingList() {
    const container = document.getElementById('shoppingListContainer');
    if (!container) return;

    if (shoppingItems.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #999;">まだアイテムがありません</div>';
        return;
    }

    // 通常モード
    if (!isShoppingEditMode && !isShoppingDeleteMode && !isShoppingReorderMode) {
        const html = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.25rem;">
                ${shoppingItems.map(item => `
                    <div
                        data-item-id="${item.id}"
                        class="shopping-item"
                        style="padding: 0.375rem; background: ${item.purchased ? '#10B981' : 'white'}; border-radius: 0.375rem; border: 2px solid ${item.purchased ? '#10B981' : '#E5E7EB'}; cursor: pointer; transition: all 0.2s; text-align: center; user-select: none;">
                        <div style="font-weight: 600; font-size: 0.85rem; color: ${item.purchased ? 'white' : '#1F2937'}; ${item.purchased ? 'text-decoration: line-through;' : ''}\">${item.name} <span style="font-size: 0.7rem;">×${item.quantity || 1}</span></div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;

        // 長押しとクリックのイベントリスナーを追加
        document.querySelectorAll('.shopping-item').forEach(element => {
            const itemId = element.getAttribute('data-item-id');

            // タッチデバイス用
            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                startLongPress(itemId);
            });

            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                endLongPress(itemId);
            });

            element.addEventListener('touchmove', () => {
                cancelLongPress();
            });

            // マウス用
            element.addEventListener('mousedown', () => {
                startLongPress(itemId);
            });

            element.addEventListener('mouseup', () => {
                endLongPress(itemId);
            });

            element.addEventListener('mouseleave', () => {
                cancelLongPress();
            });
        });
    }
    // 編集モード
    else if (isShoppingEditMode) {
        const html = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.25rem;">
                ${shoppingItems.map(item => `
                    <div onclick="editShoppingItem('${item.id}')" class="shopping-item" style="padding: 0.375rem; background: ${item.purchased ? '#D1FAE5' : '#F3F4F6'}; border-radius: 0.375rem; border: 2px solid #9CA3AF; cursor: pointer; transition: all 0.2s; text-align: center;">
                        <div style="font-weight: 600; font-size: 0.85rem; color: #1F2937; ${item.purchased ? 'text-decoration: line-through;' : ''}\">${item.name} <span style="font-size: 0.7rem;">×${item.quantity || 1}${item.unit || '個'}</span></div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
    // 削除モード
    else if (isShoppingDeleteMode) {
        const html = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.25rem;">
                ${shoppingItems.map(item => `
                    <div class="shopping-item" style="padding: 0.375rem; background: ${item.purchased ? '#D1FAE5' : '#F3F4F6'}; border-radius: 0.375rem; border: 2px solid #9CA3AF; position: relative; text-align: center;">
                        <div style="font-weight: 600; font-size: 0.85rem; color: #1F2937; ${item.purchased ? 'text-decoration: line-through;' : ''}; padding-right: 2rem;">${item.name} <span style="font-size: 0.7rem;">×${item.quantity || 1}</span></div>
                        <button onclick="deleteShoppingItem('${item.id}')" style="position: absolute; top: 50%; right: 0.25rem; transform: translateY(-50%); background: transparent; color: #EF4444; border: none; cursor: pointer; font-size: 1.2rem; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-50%) scale(1.2)'" onmouseout="this.style.transform='translateY(-50%) scale(1)'">🗑️</button>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
    // 並び替えモード
    else if (isShoppingReorderMode) {
        const html = `
            <div style="display: grid; gap: 0.25rem;">
                ${shoppingItems.map((item, index) => `
                    <div class="shopping-item" style="padding: 0.375rem; background: #F3F4F6; border-radius: 0.375rem; border: 2px solid #9CA3AF; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 0.85rem; color: #1F2937; ${item.purchased ? 'text-decoration: line-through;' : ''}\">${item.name} <span style="font-size: 0.7rem;">×${item.quantity || 1}${item.unit || '個'}</span></div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            ${index > 0 ? `<button onclick="moveShoppingItem('${item.id}', 'up')" style="background: #3B82F6; color: white; border: none; border-radius: 0.25rem; width: 2rem; height: 1.5rem; cursor: pointer; font-size: 0.875rem;">▲</button>` : '<div style="width: 2rem; height: 1.5rem;"></div>'}
                            ${index < shoppingItems.length - 1 ? `<button onclick="moveShoppingItem('${item.id}', 'down')" style="background: #3B82F6; color: white; border: none; border-radius: 0.25rem; width: 2rem; height: 1.5rem; cursor: pointer; font-size: 0.875rem;">▼</button>` : '<div style="width: 2rem; height: 1.5rem;"></div>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
    }
}

// 編集モードトグル
function toggleShoppingEditMode() {
    isShoppingEditMode = !isShoppingEditMode;
    isShoppingDeleteMode = false;
    isShoppingReorderMode = false;
    renderShoppingList();
}

// 削除モードトグル
function toggleShoppingDeleteMode() {
    isShoppingDeleteMode = !isShoppingDeleteMode;
    isShoppingEditMode = false;
    isShoppingReorderMode = false;
    renderShoppingList();
}

// 並び替えモードトグル
function toggleShoppingReorderMode() {
    isShoppingReorderMode = !isShoppingReorderMode;
    isShoppingEditMode = false;
    isShoppingDeleteMode = false;
    renderShoppingList();
}

// 追加フォームのトグル
function toggleShoppingAddForm() {
    const form = document.getElementById('shoppingAddForm');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        // フォーカスを入力欄に移動
        document.getElementById('shoppingItemName').focus();
    } else {
        form.style.display = 'none';
    }
}

// アイテムを追加
async function addShoppingItem() {
    const nameInput = document.getElementById('shoppingItemName');
    const name = nameInput.value.trim();

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    try {
        // 最大のorder値を取得
        const maxOrder = shoppingItems.length > 0 ? Math.max(...shoppingItems.map(item => item.order || 0)) : 0;

        await db.collection('shoppingList').add({
            name: name,
            quantity: 1,
            unit: '個',
            purchased: false,
            order: maxOrder + 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // フォームをリセットして閉じる
        nameInput.value = '';
        const form = document.getElementById('shoppingAddForm');
        form.style.display = 'none';
    } catch (error) {
        console.error('アイテム追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// 購入済みトグル
async function togglePurchased(itemId) {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    try {
        await db.collection('shoppingList').doc(itemId).update({
            purchased: !item.purchased
        });
    } catch (error) {
        console.error('更新エラー:', error);
    }
}

// アイテムを編集
let editingItemId = null;
function editShoppingItem(itemId) {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    editingItemId = itemId;
    document.getElementById('editShoppingItemName').value = item.name;
    document.getElementById('editShoppingItemQuantity').value = item.quantity || 1;
    document.getElementById('editShoppingItemUnit').value = item.unit || '個';

    const modal = document.getElementById('editShoppingItemModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeEditShoppingItemModal() {
    const modal = document.getElementById('editShoppingItemModal');
    if (modal) {
        modal.style.display = 'none';
    }
    editingItemId = null;
}

async function saveEditedShoppingItem() {
    if (!editingItemId) return;

    const name = document.getElementById('editShoppingItemName').value.trim();
    const quantity = parseInt(document.getElementById('editShoppingItemQuantity').value) || 1;
    const unit = document.getElementById('editShoppingItemUnit').value.trim() || '個';

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    try {
        await db.collection('shoppingList').doc(editingItemId).update({
            name: name,
            quantity: quantity,
            unit: unit
        });
        closeEditShoppingItemModal();
    } catch (error) {
        console.error('更新エラー:', error);
        alert('更新に失敗しました');
    }
}

// アイテムを削除
async function deleteShoppingItem(itemId) {
    if (!confirm('このアイテムを削除しますか？')) return;

    try {
        await db.collection('shoppingList').doc(itemId).delete();
    } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// アイテムを移動
async function moveShoppingItem(itemId, direction) {
    const currentIndex = shoppingItems.findIndex(i => i.id === itemId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= shoppingItems.length) return;

    const currentItem = shoppingItems[currentIndex];
    const targetItem = shoppingItems[targetIndex];

    try {
        const batch = db.batch();

        // order値を入れ替え
        const currentOrder = currentItem.order || currentIndex;
        const targetOrder = targetItem.order || targetIndex;

        batch.update(db.collection('shoppingList').doc(currentItem.id), { order: targetOrder });
        batch.update(db.collection('shoppingList').doc(targetItem.id), { order: currentOrder });

        await batch.commit();
    } catch (error) {
        console.error('並び替えエラー:', error);
        alert('並び替えに失敗しました');
    }
}

// 長押し開始
function startLongPress(itemId) {
    longPressItemId = itemId;
    longPressTimer = setTimeout(() => {
        // 3秒後に数量変更モーダルを表示
        showQuantityChangeModal(itemId);
    }, 3000);
}

// 長押し終了
function endLongPress(itemId) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;

        // 3秒経過していない場合は通常のクリック（購入済みトグル）
        if (longPressItemId === itemId) {
            togglePurchased(itemId);
        }
    }
    longPressItemId = null;
}

// 長押しキャンセル
function cancelLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    longPressItemId = null;
}

// 数量変更モーダルを表示
function showQuantityChangeModal(itemId) {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    longPressItemId = itemId;

    // 商品名を表示
    document.getElementById('quantityChangeItemName').textContent = item.name;

    // 現在の数量を選択
    document.getElementById('quantitySelect').value = item.quantity || 1;

    // モーダルを表示
    const modal = document.getElementById('quantityChangeModal');
    if (modal) {
        modal.style.display = 'flex';
    }

    // タイマーをクリア
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

// 数量変更モーダルを閉じる
function closeQuantityChangeModal() {
    const modal = document.getElementById('quantityChangeModal');
    if (modal) {
        modal.style.display = 'none';
    }
    longPressItemId = null;
}

// 数量変更を保存
async function saveQuantityChange() {
    if (!longPressItemId) return;

    const quantity = parseInt(document.getElementById('quantitySelect').value);

    try {
        await db.collection('shoppingList').doc(longPressItemId).update({
            quantity: quantity
        });
        closeQuantityChangeModal();
    } catch (error) {
        console.error('数量変更エラー:', error);
        alert('数量変更に失敗しました');
    }
}

// 初期アイテムを一括追加（コンソールから実行用）
async function addInitialItems() {
    const items = [
        '砂糖', '塩', '胡椒', '塩胡椒', '醤油', '酢', '酒', 'みりん', '味噌',
        'サラダ油', 'オリーブオイル', 'ごま油', 'バター', '小麦粉', '片栗粉',
        '薄力粉', 'パン粉', '鰹節', '昆布つゆ', 'BEL', '顆粒だし', '鶏ガラ',
        'コンソメ', 'オイスター', '中濃ソース', 'マヨネーズ', 'ケチャップ',
        'ポン酢', '豆板醤', '甜麵醬', '七味', '焼き肉のタレ', 'レモン汁',
        'ラー油', '輪切り唐辛子', 'ごま', '乾燥わかめ', '生姜チューブ',
        '山葵チューブ', 'にんにくチューブ', '辛子チューブ', 'サランラップ',
        'アルミホイル', 'クッキングシート', 'ごみ袋', 'キッチンペーパー',
        'ネット (丸・浅型)', 'スポンジ', '食器用洗剤', 'シンク用洗剤',
        '食洗機用洗剤', 'ガスボンベ', 'ティッシュ', 'アルコールウェット',
        'ノンアルコールウェット', 'ハンドソープ (キレイキレイ)', 'ハンドペーパー',
        '洗濯用洗剤', '洗濯用柔軟剤', '洗濯用漂白剤', '洗濯用洗剤 (翔真用)',
        '洗濯用柔軟剤(翔真用)', '洗濯用漂白剤(翔真用)', 'バスマジックリン (噴射)',
        'コロコロ', 'ファブリーズ', 'トイレットペーパー', 'トイレ用クイックル(花王)',
        'トイレ用スタンプ(ジョンソン)', 'トイレ用スポンジ(スコッチブライト)',
        'クイックルワイパー (乾拭)', 'クイックルワイパー (濡拭)', 'シャンプー',
        'リンス', 'ボディーソープ', '歯ブラシ', '歯磨き粉', '歯磨き後のフッ素ラムネ',
        'おむつ', 'お尻ふき', '消臭袋', 'ポリ袋'
    ];

    try {
        const batch = db.batch();
        let order = shoppingItems.length > 0 ? Math.max(...shoppingItems.map(item => item.order || 0)) + 1 : 1;

        items.forEach((name) => {
            const docRef = db.collection('shoppingList').doc();
            batch.set(docRef, {
                name: name,
                quantity: 1,
                unit: '個',
                purchased: false,
                order: order++,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`${items.length}個のアイテムを追加しました`);
        alert(`${items.length}個のアイテムを追加しました`);
    } catch (error) {
        console.error('一括追加エラー:', error);
        alert('追加に失敗しました: ' + error.message);
    }
}

// 初期化
function initializeShoppingList() {
    loadShoppingList();
}
