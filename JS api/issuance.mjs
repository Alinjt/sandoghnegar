// Fipiran's own fund list supplies the latest published issue/redemption NAVs.
// This list is intentionally curated; the source includes hundreds of funds.
export const SELECTED_FUNDS = [
  {key:'karafarin',regNo:'10581',label:'مشترک کارآفرین',category:'درآمد ثابت'},
  {key:'iranian',regNo:'10639',label:'یکم ایرانیان',category:'درآمد ثابت'},
  {key:'pooya',regNo:'10589',label:'مشترک پویا',category:'سهامی'},
  {key:'agah',regNo:'10616',label:'مشترک آگاه',category:'سهامی'},
  {key:'pars',regNo:'10767',label:'مشترک پارس',category:'مختلط'},
  {key:'tajrobeh',regNo:'10885',label:'تجربه ایرانیان',category:'مختلط'}
];

const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;

export function normalizeIssuance(selected,raw){
  const asOfDate=typeof raw?.date==='string'&&/^20\d{2}-\d{2}-\d{2}/.test(raw.date)
    ?raw.date.slice(0,10):null;
  return {...selected,source:'Fipiran',priceType:'nav_redemption',unit:'ریال',
    value:positive(raw?.cancelNav),navRedemption:positive(raw?.cancelNav),
    navSubscription:positive(raw?.issueNav),asOfDate};
}

export async function GET(){
  try{
    const response=await fetch('https://fipiran.com/services/fund/fundlistissue',{
      headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; SandoghNegar/1.0)','Referer':'https://fipiran.com/Fund/FundNav'},
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)throw new Error(`Fipiran returned ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data.items))throw new Error('Invalid Fipiran response');
    const byRegistration=new Map(data.items.map(item=>[String(item.regNo),item]));
    const items=SELECTED_FUNDS.map(fund=>normalizeIssuance(fund,byRegistration.get(fund.regNo)));
    if(!items.some(item=>item.value!==null))throw new Error('No published NAV');
    return Response.json({source:'Fipiran',priceType:'nav_redemption',unit:'ریال',
      asOfDate:items.map(item=>item.asOfDate).filter(Boolean).sort().at(-1)||null,
      receivedAt:new Date().toISOString(),items},
      {headers:{'Cache-Control':'public, max-age=0, s-maxage=3600, stale-while-revalidate=900'}});
  }catch{
    return Response.json({error:'NAV صندوق‌های صدور و ابطالی فعلاً در دسترس نیست.',source:'Fipiran'},
      {status:502,headers:{'Cache-Control':'no-store'}});
  }
}
