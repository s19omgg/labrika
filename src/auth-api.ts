async function jsonResponse<T>(response:Response,fallback:string):Promise<T>{
 const result=await response.json().catch(()=>({})) as {error?:string};
 if(!response.ok)throw new Error(result.error||fallback);
 return result as T;
}

export async function authRequest<T>(path:string,body:unknown):Promise<T>{
 const response=await fetch(`/api/auth/email/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return jsonResponse<T>(response,'Не удалось подтвердить почту');
}

export async function authApi<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);
 if(init.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 const response=await fetch(path,{credentials:'same-origin',...init,headers});
 return jsonResponse<T>(response,'Не удалось выполнить запрос');
}
