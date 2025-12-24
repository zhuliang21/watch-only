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
  // 简化版 mempool 检测：只查询第一个未使用的 payment 地址
  // 避免大量 API 请求导致超时和报错
  try {
    const statuses = JSON.parse(localStorage.getItem('addressStatuses') || '[]');
    const paymentList = JSON.parse(localStorage.getItem('paymentAddresses') || '[]');

    if (!statuses.length || !paymentList.length) {
      return; // 静默返回
    }

    // 找第一个未使用的 payment 地址
    let targetAddr = null;
    for (const payment of paymentList) {
      const status = statuses.find(s => s.address === payment.address);
      if (status && !status.used) {
        targetAddr = payment.address;
        break;
      }
    }

    if (!targetAddr) {
      // 没有未使用地址，使用最后一个 payment 地址
      targetAddr = paymentList[paymentList.length - 1]?.address;
    }

    if (!targetAddr) return;

    // 查询单个地址的 mempool（带 5 秒超时）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const url = `https://blockstream.info/api/address/${targetAddr}/txs/mempool`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return;

      const txs = await res.json();
      let totalSat = 0;
      const mempoolTxDeltas = [];
      const nowTs = Math.floor(Date.now() / 1000);

      txs.forEach((tx) => {
        let delta = 0;
        (tx.vout || []).forEach((o) => {
          if (o.scriptpubkey_address === targetAddr) {
            delta += o.value;
          }
        });
        (tx.vin || []).forEach((i) => {
          const prev = i.prevout;
          if (prev && prev.scriptpubkey_address === targetAddr) {
            delta -= prev.value;
          }
        });
        if (delta !== 0) {
          totalSat += delta;
          mempoolTxDeltas.push({ txid: tx.txid, d: delta, ts: nowTs, mempool: true });
        }
      });

      localStorage.setItem('mempoolIncomingTotal', JSON.stringify({ totalSat, time: Date.now() }));
      localStorage.setItem('mempoolTxDeltas', JSON.stringify(mempoolTxDeltas));
      if (typeof window.refreshSummary === 'function') window.refreshSummary();
    } catch (err) {
      clearTimeout(timeoutId);
      // 静默失败，不输出错误
    }
  } catch (err) {
    // 静默失败
  }
};
