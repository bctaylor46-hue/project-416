import { supabase } from './supabaseClient';
import { useState, useEffect, useRef } from "react";

// ── Design Tokens ─────────────────────────────────────────────────────────────
const G = {
  gold:"#c8a951", goldLt:"#e5cc7a", goldDim:"#7a6520",
  black:"#080808", card:"#0f0f0f", card2:"#141414",
  border:"#242010", border2:"#1e1e1e", text:"#f0ead8", muted:"#6b6040",
  blue:"#60a5fa", purple:"#a78bfa", green:"#22c55e", red:"#ef4444", yellow:"#eab308",
};
const goldGrad = `linear-gradient(135deg, ${G.gold}, ${G.goldLt}, ${G.gold})`;

// ── Utils ─────────────────────────────────────────────────────────────────────
const r25 = w => Math.round(w / 2.5) * 2.5;
const rpeClr = v => v >= 10 ? G.red : v >= 8 ? "#f97316" : v >= 6 ? G.yellow : G.green;
const parseMins = p => p === "E3MOM" ? 3 : p === "E2MOM" ? 2 : 1;
const flatEx = list => list.flatMap(e => e.type === "superset" ? [e.exA, e.exB] : [e]);

// ── Exercise Builders ─────────────────────────────────────────────────────────
const m  = (name, proto, pat)   => ({ name, proto, type:"main", isMain:true, pat });
const rp = (name, proto, sets)  => ({ name, proto, type:"rpe", isMain:false, sets });
const ss = (a, b) => ({
  name: `${a.name}+${b.name}`,
  type: "superset",
  isMain: false,
  exA: a,
  exB: b,
});
const rs = (n, reps, rpe, note=null) => ({ n, reps, rpe, note });

// ── Data ──────────────────────────────────────────────────────────────────────
const PATS = [
  {id:"fbPush",name:"Full Body Push",  muscle:"Chest+Quads",         mev:10,mav:[12,20],mrv:22},
  {id:"fbPull",name:"Full Body Pull",  muscle:"Back+Hamstrings",     mev:10,mav:[14,22],mrv:25},
  {id:"vPush", name:"Vertical Push",   muscle:"Front Delts",         mev:0, mav:[6,8],  mrv:12},
  {id:"vPull", name:"Vertical Pull",   muscle:"Back+Biceps",         mev:10,mav:[14,22],mrv:25},
  {id:"hPush", name:"Horizontal Push", muscle:"Chest+Triceps",       mev:10,mav:[12,20],mrv:22},
  {id:"hPull", name:"Horizontal Pull", muscle:"Back+Rear Delt",      mev:10,mav:[14,22],mrv:25},
  {id:"lPush", name:"Lower Push",      muscle:"Quads+Glutes",        mev:8, mav:[12,18],mrv:20},
  {id:"lPull", name:"Lower Pull",      muscle:"Hamstrings+Glutes",   mev:6, mav:[10,16],mrv:20},
];
const EX_PAT = {
  "Hang Clean & Press":"fbPush",
  "Squat":"lPush",
  "Bench":"hPush",
  "Deadlift":"fbPull",
  "Bent-Over Row":"hPull",
  "Neutral Grip Bench":"hPush",
  "Romanian Deadlift":"lPull",
  "Single Arm Rack Carry":"fbPull",
  "Pull Ups":"vPull",
  "DB Chest Supported Row":"hPull",
  "DB Chest Supported Rows":"hPull",
  "Lateral Raises":"vPush",
  "Reverse Cable Crossover":"hPull",
  "Skull Crushers":"hPush",
  "Hammer Curls":"vPull",
  "Lying Leg Curls":"lPull",
  "Hip Abductions":"lPull",
  "Neutral Grip Shoulder Press":"vPush",
  "DB Bulgarian Split Squat":"lPush",
  "Single Farmer's Carry":"fbPull",
};
const BODY_REF = [
  ["Abs",        0,  0,  "16-20","25+","3-5x","8-20 reps"],
  ["Back",       8,  10, "14-22","25+","2-4x","6-20 reps"],
  ["Biceps",     4,  6,  "10-15","20+","2-4x","10-20 reps"],
  ["Chest",      8,  10, "12-20","22+","2-4x","6-20 reps"],
  ["Delts",      6,  8,  "16-22","26+","2-4x","10-20 reps"],
  ["Glutes",     4,  6,  "12-18","20+","2-4x","8-15 reps"],
  ["Hamstrings", 4,  6,  "10-16","20+","2-4x","8-15 reps"],
  ["Quads",      8,  10, "12-18","20+","2-4x","8-15 reps"],
  ["Traps",      0,  0,  "12-20","26+","2-4x","10-20 reps"],
  ["Triceps",    4,  6,  "10-15","20+","2-4x","10-20 reps"],
];
const MEV_FACTORS = [
  {key:"sex",   label:"Sex",         opts:[{l:"Male",v:0},{l:"Female",v:5}]},
  {key:"weight",label:"Weight",      opts:[{l:"84+/120+ kg",v:-4},{l:"<84/<120 kg",v:-2},{l:"Average",v:0}]},
  {key:"height",label:"Height",      opts:[{l:"175+/195+ cm",v:-2},{l:"<175/<195 cm",v:-1},{l:"Average",v:0}]},
  {key:"age",   label:"Age",         opts:[{l:"50s",v:-4},{l:"40s",v:-2},{l:"30s",v:0},{l:"20s",v:1}]},
  {key:"exp",   label:"Training Exp",opts:[{l:"12+ yrs",v:-2},{l:"8-12 yrs",v:-1},{l:"4-8 yrs",v:0},{l:"<4 yrs",v:2}]},
  {key:"str",   label:"Strength",    opts:[{l:"Very High",v:-3},{l:"High",v:-1},{l:"Medium",v:0},{l:"Low",v:1}]},
  {key:"diet",  label:"Diet",        opts:[{l:"Poor",v:-3},{l:"Average",v:0},{l:"Good",v:1}]},
  {key:"sleep", label:"Sleep",       opts:[{l:"<5 hrs",v:-3},{l:"5-7 hrs",v:0},{l:"7+ hrs",v:2}]},
  {key:"stress",label:"Stress",      opts:[{l:"High",v:-3},{l:"Average",v:0},{l:"Low",v:1}]},
  {key:"drugs", label:"Drug Use",    opts:[{l:"No",v:0},{l:"Yes (PEDs)",v:3}]},
];

const P = {
  x3_85:{tp:0.85,tl:"85%",    reps:[3,3,3,6,9]},
  x3_88:{tp:0.88,tl:"88%",    reps:[3,3,3,6,9]},
  x2_88:{tp:0.88,tl:"88%",    reps:[2,2,2,4,6]},
  x2_91:{tp:0.91,tl:"91%",    reps:[2,2,2,4,6]},
  x1_91:{tp:0.91,tl:"91%",    reps:[1,1,1,2,3]},
  x1_PR:{tp:0.98,tl:"94-102%",reps:[1,1,1,2,3]},
};

const LIFTS = ["Hang Clean & Press","Squat","Bench","Deadlift"];
const FC    = {"Upper Body":G.gold,"Lower Body":G.blue,"Full Body":G.purple};

// ── Accessory set schemes ─────────────────────────────────────────────────────
const A46r  = [rs(1,6,6), rs(1,6,7), rs(1,6,8), rs(1,6,null,"= 3rd set")];  // 1×6 ×4 sets
const B4x6r = [rs(4,6,6), rs(4,6,7), rs(4,6,8), rs(4,6,null,"= 3rd set")];  // 4×6 ×4 sets
const C39   = [rs(3,9,6),  rs(3,9,7),  rs(3,9,8)];                           // 3×9
const ISO   = [rs(1,12,10),rs(1,12,10)];                                      // 1×12 RPE10 ×2
const CARRY = [rs(3,"25m",6),rs(3,"25m",7),rs(3,"25m",8)];                   // 3×25m

// ── Superset factories ────────────────────────────────────────────────────────
const armSS  = () => ss(rp("Skull Crushers","EMOM",ISO),           rp("Hammer Curls","EMOM",ISO));
const legSS  = () => ss(rp("Lying Leg Curls","EMOM",ISO),          rp("Hip Abductions","EMOM",ISO));
const deltSS = () => ss(rp("Lateral Raises","EMOM",ISO),            rp("Reverse Cable Crossover","EMOM",ISO));

const PROGRAM = [
  {week:1,theme:"Volume",range:"85%",sessions:[
    {id:1, day:"Monday",   focus:"Upper Body",exercises:[
      m("Hang Clean & Press","E3MOM",P.x3_85),
      rp("Bent-Over Row","E2MOM",A46r),
      rp("Neutral Grip Bench","EMOM",C39),
      armSS(),
    ]},
    {id:2, day:"Tuesday",  focus:"Lower Body",exercises:[
      m("Squat","E3MOM",P.x3_85),
      rp("Romanian Deadlift","E2MOM",B4x6r),
      rp("Single Arm Rack Carry","EMOM",CARRY),
      legSS(),
    ]},
    {id:3, day:"Thursday", focus:"Upper Body",exercises:[
      m("Bench","E3MOM",P.x3_85),
      rp("Pull Ups","E2MOM",B4x6r),
      rp("DB Chest Supported Row","EMOM",C39),
      deltSS(),
    ]},
    {id:4, day:"Saturday", focus:"Full Body", exercises:[
      m("Hang Clean & Press","E3MOM",P.x2_88),
      m("Squat","E3MOM",P.x2_88),
      m("Deadlift","E3MOM",P.x3_85),
    ]},
  ]},
  {week:2,theme:"Intensity",range:"88-91%",sessions:[
    {id:5, day:"Monday",   focus:"Upper Body",exercises:[
      m("Bench","E3MOM",P.x2_88),
      rp("Pull Ups","E2MOM",A46r),
      rp("Neutral Grip Shoulder Press","EMOM",C39),
      armSS(),
    ]},
    {id:6, day:"Tuesday",  focus:"Lower Body",exercises:[
      m("Deadlift","E3MOM",P.x2_88),
      rp("DB Bulgarian Split Squat","E2MOM",A46r),
      rp("Single Farmer's Carry","EMOM",CARRY),
      legSS(),
    ]},
    {id:7, day:"Thursday", focus:"Upper Body",exercises:[
      m("Hang Clean & Press","E3MOM",P.x1_91),
      rp("DB Chest Supported Rows","E2MOM",A46r),
      rp("Pull Ups","EMOM",C39),
      deltSS(),
    ]},
    {id:8, day:"Saturday", focus:"Full Body", exercises:[
      m("Squat","E3MOM",P.x1_91),
      m("Bench","E3MOM",P.x1_91),
      m("Deadlift","E3MOM",P.x1_91),
    ]},
  ]},
  {week:3,theme:"Accumulation",range:"88%",sessions:[
    {id:9,  day:"Monday",   focus:"Upper Body",exercises:[
      m("Hang Clean & Press","E3MOM",P.x3_88),
      rp("Bent-Over Row","E2MOM",A46r),
      rp("Neutral Grip Bench","EMOM",C39),
      armSS(),
    ]},
    {id:10, day:"Tuesday",  focus:"Lower Body",exercises:[
      m("Squat","E3MOM",P.x3_88),
      rp("Romanian Deadlift","E2MOM",B4x6r),
      rp("Single Arm Rack Carry","EMOM",CARRY),
      legSS(),
    ]},
    {id:11, day:"Thursday", focus:"Upper Body",exercises:[
      m("Bench","E3MOM",P.x3_88),
      rp("Pull Ups","E2MOM",B4x6r),
      rp("DB Chest Supported Row","EMOM",C39),
      deltSS(),
    ]},
    {id:12, day:"Saturday", focus:"Full Body", exercises:[
      m("Hang Clean & Press","E3MOM",P.x2_91),
      m("Squat","E3MOM",P.x2_91),
      m("Deadlift","E3MOM",P.x3_88),
    ]},
  ]},
  {week:4,theme:"Peak",range:"91-102%",sessions:[
    {id:13, day:"Monday",   focus:"Upper Body",exercises:[
      m("Bench","E3MOM",P.x2_91),
      rp("Pull Ups","E2MOM",A46r),
      rp("Neutral Grip Shoulder Press","EMOM",C39),
      armSS(),
    ]},
    {id:14, day:"Tuesday",  focus:"Lower Body",exercises:[
      m("Deadlift","E3MOM",P.x2_91),
      rp("DB Bulgarian Split Squat","E2MOM",A46r),
      rp("Single Farmer's Carry","EMOM",CARRY),
      legSS(),
    ]},
    {id:15, day:"Thursday", focus:"Upper Body",exercises:[
      m("Hang Clean & Press","E3MOM",P.x1_PR),
      rp("DB Chest Supported Rows","E2MOM",A46r),
      rp("Pull Ups","EMOM",C39),
    ]},
    {id:16, day:"Saturday", focus:"Full Body", exercises:[
      m("Squat","E3MOM",P.x1_PR),
      m("Bench","E3MOM",P.x1_PR),
      m("Deadlift","E3MOM",P.x1_PR),
    ]},
  ]},
];

// ── Supabase Storage ─────────────────────────────────────────────────────────
const ST = {
  signUp: async (email, password, name, mev, unit, rms) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    const uid = data.user.id;
    await supabase.from('profiles').insert({ id:uid, name, mev, unit, rms });
    await supabase.from('progress').insert({ user_id:uid, completed:[], logs:{}, acc_logs:{} });
    return { error:null, user:{ id:uid, email, name, mev, unit, rms, completed:[], logs:{}, accLogs:{} } };
  },
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const uid = data.user.id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).single();
    const { data: prog }    = await supabase.from('progress').select('*').eq('user_id', uid).single();
    return { error:null, user:{
      id: uid, email,
      name:    profile?.name    || '',
      mev:     profile?.mev     || {},
      unit:    profile?.unit    || 'lbs',
      rms:     profile?.rms     || {},
      completed: prog?.completed || [],
      logs:      prog?.logs      || {},
      accLogs:   prog?.acc_logs  || {},
    }};
  },
  saveProgress: async (uid, completed, logs, accLogs, rms) => {
    await supabase.from('progress').upsert({
      user_id: uid,
      completed: [...completed],
      logs,
      acc_logs: accLogs,
      rms,
      updated_at: new Date().toISOString(),
    });
  },
  saveProfile: async (uid, updates) => {
    await supabase.from('profiles').update(updates).eq('id', uid);
  },
};


// ── Shared UI ─────────────────────────────────────────────────────────────────
const FField = ({label,value,onChange,placeholder,type="text"}) => (
  <div style={{marginBottom:14}}>
    <label style={{fontSize:10,color:G.muted,letterSpacing:2,display:"block",marginBottom:6,fontWeight:700}}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",boxSizing:"border-box",background:"#111",border:`1px solid ${G.border}`,borderRadius:6,color:G.text,padding:"10px 12px",fontSize:13,outline:"none"}}/>
  </div>
);
const FBtn = ({children,onClick,secondary,disabled}) => (
  <button onClick={onClick} disabled={!!disabled}
    style={{flex:1,padding:12,background:disabled?"#1a1a1a":secondary?"#111":G.gold,
      color:disabled?"#333":secondary?G.muted:G.black,border:secondary?`1px solid ${G.border}`:"none",
      borderRadius:6,fontWeight:800,fontSize:12,letterSpacing:2,cursor:disabled?"not-allowed":"pointer"}}>
    {children}
  </button>
);
const FRow = ({f,mev,tog}) => (
  <div style={{marginBottom:13}}>
    <div style={{fontSize:9,color:G.muted,letterSpacing:2,marginBottom:6,fontWeight:700}}>{f.label.toUpperCase()}</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
      {f.opts.map(o => { const sel = mev[f.key]===o.v; return (
        <button key={o.l} onClick={()=>tog(f.key,o.v)}
          style={{padding:"5px 11px",borderRadius:4,border:sel?`1px solid ${G.gold}`:`1px solid ${G.border}`,
            background:sel?"#1a1000":"#0a0a0a",color:sel?G.gold:G.muted,fontSize:11,cursor:"pointer",fontWeight:sel?700:400}}>
          {o.l} <span style={{fontSize:9,color:sel?G.goldDim:"#333"}}>({o.v>0?"+":""}{o.v})</span>
        </button>
      );})}
    </div>
  </div>
);
const SH = ({children,color}) => (
  <div style={{fontSize:9,color:color||G.gold,fontWeight:800,letterSpacing:3,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${color||G.gold}20`}}>
    {children}
  </div>
);

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = ({size="lg"}) => {
  const big = size==="lg";
  return (
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:big?10:7,color:G.muted,letterSpacing:big?6:4,fontWeight:700,marginBottom:big?4:2}}>PROJECT</div>
      <div style={{fontSize:big?60:20,fontWeight:900,background:goldGrad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1,letterSpacing:-2}}>
        4:16
      </div>
      <div style={{fontSize:big?10:7,color:G.muted,letterSpacing:big?4:3,fontWeight:700,marginTop:big?4:2}}>LIFTERS ON THE RUN</div>
    </div>
  );
};

// ── Onboarding ────────────────────────────────────────────────────────────────
const OB_STEPS = ["Account","Body Stats","Training","1RM Setup"];

function Onboarding({onComplete}) {
  const [step,setStep]     = useState(0);
  const [mode,setMode]     = useState("signup");
  const [name,setName]     = useState("");
  const [email,setEmail]   = useState("");
  const [pw,setPw]         = useState("");
  const [showPw,setShowPw] = useState(false);
  const [mev,setMev]       = useState({});
  const [unit,setUnit]     = useState("lbs");
  const [rms,setRms]       = useState({});
  const [err,setErr]       = useState("");
  const [loading,setLoading] = useState(false);

  const mevScore = Object.values(mev).reduce((s,v)=>s+(v||0),0);
  const tog = (k,v) => setMev(p=>({...p,[k]:p[k]===v?undefined:v}));

  const handleAccount = async () => {
    if (!name.trim()) { setErr("Enter your name."); return; }
    if (!email.includes("@")||!email.includes(".")) { setErr("Enter a valid email."); return; }
    if (pw.length<6) { setErr("Password must be at least 6 characters."); return; }
    setErr(""); setLoading(true);
    if (mode==="signin") {
      const res = await ST.signIn(email, pw);
      setLoading(false);
      if (res.error) { setErr(res.error); return; }
      onComplete({ id:res.user.id, name:res.user.name, email, mev:res.user.mev||{}, unit:res.user.unit||"lbs",
        rms:res.user.rms||{}, completed:new Set(res.user.completed||[]),
        logs:res.user.logs||{}, accLogs:res.user.accLogs||{} });
      return;
    }
    setLoading(false); setStep(1);
  };

  const finish = async () => {
    const res = await ST.signUp(email, pw, name.trim(), mev, unit, rms);
    if (res.error) { setErr(res.error); setStep(0); return; }
    onComplete({ id:res.user.id, name:name.trim(), email, mev, unit, rms, completed:new Set(), logs:{}, accLogs:{} });
  };

  const card = {background:G.card,border:`1px solid ${G.border}`,borderRadius:10,padding:"24px 20px"};

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 16px",background:G.black,position:"relative",overflow:"hidden"}}>
      <div style={{position:"fixed",inset:0,zIndex:0,backgroundImage:`url(https://lh3.googleusercontent.com/d/1RYjhEY0qfobgKpT9PF3YdHTWY9nK6YeS)`,backgroundSize:"cover",backgroundPosition:"center",opacity:0.18}}/>
      <div style={{position:"fixed",inset:0,zIndex:1,background:"linear-gradient(180deg,rgba(8,8,8,0.92) 0%,rgba(8,8,8,0.7) 50%,rgba(8,8,8,0.92) 100%)"}}/>
      <div style={{position:"fixed",inset:0,zIndex:2,boxShadow:"inset 0 0 120px rgba(0,0,0,0.8)"}}/>
      <div style={{position:"fixed",top:0,left:0,right:0,height:3,background:goldGrad,zIndex:10}}/>
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:3,background:goldGrad,zIndex:10}}/>

      <div style={{marginBottom:36,position:"relative",zIndex:10}}><Logo size="lg"/></div>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:10}}>
        {step>0 && (
          <div style={{display:"flex",gap:6,marginBottom:22}}>
            {OB_STEPS.map((s,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:"100%",height:2,borderRadius:99,background:i<step?G.gold:i===step?G.gold:"#1a1a1a"}}/>
                <span style={{fontSize:8,color:i===step?G.gold:i<step?G.muted:"#2a2a2a",fontWeight:700,letterSpacing:1}}>{s.toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}
        <div style={card}>
          {step===0 && (
            <div>
              <div style={{display:"flex",marginBottom:20,background:"#0a0a0a",borderRadius:6,overflow:"hidden"}}>
                {[["signup","SIGN UP"],["signin","SIGN IN"]].map(([k,l])=>(
                  <button key={k} onClick={()=>{setMode(k);setErr("");}}
                    style={{flex:1,padding:11,background:mode===k?G.gold:"transparent",
                      color:mode===k?G.black:G.muted,border:"none",fontWeight:800,fontSize:11,letterSpacing:2,cursor:"pointer"}}>
                    {l}
                  </button>
                ))}
              </div>
              <FField label="FULL NAME" value={name} onChange={setName} placeholder="Your name"/>
              <FField label="EMAIL ADDRESS" value={email} onChange={setEmail} placeholder="you@email.com"/>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:10,color:G.muted,letterSpacing:2,display:"block",marginBottom:6,fontWeight:700}}>PASSWORD</label>
                <div style={{display:"flex",background:"#111",border:`1px solid ${G.border}`,borderRadius:6,overflow:"hidden"}}>
                  <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleAccount()}
                    placeholder="Min 6 characters"
                    style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"10px 12px",fontSize:13,outline:"none"}}/>
                  <button onClick={()=>setShowPw(s=>!s)}
                    style={{background:"transparent",border:"none",color:G.muted,padding:"0 12px",cursor:"pointer",fontSize:14}}>
                    {showPw?"🙈":"👁"}
                  </button>
                </div>
              </div>
              {err && <div style={{fontSize:11,color:G.red,marginBottom:12,padding:"8px 10px",background:"#1a0808",borderRadius:4}}>{err}</div>}
              <div style={{display:"flex",gap:8}}>
                <FBtn onClick={handleAccount} disabled={loading}>{loading?"…":mode==="signup"?"CONTINUE →":"SIGN IN"}</FBtn>
              </div>
            </div>
          )}
          {step===1 && (
            <div>
              <div style={{fontSize:13,fontWeight:800,color:G.text,marginBottom:4,letterSpacing:1}}>BODY STATS</div>
              <p style={{fontSize:11,color:G.muted,marginBottom:14,lineHeight:1.6}}>Calibrate your MEV/MRV recovery score.</p>
              {MEV_FACTORS.slice(0,5).map(f=><FRow key={f.key} f={f} mev={mev} tog={tog}/>)}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <FBtn secondary onClick={()=>setStep(0)}>← BACK</FBtn>
                <FBtn onClick={()=>setStep(2)}>NEXT →</FBtn>
              </div>
            </div>
          )}
          {step===2 && (
            <div>
              <div style={{fontSize:13,fontWeight:800,color:G.text,marginBottom:14,letterSpacing:1}}>TRAINING PROFILE</div>
              {MEV_FACTORS.slice(5).map(f=><FRow key={f.key} f={f} mev={mev} tog={tog}/>)}
              <div style={{background:"#0a0900",border:`1px solid ${G.border}`,borderRadius:8,padding:"12px 14px",marginBottom:16}}>
                <div style={{fontSize:9,color:G.muted,marginBottom:4,letterSpacing:2}}>YOUR MEV/MRV MODIFIER</div>
                <div style={{fontSize:28,fontWeight:900,color:mevScore>0?G.green:mevScore<0?G.red:G.gold}}>
                  {mevScore>0?"+":""}{mevScore}
                </div>
                <div style={{fontSize:10,color:G.muted,marginTop:2}}>
                  {mevScore>2?"High recovery -- push volume hard":mevScore<-2?"Low recovery -- manage volume carefully":"Average recovery capacity"}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <FBtn secondary onClick={()=>setStep(1)}>← BACK</FBtn>
                <FBtn onClick={()=>setStep(3)}>NEXT →</FBtn>
              </div>
            </div>
          )}
          {step===3 && (
            <div>
              <div style={{fontSize:13,fontWeight:800,color:G.text,marginBottom:4,letterSpacing:1}}>1RM SETUP</div>
              <div style={{display:"flex",background:"#0a0a0a",borderRadius:6,overflow:"hidden",marginBottom:14}}>
                {["lbs","kg"].map(u=>(
                  <button key={u} onClick={()=>setUnit(u)}
                    style={{flex:1,padding:9,background:unit===u?G.gold:"transparent",
                      color:unit===u?G.black:G.muted,border:"none",fontWeight:800,fontSize:11,letterSpacing:2,cursor:"pointer"}}>
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
              {LIFTS.map(l=>(
                <div key={l} style={{marginBottom:12}}>
                  <label style={{fontSize:10,color:G.muted,display:"block",marginBottom:5,letterSpacing:2,fontWeight:700}}>{l.toUpperCase()}</label>
                  <div style={{display:"flex",background:"#111",borderRadius:6,overflow:"hidden",border:`1px solid ${G.border}`}}>
                    <input type="number" value={rms[l]||""} placeholder="Leave blank if unknown"
                      onChange={e=>setRms(p=>({...p,[l]:e.target.value}))}
                      style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"10px 12px",fontSize:13,outline:"none"}}/>
                    <span style={{padding:"0 14px",color:G.muted,fontSize:12,display:"flex",alignItems:"center"}}>{unit}</span>
                  </div>
                </div>
              ))}
              {err && <div style={{fontSize:11,color:G.red,marginBottom:12,padding:"8px 10px",background:"#1a0808",borderRadius:4}}>{err}</div>}
              <div style={{display:"flex",gap:8,marginTop:6}}>
                <FBtn secondary onClick={()=>setStep(2)}>← BACK</FBtn>
                <FBtn onClick={finish}>START PROGRAM →</FBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Volume Tab ────────────────────────────────────────────────────────────────
function VolumeTab({weekData,activeWeek,setActiveWeek,volScore}) {
  const [showRef,setShowRef] = useState(false);
  const ws = {}; PATS.forEach(p=>ws[p.id]=0);
  weekData.sessions.forEach(s=>s.exercises.forEach(ex=>{
    const add = e => { const pid=EX_PAT[e.name]; if(pid) ws[pid]=(ws[pid]||0)+3; };
    ex.type==="superset" ? [add(ex.exA),add(ex.exB)] : add(ex);
  }));
  return (
    <div>
      <div style={{background:G.card,borderRadius:10,padding:"12px 16px",border:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:9,color:G.muted,letterSpacing:2}}>MEV/MRV SCORE</div>
          <div style={{fontSize:26,fontWeight:900,color:volScore>0?G.green:volScore<0?G.red:G.gold}}>{volScore>0?"+":""}{volScore}</div>
        </div>
        <button onClick={()=>setShowRef(s=>!s)}
          style={{background:showRef?"#051520":"#0a0a0a",border:`1px solid ${showRef?"#1a3050":G.border}`,
            borderRadius:6,color:showRef?G.blue:G.muted,padding:"8px 14px",fontSize:10,fontWeight:700,letterSpacing:2,cursor:"pointer"}}>
          {showRef?"HIDE":"VIEW"} REF TABLE
        </button>
      </div>
      {showRef && (
        <div style={{background:"#060d15",borderRadius:10,padding:14,border:`1px solid #1a3050`,marginBottom:14,overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:460}}>
            <thead>
              <tr style={{background:"#040b12"}}>
                {["Body Part","MV","MEV","MAV","MRV","Freq","Rep Range"].map(h=>(
                  <th key={h} style={{padding:"6px 8px",fontSize:9,color:G.blue,fontWeight:800,letterSpacing:1,textAlign:"left"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BODY_REF.map(([name,...vals],i)=>(
                <tr key={name} style={{background:i%2?"#040b12":"transparent"}}>
                  <td style={{padding:"6px 8px",fontSize:11,fontWeight:700,color:G.blue}}>{name}</td>
                  {vals.map((v,j)=><td key={j} style={{padding:"6px 8px",fontSize:10,color:j===0||j===1?G.muted:G.text}}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {PROGRAM.map(w=>{const act=activeWeek===w.week;return(
          <button key={w.week} onClick={()=>setActiveWeek(w.week)}
            style={{flex:1,padding:"8px 4px",borderRadius:7,border:act?`1px solid ${G.gold}`:`1px solid ${G.border}`,
              background:act?"#1a1000":"#0a0a0a",color:act?G.gold:G.muted,fontWeight:act?800:400,fontSize:11,cursor:"pointer",letterSpacing:1}}>
            WK {w.week}
          </button>
        );})}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {PATS.map(pat=>{
          const sets=ws[pat.id]||0;
          const adjMev=Math.max(0,pat.mev+volScore);
          const adjMrv=Math.max(adjMev+1,pat.mrv+volScore);
          const adjMavHi=Math.max(adjMev,pat.mav[1]+volScore);
          const pct=adjMrv>0?Math.min(100,(sets/adjMrv)*100):0;
          const status=sets===0?"none":sets<adjMev?"below":sets<=adjMavHi?"good":sets<adjMrv?"near":"over";
          const SI={none:{l:"No Volume",c:"#333"},below:{l:"Below MEV",c:G.red},good:{l:"In Range",c:G.green},near:{l:"Near MRV",c:G.gold},over:{l:"Over MRV",c:G.red}}[status];
          const bcLine={none:"#333",below:G.red,good:G.green,near:G.gold,over:G.red}[status];
          const patEx=[];
          weekData.sessions.forEach(s=>s.exercises.forEach(ex=>{
            const chk=e=>{if(EX_PAT[e.name]===pat.id&&!patEx.includes(e.name))patEx.push(e.name);};
            ex.type==="superset"?[chk(ex.exA),chk(ex.exB)]:chk(ex);
          }));
          return(
            <div key={pat.id} style={{background:G.card,borderRadius:10,border:`1px solid ${G.border}`,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontWeight:800,fontSize:14,color:G.text}}>{pat.name}</div>
                  <div style={{fontSize:10,color:G.muted,marginTop:2}}>{pat.muscle}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:24,fontWeight:900,color:SI.c}}>{sets}</div>
                  <div style={{fontSize:9,color:G.muted,letterSpacing:1}}>SETS</div>
                </div>
              </div>
              <div style={{background:"#1a1a1a",borderRadius:99,height:6,marginBottom:7,position:"relative",overflow:"visible"}}>
                <div style={{background:bcLine,borderRadius:99,height:6,width:`${pct}%`,transition:"width 0.3s"}}/>
                {adjMev>0&&<div style={{position:"absolute",top:-3,left:`${Math.min(99,(adjMev/adjMrv)*100)}%`,width:1,height:12,background:G.red,opacity:0.6}}/>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:9,color:G.blue}}>MEV: {adjMev}</span>
                <span style={{fontSize:9,color:SI.c,fontWeight:800}}>{SI.l}</span>
                <span style={{fontSize:9,color:G.red}}>MRV: {adjMrv}</span>
              </div>
              {patEx.length>0
                ?<div style={{display:"flex",flexWrap:"wrap",gap:5}}>{patEx.map((e,i)=><span key={i} style={{fontSize:10,color:G.muted,background:"#0f0f0f",border:`1px solid ${G.border}`,borderRadius:3,padding:"2px 8px"}}>{e}</span>)}</div>
                :<div style={{fontSize:10,color:"#2a2a2a",fontStyle:"italic"}}>No exercises this week</div>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Proto Tag with Timer ──────────────────────────────────────────────────────
const ProtoTag = ({proto,exName,onTimer}) => (
  <div style={{display:"flex",gap:5,alignItems:"center"}}>
    <span style={{fontSize:10,background:"#1a1000",color:G.gold,borderRadius:3,padding:"2px 7px",fontWeight:700,letterSpacing:1}}>{proto}</span>
    <button onClick={()=>onTimer({proto,exName})}
      style={{background:"#0a1a0a",border:`1px solid #1a3a1a`,borderRadius:3,color:G.green,padding:"2px 7px",fontSize:9,cursor:"pointer",letterSpacing:1,fontWeight:700}}>
      ▶ TIMER
    </button>
  </div>
);
const ProtoTagAcc = ({proto,exName,onTimer}) => (
  <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
    {proto&&<span style={{fontSize:10,color:G.blue,background:"#051525",borderRadius:3,padding:"2px 7px",fontWeight:700,letterSpacing:1}}>{proto}</span>}
    {proto&&<button onClick={()=>onTimer({proto,exName})}
      style={{background:"#0a1a0a",border:`1px solid #1a3a1a`,borderRadius:3,color:G.green,padding:"2px 7px",fontSize:9,cursor:"pointer",letterSpacing:1,fontWeight:700}}>
      ▶
    </button>}
  </div>
);

// ── Main Lift Block ───────────────────────────────────────────────────────────
function MainBlock({ex,rms,unit,sid,onLog,logs,onTimer}) {
  const [logged,setLogged] = useState(!!(logs[sid]?.[ex.name]?.length));
  if (!ex.pat) return null;
  const rm=parseFloat(rms[ex.name]),valid=!!(rm&&!isNaN(rm)&&rm>0);
  const isPRWeek = ex.pat.tl==="94-102%";
  const topPct = isPRWeek ? 0.98 : ex.pat.tp;
  const top=valid?r25(rm*topPct):null;
  const W=top?[r25(top*0.70),r25(top*0.85),top,r25(top*0.88),r25(top*0.82)]:[null,null,null,null,null];
  const rp2=ex.pat.reps;
  const ROWS=[
    {ro:"i",  lb:"Warm-up 1", reps:rp2[0],w:W[0],tag:"70% of top",  isTop:false},
    {ro:"ii", lb:"Warm-up 2", reps:rp2[1],w:W[1],tag:"85% of top",  isTop:false},
    {ro:"iii",lb:"Top Set",   reps:rp2[2],w:W[2],tag:`${ex.pat.tl} 1RM`,isTop:true},
    {ro:"iv", lb:"Back-off 1",reps:rp2[3],w:W[3],tag:"−12% of top", isTop:false},
    {ro:"v",  lb:"Back-off 2",reps:rp2[4],w:W[4],tag:"−18% of top", isTop:false},
  ];
  return (
    <div style={{border:`1px solid ${G.border}`,borderRadius:8,overflow:"hidden"}}>
      <div style={{background:"#100d00",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <span style={{fontWeight:800,fontSize:14,color:G.gold,letterSpacing:1}}>{ex.name}</span>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {top
            ?<span style={{fontSize:10,color:G.muted,background:"#0a0a0a",borderRadius:3,padding:"2px 8px"}}>Top: {top} {unit}</span>
            :<span style={{fontSize:10,color:G.muted,background:"#0a0a0a",borderRadius:3,padding:"2px 8px"}}>Set 1RM in Profile</span>
          }
          <ProtoTag proto={ex.proto} exName={ex.name} onTimer={onTimer}/>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",background:"#0c0c0c",padding:"6px 14px"}}>
        <div style={{width:24,flexShrink:0}}/>
        <div style={{flex:"1 1 auto",fontSize:9,color:"#333",fontWeight:700,letterSpacing:1}}>SET</div>
        <div style={{width:34,textAlign:"center",fontSize:9,color:"#333",fontWeight:700,flexShrink:0}}>REPS</div>
        <div style={{width:96,textAlign:"center",fontSize:9,color:"#333",fontWeight:700,letterSpacing:1,flexShrink:0}}>LOADING</div>
        <div style={{width:72,textAlign:"right",fontSize:9,color:G.gold,fontWeight:700,letterSpacing:1,flexShrink:0}}>WEIGHT</div>
      </div>
      {ROWS.map(row=>(
        <div key={row.ro} style={{display:"flex",alignItems:"center",borderTop:`1px solid ${G.border}`,padding:"9px 14px",background:row.isTop?"#0d0b00":"transparent"}}>
          <div style={{width:24,flexShrink:0}}><span style={{fontSize:10,color:G.gold,fontWeight:700}}>{row.ro}</span></div>
          <div style={{flex:"1 1 auto",fontSize:12,color:row.isTop?G.gold:G.muted,fontWeight:row.isTop?700:400}}>{row.lb}</div>
          <div style={{width:34,textAlign:"center",fontSize:15,fontWeight:900,color:row.isTop?G.gold:G.text,flexShrink:0}}>{row.reps}</div>
          <div style={{width:96,textAlign:"center",fontSize:10,color:"#444",flexShrink:0}}>{row.tag}</div>
          <div style={{width:72,textAlign:"right",flexShrink:0,fontSize:row.isTop?17:13,fontWeight:row.isTop?900:600,color:row.isTop?G.gold:G.text}}>
            {row.w!=null?<>{row.w}<span style={{fontSize:9,color:G.muted,fontWeight:400,marginLeft:3}}>{unit}</span></>:<span style={{color:"#2a2a2a"}}>--</span>}
          </div>
        </div>
      ))}
      <div style={{padding:"9px 14px",borderTop:`1px solid ${G.border}`,background:"#0c0c0c"}}>
        {top
          ?<button onClick={()=>{onLog(sid,ex.name,{topWeight:top});setLogged(true);}} disabled={logged}
            style={{padding:"6px 14px",background:logged?"#0a200a":"#0f0f0f",border:logged?`1px solid ${G.green}40`:`1px solid ${G.border}`,
              borderRadius:4,color:logged?G.green:G.muted,fontSize:10,fontWeight:700,letterSpacing:2,cursor:logged?"default":"pointer"}}>
            {logged?"✓ TOP SET LOGGED":"+ LOG TOP SET"}
          </button>
          :<span style={{fontSize:10,color:"#2a2a2a"}}>Set your 1RM in Profile to log weights</span>
        }
      </div>
    </div>
  );
}

// ── RPE Block ─────────────────────────────────────────────────────────────────
function RpeBlock({ex,sid,accLogs,setAccLog,unit,onTimer,nested=false}) {
  const exLogs=(accLogs[sid]||{})[ex.name]||{};
  return (
    <div style={{border:nested?"none":`1px solid #1a3050`,borderRadius:nested?0:8,overflow:"hidden"}}>
      <div style={{background:nested?"#040d18":"#060e1a",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:800,fontSize:14,color:G.blue,letterSpacing:1}}>{ex.name}</span>
        {ex.proto&&<ProtoTagAcc proto={ex.proto} exName={ex.name} onTimer={onTimer}/>}
      </div>
      <div style={{display:"flex",alignItems:"center",background:"#04090f",padding:"5px 14px"}}>
        <div style={{width:24,flexShrink:0}}/>
        <div style={{flex:"1 1 auto",fontSize:9,color:"#1a3050",fontWeight:700,letterSpacing:1}}>SET</div>
        <div style={{width:34,textAlign:"center",fontSize:9,color:"#1a3050",fontWeight:700,flexShrink:0}}>REPS</div>
        <div style={{width:82,textAlign:"center",fontSize:9,color:"#1a3050",fontWeight:700,letterSpacing:1,flexShrink:0}}>RPE</div>
        <div style={{width:80,textAlign:"right",fontSize:9,color:G.blue,fontWeight:700,letterSpacing:1,flexShrink:0}}>WEIGHT</div>
      </div>
      {ex.sets.map((set,i)=>{
        const wt=exLogs[i]||"";
        return (
          <div key={i} style={{display:"flex",alignItems:"center",padding:"9px 14px",borderTop:`1px solid #0a1a2a`}}>
            <div style={{width:24,flexShrink:0}}><span style={{fontSize:10,color:G.blue,fontWeight:700}}>{i+1}</span></div>
            <div style={{flex:"1 1 auto",fontSize:12,color:G.muted,fontWeight:400}}>{set.n>1?`${set.n}×`:""}{set.reps} reps</div>
            <div style={{width:34,textAlign:"center",fontSize:13,fontWeight:800,color:G.text,flexShrink:0}}>{set.reps}</div>
            <div style={{width:82,textAlign:"center",flexShrink:0}}>
              {set.rpe!=null
                ?<span style={{fontSize:11,fontWeight:800,color:rpeClr(set.rpe),background:`${rpeClr(set.rpe)}18`,borderRadius:3,padding:"2px 8px"}}>RPE {set.rpe}</span>
                :<span style={{fontSize:10,color:G.purple,fontStyle:"italic",whiteSpace:"nowrap"}}>{set.note||"= prev"}</span>
              }
            </div>
            <div style={{width:80,textAlign:"right",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:3}}>
                <input type="number" value={wt} onChange={e=>setAccLog(sid,ex.name,i,e.target.value)}
                  style={{width:46,background:"#0a1a0a",border:`1px solid #1a2a1a`,borderRadius:4,
                    color:G.text,padding:"4px 6px",fontSize:12,outline:"none",textAlign:"center"}}/>
                <span style={{fontSize:9,color:G.muted,flexShrink:0}}>{unit}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Superset Block ────────────────────────────────────────────────────────────
function SupersetBlock({ex,sid,accLogs,setAccLog,unit,onTimer}) {
  return (
    <div style={{border:`1px solid #4c1d9540`,borderRadius:8,overflow:"hidden"}}>
      <div style={{background:"#0a0614",padding:"7px 14px",borderBottom:"1px solid #1e1040",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:9,color:G.purple,fontWeight:900,letterSpacing:2,background:"#1a0a2a",borderRadius:3,padding:"2px 8px"}}>SUPERSET</span>
        <span style={{fontSize:10,color:"#6d28d9"}}>{ex.exA.name} + {ex.exB.name}</span>
      </div>
      <RpeBlock ex={ex.exA} sid={sid} accLogs={accLogs} setAccLog={setAccLog} unit={unit} onTimer={onTimer} nested/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"4px",background:"#060310",borderTop:"1px solid #1e1040",borderBottom:"1px solid #1e1040"}}>
        <span style={{fontSize:9,color:"#3d1a6d",fontWeight:700,letterSpacing:2}}>⟷ SUPERSET ⟷</span>
      </div>
      <RpeBlock ex={ex.exB} sid={sid} accLogs={accLogs} setAccLog={setAccLog} unit={unit} onTimer={onTimer} nested/>
    </div>
  );
}

// ── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({s,rms,unit,completed,onToggle,onClose,onLog,logs,accLogs,setAccLog,onTimer}) {
  const isDone=completed.has(s.id),fc=FC[s.focus]||G.gold,isPR=s.id>=15;
  const mainEx=s.exercises.filter(e=>e.type==="main");
  const accEx=s.exercises.filter(e=>e.type!=="main");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(4,4,4,0.97)",zIndex:200,overflowY:"auto",padding:"12px 10px"}}>
      <div style={{maxWidth:580,margin:"0 auto",background:G.card,borderRadius:12,border:`1px solid ${G.border}`,overflow:"hidden"}}>
        <div style={{background:G.card2,padding:"14px 16px",borderBottom:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{background:G.gold,color:G.black,borderRadius:3,padding:"2px 9px",fontWeight:900,fontSize:11,letterSpacing:1}}>S{s.id}</span>
            <span style={{fontWeight:800,fontSize:15,color:G.text}}>{s.day}</span>
            <span style={{fontSize:11,color:fc,fontWeight:700,background:`${fc}18`,padding:"2px 10px",borderRadius:12,border:`1px solid ${fc}30`}}>{s.focus}</span>
          </div>
          <button onClick={onClose} style={{background:"#111",border:`1px solid ${G.border}`,borderRadius:6,color:G.muted,padding:"6px 12px",fontSize:11,cursor:"pointer"}}>✕</button>
        </div>
        {isPR&&<div style={{background:"#100a00",padding:"9px 16px",borderBottom:`1px solid ${G.gold}30`}}>
          <span style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:2}}>🏆 PR WEEK -- Leave everything in the tank</span>
        </div>}
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
          {mainEx.length>0&&(
            <div>
              <SH color={G.gold}>MAIN LIFTS</SH>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {mainEx.map((ex,i)=><MainBlock key={i} ex={ex} rms={rms} unit={unit} sid={s.id} onLog={onLog} logs={logs} onTimer={onTimer}/>)}
              </div>
            </div>
          )}
          {accEx.length>0&&(
            <div>
              <SH color={G.blue}>ACCESSORY WORK</SH>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {accEx.map((ex,i)=>ex.type==="superset"
                  ?<SupersetBlock key={i} ex={ex} sid={s.id} accLogs={accLogs} setAccLog={setAccLog} unit={unit} onTimer={onTimer}/>
                  :<RpeBlock key={i} ex={ex} sid={s.id} accLogs={accLogs} setAccLog={setAccLog} unit={unit} onTimer={onTimer}/>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{padding:"12px 16px",borderTop:`1px solid ${G.border}`}}>
          <button onClick={onToggle}
            style={{width:"100%",padding:13,background:isDone?"#0a2a0a":"#1a1000",
              border:isDone?`1px solid ${G.green}40`:`1px solid ${G.gold}40`,
              borderRadius:8,color:isDone?G.green:G.gold,fontWeight:800,fontSize:12,letterSpacing:2,cursor:"pointer"}}>
            {isDone?"✓ SESSION COMPLETE":"MARK AS COMPLETE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EMOM Timer ────────────────────────────────────────────────────────────────
function EMOMTimer({proto,exName,onClose}) {
  const totalSecs=parseMins(proto)*60;
  const [rounds,setRounds]   = useState(6);
  const [round,setRound]     = useState(1);
  const [secs,setSecs]       = useState(totalSecs);
  const [running,setRunning] = useState(false);
  const [flash,setFlash]     = useState(false);
  const [done,setDone]       = useState(false);
  const [minimized,setMinimized] = useState(false);
  const roundsRef = useRef(rounds); roundsRef.current=rounds;

  useEffect(()=>{
    if (!running) return;
    const id=setInterval(()=>{
      setSecs(prev=>{
        if (prev<=1) {
          setFlash(true); setTimeout(()=>setFlash(false),800);
          setRound(r=>{ if(r>=roundsRef.current){setRunning(false);setDone(true);return r;} return r+1; });
          return totalSecs;
        }
        return prev-1;
      });
    },1000);
    return ()=>clearInterval(id);
  },[running,totalSecs]);

  const reset=()=>{setRunning(false);setRound(1);setSecs(totalSecs);setDone(false);};
  const mm=String(Math.floor(secs/60)).padStart(2,"0"),ss2=String(secs%60).padStart(2,"0");
  const pct=(totalSecs-secs)/totalSecs;
  const timeColor=secs>totalSecs*0.6?G.green:secs>totalSecs*0.3?G.yellow:G.red;
  const R_sm=18,C_sm=2*Math.PI*R_sm;

  return (
    <div style={{position:"fixed",bottom:80,right:12,zIndex:400,background:flash?"#060d06":G.card,
      border:`1px solid ${flash?G.green:G.border}`,borderRadius:12,minWidth:200,maxWidth:260,
      boxShadow:"0 8px 32px rgba(0,0,0,0.8)",transition:"background 0.2s,border-color 0.2s"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"#0a0a0a",borderRadius:"12px 12px 0 0",borderBottom:`1px solid ${G.border}`}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:9,color:G.gold,fontWeight:800,letterSpacing:2}}>{proto}</div>
          {!minimized&&<div style={{fontSize:11,fontWeight:700,color:G.text,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{exName}</div>}
        </div>
        <button onClick={()=>setMinimized(m=>!m)} style={{background:"#111",border:`1px solid ${G.border}`,borderRadius:4,color:G.muted,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>
          {minimized?"↕":"−"}
        </button>
        <button onClick={onClose} style={{background:"#1a0808",border:`1px solid ${G.red}40`,borderRadius:4,color:G.red,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>✕</button>
      </div>
      {minimized&&(
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px"}}>
          <svg width={42} height={42} style={{flexShrink:0}}>
            <circle cx={21} cy={21} r={R_sm} fill="none" stroke="#1a1a1a" strokeWidth={4}/>
            <circle cx={21} cy={21} r={R_sm} fill="none" stroke={timeColor} strokeWidth={4}
              strokeDasharray={C_sm} strokeDashoffset={C_sm*(1-pct)} strokeLinecap="round"
              style={{transform:"rotate(-90deg)",transformOrigin:"21px 21px",transition:"stroke-dashoffset 0.9s linear"}}/>
            <text x={21} y={26} textAnchor="middle" fontSize={10} fontWeight={900} fill={timeColor}>{round}</text>
          </svg>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:900,color:timeColor}}>{mm}:{ss2}</div>
            <div style={{fontSize:9,color:G.muted}}>R {round}/{rounds}</div>
          </div>
          <button onClick={()=>done?reset():setRunning(r=>!r)}
            style={{background:done?G.gold:running?"#3a0808":"#0a2a0a",border:"none",borderRadius:6,color:done?G.black:G.green,padding:"6px 10px",fontSize:14,cursor:"pointer"}}>
            {done?"↺":running?"⏸":"▶"}
          </button>
        </div>
      )}
      {!minimized&&(
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
              {(()=>{const R=34,C=2*Math.PI*R;return(
                <svg width={80} height={80}>
                  <circle cx={40} cy={40} r={R} fill="none" stroke="#1a1a1a" strokeWidth={7}/>
                  <circle cx={40} cy={40} r={R} fill="none" stroke={timeColor} strokeWidth={7}
                    strokeDasharray={C} strokeDashoffset={C*(1-pct)} strokeLinecap="round"
                    style={{transform:"rotate(-90deg)",transformOrigin:"40px 40px",transition:"stroke-dashoffset 0.9s linear"}}/>
                </svg>
              );})()}
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:timeColor,lineHeight:1,letterSpacing:-1}}>{mm}:{ss2}</div>
              </div>
            </div>
            <div style={{flex:1}}>
              {done?<div style={{fontSize:13,color:G.green,fontWeight:800}}>🏆 Done!</div>
                :<div style={{fontSize:13,color:G.muted}}>Round <span style={{color:G.text,fontWeight:900}}>{round}</span> of {rounds}</div>}
              <div style={{fontSize:10,color:"#2a2a2a",marginTop:4}}>{parseMins(proto)} min · {proto}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,background:"#0a0a0a",borderRadius:6,padding:"8px 10px"}}>
            <span style={{fontSize:9,color:G.muted,letterSpacing:2,flex:1}}>ROUNDS</span>
            {[[-1,"−"],[1,"+"]].map(([d,l],i)=>(
              <button key={i} onClick={()=>{if(!running)setRounds(r=>Math.max(1,Math.min(30,r+d)));}}
                style={{width:26,height:26,borderRadius:"50%",background:"#111",border:`1px solid ${G.border}`,
                  color:G.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {l}
              </button>
            ))}
            <span style={{fontSize:18,fontWeight:900,color:G.text,width:28,textAlign:"center"}}>{rounds}</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={reset} style={{flex:1,padding:"9px",background:"#111",border:`1px solid ${G.border}`,borderRadius:6,color:G.muted,fontSize:10,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
              RESET
            </button>
            <button onClick={()=>done?reset():setRunning(r=>!r)}
              style={{flex:3,padding:"9px",background:done?G.gold:running?"#2a0808":"#0a2a0a",
                border:"none",borderRadius:6,color:done?G.black:running?G.red:G.green,
                fontWeight:800,fontSize:11,letterSpacing:2,cursor:"pointer"}}>
              {done?"START OVER":running?"⏸ PAUSE":"▶ START"}
            </button>
          </div>
          {flash&&<div style={{marginTop:8,textAlign:"center",fontSize:10,color:G.green,fontWeight:800,letterSpacing:2}}>NEXT ROUND ▶</div>}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [profile,setProfile]     = useState(null);
  const [tab,setTab]             = useState("home");
  const [rms,setRms]             = useState({});
  const [unit,setUnit]           = useState("lbs");
  const [completed,setCompleted] = useState(new Set());
  const [activeWeek,setActiveWeek] = useState(1);
  const [modal,setModal]         = useState(null);
  const [logs,setLogs]           = useState({});
  const [accLogs,setAccLogs]     = useState({});
  const [mevSel,setMevSel]       = useState({});
  const [timer,setTimer]         = useState(null);
  const saveRef = useRef(false);

  useEffect(()=>{
    if (!profile||!saveRef.current) { saveRef.current=true; return; }
    ST.saveProgress(profile.id, completed, logs, accLogs, rms);
  },[completed,logs,accLogs,rms]);

  const handleLogin = d => {
    setProfile({id:d.id,name:d.name,email:d.email});
    setMevSel(d.mev||{}); setUnit(d.unit||"lbs"); setRms(d.rms||{});
    setCompleted(d.completed instanceof Set?d.completed:new Set(d.completed||[]));
    setLogs(d.logs||{}); setAccLogs(d.accLogs||{}); saveRef.current=false;
  };

  if (!profile) return <Onboarding onComplete={handleLogin}/>;

  const volScore = Object.values(mevSel).reduce((s,v)=>s+(v||0),0);
  const toggleDone = id => setCompleted(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const addLog = (sid,exName,entry) => setLogs(p=>({...p,[sid]:{...(p[sid]||{}),[exName]:[...((p[sid]||{})[exName]||[]),entry]}}));
  const setAccLog = (sid,exName,si,wt) => setAccLogs(p=>({...p,[sid]:{...(p[sid]||{}),[exName]:{...((p[sid]||{})[exName]||{}),[si]:wt}}}));
  const nextSession = PROGRAM.flatMap(w=>w.sessions).find(s=>!completed.has(s.id));
  const weekData = PROGRAM.find(w=>w.week===activeWeek);
  const NAV = [{id:"home",icon:"⊞",label:"Home"},{id:"program",icon:"📋",label:"Program"},{id:"volume",icon:"📊",label:"Volume"},{id:"progress",icon:"📈",label:"Progress"},{id:"profile",icon:"⚙",label:"Profile"}];
  const cardStyle = {background:G.card,border:`1px solid ${G.border}`,borderRadius:10};
  const card2Style = {background:G.card2,border:`1px solid ${G.border2}`,borderRadius:10};

  return (
    <div style={{minHeight:"100vh",background:G.black,color:G.text,fontFamily:"system-ui,sans-serif",paddingBottom:72}}>
      <div style={{height:3,background:goldGrad,position:"sticky",top:0,zIndex:51}}/>
      <header style={{background:"rgba(8,8,8,0.97)",borderBottom:`1px solid ${G.border}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:3,zIndex:50}}>
        <Logo size="sm"/>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:9,color:G.muted,letterSpacing:1}}>ATHLETE</div>
          <div style={{fontSize:13,fontWeight:800,color:G.gold,letterSpacing:1}}>{profile.name}</div>
        </div>
      </header>

      <main style={{maxWidth:680,margin:"0 auto",padding:"16px 14px"}}>
        {/* HOME */}
        {tab==="home"&&(
          <div>
            <div style={{...cardStyle,padding:16,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:10,color:G.muted,letterSpacing:2}}>PROGRAM PROGRESS</span>
                <span style={{fontSize:12,color:G.gold,fontWeight:800}}>{completed.size}/16 SESSIONS</span>
              </div>
              <div style={{background:"#1a1a1a",borderRadius:99,height:4,marginBottom:14}}>
                <div style={{background:goldGrad,borderRadius:99,height:4,width:`${(completed.size/16)*100}%`,transition:"width 0.4s"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {PROGRAM.map(w=>{const wd=w.sessions.filter(s=>completed.has(s.id)).length;return(
                  <div key={w.week} style={{textAlign:"center",background:"#0a0a0a",borderRadius:8,padding:"10px 4px"}}>
                    <div style={{fontSize:18,fontWeight:900,color:wd===4?G.green:wd>0?G.gold:"#2a2a2a"}}>{wd}/4</div>
                    <div style={{fontSize:9,color:G.muted,letterSpacing:1}}>WK {w.week}</div>
                    <div style={{fontSize:8,color:"#2a2a2a",marginTop:2}}>{w.theme}</div>
                  </div>
                );})}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
              {[["Done",completed.size],["Left",16-completed.size],["Week",Math.min(4,Math.ceil(completed.size/4)+1)]].map(([l,v])=>(
                <div key={l} style={{...cardStyle,padding:"14px 8px",textAlign:"center"}}>
                  <div style={{fontSize:28,fontWeight:900,color:G.gold,fontFamily:"Georgia,serif"}}>{v}</div>
                  <div style={{fontSize:9,color:G.muted,letterSpacing:2}}>{l.toUpperCase()}</div>
                </div>
              ))}
            </div>
            {nextSession&&(
              <div style={{marginBottom:18}}>
                <div style={{fontSize:10,color:G.gold,fontWeight:800,letterSpacing:3,marginBottom:8}}>NEXT SESSION</div>
                <div onClick={()=>setModal(nextSession)}
                  style={{...cardStyle,padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${G.gold}30`}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:G.text}}>Session {nextSession.id} -- {nextSession.day}</div>
                    <div style={{fontSize:11,color:FC[nextSession.focus]||G.gold,marginTop:4,letterSpacing:1}}>{nextSession.focus}</div>
                    <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                      {flatEx(nextSession.exercises).map((e,i)=>(
                        <span key={i} style={{fontSize:10,color:e.type==="main"?G.gold:G.blue,background:e.type==="main"?"#1a1000":"#051020",borderRadius:3,padding:"2px 7px"}}>{e.name}</span>
                      ))}
                    </div>
                  </div>
                  <span style={{fontSize:22,color:G.gold,flexShrink:0,marginLeft:10}}>▶</span>
                </div>
              </div>
            )}
            {completed.size===16&&(
              <div style={{...cardStyle,padding:24,textAlign:"center",border:`1px solid ${G.green}40`,marginBottom:18}}>
                <div style={{fontSize:40,marginBottom:8}}>🏆</div>
                <div style={{fontSize:18,fontWeight:900,color:G.green,letterSpacing:2}}>PROGRAM COMPLETE</div>
                <div style={{fontSize:11,color:G.muted,marginTop:6}}>You've peaked. Go hit those PRs.</div>
              </div>
            )}
            <div>
              <div style={{fontSize:10,color:G.gold,fontWeight:800,letterSpacing:3,marginBottom:8}}>1RM BOARD</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                {LIFTS.map(l=>(
                  <div key={l} style={{...card2Style,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,color:G.muted}}>{l}</span>
                    <span style={{fontSize:14,fontWeight:800,color:rms[l]?G.gold:"#2a2a2a"}}>{rms[l]||"--"} <span style={{fontSize:9,color:G.muted}}>{rms[l]?unit:""}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROGRAM */}
        {tab==="program"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {PROGRAM.map(w=>{const wd=w.sessions.filter(s=>completed.has(s.id)).length,act=activeWeek===w.week;return(
                <button key={w.week} onClick={()=>setActiveWeek(w.week)}
                  style={{flex:1,padding:"10px 4px",borderRadius:8,border:act?`1px solid ${G.gold}`:`1px solid ${G.border}`,
                    background:act?"#1a1000":"#0a0a0a",color:act?G.gold:G.muted,cursor:"pointer"}}>
                  <div style={{fontWeight:900,fontSize:13,letterSpacing:1}}>WK {w.week}</div>
                  <div style={{fontSize:10,color:act?G.goldDim:"#2a2a2a",marginTop:2}}>{wd}/4</div>
                </button>
              );})}
            </div>
            <div style={{padding:"8px 14px",background:"#0c0900",borderLeft:`3px solid ${G.gold}`,borderRadius:"0 4px 4px 0",marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:11,color:G.gold,fontWeight:800,letterSpacing:2}}>WEEK {activeWeek} -- {weekData.theme.toUpperCase()}</span>
              <span style={{fontSize:11,color:G.muted}}>{weekData.range}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {weekData.sessions.map(s=>{
                const isDone=completed.has(s.id),fc=FC[s.focus]||G.gold;
                const mainEx=s.exercises.filter(e=>e.type==="main"),accEx=s.exercises.filter(e=>e.type!=="main");
                return(
                  <div key={s.id} style={{...cardStyle,padding:"13px 14px",border:isDone?`1px solid ${G.green}30`:undefined}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                          <span style={{background:G.gold,color:G.black,borderRadius:3,padding:"2px 7px",fontWeight:900,fontSize:10}}>S{s.id}</span>
                          <span style={{fontWeight:800,fontSize:14,color:G.text}}>{s.day}</span>
                          <span style={{fontSize:10,fontWeight:700,color:fc,background:`${fc}18`,padding:"2px 8px",borderRadius:12}}>{s.focus}</span>
                          {isDone&&<span style={{fontSize:10,color:G.green,fontWeight:700}}>✓ DONE</span>}
                        </div>
                        {mainEx.length>0&&<div style={{marginBottom:8}}>
                          <div style={{fontSize:8,color:G.goldDim,letterSpacing:2,fontWeight:700,marginBottom:5}}>MAIN LIFTS</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {mainEx.map((e,i)=><span key={i} style={{fontSize:11,color:G.gold,background:"#1a1000",borderRadius:3,padding:"2px 8px"}}>{e.name}</span>)}
                          </div>
                        </div>}
                        {accEx.length>0&&<div>
                          <div style={{fontSize:8,color:"#1a3060",letterSpacing:2,fontWeight:700,marginBottom:5}}>ACCESSORY</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {accEx.map((e,i)=>e.type==="superset"
                              ?<span key={i} style={{fontSize:11,color:G.purple,background:"#0a0614",borderRadius:3,padding:"2px 8px"}}>{e.exA.name}+{e.exB.name}</span>
                              :<span key={i} style={{fontSize:11,color:G.blue,background:"#050d1a",borderRadius:3,padding:"2px 8px"}}>{e.name}</span>
                            )}
                          </div>
                        </div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                        <button onClick={()=>setModal(s)}
                          style={{background:"#111",border:`1px solid ${G.border}`,borderRadius:6,color:G.gold,padding:"7px 12px",fontSize:10,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
                          VIEW
                        </button>
                        <button onClick={()=>toggleDone(s.id)}
                          style={{background:isDone?"#0a200a":"#0a0a0a",border:isDone?`1px solid ${G.green}40`:`1px solid ${G.border}`,
                            borderRadius:6,color:isDone?G.green:G.muted,padding:"7px 12px",fontSize:10,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
                          {isDone?"✓":"DONE?"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VOLUME */}
        {tab==="volume"&&<VolumeTab weekData={weekData} activeWeek={activeWeek} setActiveWeek={setActiveWeek} volScore={volScore}/>}

        {/* PROGRESS */}
        {tab==="progress"&&(
          <div>
            <div style={{fontSize:10,color:G.muted,marginBottom:14,letterSpacing:3}}>COMPLETED SESSIONS</div>
            {completed.size===0?(
              <div style={{textAlign:"center",padding:"50px 20px",color:"#2a2a2a"}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <div style={{fontSize:14,fontWeight:700,color:G.muted}}>No sessions completed yet</div>
              </div>
            ):PROGRAM.map(w=>{
              const ws=w.sessions.filter(s=>completed.has(s.id));
              if (!ws.length) return null;
              return(
                <div key={w.week} style={{marginBottom:20}}>
                  <div style={{fontSize:10,color:G.gold,fontWeight:800,letterSpacing:3,marginBottom:10}}>
                    WEEK {w.week} -- {w.theme.toUpperCase()}
                  </div>
                  {ws.map(s=>{
                    const fc=FC[s.focus]||G.gold,sl=logs[s.id],al=accLogs[s.id];
                    return(
                      <div key={s.id} style={{background:G.card,borderRadius:8,border:`1px solid ${G.green}20`,marginBottom:8}}>
                        <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:G.text}}>Session {s.id} -- {s.day}</div>
                            <div style={{fontSize:11,color:fc,marginTop:2,letterSpacing:1}}>{s.focus}</div>
                          </div>
                          <span style={{color:G.green,fontSize:20}}>✓</span>
                        </div>
                        {((sl&&Object.keys(sl).length)||(al&&Object.keys(al).length))?(
                          <div style={{padding:"8px 14px",borderTop:`1px solid ${G.border}`,background:"#0a0a0a"}}>
                            {sl&&Object.entries(sl).map(([en,entries])=>(
                              <div key={en} style={{marginBottom:6}}>
                                <div style={{fontSize:10,color:G.gold,fontWeight:700,marginBottom:3}}>{en}</div>
                                {entries.map((e,i)=><div key={i} style={{fontSize:11,color:G.text}}>Top: {e.topWeight} {unit}</div>)}
                              </div>
                            ))}
                            {al&&Object.entries(al).map(([en,sets])=>{
                              const weights=Object.values(sets).filter(Boolean);
                              if (!weights.length) return null;
                              return <div key={en} style={{marginBottom:6}}><div style={{fontSize:10,color:G.blue,fontWeight:700,marginBottom:3}}>{en}</div><div style={{fontSize:11,color:G.muted}}>{weights.join(", ")} {unit}</div></div>;
                            })}
                          </div>
                        ):null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* PROFILE */}
        {tab==="profile"&&(
          <div>
            <div style={{...cardStyle,padding:"20px 16px",marginBottom:14,textAlign:"center"}}>
              <div style={{width:62,height:62,borderRadius:"50%",background:goldGrad,color:G.black,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,margin:"0 auto 12px"}}>
                {profile.name[0].toUpperCase()}
              </div>
              <div style={{fontWeight:900,fontSize:18,color:G.text,letterSpacing:1}}>{profile.name}</div>
              <div style={{fontSize:11,color:G.blue,marginTop:4}}>{profile.email}</div>
              <div style={{fontSize:9,color:G.muted,letterSpacing:3,marginTop:4}}>PROJECT 4:16 ATHLETE</div>
              <div style={{marginTop:10,fontSize:11,color:G.gold,fontWeight:700}}>{completed.size}/16 sessions completed</div>
            </div>
            <div style={{...cardStyle,padding:"14px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:G.text}}>Weight Unit</span>
              <div style={{display:"flex",background:"#0a0a0a",borderRadius:6,overflow:"hidden"}}>
                {["lbs","kg"].map(u=>(
                  <button key={u} onClick={()=>setUnit(u)}
                    style={{padding:"8px 16px",background:unit===u?G.gold:"transparent",color:unit===u?G.black:G.muted,border:"none",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{...cardStyle,padding:16,marginBottom:14}}>
              <div style={{fontSize:10,color:G.gold,fontWeight:800,letterSpacing:3,marginBottom:14}}>1RM SETTINGS</div>
              {LIFTS.map(l=>{const rm=parseFloat(rms[l]);return(
                <div key={l} style={{marginBottom:14}}>
                  <label style={{fontSize:10,color:G.muted,display:"block",marginBottom:5,letterSpacing:2,fontWeight:700}}>{l.toUpperCase()}</label>
                  <div style={{display:"flex",background:"#111",borderRadius:6,overflow:"hidden",border:`1px solid ${G.border}`}}>
                    <input type="number" value={rms[l]||""} placeholder="Enter 1RM..."
                      onChange={e=>setRms(p=>({...p,[l]:e.target.value}))}
                      style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"10px 12px",fontSize:13,outline:"none"}}/>
                    <span style={{padding:"0 14px",color:G.muted,fontSize:12,display:"flex",alignItems:"center"}}>{unit}</span>
                  </div>
                  {rm>0&&<div style={{marginTop:7,display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[[0.70,"70%"],[0.85,"85%"],[0.88,"88%"],[0.91,"91%"]].map(([p,lbl])=>(
                      <span key={lbl} style={{fontSize:10,color:G.muted,background:"#0f0f0f",border:`1px solid ${G.border}`,borderRadius:3,padding:"3px 8px"}}>
                        <span style={{color:G.gold,fontWeight:700}}>{r25(rm*p)}</span> @ {lbl}
                      </span>
                    ))}
                  </div>}
                </div>
              );})}
            </div>
            <div style={{...cardStyle,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:10,color:G.gold,fontWeight:800,letterSpacing:3}}>MEV/MRV FACTORS</div>
                <div style={{fontSize:12,fontWeight:800,color:volScore>0?G.green:volScore<0?G.red:G.gold}}>{volScore>0?"+":""}{volScore}</div>
              </div>
              {MEV_FACTORS.map(f=><FRow key={f.key} f={f} mev={mevSel} tog={(k,v)=>setMevSel(p=>({...p,[k]:p[k]===v?undefined:v}))}/>)}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(8,8,8,0.97)",borderTop:`1px solid ${G.border}`,display:"flex",zIndex:50}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:goldGrad,opacity:0.4}}/>
        {NAV.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:"10px 4px",background:"transparent",border:"none",
              color:tab===t.id?G.gold:G.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span style={{fontSize:8,fontWeight:tab===t.id?800:400,letterSpacing:1}}>{t.label.toUpperCase()}</span>
          </button>
        ))}
      </nav>

      {modal&&<SessionModal s={modal} rms={rms} unit={unit} completed={completed}
        onToggle={()=>toggleDone(modal.id)} onClose={()=>setModal(null)}
        onLog={addLog} logs={logs} accLogs={accLogs} setAccLog={setAccLog} onTimer={setTimer}/>}
      {timer&&<EMOMTimer proto={timer.proto} exName={timer.exName} onClose={()=>setTimer(null)}/>}
    </div>
  );
}
