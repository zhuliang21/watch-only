const bitcoin = require('bitcoinjs-lib');
const { HDKey } = require('@scure/bip32');

// zpub/zprv version bytes
const ZPUB_VERSIONS = { public: 0x04b24746, private: 0x04b2430c };

// 页面加载后绑定事件
document.addEventListener('DOMContentLoaded', () => {
  console.log('HDKey 初始化完成');

  window.generateAddresses = () => {
    let zpubInputEl = document.getElementById('zpubInput');
    const zpubInput = zpubInputEl ? zpubInputEl.value.trim() : (localStorage.currentZpub || '').trim();
    const statusEl = document.getElementById('status');
    const errorEl = document.getElementById('error');
    const setStatus = (msg)=>{ statusEl ? statusEl.textContent = msg : console.log('STATUS:',msg); };
    const setError = (msg)=>{ errorEl ? errorEl.textContent = msg : console.error('ERROR:',msg); };
    if(statusEl) statusEl.textContent='';
    if(errorEl) errorEl.textContent='';

    if (!zpubInput) {
      setError('请输入 zpub');
      return;
    }
    if (!zpubInput.startsWith('zpub')) {
      setError('扩展公钥应以 zpub 开头');
      return;
    }

    try {
      const hd = HDKey.fromExtendedKey(zpubInput, ZPUB_VERSIONS);
      // 保存 zpub
      localStorage.setItem('currentZpub', zpubInput);
      const paymentAddrs = [];
      const changeAddrs = [];

      // 生成外部(支付)地址 m/0/i  0-99
      for (let i = 0; i < 100; i++) {
        const child = hd.derive(`m/0/${i}`);
        const { address } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(child.publicKey) });
        paymentAddrs.push({ path: `m/0/${i}`, address });
      }
      // 生成内部(找零)地址 m/1/i 0-49
      for (let i = 0; i < 50; i++) {
        const child = hd.derive(`m/1/${i}`);
        const { address } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(child.publicKey) });
        changeAddrs.push({ path: `m/1/${i}`, address });
      }

      // 保存到 localStorage
      localStorage.setItem('paymentAddresses', JSON.stringify(paymentAddrs));
      localStorage.setItem('changeAddresses', JSON.stringify(changeAddrs));

      // 提示成功
      setStatus(`已生成并保存 ${paymentAddrs.length + changeAddrs.length} 个地址到 localStorage`);
    } catch (err) {
      console.error('生成地址失败', err);
      setError('生成地址失败: ' + err.message);
    }
  };
}); 