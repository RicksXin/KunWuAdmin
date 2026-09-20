"use client";
import { useState } from "react";
export function ConfigLogin(){
  const [message,setMessage]=useState("连接管理身份"),[busy,setBusy]=useState(false);
  return <button className="secondary-button" disabled={busy} title={message} onClick={async()=>{setBusy(true);try{const r=await fetch("/api/admin/resources/local-login",{method:"POST"});const b=await r.json();setMessage(r.ok?"管理身份已连接":b.error?.message??"连接失败");}catch{setMessage("连接失败，请重试");}finally{setBusy(false);}}}>{message}</button>;
}
