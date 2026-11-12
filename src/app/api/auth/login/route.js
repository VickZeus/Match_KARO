import jwt from "jsonwebtoken"
import {cookies} from "next/headers"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server";
import { getUser } from "@/lib/getUser"
import { redis } from "@/lib/redis"


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


export async function GET(){
    const user = await getUser();
    if(!user){
        return NextResponse.json({message:"Not logged in"}, {status:401})
    }
    const {data:userData, error:userError} = await supabase
        .from("login_pass_table")
        .select("username, created_at, autho, email")
        .eq("username", user.username)
        .single()
    const {data:clusterData, error:clusterError} = await supabase
        .from("user_clusters")
        .select("cluster_id, model_run_id, updated_at")
        .eq("username", user.username)
        .maybeSingle()

    if(userError || clusterError){
        console.log(userError?.message || clusterError?.message)
        return NextResponse.json({message:"User not found"}, {status:404})
    }
    const data = {...userData, ...clusterData}
    try{
        await redis.set(`user:${user.username}`, data, {ex:3600})
    }catch(e){
        console.log("Redis write failed", e)
        return NextResponse.json({cached:false}, {status:200})
    }
    return NextResponse.json({cached:true}, {status:200})
}