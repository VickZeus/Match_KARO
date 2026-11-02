import jwt from "jsonwebtoken"
import {cookies} from "next/headers"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server";


export async function POST(req){
    const{username,password}=await req.json();

    const {data,error}=await supabase
        .from("login_pass_table")
        .select("hpass,autho")
        .eq("username",username)
        .single()

    if(error){
        console.log(error.message)
        return NextResponse.json({message:"User Authentication Failed"}, {status:401})
    }


    const {hpass,autho}=data;
    const isValid=await bcrypt.compare(password,hpass)
    if(!isValid){// if invalid password
        return NextResponse.json({message:"Wrong Password"}, {status:401})
    }   

    // if valid
    const token=jwt.sign({username,autho},process.env.JWT_SECRET,{expiresIn:"2d"})
    const store=await cookies();
    store.set("token",token,{
        httpOnly:true,
        path:"/",
        maxAge:60*60*24
    })
  return NextResponse.json({ message: "Login successful" }, { status: 200 });   
}


