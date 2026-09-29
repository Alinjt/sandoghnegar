// Vercel Function. Prices and ETF NAV come from TSETMC's public JSON endpoints.
// Keep this list in sync with fundInstruments in script.js for the direct-browser fallback.
export const FUNDS = [
  {key:'yaghoot',label:'یاقوت',category:'درآمد ثابت',insCode:'1438514795814416'},
  {key:'afran',label:'افران',category:'درآمد ثابت',insCode:'3846143218462419'},
  {key:'dara',label:'دارا یکم',category:'سهامی',insCode:'62235397452612911'},
  {key:'palayesh',label:'پالایش',category:'سهامی',insCode:'67675656072510693'},
  {key:'ahrom',label:'اهرم',category:'اهرمی',insCode:'17914401175772326'},
  {key:'firoozeh',label:'فیروزه',category:'سهامی',insCode:'66036975502302203'},
  {key:'ayar',label:'عیار',category:'طلا',insCode:'34144395039913458'},
  {key:'tala',label:'طلا',category:'طلا',insCode:'46700660505281786'}
];

const API = 'https://cdn.tsetmc.com/api/';
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

export function marketTimestamp(day,clock){
  const date=String(day||'');
  if(!/^20\d{6}$/.test(date))return null;
  const time=String(clock||0).padStart(6,'0');
  if(!/^\d{6}$/.test(time))return null;
  const year=date.slice(0,4),month=date.slice(4,6),dayOfMonth=date.slice(6,8);
  const hour=time.slice(0,2),minute=time.slice(2,4),second=time.slice(4,6);
  const timestamp=`${year}-${month}-${dayOfMonth}T${hour}:${minute}:${second}+03:30`;
  return Number.isNaN(Date.parse(timestamp))?null:timestamp;
}

async function getJSON(path){
  const response=await fetch(API+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error(`TSETMC returned ${response.status}`);
  return response.json();
}

async function mapWithConcurrency(values,limit,task){
  const results=new Array(values.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{
    while(next<values.length){const index=next++;results[index]=await task(values[index])}
  }));
  return results;
}

export function normalizeFund(fund,price,nav){
  const value=positive(price?.pDrCotVal);
  const previous=positive(price?.priceYesterday);
  const closing=positive(price?.pClosing);
  const asOf=value?marketTimestamp(price?.dEven,price?.hEven):null;
  const navRedemption=positive(nav?.pRedTran);
  const navSubscription=positive(nav?.pSubTran);
  return {
    ...fund,symbol:'ETF',unit:'ریال',value,closing,
    changePercent:value&&previous?Math.round((value/previous-1)*10000)/100:null,
    asOf,
    navRedemption,navSubscription,
    navAsOf:navRedemption||navSubscription?marketTimestamp(nav?.deven,nav?.hEven):null
  };
}

export async function GET(){
  const items=await mapWithConcurrency(FUNDS,4,async fund=>{
    const code=fund.insCode;
    const [priceResult,navResult]=await Promise.allSettled([
      getJSON(`ClosingPrice/GetClosingPriceInfo/${code}`),
      getJSON(`Fund/GetETFByInsCode/${code}`)
    ]);
    return normalizeFund(fund,
      priceResult.status==='fulfilled'?priceResult.value?.closingPriceInfo:null,
      navResult.status==='fulfilled'?navResult.value?.etf:null);
  });
  const available=items.filter(item=>item.value!==null);
  if(!available.length)return Response.json(
    {error:'داده صندوق‌ها در حال حاضر از منبع دریافت نشد.',source:'TSETMC'},
    {status:502,headers:{'Cache-Control':'no-store'}});
  const updatedAt=available.map(item=>item.asOf).filter(Boolean).sort().at(-1)||null;
  return Response.json({source:'TSETMC',priceType:'last_trade',unit:'ریال',updatedAt,receivedAt:new Date().toISOString(),items},
    {headers:{'Cache-Control':'public, max-age=0, s-maxage=60, stale-while-revalidate=30'}});
}
