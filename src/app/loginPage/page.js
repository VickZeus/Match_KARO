"use client";
import {useRouter} from "next/navigation";
import { useState } from "react";
import {FaUserCircle,FaLock,FaEnvelope} from "react-icons/fa"
import { useEffect } from "react";


export function RegisterPage({setFlag,flag}){
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const router=useRouter();

  async function handleSubmit(e) {
    e.preventDefault(); // stop page reload

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password,email}),
    });

    const data = await res.json();
    setMessage(data.message);

    if (res.ok) {
      setMessage("Registered Successfully, Please Login")
      setFlag(true)
    }
    else{
      setMessage(err)
    }
  }




  return (
    <div className=" h-screen w-screen flex flex-col justify-center items-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 justify-center items-center">
        <div className="pix text-2xl mb-4">Register</div>
        
        <div className="flex gap-2 justify-center items-center">
          <FaUserCircle className="text-[28px]"/>
          <input className="text-[20px] rounded rounded-md pl-4" placeholder="Enter Username" value={username} onChange={(e) => setUsername(e.target.value)}/>
        </div>

        <div className="flex gap-2 justify-center items-center">
          <FaLock className="text-[28px]"/>
          <input type="password" placeholder="Enter Password" className="text-[20px] rounded rounded-md pl-4" value={password} onChange={(e) => setPassword(e.target.value)}/>
        </div>
        
        <div className="flex gap-2 justify-center items-center">
          <FaEnvelope className="text-[28px]"/>
          <input type="email" placeholder="Enter Email ID" value={email} onChange={(e) => setEmail(e.target.value)} className="text-[20px] rounded rounded-md pl-4"/>        
        </div>
        
        <button type="submit" className="pix text-xs bg-amber-50 text-black p-2 rounded rounded-lg mt-4">SUBMIT</button>
        <button className="text-blue-500" onClick={() => setFlag(!flag)} type="button">Login ?</button>      
      </form>
      <p>{message}</p>
    </div>
  );
}

export function LoginPage({setFlag,flag}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router=useRouter();

  async function handleSubmit(e) {
    e.preventDefault(); // stop page reload

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    setMessage(data.message);

    if (res.ok) {
      try{
          const r = await fetch("/api/auth/login");
          if(!r.ok) console.error("User cache failed:", r.status);
      }catch (err){
          console.error("Failed To Fetch User Data",err);
      }
      router.replace("/home");
      router.refresh();
    }
  }
return (
  <div className="h-screen w-screen flex flex-col justify-center items-center">
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 justify-center items-center">
      <div className="pix text-2xl mb-4">Login</div>

      <div className="flex gap-2 justify-center items-center">
        <FaUserCircle className="text-[28px]" />
        <input
          className="text-[20px] rounded-md pl-4"
          placeholder="Enter Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className="flex gap-2 justify-center items-center">
        <FaLock className="text-[28px]" />
        <input
          type="password"
          placeholder="Enter Password"
          className="text-[20px] rounded-md pl-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="submit" className="pix text-xs bg-amber-50 text-black p-2 rounded-lg mt-4">
        SUBMIT
      </button>
      <button  type="button" className="text-blue-600" onClick={() => setFlag(!flag)}>New User ?</button>      

    </form>
    <p>{message}</p>
  </div>
);
}


export default function Login_Register(){
  const [flag,setFlag]=useState(false)
  return(
    <div>
        {(flag)?<LoginPage setFlag={setFlag} flag={flag}/>:<RegisterPage setFlag={setFlag} flag={flag}/>}
    </div>
  )
}




