/* eslint-disable no-undef */
// 查询地址是否使用过以及余额，并存入 localStorage
// 策略：顺序遍历 localStorage 中保存的 paymentAddresses -> changeAddresses
//      若连续 5 个地址未使用(n_tx 为 0)，则视为后续地址均未使用，停止请求

const API_BASE = 'https://blockchain.info';
const BATCH = 100; // blockchain.info balance endpoint 支持一次最多 100 个地址
const STOP_GAP = 5; // 连续未使用阈值

async function fetchBalances(batch) {
  const active = batch.join('|');
  const url = `${API_BASE}/balance?active=${active}&cors=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API 请求失败: ${res.status}`);
  return res.json();
}

window.checkAddresses = async function () {
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  statusEl.textContent = '';
  errorEl.textContent = '';

  try {
    const payments = JSON.parse(localStorage.getItem('paymentAddresses') || '[]');
    const changes = JSON.parse(localStorage.getItem('changeAddresses') || '[]');

    if (payments.length === 0 && changes.length === 0)
      throw new Error('localStorage 中没有地址，请先生成。');

    const result = [];

    async function processBranch(list) {
      let consecutiveUnused = 0;
      for (let i = 0; i < list.length; i += BATCH) {
        const slice = list.slice(i, i + BATCH);
        if (consecutiveUnused >= STOP_GAP) break;
        const addrs = slice.map((o) => o.address);
        const data = await fetchBalances(addrs);
        for (const addrObj of slice) {
          const info = data[addrObj.address];
          const used = info && (info.n_tx > 0 || info.final_balance > 0);
          const balance = info ? info.final_balance : 0;
          result.push({ ...addrObj, used, balance });
          if (used) {
            consecutiveUnused = 0;
          } else {
            consecutiveUnused++;
          }
        }
      }
    }

    await processBranch(payments);
    await processBranch(changes);

    localStorage.setItem('addressStatuses', JSON.stringify(result));
    statusEl.textContent = `已查询 ${result.length} 个地址，结果已保存到 localStorage(addressStatuses)`;
  } catch (err) {
    console.error('检查地址失败', err);
    errorEl.textContent = '检查地址失败: ' + err.message;
  }
};

window.computeTotalBalance = function () {
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  statusEl.textContent = '';
  errorEl.textContent = '';
  try {
    const statuses = JSON.parse(localStorage.getItem('addressStatuses') || '[]');
    if (statuses.length === 0) throw new Error('请先执行地址检查，再计算余额');
    const totalSatoshi = statuses.reduce((sum, o) => sum + (o.balance || 0), 0);
    const totalBTC = totalSatoshi / 1e8;
    // 写入 localStorage
    localStorage.setItem('totalBalance', JSON.stringify({ satoshi: totalSatoshi, btc: totalBTC }));
    statusEl.textContent = `总余额: ${totalBTC} BTC (${totalSatoshi} satoshi)`;
  } catch (err) {
    console.error('计算余额失败', err);
    errorEl.textContent = '计算余额失败: ' + err.message;
  }
}; 