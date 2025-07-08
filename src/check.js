/* eslint-disable no-undef */
// 查询地址是否使用过以及余额，并存入 localStorage
// 策略：顺序遍历 localStorage 中保存的 paymentAddresses -> changeAddresses
//      若连续 5 个地址未使用(n_tx 为 0)，则视为后续地址均未使用，停止请求

const API_BASE = 'https://blockchain.info';
const BATCH = 100; // blockchain.info balance endpoint 支持一次最多 100 个地址
const STOP_GAP = 5; // 连续未使用阈值
const rawQr = require('qr');
const encodeQR = typeof rawQr === 'function' ? rawQr : rawQr.default;

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
  const setStatus = (msg)=>{ statusEl ? statusEl.textContent = msg : console.log('STATUS:',msg); };
  const setError = (msg)=>{ errorEl ? errorEl.textContent = msg : console.error('ERROR:',msg); };
  if(statusEl) statusEl.textContent='';
  if(errorEl) errorEl.textContent='';

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
    setStatus(`已查询 ${result.length} 个地址，结果已保存到 localStorage(addressStatuses)`);
  } catch (err) {
    console.error('检查地址失败', err);
    setError('检查地址失败: ' + err.message);
  }
};

window.computeTotalBalance = function () {
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  const setStatus = (msg)=>{ statusEl ? statusEl.textContent = msg : console.log('STATUS:',msg); };
  const setError = (msg)=>{ errorEl ? errorEl.textContent = msg : console.error('ERROR:',msg); };
  if(statusEl) statusEl.textContent='';
  if(errorEl) errorEl.textContent='';

  try {
    const statuses = JSON.parse(localStorage.getItem('addressStatuses') || '[]');
    if (statuses.length === 0) throw new Error('请先执行地址检查，再计算余额');
    const totalSatoshi = statuses.reduce((sum, o) => sum + (o.balance || 0), 0);
    const totalBTC = totalSatoshi / 1e8;
    // 写入 localStorage
    localStorage.setItem('totalBalance', JSON.stringify({ satoshi: totalSatoshi, btc: totalBTC }));
    if (typeof window.refreshSummary === 'function') window.refreshSummary();
    setStatus(`总余额: ${totalBTC} BTC (${totalSatoshi} satoshi)`);
  } catch (err) {
    console.error('计算余额失败', err);
    setError('计算余额失败: ' + err.message);
  }
};

window.getReceiveAddress = function () {
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  const setStatus = (msg)=>{ statusEl ? statusEl.textContent = msg : console.log('STATUS:',msg); };
  const setError = (msg)=>{ errorEl ? errorEl.textContent = msg : console.error('ERROR:',msg); };
  if(statusEl) statusEl.textContent='';
  if(errorEl) errorEl.textContent='';
  
  try {
    const statuses = JSON.parse(localStorage.getItem('addressStatuses') || '[]');
    const payments = JSON.parse(localStorage.getItem('paymentAddresses') || '[]');
    
    if (payments.length === 0) {
      throw new Error('请先生成地址列表');
    }
    
    if (statuses.length === 0) {
      throw new Error('请先检查地址状态');
    }
    
    // 查找第一个未使用的 payment 地址
    let firstUnusedAddress = null;
    
    for (const payment of payments) {
      const status = statuses.find(s => s.address === payment.address);
      if (status && !status.used) {
        firstUnusedAddress = payment;
        break;
      }
    }
    
    if (!firstUnusedAddress) {
      // 如果所有已检查的地址都被使用了，返回第一个payment地址
      firstUnusedAddress = payments[0];
      setStatus(`接收地址: ${firstUnusedAddress.address} (路径: ${firstUnusedAddress.path}) - 警告：所有已检查地址都已使用`);
    } else {
      setStatus(`接收地址: ${firstUnusedAddress.address} (路径: ${firstUnusedAddress.path})`);
    }
    
    // 弹出二维码弹窗
    showQrModal(firstUnusedAddress.address);
    
    // 将接收地址复制到剪贴板（如果浏览器支持）
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(firstUnusedAddress.address).then(() => {
        if(statusEl) {
          statusEl.textContent += ' - 已复制到剪贴板';
        } else {
          console.log('STATUS: 接收地址已复制到剪贴板');
        }
      }).catch(() => {
        // 复制失败，静默处理
      });
    }
    
    return firstUnusedAddress;
    
  } catch (err) {
    console.error('获取接收地址失败', err);
    setError('获取接收地址失败: ' + err.message);
    return null;
  }
};

// 添加弹窗显示二维码和地址的函数
function showQrModal(address) {
  // 若已有弹窗则先删除
  const existing = document.getElementById('qrOverlay');
  if (existing) existing.remove();

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.id = 'qrOverlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(20, 20, 20, 0.8) 100%);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 12000;
    animation: fadeIn 0.3s ease-out;
  `;

  // 添加CSS动画到页面
  if (!document.getElementById('qrModalStyles')) {
    const style = document.createElement('style');
    style.id = 'qrModalStyles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(30px) scale(0.95);
        }
        to { 
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
    `;
    document.head.appendChild(style);
  }

  // 点击空白处关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => overlay.remove(), 200);
    }
  });

  // 容器
  const box = document.createElement('div');
  box.style.cssText = `
    background: #000;
    border: 1px solid #333;
    border-radius: 20px;
    padding: 32px 28px;
    width: calc(100vw - 48px);
    max-width: 380px;
    text-align: center;
    box-shadow: 
      0 20px 40px rgba(0, 0, 0, 0.5),
      0 0 20px rgba(247, 147, 26, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    overflow: hidden;
    animation: slideUp 0.4s ease-out;
  `;

  // 添加关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
    border-radius: 50%;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 1;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.style.color = '#fff';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.style.color = '#ccc';
  });
  closeBtn.addEventListener('click', () => {
    overlay.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => overlay.remove(), 200);
  });
  box.appendChild(closeBtn);

  // QR码容器
  const qrContainer = document.createElement('div');
  qrContainer.style.cssText = `
    background: #fff;
    border-radius: 16px;
    padding: 20px;
    margin: 20px 0;
    box-shadow: 
      0 8px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  `;

  // 生成 QR（SVG 元素）
  let svg = encodeQR(address, 'svg');
  // encodeQR 可能返回字符串或元素，做兼容处理
  if (typeof svg === 'string') {
    const wrap = document.createElement('div');
    wrap.innerHTML = svg;
    svg = wrap.firstChild;
  }
  svg.style.cssText = `
    width: 200px;
    height: 200px;
    display: block;
    margin: 0 auto;
  `;
  qrContainer.appendChild(svg);
  box.appendChild(qrContainer);

  // 地址文字，可点击复制
  const addrEl = document.createElement('div');
  addrEl.style.cssText = `
    background: rgba(247, 147, 26, 0.15);
    border: 1px solid rgba(247, 147, 26, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  `;
  
  const addrText = document.createElement('p');
  addrText.textContent = address;
  addrText.style.cssText = `
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
    color: #f7931a;
    font-family: 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
  `;
  
  const copyHint = document.createElement('p');
  copyHint.textContent = '点击复制';
  copyHint.style.cssText = `
    margin: 8px 0 0 0;
    font-size: 11px;
    color: #ccc;
    font-weight: 500;
    text-align: center;
  `;
  
  addrEl.appendChild(addrText);
  addrEl.appendChild(copyHint);
  box.appendChild(addrEl);

  // 地址悬停效果
  addrEl.addEventListener('mouseenter', () => {
    addrEl.style.background = 'rgba(247, 147, 26, 0.25)';
    addrEl.style.transform = 'scale(1.02)';
    copyHint.textContent = '点击复制地址';
    copyHint.style.color = '#f7931a';
  });
  
  addrEl.addEventListener('mouseleave', () => {
    addrEl.style.background = 'rgba(247, 147, 26, 0.15)';
    addrEl.style.transform = 'scale(1)';
    copyHint.textContent = '点击复制';
    copyHint.style.color = '#ccc';
  });

  // 改进的复制函数，兼容iOS Safari
  const copyToClipboard = async (text) => {
    // 检测是否是iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    try {
      // 优先尝试现代API
      if (navigator.clipboard && window.isSecureContext && !isIOS) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // iOS Safari fallback: 创建临时输入框
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 2em;
        height: 2em;
        padding: 0;
        border: none;
        outline: none;
        boxShadow: none;
        background: transparent;
        opacity: 0;
        z-index: -1;
      `;
      
      document.body.appendChild(textArea);
      
      // iOS需要特殊处理
      if (isIOS) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textArea.setSelectionRange(0, 999999);
      } else {
        textArea.focus();
        textArea.select();
      }
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        return true;
      }
      
      // 最后的fallback - 提示用户手动选择
      throw new Error('复制失败');
      
    } catch (error) {
      // 对于iOS Safari，显示一个可选择的文本框
      if (isIOS && isSafari) {
        showSelectableText(text);
        return false; // 返回false表示需要用户手动操作
      }
      throw error;
    }
  };

  // 显示可选择的文本（iOS Safari专用）
  const showSelectableText = (text) => {
    // 创建一个模态框显示可选择的文本
    const selectModal = document.createElement('div');
    selectModal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 15000;
    `;
    
    const selectBox = document.createElement('div');
    selectBox.style.cssText = `
      background: #000;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      max-width: 90%;
      text-align: center;
    `;
    
    const hint = document.createElement('p');
    hint.textContent = '长按下方地址进行复制';
    hint.style.cssText = `
      color: #ccc;
      margin: 0 0 12px 0;
      font-size: 14px;
    `;
    
    const selectableText = document.createElement('textarea');
    selectableText.value = text;
    selectableText.style.cssText = `
      width: 100%;
      background: rgba(247, 147, 26, 0.15);
      border: 1px solid rgba(247, 147, 26, 0.3);
      border-radius: 8px;
      padding: 12px;
      color: #f7931a;
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
      font-size: 13px;
      resize: none;
      outline: none;
    `;
    selectableText.readOnly = true;
    selectableText.rows = 3;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = `
      margin-top: 12px;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 6px;
      color: #ccc;
      cursor: pointer;
    `;
    
    closeBtn.onclick = () => selectModal.remove();
    selectModal.onclick = (e) => { if (e.target === selectModal) selectModal.remove(); };
    
    selectBox.appendChild(hint);
    selectBox.appendChild(selectableText);
    selectBox.appendChild(closeBtn);
    selectModal.appendChild(selectBox);
    document.body.appendChild(selectModal);
    
    // 自动选择文本
    setTimeout(() => {
      selectableText.focus();
      selectableText.setSelectionRange(0, text.length);
    }, 100);
  };

  // 地址点击复制
  addrEl.addEventListener('click', async () => {
    try {
      const success = await copyToClipboard(address);
      
      if (success) {
        // 复制成功
        addrText.textContent = '✓ 已复制到剪贴板';
        addrText.style.color = '#32cd32';
        copyHint.textContent = '复制成功！';
        copyHint.style.color = '#32cd32';
        addrEl.style.background = 'rgba(50, 205, 50, 0.1)';
        addrEl.style.borderColor = 'rgba(50, 205, 50, 0.3)';
        
        setTimeout(() => {
          addrText.textContent = address;
          addrText.style.color = '#f7931a';
          copyHint.textContent = '点击复制';
          copyHint.style.color = '#ccc';
          addrEl.style.background = 'rgba(247, 147, 26, 0.15)';
          addrEl.style.borderColor = 'rgba(247, 147, 26, 0.3)';
        }, 2000);
      }
      // 如果success为false，说明已经显示了选择框，不需要额外处理
      
    } catch (error) {
      // 复制失败
      copyHint.textContent = '复制失败，请手动复制';
      copyHint.style.color = '#ff6b6b';
      setTimeout(() => {
        copyHint.textContent = '点击复制';
        copyHint.style.color = '#ccc';
      }, 2000);
    }
  });

  overlay.appendChild(box);
  document.body.appendChild(overlay);
} 