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

// イベントリスナー設定済みフラグ
let shoppingListEventListenersSet = false;

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
                // クライアント側でソート（五十音順）
                shoppingItems.sort((a, b) => {
                    return a.name.localeCompare(b.name, 'ja');
                });
                renderShoppingList();
                renderCheckedShoppingWidget();
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

    // カテゴリ別に分類（categoryがない場合は'食品'として扱う）
    const foodItems = shoppingItems.filter(item => !item.category || item.category === '食品');
    const dailyItems = shoppingItems.filter(item => item.category === '日用品');

    // 通常モード
    if (!isShoppingEditMode && !isShoppingDeleteMode && !isShoppingReorderMode) {
        const renderCategorySection = (items, categoryName) => {
            if (items.length === 0) return '';
            return `
                <div style="margin-bottom: 0.75rem;">
                    <h4 style="font-size: 0.75rem; font-weight: 700; color: #374151; margin-bottom: 0.375rem; padding-left: 0.25rem;">${categoryName}</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.2rem;">
                        ${items.map(item => `
                            <div
                                data-item-id="${item.id}"
                                class="shopping-item"
                                style="padding: 0.25rem; background: ${item.purchased ? '#10B981' : 'white'}; border-radius: 0.25rem; border: 1px solid ${item.purchased ? '#10B981' : '#E5E7EB'}; cursor: pointer; text-align: center; user-select: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent;">
                                <div style="font-weight: 600; font-size: 0.7rem; color: ${item.purchased ? 'white' : '#1F2937'};">${item.name}${(item.quantity && item.quantity > 1) ? ` <span style="font-size: 0.6rem;">×${item.quantity}</span>` : ''}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const html = `
            ${renderCategorySection(foodItems, '食品')}
            ${foodItems.length > 0 && dailyItems.length > 0 ? '<hr style="border: none; border-top: 2px solid #E5E7EB; margin: 1rem 0;">' : ''}
            ${renderCategorySection(dailyItems, '日用品')}
        `;
        container.innerHTML = html;

        // イベントリスナーを初回のみ設定
        if (!shoppingListEventListenersSet) {
            shoppingListEventListenersSet = true;

            // タップで即座にトグル、長押しで数量変更
            // container自体にイベントリスナーを設定（イベントデリゲーション）
            container.addEventListener('touchstart', (e) => {
                const itemElement = e.target.closest('.shopping-item');
                if (itemElement) {
                    const itemId = itemElement.getAttribute('data-item-id');
                    const item = shoppingItems.find(i => i.id === itemId);
                    if (item) {
                        // DOM直接操作で即座に色変更（再描画なし）
                        const newPurchased = !item.purchased;
                        if (newPurchased) {
                            itemElement.style.background = '#10B981';
                            itemElement.style.borderColor = '#10B981';
                            const textDiv = itemElement.querySelector('div');
                            if (textDiv) textDiv.style.color = 'white';
                        } else {
                            itemElement.style.background = 'white';
                            itemElement.style.borderColor = '#E5E7EB';
                            const textDiv = itemElement.querySelector('div');
                            if (textDiv) textDiv.style.color = '#1F2937';
                        }
                    }
                    // 長押し判定開始
                    startLongPressForQuantity(itemId);
                }
            }, { passive: true });

            container.addEventListener('touchend', (e) => {
                const wasCanceled = cancelLongPressForQuantity();
                // タイマーがキャンセルされた場合（通常のタップ）のみFirebase保存
                if (wasCanceled) {
                    const itemElement = e.target.closest('.shopping-item');
                    if (itemElement) {
                        const itemId = itemElement.getAttribute('data-item-id');
                        togglePurchased(itemId);
                    }
                }
            }, { passive: true });

            container.addEventListener('touchmove', (e) => {
                const wasCanceled = cancelLongPressForQuantity();
                // スクロールでキャンセルされた場合は色を元に戻す
                if (wasCanceled) {
                    const itemElement = e.target.closest('.shopping-item');
                    if (itemElement) {
                        const itemId = itemElement.getAttribute('data-item-id');
                        const item = shoppingItems.find(i => i.id === itemId);
                        if (item) {
                            // 元の色に戻す
                            if (item.purchased) {
                                itemElement.style.background = '#10B981';
                                itemElement.style.borderColor = '#10B981';
                                const textDiv = itemElement.querySelector('div');
                                if (textDiv) textDiv.style.color = 'white';
                            } else {
                                itemElement.style.background = 'white';
                                itemElement.style.borderColor = '#E5E7EB';
                                const textDiv = itemElement.querySelector('div');
                                if (textDiv) textDiv.style.color = '#1F2937';
                            }
                        }
                    }
                }
            }, { passive: true });

            container.addEventListener('mousedown', (e) => {
                const itemElement = e.target.closest('.shopping-item');
                if (itemElement) {
                    const itemId = itemElement.getAttribute('data-item-id');
                    const item = shoppingItems.find(i => i.id === itemId);
                    if (item) {
                        // DOM直接操作で即座に色変更（再描画なし）
                        const newPurchased = !item.purchased;
                        if (newPurchased) {
                            itemElement.style.background = '#10B981';
                            itemElement.style.borderColor = '#10B981';
                            const textDiv = itemElement.querySelector('div');
                            if (textDiv) textDiv.style.color = 'white';
                        } else {
                            itemElement.style.background = 'white';
                            itemElement.style.borderColor = '#E5E7EB';
                            const textDiv = itemElement.querySelector('div');
                            if (textDiv) textDiv.style.color = '#1F2937';
                        }
                        // バックグラウンドでFirebase保存
                        togglePurchased(itemId);
                    }
                    // 長押し判定開始
                    startLongPressForQuantity(itemId);
                }
            });

            container.addEventListener('mouseup', () => {
                cancelLongPressForQuantity();
            });

            container.addEventListener('mouseleave', () => {
                const canceledItemId = cancelLongPressForQuantity();
                // マウスが離れてキャンセルされた場合は元に戻す
                if (canceledItemId) {
                    togglePurchased(canceledItemId);
                }
            });
        }
    }
    // 編集モード
    else if (isShoppingEditMode) {
        const renderCategorySection = (items, categoryName) => {
            if (items.length === 0) return '';
            return `
                <div style="margin-bottom: 0.75rem;">
                    <h4 style="font-size: 0.75rem; font-weight: 700; color: #374151; margin-bottom: 0.375rem; padding-left: 0.25rem;">${categoryName}</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.2rem;">
                        ${items.map(item => `
                            <div onclick="editShoppingItem('${item.id}')" class="shopping-item" style="padding: 0.25rem; background: ${item.purchased ? '#D1FAE5' : '#F3F4F6'}; border-radius: 0.25rem; border: 1px solid #9CA3AF; cursor: pointer; transition: all 0.2s; text-align: center;">
                                <div style="font-weight: 600; font-size: 0.7rem; color: #1F2937;">${item.name}${(item.quantity && item.quantity > 1) ? ` <span style="font-size: 0.6rem;">×${item.quantity}</span>` : ''}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const html = `
            ${renderCategorySection(foodItems, '食品')}
            ${foodItems.length > 0 && dailyItems.length > 0 ? '<hr style="border: none; border-top: 2px solid #E5E7EB; margin: 1rem 0;">' : ''}
            ${renderCategorySection(dailyItems, '日用品')}
        `;
        container.innerHTML = html;
    }
    // 削除モード
    else if (isShoppingDeleteMode) {
        const renderCategorySection = (items, categoryName) => {
            if (items.length === 0) return '';
            return `
                <div style="margin-bottom: 0.75rem;">
                    <h4 style="font-size: 0.75rem; font-weight: 700; color: #374151; margin-bottom: 0.375rem; padding-left: 0.25rem;">${categoryName}</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.2rem;">
                        ${items.map(item => `
                            <div class="shopping-item" style="padding: 0.25rem; background: ${item.purchased ? '#D1FAE5' : '#F3F4F6'}; border-radius: 0.25rem; border: 1px solid #9CA3AF; position: relative; text-align: center;">
                                <div style="font-weight: 600; font-size: 0.7rem; color: #1F2937; padding-right: 1.5rem;">${item.name}${(item.quantity && item.quantity > 1) ? ` <span style="font-size: 0.6rem;">×${item.quantity}</span>` : ''}</div>
                                <button onclick="deleteShoppingItem('${item.id}')" style="position: absolute; top: 50%; right: 0.2rem; transform: translateY(-50%); background: transparent; color: #EF4444; border: none; cursor: pointer; font-size: 1rem; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-50%) scale(1.2)'" onmouseout="this.style.transform='translateY(-50%) scale(1)'">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const html = `
            ${renderCategorySection(foodItems, '食品')}
            ${foodItems.length > 0 && dailyItems.length > 0 ? '<hr style="border: none; border-top: 2px solid #E5E7EB; margin: 1rem 0;">' : ''}
            ${renderCategorySection(dailyItems, '日用品')}
        `;
        container.innerHTML = html;
    }
    // 並び替えモード（ドラッグ&ドロップ）
    else if (isShoppingReorderMode) {
        const renderCategorySection = (items, categoryName) => {
            if (items.length === 0) return '';
            return `
                <div style="margin-bottom: 0.75rem;">
                    <h4 style="font-size: 0.75rem; font-weight: 700; color: #374151; margin-bottom: 0.375rem; padding-left: 0.25rem;">${categoryName}</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.2rem;">
                        ${items.map((item, index) => `
                            <div
                                class="shopping-item reorder-item"
                                data-item-id="${item.id}"
                                data-index="${index}"
                                draggable="true"
                                style="padding: 0.25rem; background: #F3F4F6; border-radius: 0.25rem; border: 1px solid #9CA3AF; text-align: center; cursor: move; user-select: none; touch-action: none;">
                                <div style="font-weight: 600; font-size: 0.7rem; color: #1F2937;">${item.name}${(item.quantity && item.quantity > 1) ? ` <span style="font-size: 0.6rem;">×${item.quantity}</span>` : ''}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const html = `
            <div id="reorderContainer">
                ${renderCategorySection(foodItems, '食品')}
                ${foodItems.length > 0 && dailyItems.length > 0 ? '<hr style="border: none; border-top: 2px solid #E5E7EB; margin: 1rem 0;">' : ''}
                ${renderCategorySection(dailyItems, '日用品')}
            </div>
        `;
        container.innerHTML = html;

        // ドラッグ&ドロップイベントを設定
        setupDragAndDrop();
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
    const categorySelect = document.getElementById('shoppingItemCategory');
    const name = nameInput.value.trim();
    const category = categorySelect ? categorySelect.value : '食品';

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
            category: category,
            purchased: false,
            order: maxOrder + 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // フォームをリセットして閉じる
        nameInput.value = '';
        if (categorySelect) categorySelect.value = '食品';
        const form = document.getElementById('shoppingAddForm');
        form.style.display = 'none';
    } catch (error) {
        console.error('アイテム追加エラー:', error);
        alert('追加に失敗しました');
    }
}

// 購入済みトグル（持ち物チェックリストと同じシンプルな仕組み）
async function togglePurchased(itemId) {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    // 状態を切り替え
    item.purchased = !item.purchased;

    try {
        // Firestoreに保存（リアルタイムリスナーが自動的にrenderShoppingListを呼ぶ）
        await db.collection('shoppingList').doc(itemId).update({
            purchased: item.purchased
        });
    } catch (error) {
        console.error('更新エラー:', error);
        // エラー時は元に戻す
        item.purchased = !item.purchased;
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

    const categorySelect = document.getElementById('editShoppingItemCategory');
    if (categorySelect) {
        categorySelect.value = item.category || '食品';
    }

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
    const categorySelect = document.getElementById('editShoppingItemCategory');
    const category = categorySelect ? categorySelect.value : '食品';

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    try {
        await db.collection('shoppingList').doc(editingItemId).update({
            name: name,
            quantity: quantity,
            unit: unit,
            category: category
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

// ドラッグ&ドロップのセットアップ
let draggedElement = null;
let draggedItemId = null;
let touchDragStartY = 0;
let touchDragStartX = 0;

function setupDragAndDrop() {
    const items = document.querySelectorAll('.reorder-item');

    items.forEach(item => {
        // デスクトップ: ドラッグイベント
        item.addEventListener('dragstart', (e) => {
            draggedElement = e.target;
            draggedItemId = e.target.getAttribute('data-item-id');
            e.target.style.opacity = '0.5';
        });

        item.addEventListener('dragend', (e) => {
            e.target.style.opacity = '1';
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedElement && draggedElement !== e.target) {
                swapItems(draggedItemId, e.target.getAttribute('data-item-id'));
            }
        });

        // モバイル: タッチイベント
        item.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            touchDragStartX = touch.clientX;
            touchDragStartY = touch.clientY;
            draggedElement = e.target.closest('.reorder-item');
            draggedItemId = draggedElement.getAttribute('data-item-id');
            draggedElement.style.opacity = '0.5';
            draggedElement.style.transform = 'scale(1.05)';
        });

        item.addEventListener('touchmove', (e) => {
            if (!draggedElement) return;
            e.preventDefault();

            const touch = e.touches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = elementBelow?.closest('.reorder-item');

            if (targetItem && targetItem !== draggedElement) {
                // 視覚的なフィードバック
                targetItem.style.background = '#DBEAFE';
            }
        });

        item.addEventListener('touchend', (e) => {
            if (!draggedElement) return;

            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = elementBelow?.closest('.reorder-item');

            if (targetItem && targetItem !== draggedElement) {
                const targetItemId = targetItem.getAttribute('data-item-id');
                swapItems(draggedItemId, targetItemId);
            }

            draggedElement.style.opacity = '1';
            draggedElement.style.transform = 'scale(1)';
            draggedElement = null;
            draggedItemId = null;
        });
    });
}

// アイテムの順序を入れ替え
async function swapItems(itemId1, itemId2) {
    const index1 = shoppingItems.findIndex(i => i.id === itemId1);
    const index2 = shoppingItems.findIndex(i => i.id === itemId2);

    if (index1 === -1 || index2 === -1) return;

    const item1 = shoppingItems[index1];
    const item2 = shoppingItems[index2];

    try {
        const batch = db.batch();

        const order1 = item1.order || index1;
        const order2 = item2.order || index2;

        batch.update(db.collection('shoppingList').doc(item1.id), { order: order2 });
        batch.update(db.collection('shoppingList').doc(item2.id), { order: order1 });

        await batch.commit();
    } catch (error) {
        console.error('並び替えエラー:', error);
    }
}

// 長押し開始（数量変更モーダル用）
function startLongPressForQuantity(itemId) {
    longPressItemId = itemId;
    longPressTimer = setTimeout(() => {
        // 1.5秒長押しされたのでモーダル表示（色は元に戻す）
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            const item = shoppingItems.find(i => i.id === itemId);
            if (item) {
                // 元の色に戻す
                if (item.purchased) {
                    itemElement.style.background = '#10B981';
                    itemElement.style.borderColor = '#10B981';
                    const textDiv = itemElement.querySelector('div');
                    if (textDiv) textDiv.style.color = 'white';
                } else {
                    itemElement.style.background = 'white';
                    itemElement.style.borderColor = '#E5E7EB';
                    const textDiv = itemElement.querySelector('div');
                    if (textDiv) textDiv.style.color = '#1F2937';
                }
            }
        }
        showQuantityChangeModal(itemId);
        longPressTimer = null;
    }, 1500);
}

// 長押しキャンセル（キャンセルされたかどうかのbool値を返す）
function cancelLongPressForQuantity() {
    const wasCanceled = longPressTimer !== null;
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    longPressItemId = null;
    return wasCanceled;
}

// 数量変更モーダルを表示（名前とカテゴリも編集可能）
function showQuantityChangeModal(itemId) {
    console.log('showQuantityChangeModal called with itemId:', itemId);
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) {
        console.error('Item not found for id:', itemId);
        return;
    }

    longPressItemId = itemId;
    console.log('longPressItemId set to:', longPressItemId);

    // モーダルを取得
    const modal = document.getElementById('quantityChangeModal');

    // モーダルにアイテムIDを保存（グローバル変数が消えても大丈夫なように）
    if (modal) {
        modal.setAttribute('data-item-id', itemId);
        console.log('Modal data-item-id set to:', itemId);
    }

    // 商品名を入力フィールドに設定
    const nameInput = document.getElementById('quantityChangeItemName');
    if (nameInput) {
        nameInput.value = item.name;
    }

    // 現在の数量を選択
    const quantitySelect = document.getElementById('quantitySelect');
    if (quantitySelect) {
        quantitySelect.value = item.quantity || 1;
    }

    // カテゴリを選択
    const categorySelect = document.getElementById('quantityChangeCategorySelect');
    if (categorySelect) {
        categorySelect.value = item.category || '食品';
    }

    // モーダルを表示
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
    console.log('closeQuantityChangeModal called, clearing longPressItemId');
    const modal = document.getElementById('quantityChangeModal');
    if (modal) {
        modal.style.display = 'none';
    }
    longPressItemId = null;
}

// 数量変更を保存（名前とカテゴリも保存）
async function saveQuantityChange() {
    console.log('saveQuantityChange called, longPressItemId:', longPressItemId);

    // モーダルからアイテムIDを取得（グローバル変数の代わり）
    const modal = document.getElementById('quantityChangeModal');
    const itemId = modal ? modal.getAttribute('data-item-id') : null;

    console.log('Retrieved itemId from modal:', itemId);

    if (!itemId) {
        console.error('itemId is null!');
        alert('エラー: アイテムIDが見つかりません');
        return;
    }

    const nameInput = document.getElementById('quantityChangeItemName');
    const quantitySelect = document.getElementById('quantitySelect');
    const categorySelect = document.getElementById('quantityChangeCategorySelect');

    const name = nameInput ? nameInput.value.trim() : '';
    const quantity = quantitySelect ? parseInt(quantitySelect.value) : 1;
    const category = categorySelect ? categorySelect.value : '食品';

    if (!name) {
        alert('商品名を入力してください');
        return;
    }

    const item = shoppingItems.find(i => i.id === itemId);

    console.log('Saving - name:', name, 'quantity:', quantity, 'category:', category, 'for item:', item);

    if (item) {
        // ローカルデータを更新
        item.name = name;
        item.quantity = quantity;
        item.category = category;
    }

    try {
        await db.collection('shoppingList').doc(itemId).update({
            name: name,
            quantity: quantity,
            category: category
        });
        console.log('Firebase update successful');
        closeQuantityChangeModal();
        // 再描画して変更を表示
        renderShoppingList();
    } catch (error) {
        console.error('更新エラー:', error);
        alert('更新に失敗しました: ' + error.message);
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

// 既存アイテムにカテゴリを自動設定
async function autoCategorizeItems() {
    // 食品キーワード
    const foodKeywords = [
        '砂糖', '塩', '胡椒', '塩胡椒', '醤油', '酢', '酒', 'みりん', '味噌',
        'サラダ油', 'オリーブオイル', 'ごま油', 'バター', '小麦粉', '片栗粉',
        '薄力粉', 'パン粉', '鰹節', '昆布つゆ', 'BEL', '顆粒だし', '鶏ガラ',
        'コンソメ', 'オイスター', '中濃ソース', 'マヨネーズ', 'ケチャップ',
        'ポン酢', '豆板醤', '甜麵醬', '七味', '焼き肉のタレ', 'レモン汁',
        'ラー油', '輪切り唐辛子', 'ごま', '乾燥わかめ', '生姜チューブ',
        '山葵チューブ', 'にんにくチューブ', '辛子チューブ', '牛乳', '卵',
        '肉', '魚', '野菜', '果物', 'パン', '米', '麺', 'ラーメン', 'パスタ',
        'チーズ', 'ヨーグルト', '豆腐', '納豆', 'ジュース', '水', 'お茶',
        'コーヒー', '紅茶', 'お菓子', 'アイス', 'デザート', '調味料'
    ];

    // 日用品キーワード
    const dailyItemsKeywords = [
        'サランラップ', 'アルミホイル', 'クッキングシート', 'ごみ袋', 'キッチンペーパー',
        'ネット', 'スポンジ', '洗剤', 'シンク用洗剤', '食器用洗剤',
        '食洗機用洗剤', 'ガスボンベ', 'ティッシュ', 'アルコールウェット',
        'ノンアルコールウェット', 'ハンドソープ', 'キレイキレイ', 'ハンドペーパー',
        '洗濯', '柔軟剤', '漂白剤', 'バスマジックリン', 'コロコロ', 'ファブリーズ',
        'トイレットペーパー', 'トイレ用クイックル', 'トイレ用スタンプ', 'トイレ用スポンジ',
        'クイックルワイパー', 'シャンプー', 'リンス', 'ボディーソープ', '歯ブラシ',
        '歯磨き粉', 'フッ素ラムネ', 'おむつ', 'お尻ふき', '消臭袋', 'ポリ袋',
        '石鹸', 'タオル', '洗顔', 'メイク落とし', '化粧水', '乳液'
    ];

    // カテゴリ判定関数
    const determineCategory = (name) => {
        const lowerName = name.toLowerCase();

        // 日用品キーワードをチェック
        for (const keyword of dailyItemsKeywords) {
            if (name.includes(keyword)) {
                return '日用品';
            }
        }

        // 食品キーワードをチェック
        for (const keyword of foodKeywords) {
            if (name.includes(keyword)) {
                return '食品';
            }
        }

        // デフォルトは食品
        return '食品';
    };

    try {
        const batch = db.batch();
        let updateCount = 0;

        for (const item of shoppingItems) {
            // categoryフィールドがない、または空の場合のみ更新
            if (!item.category) {
                const category = determineCategory(item.name);
                const docRef = db.collection('shoppingList').doc(item.id);
                batch.update(docRef, { category: category });
                updateCount++;
            }
        }

        if (updateCount > 0) {
            await batch.commit();
            console.log(`${updateCount}個のアイテムにカテゴリを設定しました`);
            alert(`${updateCount}個のアイテムにカテゴリを自動設定しました`);
        } else {
            console.log('すべてのアイテムにカテゴリが設定されています');
            alert('すべてのアイテムにカテゴリが設定されています');
        }
    } catch (error) {
        console.error('自動カテゴリ設定エラー:', error);
        alert('自動カテゴリ設定に失敗しました: ' + error.message);
    }
}

// その他ページにチェック済み買い物リストを表示
function renderCheckedShoppingWidget() {
    const widget = document.getElementById('checkedShoppingListWidget');
    const itemsContainer = document.getElementById('checkedShoppingItems');

    if (!widget || !itemsContainer) return;

    // その他ページが表示されていない場合は何もしない
    const otherPage = document.getElementById('otherPage');
    if (!otherPage || !otherPage.classList.contains('active')) {
        return;
    }

    // チェック済み（塗りつぶし済み）のアイテムを取得
    const checkedItems = shoppingItems.filter(item => item.purchased);

    if (checkedItems.length === 0) {
        widget.style.display = 'none';
        return;
    }

    widget.style.display = 'block';

    // カテゴリ別にグループ化
    const foodItems = checkedItems.filter(item => !item.category || item.category === '食品');
    const dailyItems = checkedItems.filter(item => item.category === '日用品');

    let html = '';

    if (foodItems.length > 0) {
        html += '<div style="margin-bottom: 0.5rem;"><strong style="font-size: 0.875rem; color: #6B7280;">食品</strong></div>';
        html += foodItems.map(item => {
            const quantity = item.quantity > 1 ? ` ×${item.quantity}` : '';
            const unit = item.unit ? ` ${item.unit}` : '';
            return `<div style="font-size: 0.875rem; padding: 0.25rem 0; color: #374151;">• ${item.name}${quantity}${unit}</div>`;
        }).join('');
    }

    if (dailyItems.length > 0) {
        if (foodItems.length > 0) {
            html += '<div style="border-top: 1px solid #E5E7EB; margin: 0.5rem 0;"></div>';
        }
        html += '<div style="margin-bottom: 0.5rem;"><strong style="font-size: 0.875rem; color: #6B7280;">日用品</strong></div>';
        html += dailyItems.map(item => {
            const quantity = item.quantity > 1 ? ` ×${item.quantity}` : '';
            const unit = item.unit ? ` ${item.unit}` : '';
            return `<div style="font-size: 0.875rem; padding: 0.25rem 0; color: #374151;">• ${item.name}${quantity}${unit}</div>`;
        }).join('');
    }

    itemsContainer.innerHTML = html;
}

// 購入済みアイテムをクリア
async function clearPurchasedItems() {
    const checkedItems = shoppingItems.filter(item => item.purchased);

    if (checkedItems.length === 0) {
        return;
    }

    if (!confirm(`${checkedItems.length}個のアイテムを削除しますか？`)) {
        return;
    }

    try {
        const batch = db.batch();
        checkedItems.forEach(item => {
            const docRef = db.collection('shoppingList').doc(item.id);
            batch.delete(docRef);
        });
        await batch.commit();
    } catch (error) {
        console.error('購入済みアイテム削除エラー:', error);
        alert('削除に失敗しました');
    }
}

// 初期化
function initializeShoppingList() {
    loadShoppingList();
}
