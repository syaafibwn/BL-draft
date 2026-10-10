/* Homepage-only dependency-free 3D football. Add up to 20 permitted local media clips to CLIPS. */
(function () {
  "use strict";
  const CLIPS = [];
  const SIZE = 192;
  const reducedQuery = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = !!(reducedQuery && reducedQuery.matches);
  const V = (x,y,z) => ({x,y,z});
  const add = (a,b) => V(a.x+b.x,a.y+b.y,a.z+b.z);
  const sub = (a,b) => V(a.x-b.x,a.y-b.y,a.z-b.z);
  const mul = (a,s) => V(a.x*s,a.y*s,a.z*s);
  const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
  const cross = (a,b) => V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
  const norm = a => mul(a,1/(Math.hypot(a.x,a.y,a.z)||1));
  const mean = points => mul(points.reduce((sum,p)=>add(sum,p),V(0,0,0)),1/points.length);
  const PHI = (1+Math.sqrt(5))/2;
  const vertices = [
    V(-1,PHI,0),V(1,PHI,0),V(-1,-PHI,0),V(1,-PHI,0),
    V(0,-1,PHI),V(0,1,PHI),V(0,-1,-PHI),V(0,1,-PHI),
    V(PHI,0,-1),V(PHI,0,1),V(-PHI,0,-1),V(-PHI,0,1)
  ].map(norm);
  const triangles = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];
  function outward(points) {
    let center = mean(points);
    let normal = norm(cross(sub(points[1],points[0]),sub(points[2],points[1])));
    if (dot(normal,center)<0) { points.reverse(); normal=mul(normal,-1); }
    return {points,center,normal};
  }
  function buildFaces() {
    const cuts=vertices.map(()=>Object.create(null));
    const neighbors=vertices.map(()=>new Set());
    triangles.forEach(([a,b,c])=>{
      [[a,b],[a,c],[b,a],[b,c],[c,a],[c,b]].forEach(([i,j])=>{
        neighbors[i].add(j);
        cuts[i][j]=norm(add(mul(vertices[i],2),vertices[j]));
      });
    });
    const pentagons=vertices.map((vertex,i)=>{
      const reference=Math.abs(vertex.y)<0.9?V(0,1,0):V(1,0,0);
      const u=norm(cross(reference,vertex)),v=norm(cross(vertex,u));
      const ring=[...neighbors[i]].sort((a,b)=>{
        const pa=sub(cuts[i][a],vertex),pb=sub(cuts[i][b],vertex);
        return Math.atan2(dot(pa,v),dot(pa,u))-Math.atan2(dot(pb,v),dot(pb,u));
      }).map(j=>cuts[i][j]);
      return outward(ring);
    });
    const hexagons=triangles.map(([a,b,c])=>outward([
      cuts[a][b],cuts[b][a],cuts[b][c],cuts[c][b],cuts[c][a],cuts[a][c]
    ]));
    return pentagons.concat(hexagons).map((face,index)=>{
      face.isHex=index>=12;
      face.index=index;
      const axisU=norm(sub(face.points[0],face.center));
      const axisV=norm(cross(face.normal,axisU));
      const local=face.points.map(p=>({u:dot(sub(p,face.center),axisU),v:dot(sub(p,face.center),axisV)}));
      const minU=Math.min(...local.map(p=>p.u)),maxU=Math.max(...local.map(p=>p.u));
      const minV=Math.min(...local.map(p=>p.v)),maxV=Math.max(...local.map(p=>p.v));
      const pad=SIZE*0.07, usable=SIZE-pad*2;
      face.uv=local.map(p=>({x:pad+(p.u-minU)/(maxU-minU||1)*usable,y:SIZE-pad-(p.v-minV)/(maxV-minV||1)*usable}));
      face.texture=document.createElement("canvas");
      face.texture.width=SIZE;face.texture.height=SIZE;
      face.media=null;face.clip=face.isHex?CLIPS[index-12]:"";face.started=false;face.playPending=false;
      return face;
    });
  }
  function rotate(p,y,x) {
    const cy=Math.cos(y),sy=Math.sin(y),cx=Math.cos(x),sx=Math.sin(x);
    const xx=p.x*cy+p.z*sy,zz=-p.x*sy+p.z*cy;
    return V(xx,p.y*cx-zz*sx,p.y*sx+zz*cx);
  }
  function project(p,w,h,focal) {
    const scale=focal/(3.2-p.z);
    return {x:w*.5+p.x*scale,y:h*.49-p.y*scale,z:p.z};
  }
  function mapTriangle(ctx, texture, source, dest) {
    const [s0,s1,s2]=source,[d0,d1,d2]=dest;
    const dx1=s1.x-s0.x,dy1=s1.y-s0.y,dx2=s2.x-s0.x,dy2=s2.y-s0.y;
    const det=dx1*dy2-dx2*dy1;
    if (Math.abs(det)<0.0001) return;
    const a=((d1.x-d0.x)*dy2-(d2.x-d0.x)*dy1)/det;
    const c=(dx1*(d2.x-d0.x)-dx2*(d1.x-d0.x))/det;
    const b=((d1.y-d0.y)*dy2-(d2.y-d0.y)*dy1)/det;
    const d=(dx1*(d2.y-d0.y)-dx2*(d1.y-d0.y))/det;
    const e=d0.x-a*s0.x-c*s0.y,f=d0.y-b*s0.x-d*s0.y;
    ctx.save();ctx.beginPath();ctx.moveTo(d0.x,d0.y);ctx.lineTo(d1.x,d1.y);ctx.lineTo(d2.x,d2.y);ctx.closePath();ctx.clip();
    ctx.setTransform(a,b,c,d,e,f);ctx.drawImage(texture,0,0,SIZE,SIZE);ctx.restore();
  }
  function makeImage(src) { const im=new Image();im.decoding="async";im.src=src;return im; }
  function mediaFor(src, fallback) {
    if (!src) return {kind:"portrait",src:makeImage(fallback),url:fallback};
    const url=new URL(src,document.baseURI).href;
    if (/\.(gif|png|jpe?g|webp|avif)(?:[?#].*)?$/i.test(src)) return {kind:"image",src:null,url};
    const video=document.createElement("video");
    video.muted=true;video.loop=true;video.playsInline=true;video.preload="none";
    return {kind:"video",src:video,url,started:false,playPending:false};
  }
  function init() {
    const hero=document.querySelector(".home-hero");
    if (!hero||hero.dataset.footballReady) return;
    hero.dataset.footballReady="true";
    hero.classList.add("home-hero--football");
    const canvas=document.createElement("canvas");canvas.className="home-football-canvas";canvas.setAttribute("aria-hidden","true");canvas.width=1;canvas.height=1;document.body.appendChild(canvas);
    const ctx=canvas.getContext("2d",{alpha:true,desynchronized:true});if(!ctx)return;
    const records=typeof players!=="undefined"?players:[];
    const portrait=i=>{if(!records.length)return null;const p=records[(i*7+3)%records.length];return typeof playerImageUrl==="function"?playerImageUrl(p):p.image;};
    const faces=buildFaces(),hex=faces.filter(f=>f.isHex);
    hex.forEach((f,i)=>{f.media=mediaFor(CLIPS[i],portrait(i));});
    let width=0,height=0,dpr=1,raf=0,visible=false,homeActive=false,last=0;
    function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;dpr=Math.min(window.devicePixelRatio||1,1.5);width=Math.round(r.width*dpr);height=Math.round(r.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;if(reduced)draw(performance.now());else run();}}
    function stop(){if(raf)cancelAnimationFrame(raf);raf=0;hex.forEach(f=>{if(f.media.kind==="video")f.media.src.pause();});}
    function run(){if(raf||!visible||!homeActive||document.hidden||reduced)return;raf=requestAnimationFrame(tick);}
    function tick(t){raf=0;if(!visible||!homeActive||document.hidden)return;if(t-last>33){draw(t);last=t;}run();}
    function draw(t){
      if(!width||!height)return;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
      const focal=Math.min(width,height)*2.6,y=reduced?-.3:t*.00022-.3,x=reduced?.17:.17+Math.sin(t*.0002)*.07;
      const projectPoint=p=>{const q=rotate(p,y,x),s=focal/(3.2-q.z);return {x:width*.5+q.x*s,y:height*.49-q.y*s,z:q.z};};
      const front=[];
      faces.forEach(f=>{
        const normal=rotate(f.normal,y,x);if(normal.z<.025){if(f.isHex&&f.media&&f.media.kind==="video")f.media.src.pause();return;}
        const points=f.points.map(projectPoint);
        front.push({f,normal,points,center:projectPoint(f.center),depth:points.reduce((sum,p)=>sum+p.z,0)/points.length});
      });
      front.sort((a,b)=>a.depth-b.depth);
      const glow=ctx.createRadialGradient(width*.51,height*.79,2,width*.51,height*.79,Math.min(width,height)*.42);
      glow.addColorStop(0,"rgba(20,156,255,.18)");glow.addColorStop(1,"rgba(20,156,255,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      front.forEach(({f,normal,points,center})=>{
        ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.fillStyle=f.isHex?"#081522":"#06111d";ctx.fill();
        if(f.isHex&&f.media){
          const m=f.media;
          if(!reduced){
            if(m.kind==="video"){
              if(!m.started){m.src.src=m.url;m.src.load();m.started=true;}
              if(m.src.paused&&!m.playPending){m.playPending=true;m.src.play().catch(()=>{}).finally(()=>{m.playPending=false;});}
            } else if(!m.src) m.src=makeImage(m.url);
          } else if(m.kind==="video") m.src.pause();
          const image=m.src,sw=image&&(image.videoWidth||image.naturalWidth),sh=image&&(image.videoHeight||image.naturalHeight);
          if(image&&sw&&sh){
            const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
            const side=Math.max(maxX-minX,maxY-minY)*1.8;
            const tc=f.texture.getContext("2d");tc.clearRect(0,0,SIZE,SIZE);
            const cover=Math.max(SIZE/sw,SIZE/sh);
            tc.drawImage(image,(sw-SIZE/cover)/2,(sh-SIZE/cover)/2,SIZE/cover,SIZE/cover,0,0,SIZE,SIZE);
            const mid={x:SIZE/2,y:SIZE/2};
            for(let i=0;i<points.length;i++)mapTriangle(ctx,f.texture,[mid,f.uv[i],f.uv[(i+1)%points.length]],[center,points[i],points[(i+1)%points.length]]);
          }
          ctx.strokeStyle="rgba(72,192,242,.78)";ctx.lineWidth=Math.max(1,dpr);ctx.stroke();
          ctx.fillStyle="rgba(0,4,12,.22)";ctx.fill();
        } else {
          ctx.fillStyle="rgba(20,57,78,"+(.3+Math.max(0,normal.z)*.3)+")";ctx.fill();
          ctx.strokeStyle="rgba(44,104,135,.9)";ctx.lineWidth=Math.max(1,dpr);ctx.stroke();
        }
      });
    }
    const ro=typeof ResizeObserver==="function"?new ResizeObserver(resize):null;ro?.observe(canvas);
    const io=typeof IntersectionObserver==="function"?new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;if(visible){resize();if(reduced)draw(performance.now());else run();}else stop();},{rootMargin:"100px"}):null;
    if(io)io.observe(canvas);else visible=true;
    const menuScreen=document.getElementById("menu-screen")||hero;
    function syncHomeVisibility(){
      homeActive=!menuScreen.classList.contains("hidden");
      document.body.classList.toggle("home-football-active",homeActive);
      if(homeActive){resize();if(reduced)draw(performance.now());else run();}
      else stop();
    }
    new MutationObserver(syncHomeVisibility).observe(menuScreen,{attributes:true,attributeFilter:["class"]});
    window.addEventListener("resize",resize,{passive:true});
    document.addEventListener("visibilitychange",()=>document.hidden?stop():(reduced?draw(performance.now()):run()));
    if(reducedQuery)reducedQuery.addEventListener("change",e=>{reduced=e.matches;if(reduced){stop();draw(performance.now());}else run();});
    syncHomeVisibility();resize();if(!io&&homeActive){if(reduced)draw(performance.now());else run();}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();