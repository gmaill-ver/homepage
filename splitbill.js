// ==========================================
// 割り勘機能
// ==========================================

let splitExpenses = [];
let splitCumulativeBalances = {}; // 累積残高
let splitSettlementHistory = []; // 精算履歴

// データを読み込み
async function loadSplitBillData() {
    try {
        const doc = await db.collection('settings').doc('splitBill').get();
        if (doc.exists) {
            const data = doc.data();
            splitExpenses = data.expenses || [];
            splitCumulativeBalances = data.cumulativeBalances || {};
            splitSettlementHistory = data.settlementHistory || [];
            updateSplitBillDisplay();
            updateSplitHistoryDisplay();
        }
    } catch (error) {
        console.error('割り勘データ読み込みエラー:', error);
    }
}

// データを保存
async function saveSplitBillData() {
    try {
        await db.collection('settings').doc('splitBill').set({
            expenses: splitExpenses,
            cumulativeBalances: splitCumulativeBalances,
            settlementHistory: splitSettlementHistory
        });
    } catch (error) {
        console.error('割り勘データ保存エラー:', error);
        alert('保存に失敗しました');
    }
}

// 支払いを追加
async function addSplitExpense() {
    const payer = document.getElementById('splitPayerName').value.trim();
    const name = document.getElementById('splitExpenseName').value.trim();
    const amount = parseFloat(document.getElementById('splitAmount').value);

    if (!payer || !name || !amount || amount <= 0) {
        alert('すべての項目を正しく入力してください');
        return;
    }

    splitExpenses.push({ payer, name, amount });

    document.getElementById('splitPayerName').value = '';
    document.getElementById('splitExpenseName').value = '';
    document.getElementById('splitAmount').value = '';

    await saveSplitBillData();
    updateSplitBillDisplay();
    updateSplitNameList();
}

// 支払いを削除
async function deleteSplitExpense(index) {
    splitExpenses.splice(index, 1);
    await saveSplitBillData();
    updateSplitBillDisplay();
    updateSplitNameList();
}

// 精算完了
async function doSplitSettlement() {
    if (splitExpenses.length === 0) {
        alert('精算する支払いがありません');
        return;
    }

    // 今回の精算を計算
    const totals = {};
    let grandTotal = 0;

    splitExpenses.forEach(expense => {
        totals[expense.payer] = (totals[expense.payer] || 0) + expense.amount;
        grandTotal += expense.amount;
    });

    const numPeople = Object.keys(totals).length;
    const perPersonAmount = grandTotal / numPeople;

    const currentBalances = {};
    Object.keys(totals).forEach(person => {
        currentBalances[person] = totals[person] - perPersonAmount;
    });

    // 累積残高を更新
    Object.keys(currentBalances).forEach(person => {
        splitCumulativeBalances[person] = (splitCumulativeBalances[person] || 0) + currentBalances[person];
    });

    // 履歴に追加
    splitSettlementHistory.push({
        date: new Date().toLocaleString('ja-JP'),
        expenses: [...splitExpenses],
        balances: {...currentBalances},
        total: grandTotal
    });

    // 今回の支払いをクリア
    splitExpenses = [];

    await saveSplitBillData();
    updateSplitBillDisplay();
    updateSplitHistoryDisplay();

    alert('精算完了しました！');
}

// 名前リストを更新
function updateSplitNameList() {
    const nameList = document.getElementById('splitNameList');
    const allNames = new Set([
        ...splitExpenses.map(e => e.payer),
        ...Object.keys(splitCumulativeBalances)
    ]);
    nameList.innerHTML = [...allNames].map(name => `<option value="${name}">`).join('');
}

// 表示を更新
function updateSplitBillDisplay() {
    // 今回の支払い履歴の表示
    const expenseList = document.getElementById('splitExpenseList');
    if (splitExpenses.length === 0) {
        expenseList.innerHTML = '<div style="text-align: center; padding: 1rem; color: #999; font-size: 0.875rem;">まだ支払いが登録されていません</div>';
    } else {
        expenseList.innerHTML = splitExpenses.map((expense, index) => `
            <div style="background: #F9FAFB; padding: 0.5rem; border-radius: 0.375rem; margin-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #333; font-size: 0.875rem;">${expense.name}</div>
                    <div style="font-size: 0.75rem; color: #666;">${expense.payer}が支払い</div>
                </div>
                <div style="font-size: 1rem; font-weight: bold; color: #667eea; margin-left: 0.5rem;">¥${expense.amount.toLocaleString()}</div>
                <button onclick="deleteSplitExpense(${index})" style="background: #EF4444; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.5rem; cursor: pointer;">削除</button>
            </div>
        `).join('');
    }

    // 今回の精算結果の計算
    const totals = {};
    let grandTotal = 0;

    splitExpenses.forEach(expense => {
        totals[expense.payer] = (totals[expense.payer] || 0) + expense.amount;
        grandTotal += expense.amount;
    });

    const allPeople = new Set([
        ...Object.keys(totals),
        ...Object.keys(splitCumulativeBalances)
    ]);

    const numPeople = Object.keys(totals).length || allPeople.size;
    const perPersonAmount = numPeople > 0 ? grandTotal / numPeople : 0;

    const currentBalances = {};
    Object.keys(totals).forEach(person => {
        currentBalances[person] = totals[person] - perPersonAmount;
    });

    // 累積残高を計算（まだ精算完了していない分を含む）
    const displayBalances = {};
    allPeople.forEach(person => {
        displayBalances[person] = (splitCumulativeBalances[person] || 0) + (currentBalances[person] || 0);
    });

    const resultList = document.getElementById('splitResultList');
    if (allPeople.size === 0) {
        resultList.innerHTML = '<div style="text-align: center; padding: 1rem; color: #999; font-size: 0.875rem;">支払いを追加すると精算結果が表示されます</div>';
    } else {
        const sortedPeople = [...allPeople].sort((a, b) => displayBalances[b] - displayBalances[a]);

        resultList.innerHTML = sortedPeople.map(person => {
            const balance = displayBalances[person];
            const cumulative = splitCumulativeBalances[person] || 0;
            const current = currentBalances[person] || 0;

            let statusText = '';
            if (cumulative !== 0 && current !== 0) {
                statusText = `前回: ${cumulative >= 0 ? '+' : ''}¥${Math.round(cumulative).toLocaleString()} | 今回: ${current >= 0 ? '+' : ''}¥${Math.round(current).toLocaleString()}`;
            } else if (cumulative !== 0) {
                statusText = `前回から: ${cumulative >= 0 ? '+' : ''}¥${Math.round(cumulative).toLocaleString()}`;
            } else if (current !== 0) {
                statusText = `今回: ${current >= 0 ? '+' : ''}¥${Math.round(current).toLocaleString()}`;
            }

            const balanceText = balance >= 0
                ? `もらう: ¥${Math.round(Math.abs(balance)).toLocaleString()}`
                : `払う: ¥${Math.round(Math.abs(balance)).toLocaleString()}`;
            const balanceColor = balance >= 0 ? '#4CAF50' : '#EF4444';

            return `
                <div style="background: ${balance >= 0 ? '#E8F5E9' : '#FFEBEE'}; padding: 0.5rem; border-radius: 0.375rem; margin-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #333; font-size: 0.875rem;">${person}</div>
                        ${statusText ? `<div style="font-size: 0.7rem; color: #666; margin-top: 0.125rem;">${statusText}</div>` : ''}
                    </div>
                    <div style="font-size: 1rem; font-weight: bold; color: ${balanceColor};">${balanceText}</div>
                </div>
            `;
        }).join('');
    }

    document.getElementById('splitTotalAmount').textContent = `¥${grandTotal.toLocaleString()}`;
}

// 履歴表示を更新
function updateSplitHistoryDisplay() {
    const historySection = document.getElementById('splitHistorySection');
    const historyList = document.getElementById('splitHistoryList');

    if (splitSettlementHistory.length === 0) {
        historySection.style.display = 'none';
        return;
    }

    historySection.style.display = 'block';
    historyList.innerHTML = splitSettlementHistory.map((settlement, index) => `
        <div style="background: #F5F5F5; padding: 0.5rem; border-radius: 0.375rem; margin-bottom: 0.25rem;">
            <div style="font-weight: bold; color: #333; margin-bottom: 0.25rem; font-size: 0.875rem;">精算 #${index + 1} - ${settlement.date}</div>
            <div style="font-size: 0.75rem; color: #666; margin: 0.125rem 0;">合計: ¥${settlement.total.toLocaleString()}</div>
            <div style="font-size: 0.75rem; color: #666;">
                ${settlement.expenses.map(e => `${e.name} (${e.payer}: ¥${e.amount.toLocaleString()})`).join(', ')}
            </div>
        </div>
    `).reverse().join('');
}

// 初期化
async function initializeSplitBill() {
    await loadSplitBillData();
    updateSplitNameList();
}
