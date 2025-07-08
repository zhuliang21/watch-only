/* eslint-disable no-undef */
// --- 使用 multiaddr 批量接口并分页，避免遗漏早期交易 ---
const API_BASE = 'https://blockchain.info';
const ADDR_BATCH = 100;
const TX_PAGE = 100; // multiaddr n param
const RATE_DELAY = 600; // 0.6s
const MAX_RETRY = 3;

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function fetchMulti(activeAddrs, offset=0,retry=0){
  const url=`${API_BASE}/multiaddr?active=${activeAddrs.join('|')}&n=${TX_PAGE}&offset=${offset}&cors=true`;
  const res=await fetch(url);
  if(res.status===429){
    if(retry>=MAX_RETRY) throw new Error('429 Too Many Requests');
    await sleep(RATE_DELAY*(retry+1));
    return fetchMulti(activeAddrs,offset,retry+1);
  }
  if(!res.ok) throw new Error('multiaddr 错误 '+res.status);
  return res.json();
}

window.fetchTxHistory = async function(){
  const status = document.getElementById('status');
  const errEl = document.getElementById('error');
  const setStatus = (msg)=>{ status ? status.textContent = msg : console.log('STATUS:', msg); };
  const setError = (msg)=>{ errEl ? errEl.textContent = msg : console.error('ERROR:', msg); };
  if(status) status.textContent='';
  if(errEl) errEl.textContent='';
  try{
    const addrStatuses=JSON.parse(localStorage.addressStatuses||'[]');
    const used=addrStatuses.filter(o=>o.used).map(o=>o.address);
    if(!used.length) throw new Error('没有已使用地址');
    const addrSet=new Set(used);

    const deltaMap={};// 去重按 tx.hash

    for(let i=0;i<used.length;i+=ADDR_BATCH){
      const slice=used.slice(i,i+ADDR_BATCH);
      let offset=0,more=true;
      while(more){
        const data=await fetchMulti(slice,offset);
        if(data.txs){
          data.txs.forEach(tx=>{
            if(deltaMap[tx.hash]!==undefined) return; // 已处理
            let delta=0;
            tx.out&&tx.out.forEach(o=>{if(addrSet.has(o.addr)) delta+=o.value;});
            tx.inputs&&tx.inputs.forEach(i=>{if(addrSet.has(i.prev_out?.addr)) delta-=i.prev_out.value;});
            if(delta!==0) deltaMap[tx.hash]={ts:tx.time,d:delta};
          });
        }
        more=data.txs && data.txs.length===TX_PAGE;
        offset+=TX_PAGE;
        if(more) await sleep(RATE_DELAY);
      }
      await sleep(RATE_DELAY);
    }

    const deltas=Object.values(deltaMap).sort((a,b)=>a.ts-b.ts);
    localStorage.setItem('txDeltas',JSON.stringify(deltas));
    // 清理旧大文件
    localStorage.removeItem('addressTxs');
    setStatus(`已保存净额记录 ${deltas.length} 项 (txDeltas)`);
  }catch(e){console.error(e);setError('失败: '+e.message);}
};

window.buildBalanceTable=function(){
  const status = document.getElementById('status');
  const errEl = document.getElementById('error');
  const setStatus = (msg)=>{ status ? status.textContent = msg : console.log('STATUS:', msg); };
  const setError = (msg)=>{ errEl ? errEl.textContent = msg : console.error('ERROR:', msg); };
  if(status) status.textContent='';
  if(errEl) errEl.textContent='';
  try{
    const deltas=JSON.parse(localStorage.txDeltas||'[]');
    if(!deltas.length) throw new Error('请先拉取交易并生成 txDeltas');
    let running=0; const dayMap={};
    deltas.forEach(d=>{running+=d.d; const date=new Date(d.ts*1000).toISOString().slice(0,10); dayMap[date]=running;});
    const daily=Object.keys(dayMap).sort().map(date=>({date,balance:dayMap[date]}));
    localStorage.setItem('balanceTimeline',JSON.stringify(daily));
    setStatus('余额表已生成，共 '+daily.length+' 天 (balanceTimeline)');
  }catch(e){console.error(e);setError('生成失败: '+e.message);}
};

// 绘制余额折线图 - Robinhood 风格
const Chart = require('chart.js/auto');
Chart.defaults.font.family = 'SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
let chartInstance;
window.drawBalanceChart=function(){
  const status = document.getElementById('status');
  const errEl = document.getElementById('error');
  const setStatus = (msg)=>{ status ? status.textContent = msg : console.log('STATUS:', msg); };
  const setError = (msg)=>{ errEl ? errEl.textContent = msg : console.error('ERROR:', msg); };
  if(status) status.textContent='';
  if(errEl) errEl.textContent='';
  try{
    const data=JSON.parse(localStorage.balanceTimeline||'[]');
    if(!data.length) throw new Error('请先生成余额表');
    const labels=data.map(d=>d.date);
    const balances=data.map(d=>d.balance/1e8); // BTC
    const currentBalance = balances[balances.length - 1];
    
    // 更新右侧余额显示
    const balanceDisplay = document.getElementById('balanceDisplay');
    const formatBalance = (balance) => {
      if (balance >= 1) {
        return `₿${balance.toFixed(8)}`;
      } else {
        return `₿${balance.toFixed(8)}`;
      }
    };
    balanceDisplay.textContent = formatBalance(currentBalance);
    
    // 显示当前日期（与余额对应）
    let dateDisplay = document.getElementById('dateDisplay');
    if (!dateDisplay) {
      dateDisplay = document.createElement('div');
      dateDisplay.id = 'dateDisplay';
      dateDisplay.style.cssText = `
        position: absolute;
        top: 50px;
        left: 20px;
        color: #00d4aa;
        font-size: 20px;
        font-weight: bold;
        z-index: 10;
        font-family: 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
      `;
      document.getElementById('chartContainer').appendChild(dateDisplay);
    }
    dateDisplay.textContent = labels[labels.length - 1];
    
    const ctx=document.getElementById('balanceChart').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    
    // 当前悬停索引用于分段着色
    let hoverIndex = balances.length - 1;

    // 用两个数据集实现左右段不同颜色与阴影
    function makeGradient(color) {
      const g = ctx.createLinearGradient(0, 0, 0, 200);
      if(color==='green'){
        g.addColorStop(0,'rgba(0,212,170,0.5)');
        g.addColorStop(1,'rgba(0,212,170,0.05)');
      }else{
        g.addColorStop(0,'rgba(128,128,128,0.5)');
        g.addColorStop(1,'rgba(128,128,128,0.05)');
      }
      return g;
    }

    const buildDataSets = () => {
      const leftData = balances.map((v,i)=> i<=hoverIndex ? v : null);
      const rightData = balances.map((v,i)=> i>hoverIndex ? v : null);
      return [
        {
          data:leftData,
          borderColor:'#00d4aa',
          backgroundColor: makeGradient('green'),
          borderWidth:2,
          fill:true,
          tension:0.4,
          pointRadius:(ctx)=> ctx.dataIndex===hoverIndex?4:0,
          pointBackgroundColor:'#ffffff',
          pointBorderColor:'#ffffff',
          pointHoverRadius:4
        },
        {
          data:rightData,
          borderColor:'#666666',
          backgroundColor: makeGradient('grey'),
          borderWidth:2,
          fill:true,
          tension:0.4,
          pointRadius:0,
          pointHoverRadius:0
        }
      ];
    };

    chartInstance=new Chart(ctx,{
      type:'line',
      data:{labels,datasets: buildDataSets()},
      options:{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: { enabled: false }
        },
        scales:{
          y:{
            display: false,
            beginAtZero: false,
            grid: {
              display: false
            }
          },
          x:{
            display: false,
            grid: {
              display: false
            }
          }
        },
        elements:{point:{radius:0}},
        interaction: {
          intersect: false,
          mode: 'index'
        },
        onHover: (event, activeElements) => {
          if (activeElements.length > 0) {
            const dataIndex = activeElements[0].index;
            const hoverBalance = balances[dataIndex];
            
            hoverIndex = dataIndex;
            chartInstance.data.datasets = buildDataSets();
            chartInstance.update('none');
            
            balanceDisplay.textContent = formatBalance(hoverBalance);
            dateDisplay.textContent = labels[dataIndex];
          } else {
            hoverIndex = balances.length - 1;
            chartInstance.data.datasets = buildDataSets();
            chartInstance.update('none');
            
            balanceDisplay.textContent = formatBalance(currentBalance);
            dateDisplay.textContent = labels[labels.length - 1];
          }
        }
      }
    });
    setStatus('已绘制 Robinhood 风格余额曲线');
  }catch(e){console.error(e);setError('绘图失败: '+e.message);}
};

function getLocalStorageSize() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key   = localStorage.key(i);
    const value = localStorage.getItem(key);
    // key 与 value 都按 UTF-16 计算：每字符 2 字节
    total += (key.length + value.length) * 2;
  }
  return total; // 字节
}

const bytes = getLocalStorageSize();
console.log(`localStorage 已占用 ${(bytes/1024).toFixed(2)} KB`); 