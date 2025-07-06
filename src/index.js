const bitcoin = require('bitcoinjs-lib');
const { HDKey } = require('@scure/bip32');

// zpub/zprv version bytes
const ZPUB_VERSIONS = { public: 0x04b24746, private: 0x04b2430c };

// 页面加载后绑定事件
document.addEventListener('DOMContentLoaded', () => {
  console.log('HDKey 初始化完成');

  window.convertZpub = () => {
    const zpubInput = document.getElementById('zpubInput').value.trim();
    const addressEl = document.getElementById('address');
    const errorEl = document.getElementById('error');

    // 清空旧结果
    addressEl.textContent = '';
    errorEl.textContent = '';

    if (!zpubInput) {
      errorEl.textContent = '请输入 zpub';
      return;
    }
    if (!zpubInput.startsWith('zpub')) {
      errorEl.textContent = '扩展公钥应以 zpub 开头';
      return;
    }

    try {
      // 解析 zpub（提供正确版本字节）
      const hd = HDKey.fromExtendedKey(zpubInput, ZPUB_VERSIONS);
      // 派生 m/0/0
      const child = hd.derive('m/0/0');
      // 生成原生 segwit 地址
      const { address } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(child.publicKey) });
      addressEl.textContent = address;
    } catch (err) {
      console.error('转换失败', err);
      errorEl.textContent = '转换失败: ' + err.message;
    }
  };

  window.generateAddresses = () => {
    const zpubInput = document.getElementById('zpubInput').value.trim();
    const statusEl = document.getElementById('status');
    const errorEl = document.getElementById('error');
    
    statusEl.textContent = '';
    errorEl.textContent = '';

    if (!zpubInput) {
      errorEl.textContent = '请输入 zpub';
      return;
    }
    if (!zpubInput.startsWith('zpub')) {
      errorEl.textContent = '扩展公钥应以 zpub 开头';
      return;
    }

    try {
      const hd = HDKey.fromExtendedKey(zpubInput, ZPUB_VERSIONS);
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
      statusEl.textContent = `已生成并保存 ${paymentAddrs.length + changeAddrs.length} 个地址到 localStorage`;
    } catch (err) {
      console.error('生成地址失败', err);
      errorEl.textContent = '生成地址失败: ' + err.message;
    }
  };
}); 