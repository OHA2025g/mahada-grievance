/** Preserve task context when platform sign-in redirects back to a page. */
export function routeReturn(path:string, values:Record<string,string|string[]|undefined>) {
  const query=new URLSearchParams();
  const permitted=['screen','workspace','case','batch','dialog','view','q','filter','board','category','status','page'];
  for(const key of permitted){const value=values[key];if(typeof value==='string')query.set(key,value);else if(Array.isArray(value)&&value.length)query.set(key,value[0]);}
  return path+(query.size?'?'+query:'');
}
