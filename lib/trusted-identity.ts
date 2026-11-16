// Sites dispatch strips visitor-supplied identity headers. An observed legacy
// private-owner request carries verified email but no Site user ID. The fallback
// is restricted to the configured owner; other accounts require the stable ID.
export async function trustedIdentity(headers:{get:(name:string)=>string|null},ownerEmail?:string){
 const email=headers.get('oai-authenticated-user-email')?.toLowerCase().trim(),id=headers.get('oai-authenticated-user-id');
 if(!email)return null;if(id)return {id,email,ownerFallback:false};
 if(!ownerEmail||email!==ownerEmail.toLowerCase().trim())return null;
 const bytes=new TextEncoder().encode('appgprj_6acff35698d081919e6491b87791e026|'+email),digest=await crypto.subtle.digest('SHA-256',bytes);
 return {id:'private-owner:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),email,ownerFallback:true};
}
