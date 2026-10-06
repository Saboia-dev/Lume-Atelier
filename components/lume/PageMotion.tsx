"use client";
import { useEffect,useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
export default function PageMotion({children}:{children:React.ReactNode}){
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(window.matchMedia("(prefers-reduced-motion:reduce)").matches)return;const context=gsap.context(()=>{gsap.from("h1",{y:25,opacity:0,duration:.8,scrollTrigger:{trigger:"h1",start:"top 90%"}});gsap.utils.toArray<HTMLElement>("main section").forEach(section=>gsap.from(section,{y:25,opacity:0,duration:.7,scrollTrigger:{trigger:section,start:"top 90%"}}));},root);return()=>context.revert();},[]);
  return <div ref={root}>{children}</div>;
}
