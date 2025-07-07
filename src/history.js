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
  const status=document.getElementById('status');
  const errEl=document.getElementById('error');
  status.textContent=''; errEl.textContent='';
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
    status.textContent=`已保存净额记录 ${deltas.length} 项 (txDeltas)`;
  }catch(e){console.error(e);errEl.textContent='失败: '+e.message;}
};

window.buildBalanceTable=function(){
  const status=document.getElementById('status');
  const errEl=document.getElementById('error');
  status.textContent=''; errEl.textContent='';
  try{
    const deltas=JSON.parse(localStorage.txDeltas||'[]');
    if(!deltas.length) throw new Error('请先拉取交易并生成 txDeltas');
    let running=0; const dayMap={};
    deltas.forEach(d=>{running+=d.d; const date=new Date(d.ts*1000).toISOString().slice(0,10); dayMap[date]=running;});
    const daily=Object.keys(dayMap).sort().map(date=>({date,balance:dayMap[date]}));
    localStorage.setItem('balanceTimeline',JSON.stringify(daily));
    status.textContent='余额表已生成，共 '+daily.length+' 天 (balanceTimeline)';
  }catch(e){console.error(e);errEl.textContent='生成失败: '+e.message;}
};

// 绘制余额折线图
const Chart = require('chart.js/auto');
let chartInstance;
window.drawBalanceChart=function(){
  const status=document.getElementById('status');
  const errEl=document.getElementById('error');
  status.textContent=''; errEl.textContent='';
  try{
    const data=JSON.parse(localStorage.balanceTimeline||'[]');
    if(!data.length) throw new Error('请先生成余额表');
    const labels=data.map(d=>d.date);
    const balances=data.map(d=>d.balance/1e8); // BTC
    const ctx=document.getElementById('balanceChart').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    chartInstance=new Chart(ctx,{
      type:'line',
      data:{labels,datasets:[{
        label:'BTC 余额',
        data:balances,
        borderColor:'blue',
        tension:0.4,
        pointRadius:0,
        pointHoverRadius:4
      }]},
      options:{
        scales:{
          y:{beginAtZero:true},
          x:{
            ticks:{
              callback:function(value,index){
                // 约每90天显示一个标签
                const total=this.getLabelForValue(value);
                return index%90===0? total:'';
              },
              autoSkip:false
            }
          }
        },
        elements:{point:{radius:0}}
      }
    });
    status.textContent='已绘制余额曲线';
  }catch(e){console.error(e);errEl.textContent='绘图失败: '+e.message;}
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