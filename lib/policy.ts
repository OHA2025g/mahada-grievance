import type {Values} from './types';
export function calculateDue(receipt:string,policy:Values,calendar:Values,holidays:string[]){
 if(policy['Approved policy']!==true||calendar['Calendar approved']!==true)return null;
 const duration=Number(policy['Day duration']);if(!Number.isInteger(duration)||duration<1||duration>3660)throw new Error('Policy duration must be an integer from 1 to 3,660.');
 const current=new Date(receipt+'T12:00:00Z');if(!Number.isFinite(current.getTime()))throw new Error('Original receipt is invalid.');let counted=0;const include=policy['Day-count convention']==='Include receipt day';const working=policy['Day counting']==='Working days',week=String(calendar['Working days']);const skip=new Set(holidays);
 for(let attempts=0;attempts<10000;attempts++){
  if(attempts||!include)current.setUTCDate(current.getUTCDate()+1);
  const iso=current.toISOString().slice(0,10),weekday=current.getUTCDay();const permitted=!working||(!skip.has(iso)&&(week==='All calendar days'||(weekday!==0&&(week!=='Monday to Friday'||weekday!==6))));
  if(permitted)counted++;if(counted===duration)return iso;
 }throw new Error('The approved calendar cannot produce a deadline.');
}
