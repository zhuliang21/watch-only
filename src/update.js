// 自动检测地址状态更新模块
// 用于定时检测比特币地址状态变化，识别新交易

// 自动检测相关变量
let autoDetectInterval = null;
let countdownInterval = null;
let isAutoDetecting = false;
let nextDetectTimeStamp = 0;

// 切换自动检测状态
window.toggleAutoDetect = function() {
  const btn = document.getElementById('autoDetectBtn');
  const statusDiv = document.getElementById('autoDetectStatus');
  const statusText = document.getElementById('detectStatusText');
  
  if (isAutoDetecting) {
    // 停止自动检测
    stopAutoDetect();
    if (btn) {
      btn.textContent = '开启自动检测';
      btn.style.background = '#ffc107';
    }
    if (statusDiv) statusDiv.style.display = 'none';
    if (statusText) statusText.textContent = '已停止';
  } else {
    // 开始自动检测
    startAutoDetect();
    if (btn) {
      btn.textContent = '停止自动检测';
      btn.style.background = '#dc3545';
    }
    if (statusDiv) statusDiv.style.display = 'block';
    if (statusText) statusText.textContent = '运行中';
  }
};

// 仅启动自动检测（适用于主页面）
window.startAutoDetectSilent = function() {
  if (!isAutoDetecting) {
    startAutoDetect();
  }
};

// 开始自动检测
function startAutoDetect() {
  isAutoDetecting = true;
  
  // 立即执行一次检测
  performAutoDetection();
  
  // 设置定时器，每30秒执行一次
  autoDetectInterval = setInterval(performAutoDetection, 30000);
  
  // 开始倒计时显示
  startCountdown();
  
  addToDetectionLog('🟢 自动检测已启动，间隔30秒');
}

// 停止自动检测
function stopAutoDetect() {
  isAutoDetecting = false;
  
  if (autoDetectInterval) {
    clearInterval(autoDetectInterval);
    autoDetectInterval = null;
  }
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  const nextDetectTimeEl = document.getElementById('nextDetectTime');
  if (nextDetectTimeEl) {
    nextDetectTimeEl.textContent = '--';
  }
  addToDetectionLog('🔴 自动检测已停止');
}

// 执行自动检测
async function performAutoDetection() {
  try {
    addToDetectionLog(`🔍 开始检测... (${new Date().toLocaleTimeString()})`);
    
    // 保存当前的检测结果作为对比基准
    const previousResults = JSON.parse(localStorage.getItem('addressStatuses') || '[]');
    const prevTotalObj = JSON.parse(localStorage.getItem('totalBalance') || 'null');
    const prevTotalSat = prevTotalObj ? prevTotalObj.satoshi : 0;
    
    // 执行地址检查
    await window.checkAddresses();
    
    // 获取新的检测结果
    const currentResults = JSON.parse(localStorage.getItem('addressStatuses') || '[]');
    
    // 计算总余额并更新 localStorage
    window.computeTotalBalance && window.computeTotalBalance();
    addToDetectionLog('💰 总余额已更新');
    
    // 查询人民币价格
    if (window.queryRMBPrice) {
      await window.queryRMBPrice();
      addToDetectionLog('💴 人民币价格已更新');
    }
    
    // 更新未确认余额（mempool）
    if (window.checkMempoolIncoming) {
      await window.checkMempoolIncoming();
      addToDetectionLog('💱 未确认余额已更新');
    }

    // 判断总余额是否变化，若变化则刷新交易历史与余额时间线
    const newTotalObj = JSON.parse(localStorage.getItem('totalBalance') || 'null');
    const newTotalSat = newTotalObj ? newTotalObj.satoshi : 0;
    if (newTotalSat !== prevTotalSat) {
      addToDetectionLog('📈 检测到余额变化，刷新交易历史与余额表');
      if (window.fetchTxHistory) await window.fetchTxHistory();
      if (window.buildBalanceTable) window.buildBalanceTable();
      if (window.renderRecentTxs) window.renderRecentTxs();
    } else {
      addToDetectionLog('⚖️ 余额无变化');
    }
    
    // 比较结果，检测新交易
    const newTransactions = detectNewTransactions(previousResults, currentResults);
    
    if (newTransactions.length > 0) {
      showNewTransactionAlert(newTransactions);
      addToDetectionLog(`✅ 发现 ${newTransactions.length} 个新交易`);
    } else {
      hideNewTransactionAlert();
      addToDetectionLog('✅ 检测完成，无新交易');
    }
    
    // 更新下次检测时间
    nextDetectTimeStamp = Date.now() + 30000;
    
  } catch (error) {
    addToDetectionLog(`❌ 检测失败: ${error.message}`);
    console.error('自动检测失败:', error);
  }
}

// 检测新交易
function detectNewTransactions(previousResults, currentResults) {
  const newTransactions = [];
  
  // 创建之前结果的映射，便于查找
  const previousMap = new Map();
  previousResults.forEach(addr => {
    previousMap.set(addr.address, addr);
  });
  
  // 比较当前结果与之前结果
  currentResults.forEach(currentAddr => {
    const previousAddr = previousMap.get(currentAddr.address);
    
    if (previousAddr) {
      // 检查余额是否有变化或使用状态是否改变
      const balanceChanged = currentAddr.balance !== previousAddr.balance;
      const statusChanged = currentAddr.used !== previousAddr.used;
      
      // 增强检测：检查交易数量变化（包含未确认交易）
      const txCountChanged = (currentAddr.n_tx || 0) !== (previousAddr.n_tx || 0);
      
      if (balanceChanged || statusChanged || txCountChanged) {
        const changeType = balanceChanged ? 
          (currentAddr.balance > previousAddr.balance ? '接收' : '发送') : 
          (txCountChanged ? '未确认交易' : '状态变更');
          
        newTransactions.push({
          address: currentAddr.address,
          path: currentAddr.path,
          previousBalance: previousAddr.balance,
          currentBalance: currentAddr.balance,
          balanceChange: currentAddr.balance - previousAddr.balance,
          previousUsed: previousAddr.used,
          currentUsed: currentAddr.used,
          previousTxCount: previousAddr.n_tx || 0,
          currentTxCount: currentAddr.n_tx || 0,
          changeType: changeType
        });
      }
    } else if (currentAddr.used || currentAddr.balance > 0) {
      // 新地址且有交易
      newTransactions.push({
        address: currentAddr.address,
        path: currentAddr.path,
        previousBalance: 0,
        currentBalance: currentAddr.balance,
        balanceChange: currentAddr.balance,
        previousUsed: false,
        currentUsed: currentAddr.used,
        previousTxCount: 0,
        currentTxCount: currentAddr.n_tx || 0,
        changeType: '新地址交易'
      });
    }
  });
  
  return newTransactions;
}

// 显示新交易提醒
function showNewTransactionAlert(newTransactions) {
  const alertDiv = document.getElementById('newTransactionAlert');
  const detailsSpan = document.getElementById('newTxDetails');
  
  if (!alertDiv || !detailsSpan) return;
  
  let alertText = '';
  newTransactions.forEach(tx => {
    const balanceChangeText = tx.balanceChange > 0 ? 
      `+${(tx.balanceChange / 1e8).toFixed(8)} BTC` : 
      tx.balanceChange < 0 ? `${(tx.balanceChange / 1e8).toFixed(8)} BTC` :
      '0 BTC';
    
    // 显示交易类型和详细信息
    const txCountInfo = tx.currentTxCount > tx.previousTxCount ? 
      ` (交易数: ${tx.previousTxCount}→${tx.currentTxCount})` : '';
    
    alertText += `${tx.changeType} - 地址 ${tx.address.substring(0, 8)}...${tx.address.slice(-8)} 余额变化: ${balanceChangeText}${txCountInfo}; `;
  });
  
  detailsSpan.textContent = alertText;
  alertDiv.style.display = 'block';
  
  // 10秒后自动隐藏
  setTimeout(() => {
    if (alertDiv) {
      alertDiv.style.display = 'none';
    }
  }, 10000);
}

// 隐藏新交易提醒
function hideNewTransactionAlert() {
  const alertDiv = document.getElementById('newTransactionAlert');
  if (alertDiv) {
    alertDiv.style.display = 'none';
  }
}

// 开始倒计时显示
function startCountdown() {
  nextDetectTimeStamp = Date.now() + 30000;
  
  countdownInterval = setInterval(() => {
    const remaining = Math.max(0, nextDetectTimeStamp - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    
    const nextDetectTimeEl = document.getElementById('nextDetectTime');
    if (nextDetectTimeEl) {
      if (remaining <= 0) {
        nextDetectTimeEl.textContent = '检测中...';
      } else {
        nextDetectTimeEl.textContent = `${seconds}秒`;
      }
    }
  }, 1000);
}

// 添加检测日志
function addToDetectionLog(message) {
  const logDiv = document.getElementById('detectionLog');
  if (!logDiv) return;
  
  const time = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.textContent = `[${time}] ${message}`;
  logDiv.appendChild(logEntry);
  
  // 保持最多10条日志
  while (logDiv.children.length > 10) {
    logDiv.removeChild(logDiv.firstChild);
  }
  
  // 滚动到最新日志
  logDiv.scrollTop = logDiv.scrollHeight;
}

// 页面卸载时清理定时器
window.addEventListener('beforeunload', () => {
  if (autoDetectInterval) {
    clearInterval(autoDetectInterval);
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

// 导出状态查询函数，供外部使用
window.getAutoDetectStatus = function() {
  return {
    isAutoDetecting,
    nextDetectTimeStamp
  };
};

// ----------------------------------------
// 检测未确认收入 (mempool)
// 找到最后一个已使用 payment 与 change 地址及其后两个地址，共 6 个，
// 查询 mempool 中流入这些地址的 satoshi 总额，并与上次结果比较。
// ----------------------------------------
window.checkMempoolIncoming = async function () {
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  const setStatus = (msg) => { statusEl ? statusEl.textContent = msg : console.log('STATUS:', msg); };
  const setError = (msg) => { errorEl ? errorEl.textContent = msg : console.error('ERROR:', msg); };
  if (statusEl) statusEl.textContent = '';
  if (errorEl) errorEl.textContent = '';

  try {
    // 读取状态与地址列表
    const statuses = JSON.parse(localStorage.getItem('addressStatuses') || '[]');
    const paymentList = JSON.parse(localStorage.getItem('paymentAddresses') || '[]');
    const changeList = JSON.parse(localStorage.getItem('changeAddresses') || '[]');

    if (!statuses.length || (!paymentList.length && !changeList.length)) {
      throw new Error('请先生成地址并检查地址状态');
    }

    // 帮助函数：解析路径中的索引数字 m/0/i 或 m/1/i
    const getIndex = (path) => {
      const parts = path.split('/');
      return parseInt(parts[parts.length - 1], 10);
    };

    // 找到最后一个已使用的 payment 与 change 地址索引
    const lastUsedIdx = (branchPrefix) => {
      const used = statuses
        .filter((s) => s.used && s.path.startsWith(branchPrefix))
        .map((s) => getIndex(s.path));
      if (!used.length) return -1;
      return Math.max(...used);
    };

    const lastPayIdx = lastUsedIdx('m/0/');
    const lastChangeIdx = lastUsedIdx('m/1/');

    if (lastPayIdx === -1 && lastChangeIdx === -1) {
      throw new Error('尚未检测到任何已使用地址');
    }

    // 选取目标地址：各分支最后已用 + 后两个 (若存在)
    function collectTargets(list, lastIdx) {
      const targets = [];
      if (lastIdx >= 0 && list[lastIdx]) targets.push(list[lastIdx]);
      for (let offset = 1; offset <= 2; offset++) {
        const idx = lastIdx + offset;
        if (idx >= 0 && list[idx]) targets.push(list[idx]);
      }
      return targets;
    }

    const targets = [
      ...collectTargets(paymentList, lastPayIdx),
      ...collectTargets(changeList, lastChangeIdx)
    ];

    // 加入所有当前余额大于0的地址
    const balanceAddrs = statuses.filter((s) => (s.balance || 0) > 0).map((s) => s.address);

    const addressSet = Array.from(
      new Set([
        ...targets.map((t) => t.address),
        ...balanceAddrs
      ])
    );

    if (!addressSet.length) {
      throw new Error('无法确定查询地址');
    }

    // 查询单地址 mempool
    async function fetchIncoming(addr) {
      const url = `https://blockstream.info/api/address/${addr}/txs/mempool`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('mempool API 错误: ' + res.status);
      const txs = await res.json();
      let net = 0;
      const txMap = new Map();
      txs.forEach((tx) => {
        let delta = 0;
        // 流入：当前交易输出到本地址
        (tx.vout || []).forEach((o) => {
          if (o.scriptpubkey_address === addr) {
            net += o.value; // satoshi
            delta += o.value;
          }
        });
        // 流出：本地址的旧输出被花费
        (tx.vin || []).forEach((i) => {
          const prev = i.prevout;
          if (prev && prev.scriptpubkey_address === addr) {
            net -= prev.value;
            delta -= prev.value;
          }
        });
        if (delta !== 0) {
          const current = txMap.get(tx.txid) || 0;
          txMap.set(tx.txid, current + delta);
        }
      });
      return { net, txMap };
    }

    // 并发查询
    const incomingValues = await Promise.all(addressSet.map(fetchIncoming));
    const totalSat = incomingValues.reduce((a, b) => a + b.net, 0);
    const combinedTx = new Map();
    incomingValues.forEach((r) => {
      r.txMap.forEach((delta, txid) => {
        const current = combinedTx.get(txid) || 0;
        combinedTx.set(txid, current + delta);
      });
    });
    const nowTs = Math.floor(Date.now() / 1000);
    const mempoolTxDeltas = Array.from(combinedTx.entries()).map(([txid, d]) => ({
      txid,
      d,
      ts: nowTs,
      mempool: true
    }));

    const btc = (v) => (v / 1e8).toFixed(8);
    // 保存汇总值到 localStorage（不保存地址列表）
    localStorage.setItem('mempoolIncomingTotal', JSON.stringify({ totalSat, time: Date.now() }));
    localStorage.setItem('mempoolTxDeltas', JSON.stringify(mempoolTxDeltas));

    setStatus(`未确认收入: ${btc(totalSat)} BTC`);
    if (typeof window.refreshSummary === 'function') window.refreshSummary();
  } catch (err) {
    setError('检测未确认收入失败: ' + err.message);
  }
};

// ----------------------------------------
// 查询人民币价格
// 通过 API 获取比特币对人民币汇率，计算总资产人民币价值并写入 localStorage
// ----------------------------------------
window.queryRMBPrice = async function () {
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  const setStatus = (msg) => { statusEl ? statusEl.textContent = msg : console.log('STATUS:', msg); };
  const setError = (msg) => { errorEl ? errorEl.textContent = msg : console.error('ERROR:', msg); };
  if (statusEl) statusEl.textContent = '';
  if (errorEl) errorEl.textContent = '';

  try {
    // 读取当前比特币总余额
    const totalBalance = JSON.parse(localStorage.getItem('totalBalance') || 'null');
    if (!totalBalance || !totalBalance.btc) {
      throw new Error('请先计算总余额');
    }

    const btcAmount = totalBalance.btc;

    // 查询比特币对人民币汇率 - 使用 CoinGecko API
    setStatus('正在查询比特币价格...');
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=cny');
    
    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const btcPriceCNY = data.bitcoin?.cny;

    if (!btcPriceCNY) {
      throw new Error('无法获取比特币价格数据');
    }

    // 计算总人民币价值
    const totalRMB = btcAmount * btcPriceCNY;

    // 保存到 localStorage
    const priceData = {
      btcPriceCNY,
      btcAmount,
      totalRMB,
      timestamp: Date.now(),
      updateTime: new Date().toLocaleString('zh-CN')
    };

    localStorage.setItem('rmbPrice', JSON.stringify(priceData));

    // 更新页面显示
    if (typeof window.refreshSummary === 'function') window.refreshSummary();

    setStatus(`₿ 1 = ¥${btcPriceCNY.toLocaleString('zh-CN')} | 总价值: ¥${totalRMB.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  } catch (err) {
    setError('查询人民币价格失败: ' + err.message);
  }
}; 
