import { supabase } from './supabaseClient';
import { useState, useEffect, useRef } from "react";

// ── Google Fonts ───────────────────────────────────────────────────────────────
const FONTS = "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@300;400;600;700;800;900&display=swap');";
if (typeof document !== 'undefined' && !document.getElementById('p416-fonts')) {
  const s = document.createElement('style'); s.id='p416-fonts'; s.textContent=FONTS; document.head.appendChild(s);
}

// ── Design Tokens ─────────────────────────────────────────────────────────────
const G = {
  gold:"#c8a951", goldLt:"#e5cc7a", goldDim:"#7a6520",
  black:"#080808", card:"#0f0f0f", card2:"#141414",
  border:"#242010", border2:"#1e1e1e", text:"#f0ead8", muted:"#4a4030",
  blue:"#c8a951", purple:"#7a6520", green:"#c8a951", red:"#ef4444", yellow:"#eab308",
};
const goldGrad = `linear-gradient(90deg, ${G.gold}, ${G.goldLt}, ${G.gold})`;
const F = { display:"'Bebas Neue', sans-serif", body:"'Montserrat', sans-serif" };

// ── Utils ─────────────────────────────────────────────────────────────────────
const r25 = (w, unit) => unit === 'kg' ? Math.round(w / 2.5) * 2.5 : Math.round(w / 5) * 5;
const rpeClr = v => v >= 10 ? G.red : v >= 8 ? "#f97316" : v >= 6 ? G.yellow : G.gold;
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
// MEV numeric calc helpers
const calcWeightMev = (lbs) => {
  if (!lbs) return 0;
  const kg = lbs; // stored as lbs
  return kg > 250 ? -4 : kg > 185 ? -2 : 0;
};
const calcHeightMev = (inches) => {
  if (!inches) return 0;
  return inches > 76 ? -2 : inches > 68 ? -1 : 0;
};
const calcAgeMev = (age) => {
  if (!age) return 0;
  const a = parseInt(age);
  return a >= 50 ? -4 : a >= 40 ? -2 : a >= 30 ? 0 : 1;
};
const calcExpMev = (years) => {
  if (!years) return 0;
  const y = parseFloat(years);
  return y >= 12 ? -2 : y >= 8 ? -1 : y >= 4 ? 0 : 2;
};

const MEV_FACTORS = [
  {key:"sex",   label:"Sex",         opts:[{l:"Male",v:0},{l:"Female",v:5}]},
  {key:"str",   label:"Strength",    opts:[{l:"Very High",v:-3},{l:"High",v:-1},{l:"Medium",v:0},{l:"Low",v:1}]},
  {key:"diet",  label:"Diet",        opts:[{l:"Poor",v:-3},{l:"Average",v:0},{l:"Good",v:1}]},
  {key:"sleep", label:"Sleep",       opts:[{l:"<5 hrs",v:-3},{l:"5-7 hrs",v:0},{l:"7+ hrs",v:2}]},
  {key:"stress",label:"Stress",      opts:[{l:"High",v:-3},{l:"Average",v:0},{l:"Low",v:1}]},
  {key:"drugs", label:"Drug Use",    opts:[{l:"No",v:0},{l:"Yes (PEDs)",v:3}]},
];
// Numeric fields (weight, height, age, exp) handled separately via FNumeric component
const MEV_NUMERIC = [
  {key:"weight_lbs", label:"Body Weight", unit:"lbs", placeholder:"185", calc:calcWeightMev,
   hint:"<185 lbs = 0 · 185-250 = –2 · 250+ = –4"},
  {key:"height_in",  label:"Height",      unit:"in",  placeholder:"70",  calc:calcHeightMev,
   hint:"<68 in = 0 · 68-76 = –1 · 76+ = –2"},
  {key:"age",        label:"Age",         unit:"yrs", placeholder:"30",  calc:calcAgeMev,
   hint:"20s = +1 · 30s = 0 · 40s = –2 · 50s+ = –4"},
  {key:"exp",        label:"Training Exp",unit:"yrs", placeholder:"5",   calc:calcExpMev,
   hint:"<4 yrs = +2 · 4-8 = 0 · 8-12 = –1 · 12+ = –2"},
];
const calcNumericMevScore = (mev) => {
  return MEV_NUMERIC.reduce((sum, f) => sum + (f.calc(mev[f.key])||0), 0);
};

const P = {
  x3_85:{tp:0.85,tl:"85%",    reps:[3,3,3,6,9]},
  x3_88:{tp:0.88,tl:"88%",    reps:[3,3,3,6,9]},
  x2_88:{tp:0.88,tl:"88%",    reps:[2,2,2,4,6]},
  x2_91:{tp:0.91,tl:"91%",    reps:[2,2,2,4,6]},
  x1_91:{tp:0.91,tl:"91%",    reps:[1,1,1,2,3]},
  x1_PR:{tp:0.98,tl:"94-102%",reps:[1,1,1,2,3]},
};

const LIFTS = ["Hang Clean & Press","Squat","Bench","Deadlift"];
const FC    = {"Upper Body":G.gold,"Lower Body":G.gold,"Full Body":G.goldDim};

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
    return { error:null, user:{ id:uid, email, name, mev, unit, rms, role:'athlete', completed:[], logs:{}, accLogs:{} } };
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
      role:    profile?.role    || 'athlete',
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
    await supabase.from('profiles').upsert({ id: uid, ...updates });
  },
  getAthletes: async () => {
    const { data } = await supabase.from('profiles')
      .select('id, name, unit, rms, mev')
      .eq('role', 'athlete')
      .order('name');
    return data || [];
  },
  getAthleteProgress: async (uid) => {
    const { data } = await supabase.from('progress').select('*').eq('user_id', uid).single();
    return data || {};
  },
};


// ── Shared UI ─────────────────────────────────────────────────────────────────
const FField = ({label,value,onChange,placeholder,type="text"}) => (
  <div style={{marginBottom:14}}>
    <label style={{fontFamily:F.display,fontSize:12,color:G.muted,letterSpacing:3,display:"block",marginBottom:6}}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",boxSizing:"border-box",background:"#0a0a0a",border:`1px solid ${G.border}`,color:G.text,padding:"11px 14px",fontSize:13,outline:"none",fontFamily:F.body}}/>
  </div>
);
const FBtn = ({children,onClick,secondary,disabled}) => (
  <button onClick={onClick} disabled={!!disabled}
    style={{flex:1,padding:"12px 16px",background:disabled?"#1a1a1a":secondary?"transparent":goldGrad,
      color:disabled?"#333":secondary?G.muted:G.black,
      border:secondary?`1px solid ${G.border}`:"none",
      fontFamily:F.display,fontSize:16,letterSpacing:3,cursor:disabled?"not-allowed":"pointer"}}>
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
const FNumeric = ({f, mev, onChange}) => {
  const val = mev[f.key]||"";
  const score = f.calc(val);
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontFamily:F.display,fontSize:12,color:G.muted,letterSpacing:3}}>{f.label.toUpperCase()}</span>
        <span style={{fontFamily:F.display,fontSize:14,color:val?G.gold:G.muted,letterSpacing:1}}>
          {val ? `${score>0?"+":""}${score}` : "—"}
        </span>
      </div>
      <div style={{display:"flex",alignItems:"center",background:"#0a0a0a",border:`1px solid ${G.border}`}}>
        <input type="number" value={val} placeholder={f.placeholder}
          onChange={e=>onChange(f.key, e.target.value)}
          style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"10px 14px",
            fontFamily:F.display,fontSize:24,letterSpacing:2,outline:"none"}}/>
        <span style={{fontFamily:F.display,fontSize:12,color:G.muted,padding:"0 14px",letterSpacing:2}}>{f.unit.toUpperCase()}</span>
      </div>
      <div style={{fontFamily:F.body,fontSize:9,color:G.muted,marginTop:4,opacity:0.7}}>{f.hint}</div>
    </div>
  );
};

const SH = ({children,color}) => (
  <div style={{fontFamily:F.display,fontSize:13,color:color||G.gold,letterSpacing:4,marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${color||G.gold}25`,display:"flex",alignItems:"center",gap:10}}>
    {children}
  </div>
);

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = ({size="lg"}) => {
  const big = size==="lg";
  return (
    <div style={{textAlign:"center",fontFamily:F.body}}>
      <div style={{fontSize:big?9:7,color:G.muted,letterSpacing:big?8:5,fontWeight:700,marginBottom:big?4:2,textTransform:"uppercase"}}>PROJECT</div>
      <div style={{fontFamily:F.display,fontSize:big?72:26,background:goldGrad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",lineHeight:1,letterSpacing:big?3:1}}>
        4:16
      </div>
      <div style={{fontSize:big?8:6,color:G.muted,letterSpacing:big?6:4,fontWeight:700,marginTop:big?4:2,textTransform:"uppercase"}}>LIFTERS ON THE RUN</div>
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

  const mevScore = Object.values(mev).reduce((s,v)=>s+(v||0),0) + calcNumericMevScore(mev);
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

  const card = {background:G.card,border:`1px solid ${G.border}`,borderRadius:0,padding:"24px 20px"};

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 16px",background:G.black,position:"relative",overflow:"hidden"}}>
      <div style={{position:"fixed",inset:0,zIndex:0,background:"repeating-linear-gradient(-45deg,transparent,transparent 3px,rgba(200,169,81,0.02) 3px,rgba(200,169,81,0.02) 6px)"}}/>
      <div style={{position:"fixed",top:"10%",right:"-10%",width:"60vw",height:"60vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(200,169,81,0.06) 0%,transparent 70%)",zIndex:0,pointerEvents:"none"}}/>
      <div style={{position:"fixed",top:0,left:0,right:0,height:4,background:goldGrad,zIndex:10}}/>
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:4,background:goldGrad,zIndex:10}}/>

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
              <div style={{fontFamily:F.display,fontSize:24,color:G.text,marginBottom:4,letterSpacing:3}}>BODY STATS</div>
              <p style={{fontSize:11,color:G.muted,marginBottom:14,lineHeight:1.6}}>Calibrate your MEV/MRV recovery score.</p>
              {MEV_NUMERIC.map(f=><FNumeric key={f.key} f={f} mev={mev} onChange={(k,v)=>setMev(p=>({...p,[k]:v}))}/>)}
              {MEV_FACTORS.slice(0,2).map(f=><FRow key={f.key} f={f} mev={mev} tog={tog}/>)}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <FBtn secondary onClick={()=>setStep(0)}>← BACK</FBtn>
                <FBtn onClick={()=>setStep(2)}>NEXT →</FBtn>
              </div>
            </div>
          )}
          {step===2 && (
            <div>
              <div style={{fontFamily:F.display,fontSize:24,color:G.text,marginBottom:14,letterSpacing:3}}>TRAINING PROFILE</div>
              {MEV_FACTORS.slice(2).map(f=><FRow key={f.key} f={f} mev={mev} tog={tog}/>)}
              <div style={{background:"#0a0900",border:`1px solid ${G.border}`,borderRadius:8,padding:"12px 14px",marginBottom:16}}>
                <div style={{fontSize:9,color:G.muted,marginBottom:4,letterSpacing:2}}>YOUR MEV/MRV MODIFIER</div>
                <div style={{fontSize:28,fontWeight:900,color:mevScore>0?G.gold:mevScore<0?G.red:G.gold}}>
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
              <div style={{fontFamily:F.display,fontSize:24,color:G.text,marginBottom:4,letterSpacing:3}}>1RM SETUP</div>
              <div style={{display:"flex",background:"#0a0a0a",borderRadius:6,overflow:"hidden",marginBottom:14}}>
                {["lbs","kg"].map(u=>(
                  <button key={u} onClick={()=>{setUnit(u);ST.saveProfile(profile.id,{unit:u});}}
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
                      onChange={e=>{const v=e.target.value;setRms(p=>{const n={...p,[l]:v};ST.saveProfile(profile.id,{rms:n});return n;});}}
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
          <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:3}}>MEV/MRV SCORE</div>
          <div style={{fontSize:26,fontWeight:900,color:volScore>0?G.gold:volScore<0?G.red:G.gold}}>{volScore>0?"+":""}{volScore}</div>
        </div>
        <button onClick={()=>setShowRef(s=>!s)}
          style={{background:showRef?"#1a1000":"#0a0a0a",border:`1px solid ${showRef?"#242010":G.border}`,
            borderRadius:6,color:showRef?G.gold:G.muted,padding:"8px 14px",fontSize:10,fontWeight:700,letterSpacing:2,cursor:"pointer"}}>
          {showRef?"HIDE":"VIEW"} REF TABLE
        </button>
      </div>
      {showRef && (
        <div style={{background:"#0f0f0f",borderRadius:10,padding:14,border:`1px solid ${G.border}`,marginBottom:14,overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:460}}>
            <thead>
              <tr style={{background:"#0c0c0c"}}>
                {["Body Part","MV","MEV","MAV","MRV","Freq","Rep Range"].map(h=>(
                  <th key={h} style={{padding:"6px 8px",fontSize:9,color:G.gold,fontWeight:800,letterSpacing:1,textAlign:"left"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BODY_REF.map(([name,...vals],i)=>(
                <tr key={name} style={{background:i%2?"#0c0c0c":"transparent"}}>
                  <td style={{padding:"6px 8px",fontSize:11,fontWeight:700,color:G.gold}}>{name}</td>
                  {vals.map((v,j)=><td key={j} style={{padding:"6px 8px",fontSize:10,color:G.muted}}>{v}</td>)}
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
              background:act?"#1a1000":"#0a0a0a",color:act?G.gold:G.muted,fontFamily:F.display,fontSize:15,cursor:"pointer",letterSpacing:3}}>
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
          const SI={none:{l:"No Volume",c:"#333"},below:{l:"Below MEV",c:G.red},good:{l:"In Range",c:G.gold},near:{l:"Near MRV",c:G.gold},over:{l:"Over MRV",c:G.red}}[status];
          const bcLine={none:"#333",below:G.red,good:G.gold,near:G.gold,over:G.red}[status];
          const patEx=[];
          weekData.sessions.forEach(s=>s.exercises.forEach(ex=>{
            const chk=e=>{if(EX_PAT[e.name]===pat.id&&!patEx.includes(e.name))patEx.push(e.name);};
            ex.type==="superset"?[chk(ex.exA),chk(ex.exB)]:chk(ex);
          }));
          return(
            <div key={pat.id} style={{background:G.card,borderRadius:10,border:`1px solid ${G.border}`,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontFamily:F.display,fontSize:18,letterSpacing:2,color:G.text}}>{pat.name}</div>
                  <div style={{fontSize:10,color:G.muted,marginTop:2}}>{pat.muscle}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:24,fontWeight:900,color:SI.c}}>{sets}</div>
                  <div style={{fontSize:9,color:G.muted,letterSpacing:1}}>SETS</div>
                </div>
              </div>
              <div style={{background:"#1a1a1a",borderRadius:99,height:6,marginBottom:7,position:"relative",overflow:"visible"}}>
                <div style={{background:bcLine,borderRadius:99,height:6,width:`${pct}%`,transition:"width 0.3s"}}/>
                {adjMev>0&&<div style={{position:"absolute",top:-3,left:`${Math.min(99,(adjMev/adjMrv)*100)}%`,width:1,height:12,background:G.goldDim,opacity:0.6}}/>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:9,color:G.gold}}>MEV: {adjMev}</span>
                <span style={{fontSize:9,color:SI.c,fontWeight:800}}>{SI.l}</span>
                <span style={{fontSize:9,color:G.gold}}>MRV: {adjMrv}</span>
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
    <span style={{fontFamily:F.display,fontSize:12,background:"#1a1000",color:G.gold,padding:"1px 8px",letterSpacing:2}}>{proto}</span>
    <button onClick={()=>onTimer({proto,exName})}
      style={{background:"#0a0a0a",border:`1px solid #1a3a1a`,borderRadius:3,color:G.gold,padding:"2px 7px",fontSize:9,cursor:"pointer",letterSpacing:1,fontWeight:700}}>
      ▶ TIMER
    </button>
  </div>
);
const ProtoTagAcc = ({proto,exName,onTimer}) => (
  <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
    {proto&&<span style={{fontSize:10,color:G.gold,background:"#1a1000",borderRadius:3,padding:"2px 7px",fontWeight:700,letterSpacing:1}}>{proto}</span>}
    {proto&&<button onClick={()=>onTimer({proto,exName})}
      style={{background:"#0a0a0a",border:`1px solid #1a3a1a`,borderRadius:3,color:G.gold,padding:"2px 7px",fontSize:9,cursor:"pointer",letterSpacing:1,fontWeight:700}}>
      ▶
    </button>}
  </div>
);

// ── Main Lift Block ───────────────────────────────────────────────────────────
function MainBlock({ex,rms,unit,sid,onLog,logs,onTimer,readinessAdj=0}) {
  const [logged,setLogged] = useState(!!(logs[sid]?.[ex.name]?.length));
  if (!ex.pat) return null;
  const rm=parseFloat(rms[ex.name]),valid=!!(rm&&!isNaN(rm)&&rm>0);
  const isPRWeek = ex.pat.tl==="94-102%";
  const topPct = isPRWeek ? 0.98 : ex.pat.tp;
  const adjPct = topPct + (readinessAdj/100);
  const top=valid?r25(rm*adjPct, unit):null;
  const W=top?[r25(top*0.70, unit),r25(top*0.85, unit),top,r25(top*0.88, unit),r25(top*0.82, unit)]:[null,null,null,null,null];
  const rp2=ex.pat.reps;
  const ROWS=[
    {ro:"i",  lb:"Warm-up 1", reps:rp2[0],w:W[0],tag:"70% of top",  isTop:false},
    {ro:"ii", lb:"Warm-up 2", reps:rp2[1],w:W[1],tag:"85% of top",  isTop:false},
    {ro:"iii",lb:"Top Set",   reps:rp2[2],w:W[2],tag:readinessAdj!==0?`${ex.pat.tl} ${readinessAdj>0?"+":""}${readinessAdj}% ADJ`:`${ex.pat.tl} 1RM`,isTop:true},
    {ro:"iv", lb:"Back-off 1",reps:rp2[3],w:W[3],tag:"−12% of top", isTop:false},
    {ro:"v",  lb:"Back-off 2",reps:rp2[4],w:W[4],tag:"−18% of top", isTop:false},
  ];
  return (
    <div style={{border:`1px solid ${G.border}`,borderRadius:8,overflow:"hidden"}}>
      <div style={{background:"#100d00",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <span style={{fontFamily:F.display,fontSize:20,color:G.gold,letterSpacing:2,lineHeight:1}}>{ex.name}</span>
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
            style={{padding:"6px 14px",background:logged?"#0a0900":"#0f0f0f",border:logged?`1px solid ${G.gold}40`:`1px solid ${G.border}`,
              borderRadius:4,color:logged?G.gold:G.muted,fontSize:10,fontWeight:700,letterSpacing:2,cursor:logged?"default":"pointer"}}>
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
      <div style={{background:nested?"#100d00":"#100d00",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:F.display,fontSize:20,color:G.gold,letterSpacing:2,lineHeight:1}}>{ex.name}</span>
        {ex.proto&&<ProtoTagAcc proto={ex.proto} exName={ex.name} onTimer={onTimer}/>}
      </div>
      <div style={{display:"flex",alignItems:"center",background:"#0c0c0c",padding:"5px 14px"}}>
        <div style={{width:24,flexShrink:0}}/>
        <div style={{flex:"1 1 auto",fontSize:9,color:"#242010",fontWeight:700,letterSpacing:1}}>SET</div>
        <div style={{width:34,textAlign:"center",fontSize:9,color:"#242010",fontWeight:700,flexShrink:0}}>REPS</div>
        <div style={{width:82,textAlign:"center",fontSize:9,color:"#242010",fontWeight:700,letterSpacing:1,flexShrink:0}}>RPE</div>
        <div style={{width:80,textAlign:"right",fontSize:9,color:G.gold,fontWeight:700,letterSpacing:1,flexShrink:0}}>WEIGHT</div>
      </div>
      {ex.sets.map((set,i)=>{
        const wt=exLogs[i]||"";
        return (
          <div key={i} style={{display:"flex",alignItems:"center",padding:"9px 14px",borderTop:`1px solid #0a1a2a`}}>
            <div style={{width:24,flexShrink:0}}><span style={{fontSize:10,color:G.gold,fontWeight:700}}>{i+1}</span></div>
            <div style={{flex:"1 1 auto",fontSize:12,color:G.muted,fontWeight:400}}>{set.n>1?`${set.n}×`:""}{set.reps} reps</div>
            <div style={{width:34,textAlign:"center",fontSize:13,fontWeight:800,color:G.text,flexShrink:0}}>{set.reps}</div>
            <div style={{width:82,textAlign:"center",flexShrink:0}}>
              {set.rpe!=null
                ?<span style={{fontSize:11,fontWeight:800,color:rpeClr(set.rpe),background:`${rpeClr(set.rpe)}18`,borderRadius:3,padding:"2px 8px"}}>RPE {set.rpe}</span>
                :<span style={{fontSize:10,color:G.goldDim,fontStyle:"italic",whiteSpace:"nowrap"}}>{set.note||"= prev"}</span>
              }
            </div>
            <div style={{width:80,textAlign:"right",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:3}}>
                <input type="number" value={wt} onChange={e=>setAccLog(sid,ex.name,i,e.target.value)}
                  style={{width:46,background:"#0a0a0a",border:`1px solid #1a2a1a`,borderRadius:4,
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
    <div style={{border:`1px solid #24201040`,borderRadius:8,overflow:"hidden"}}>
      <div style={{background:"#100d00",padding:"7px 14px",borderBottom:"1px solid #1e1040",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:9,color:G.goldDim,fontWeight:900,letterSpacing:2,background:"#1a1000",borderRadius:3,padding:"2px 8px"}}>SUPERSET</span>
        <span style={{fontSize:10,color:"#c8a951"}}>{ex.exA.name} + {ex.exB.name}</span>
      </div>
      <RpeBlock ex={ex.exA} sid={sid} accLogs={accLogs} setAccLog={setAccLog} unit={unit} onTimer={onTimer} nested/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"4px",background:"#0c0c0c",borderTop:"1px solid #1e1040",borderBottom:"1px solid #1e1040"}}>
        <span style={{fontSize:9,color:"#7a6520",fontWeight:700,letterSpacing:2}}>⟷ SUPERSET ⟷</span>
      </div>
      <RpeBlock ex={ex.exB} sid={sid} accLogs={accLogs} setAccLog={setAccLog} unit={unit} onTimer={onTimer} nested/>
    </div>
  );
}


// ── Readiness System ──────────────────────────────────────────────────────────
const READINESS_Qs = [
  { id:"sleep",  label:"Sleep Quality",           emoji:"🌙", inverted:false },
  { id:"focus",  label:"Mental Focus",            emoji:"🧠", inverted:false },
  { id:"energy", label:"Physical Energy",         emoji:"⚡", inverted:false },
  { id:"stress", label:"Stress Level",            emoji:"🔥", inverted:true  },
];
const LOAD_PROFILES = {
  green:  { label:"GO MODE",          adj:0,   msg:"You are dialed in. Hit the numbers.",             icon:"🟢" },
  yellow: { label:"MANAGED DAY",      adj:-5,  msg:"Slight deload. Focus on bar speed and technique.", icon:"🟡" },
  red:    { label:"SURVIVAL SESSION", adj:-10, msg:"Showing up counts. Reduced load, full credit.",    icon:"🔴" },
};

function ReadinessGate({onComplete}) {
  const [vals, setVals] = useState({sleep:5,focus:5,energy:5,stress:5});
  const score = Math.round((vals.sleep + vals.focus + vals.energy + (11 - vals.stress)) / 4);
  const prof = score>=7 ? LOAD_PROFILES.green : score>=4 ? LOAD_PROFILES.yellow : LOAD_PROFILES.red;

  return (
    <div style={{padding:"20px 16px"}}>
      <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:4,marginBottom:4}}>PRE-SESSION CHECK-IN</div>
      <div style={{fontFamily:F.display,fontSize:28,color:G.gold,letterSpacing:3,marginBottom:6,lineHeight:1}}>HOW ARE YOU SHOWING UP?</div>
      <p style={{fontFamily:F.body,fontSize:12,color:G.muted,marginBottom:24,lineHeight:1.7}}>No wrong answers. This adapts your session — not your character.</p>

      {READINESS_Qs.map(q=>{
        const val=vals[q.id];
        const pct=((val-1)/9)*100;
        const c = q.inverted
          ? (val<=4?G.gold:val<=7?G.goldLt:G.muted)
          : (val>=7?G.gold:val>=4?G.goldLt:G.goldDim);
        return (
          <div key={q.id} style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontFamily:F.body,fontSize:13,color:G.text,fontWeight:600}}>{q.emoji} {q.label}</span>
              <span style={{fontFamily:F.display,fontSize:22,color:c,letterSpacing:1}}>{val}</span>
            </div>
            <input type="range" min={1} max={10} value={val}
              onChange={e=>setVals(p=>({...p,[q.id]:Number(e.target.value)}))}
              style={{width:"100%",WebkitAppearance:"none",appearance:"none",height:3,borderRadius:2,
                background:`linear-gradient(90deg, ${G.gold} ${pct}%, #222 ${pct}%)`,outline:"none",cursor:"pointer"}}/>
          </div>
        );
      })}

      <div style={{background:G.card2,border:`1px solid ${G.border}`,padding:"14px 16px",marginBottom:20,marginTop:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <span style={{fontSize:18}}>{prof.icon}</span>
          <span style={{fontFamily:F.display,fontSize:20,color:G.gold,letterSpacing:3}}>{prof.label}</span>
          {prof.adj!==0&&<span style={{fontFamily:F.display,fontSize:11,color:G.muted,background:G.card,padding:"2px 10px",letterSpacing:2,border:`1px solid ${G.border}`}}>{prof.adj}% LOAD</span>}
        </div>
        <p style={{fontFamily:F.body,fontSize:12,color:G.muted,margin:0,lineHeight:1.6}}>{prof.msg}</p>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"0 4px"}}>
        <div style={{flex:1,height:1,background:G.border}}/>
        <span style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:3}}>READINESS</span>
        <span style={{fontFamily:F.display,fontSize:28,color:G.gold,letterSpacing:1}}>{score}/10</span>
        <div style={{flex:1,height:1,background:G.border}}/>
      </div>

      <button onClick={()=>onComplete({score,profile:prof,adj:prof.adj})}
        style={{width:"100%",padding:14,background:goldGrad,border:"none",
          fontFamily:F.display,fontSize:20,letterSpacing:4,color:G.black,cursor:"pointer"}}>
        LOAD MY SESSION →
      </button>
    </div>
  );
}

// ── Quality Scale ─────────────────────────────────────────────────────────────
const QUALITY = [
  {v:1, label:"Awful"},  {v:2, label:"Poor"},   {v:3, label:"Rough"},
  {v:4, label:"Off"},    {v:5, label:"Neutral"}, {v:6, label:"Okay"},
  {v:7, label:"Good"},   {v:8, label:"V. Good"}, {v:9, label:"Excel."},
  {v:10,label:"Ideal"},
];
const qColor = v => v>=8?G.gold:v>=6?G.goldLt:v>=4?G.goldDim:G.muted;

function WinsScreen({readiness,sessionId,completed,qualityRatings,onClose}) {
  const sess = PROGRAM.flatMap(w=>w.sessions).find(s=>s.id===sessionId);
  const nextSess = PROGRAM.flatMap(w=>w.sessions).find(s=>s.id===sessionId+1);
  const hasRatings = qualityRatings && Object.values(qualityRatings).some(r=>r.length>0);

  return (
    <div style={{padding:"28px 16px",textAlign:"center"}}>
      <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:4,marginBottom:4}}>SESSION CLOSED</div>
      <div style={{fontFamily:F.display,fontSize:48,color:G.gold,letterSpacing:3,lineHeight:1,marginBottom:6}}>YOU SHOWED UP.</div>
      <p style={{fontFamily:F.body,fontSize:12,color:G.muted,marginBottom:28,lineHeight:1.7}}>
        {readiness.profile.label==="SURVIVAL SESSION"
          ? "That was a survival session. Showing up on hard days builds more than the lift."
          : readiness.profile.label==="MANAGED DAY"
          ? "Managed day. Controlled effort. Consistent athlete."
          : "Full output. You earned this one."}
      </p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
        {[
          ["🏋️","Session",`S${sessionId}`],
          ["📊","Program",`${completed.size}/16`],
          ["⚡","Readiness",`${readiness.score}/10`],
          [readiness.profile.icon,"Status",readiness.profile.label],
        ].map(([icon,label,val])=>(
          <div key={label} style={{background:G.card,border:`1px solid ${G.border}`,padding:"16px 10px"}}>
            <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
            <div style={{fontFamily:F.display,fontSize:22,color:G.gold,letterSpacing:2,lineHeight:1}}>{val}</div>
            <div style={{fontFamily:F.body,fontSize:10,color:G.muted,marginTop:4}}>{label}</div>
          </div>
        ))}
      </div>

      {hasRatings&&(
        <div style={{background:G.card,border:`1px solid ${G.border}`,overflow:"hidden",marginBottom:20,textAlign:"left"}}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:4}}>SET QUALITY</div>
          {Object.entries(qualityRatings).filter(([,r])=>r.length>0).map(([name,ratings])=>{
            const avg = ratings.reduce((a,b)=>a+b,0)/ratings.length;
            return (
              <div key={name} style={{padding:"12px 16px",borderBottom:`1px solid ${G.border2}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontFamily:F.display,fontSize:16,letterSpacing:2,color:G.text}}>{name.toUpperCase()}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:F.display,fontSize:22,color:qColor(avg)}}>{avg.toFixed(1)}</span>
                    <span style={{fontFamily:F.body,fontSize:9,fontWeight:700,color:qColor(avg),textTransform:"uppercase",letterSpacing:2}}>{QUALITY[Math.round(avg)-1]?.label}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {ratings.map((r,i)=>(
                    <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{width:28,height:28,background:`${qColor(r)}22`,border:`1px solid ${qColor(r)}66`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontFamily:F.display,fontSize:14,color:qColor(r)}}>{r}</span>
                      </div>
                      <span style={{fontFamily:F.body,fontSize:8,color:G.muted}}>S{i+1}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nextSess&&(
        <div style={{background:G.card2,border:`1px solid ${G.border}`,padding:"14px 16px",marginBottom:20,textAlign:"left"}}>
          <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:3,marginBottom:6}}>NEXT SESSION</div>
          <div style={{fontFamily:F.display,fontSize:18,color:G.text,letterSpacing:2}}>S{nextSess.id} — {nextSess.day.toUpperCase()}</div>
          <div style={{fontFamily:F.body,fontSize:11,color:G.muted,marginTop:3}}>{nextSess.focus}</div>
        </div>
      )}

      {/* ── Shareable Session Card ── */}
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:4,marginBottom:10,textAlign:"left"}}>SESSION CARD</div>
        <div id="session-share-card" style={{
          background:G.black,border:`1px solid ${G.gold}40`,padding:"24px 20px",
          fontFamily:F.body,textAlign:"left",
          backgroundImage:"repeating-linear-gradient(-45deg,transparent,transparent 3px,rgba(200,169,81,0.015) 3px,rgba(200,169,81,0.015) 6px)",
        }}>
          {/* Card header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${G.border}`}}>
            <div>
              <div style={{fontFamily:F.display,fontSize:8,color:G.muted,letterSpacing:5,marginBottom:2}}>PROJECT</div>
              <div style={{fontFamily:F.display,fontSize:32,background:goldGrad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",lineHeight:1,letterSpacing:2}}>4:16</div>
              <div style={{fontFamily:F.display,fontSize:7,color:G.muted,letterSpacing:4,marginTop:2}}>LIFTERS ON THE RUN</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:F.display,fontSize:22,color:G.gold,letterSpacing:2,lineHeight:1}}>S{sessionId}</div>
              <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:2,marginTop:2}}>{sess?.day?.toUpperCase()}</div>
              <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:2}}>{sess?.focus?.toUpperCase()}</div>
            </div>
          </div>

          {/* Readiness */}
          <div style={{display:"flex",gap:16,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${G.border}`}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3,marginBottom:4}}>READINESS</div>
              <div style={{fontFamily:F.display,fontSize:28,color:G.gold,letterSpacing:2,lineHeight:1}}>{readiness.score}<span style={{fontSize:14,color:G.muted}}>/10</span></div>
            </div>
            <div style={{flex:2}}>
              <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3,marginBottom:4}}>STATUS</div>
              <div style={{fontFamily:F.display,fontSize:18,color:G.gold,letterSpacing:2,lineHeight:1}}>{readiness.profile.icon} {readiness.profile.label}</div>
              {readiness.adj!==0&&<div style={{fontFamily:F.body,fontSize:10,color:G.muted,marginTop:3}}>{readiness.adj}% load adjustment</div>}
            </div>
          </div>

          {/* Main lifts */}
          {sess&&sess.exercises.filter(e=>e.type==="main").length>0&&(
            <div style={{marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${G.border}`}}>
              <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3,marginBottom:10}}>MAIN LIFTS</div>
              {sess.exercises.filter(e=>e.type==="main").map((ex,i)=>{
                const ratings = qualityRatings[ex.name]||[];
                const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:10,borderBottom:i<sess.exercises.filter(e=>e.type==="main").length-1?`1px solid ${G.border2}`:"none"}}>
                    <div>
                      <div style={{fontFamily:F.display,fontSize:16,color:G.gold,letterSpacing:2,lineHeight:1}}>{ex.name.toUpperCase()}</div>
                      <div style={{fontFamily:F.body,fontSize:10,color:G.muted,marginTop:3}}>
                        {ex.pat?.reps[2]} reps @ {ex.pat?.tl}{readiness.adj?` (adj ${readiness.adj}%)`:""}
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      {avg!==null&&(
                        <div>
                          <div style={{fontFamily:F.display,fontSize:20,color:qColor(avg),letterSpacing:1}}>{avg.toFixed(1)}</div>
                          <div style={{fontFamily:F.body,fontSize:9,color:qColor(avg),letterSpacing:1,textTransform:"uppercase"}}>{QUALITY[Math.round(avg)-1]?.label}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Accessories summary */}
          {sess&&sess.exercises.filter(e=>e.type!=="main").length>0&&(
            <div style={{marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${G.border}`}}>
              <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3,marginBottom:8}}>ACCESSORY WORK</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {sess.exercises.filter(e=>e.type!=="main").map((ex,i)=>(
                  <span key={i} style={{fontFamily:F.display,fontSize:11,color:G.muted,background:"#0a0a0a",border:`1px solid ${G.border}`,padding:"3px 10px",letterSpacing:1}}>
                    {ex.type==="superset"?`${ex.exA.name} + ${ex.exB.name}`:ex.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Program progress */}
          <div style={{display:"flex",gap:16,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${G.border}`}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3,marginBottom:4}}>PROGRAM</div>
              <div style={{fontFamily:F.display,fontSize:24,color:G.gold,letterSpacing:2,lineHeight:1}}>{completed.size}<span style={{fontSize:14,color:G.muted}}>/16</span></div>
            </div>
            <div style={{flex:2}}>
              <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3,marginBottom:6}}>PROGRESS</div>
              <div style={{height:6,background:"#1a1a1a",marginBottom:3}}>
                <div style={{height:6,background:goldGrad,width:`${(completed.size/16)*100}%`}}/>
              </div>
              <div style={{display:"flex",gap:3}}>
                {[1,2,3,4].map(w=>{
                  const wk = PROGRAM.find(p=>p.week===w);
                  const done = wk?.sessions.filter(s=>completed.has(s.id)).length||0;
                  return <div key={w} style={{flex:1,textAlign:"center"}}>
                    <div style={{fontFamily:F.display,fontSize:9,color:done===4?G.gold:G.muted,letterSpacing:1}}>{done}/4</div>
                    <div style={{fontFamily:F.display,fontSize:7,color:G.border,letterSpacing:1}}>W{w}</div>
                  </div>;
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3}}>LIFTERSONTTHERUN.APP</div>
            <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:2}}>PROJECT 4:16 · GSF</div>
          </div>
        </div>

        {/* Screenshot hint */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"8px 12px",background:G.card2,border:`1px solid ${G.border}`}}>
          <span style={{fontSize:16}}>📸</span>
          <span style={{fontFamily:F.body,fontSize:11,color:G.muted,lineHeight:1.5}}>Screenshot this card to share your session</span>
        </div>
      </div>

      <button onClick={onClose}
        style={{width:"100%",padding:14,background:"transparent",border:`1px solid ${G.border}`,
          fontFamily:F.display,fontSize:16,letterSpacing:4,color:G.muted,cursor:"pointer"}}>
        CLOSE
      </button>
    </div>
  );
}


// ── Bar Loader Modal (bottom sheet) ──────────────────────────────────────────
function BarLoaderSheet({seedLbs, onClose}) {
  const [inputVal, setInputVal] = useState(String(Math.round(seedLbs)));
  const [loading2, setLoading2] = useState(null);
  const [snapped, setSnapped] = useState(seedLbs);
  const BAR_LB = 45;
  const PLATES_LB = [
    {lb:45, label:"45",  name:"Red",    color:"#CC2200", textColor:"#fff"},
    {lb:35, label:"35",  name:"Blue",   color:"#1a4fc4", textColor:"#fff"},
    {lb:25, label:"25",  name:"Yellow", color:"#e8c200", textColor:"#111"},
    {lb:10, label:"10",  name:"Green",  color:"#2a7a2a", textColor:"#fff"},
    {lb:5,  label:"5",   name:"White",  color:"#e8e8e8", textColor:"#111"},
    {lb:2.5,label:"2.5", name:"Gray",   color:"#888888", textColor:"#fff"},
  ];
  const calcL = (target) => {
    let rem = (target - BAR_LB) / 2;
    if (rem < 0) return null;
    const counts = [];
    for (const p of PLATES_LB) { const n=Math.floor(rem/p.lb+0.001); counts.push(n); rem-=n*p.lb; }
    return Math.abs(rem) > 0.05 ? null : counts;
  };
  const snapL = (lb) => lb<=BAR_LB ? BAR_LB : BAR_LB + Math.round((lb-BAR_LB)/5)*5;

  useEffect(()=>{
    const n=parseFloat(inputVal);
    if(isNaN(n)){setLoading2(null);return;}
    const s=snapL(n); setSnapped(s); setLoading2(calcL(s));
  },[inputVal]);

  const perSide = loading2 ? PLATES_LB.reduce((s,p,i)=>s+p.lb*loading2[i],0) : 0;

  const PlateRow = ({counts,rev}) => {
    if(!counts) return null;
    // Build plates heaviest first (natural order = heaviest nearest collar)
    let plates = [];
    PLATES_LB.forEach((p,i)=>{ for(let j=0;j<counts[i];j++) plates.push({...p,key:`${i}-${j}`}); });
    // Left side: reverse so heaviest is nearest center bar
    // Right side: already heaviest nearest center bar
    if(rev) plates=[...plates].reverse();
    return (
      <div style={{display:"flex",alignItems:"center",gap:2,flexShrink:0}}>
        {plates.map(p=>{
          const w=Math.max(12,p.lb*0.55), h=52+p.lb*1.4;
          return <div key={p.key} style={{width:w,height:h,background:p.color,border:"1px solid rgba(255,255,255,0.12)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"inset 0 2px 3px rgba(255,255,255,0.1),0 2px 6px rgba(0,0,0,0.5)"}}>
            <span style={{fontSize:7,color:p.textColor,fontFamily:F.display,writingMode:"vertical-rl",transform:"rotate(180deg)",letterSpacing:1}}>{p.label}</span>
          </div>;
        })}
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:300}}/>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:G.card,borderTop:`1px solid ${G.border}`,zIndex:301,maxHeight:"88vh",overflowY:"auto",paddingBottom:32}}>
        <div style={{display:"flex",justifyContent:"center",paddingTop:12,paddingBottom:4}}>
          <div style={{width:36,height:3,background:G.border}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px 16px",borderBottom:`1px solid ${G.border}`}}>
          <div>
            <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:4,marginBottom:2}}>PLATE CALCULATOR</div>
            <div style={{fontFamily:F.display,fontSize:26,color:G.gold,letterSpacing:3}}>LOAD THE BAR</div>
          </div>
          <button onClick={onClose} style={{background:G.card2,border:`1px solid ${G.border}`,width:36,height:36,color:G.muted,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"20px 20px 0"}}>
          <div style={{position:"relative",marginBottom:8}}>
            <input type="number" value={inputVal} onChange={e=>setInputVal(e.target.value)}
              style={{width:"100%",background:"#0a0a0a",border:`1px solid ${G.border}`,padding:"14px 56px 14px 18px",
                fontFamily:F.display,fontSize:36,letterSpacing:2,color:G.text,outline:"none"}}/>
            <span style={{position:"absolute",right:18,top:"50%",transform:"translateY(-50%)",fontFamily:F.display,fontSize:14,color:G.muted,letterSpacing:2}}>LBS</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
            {[135,185,225,275,315,365,405,455].map(v=>(
              <button key={v} onClick={()=>setInputVal(String(v))} style={{
                background:parseFloat(snapped)===v?G.border:"#0a0a0a",color:parseFloat(snapped)===v?G.gold:G.muted,
                border:`1px solid ${parseFloat(snapped)===v?G.gold:G.border}`,padding:"5px 11px",
                fontFamily:F.display,fontSize:14,letterSpacing:2,cursor:"pointer"}}>
                {v}
              </button>
            ))}
          </div>
          {loading2&&(
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[["TOTAL",`${snapped} lbs`],["BAR",`${BAR_LB} lbs`],["PER SIDE",`${perSide} lbs`]].map(([lbl,val])=>(
                <div key={lbl} style={{flex:1,background:"#0a0a0a",border:`1px solid ${G.border}`,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:3,marginBottom:3}}>{lbl}</div>
                  <div style={{fontFamily:F.display,fontSize:16,color:G.gold,letterSpacing:1}}>{val}</div>
                </div>
              ))}
            </div>
          )}
          {loading2&&(
            <div style={{background:"#0a0a0a",border:`1px solid ${G.border}`,padding:"16px 12px",marginBottom:12,overflowX:"auto"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",minWidth:"max-content",margin:"0 auto"}}>
                <div style={{width:6,height:12,background:G.muted,borderRadius:"2px 0 0 2px",flexShrink:0}}/>
                <PlateRow counts={loading2} rev={false}/>
                <div style={{width:8,height:60,background:G.border,borderRadius:2,flexShrink:0,margin:"0 2px"}}/>
                <div style={{height:14,minWidth:60,flex:"0 1 80px",background:`linear-gradient(180deg,${G.muted},${G.border})`,borderRadius:2,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:7,fontFamily:F.display,letterSpacing:2,color:G.black}}>BAR</span>
                </div>
                <div style={{width:8,height:60,background:G.border,borderRadius:2,flexShrink:0,margin:"0 2px"}}/>
                <PlateRow counts={loading2} rev={true}/>
                <div style={{width:6,height:12,background:G.muted,borderRadius:"0 2px 2px 0",flexShrink:0}}/>
              </div>
            </div>
          )}
          {loading2&&(
            <div style={{background:"#0a0a0a",border:`1px solid ${G.border}`,overflow:"hidden",marginBottom:16}}>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${G.border}`,fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:4}}>PLATE BREAKDOWN</div>
              {loading2.map((count,i)=>count>0?(
                <div key={i} style={{display:"flex",alignItems:"center",padding:"10px 14px",gap:10,borderBottom:`1px solid ${G.border2}`}}>
                  <div style={{width:32,height:32,background:PLATES_LB[i].color,border:"1px solid rgba(255,255,255,0.1)",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontFamily:F.display,fontSize:11,color:PLATES_LB[i].textColor,letterSpacing:1}}>{PLATES_LB[i].label}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:F.display,fontSize:16,letterSpacing:2,color:G.text}}>{PLATES_LB[i].name.toUpperCase()} — {PLATES_LB[i].lb} LB</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["SIDE",count,true],["TOTAL",count*2,false]].map(([lbl,val,hi])=>(
                      <div key={lbl} style={{textAlign:"center"}}>
                        <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:2,marginBottom:2}}>{lbl}</div>
                        <div style={{background:hi?goldGrad:G.card2,color:hi?G.black:G.muted,padding:"3px 10px",fontFamily:F.display,fontSize:20,border:hi?"none":`1px solid ${G.border}`}}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ):null)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({s,rms,unit,completed,onToggle,onClose,onLog,logs,accLogs,setAccLog,onTimer}) {
  const isDone=completed.has(s.id),isPR=s.id>=15;
  const [phase,setPhase]             = useState(isDone?"session":"checkin");
  const [readiness,setReadiness]     = useState(null);
  const [stepIdx,setStepIdx]         = useState(0);
  const [pendingQuality,setPQ]       = useState(false);
  const [qualityRatings,setQR]       = useState({});
  const [weights,setWeights]         = useState({});
  const [barTarget,setBarTarget]     = useState(null);
  const PHASES = ["checkin","session","wins"];

  // ── Build flat step list: every set of every exercise ────────────────────
  const steps = [];
  s.exercises.forEach(ex=>{
    if (ex.type==="superset") {
      // interleave sets: exA set1, exB set1, exA set2, exB set2...
      const maxSets = Math.max(ex.exA.sets.length, ex.exB.sets.length);
      for (let i=0; i<maxSets; i++) {
        if (ex.exA.sets[i]) steps.push({ex:ex.exA, setIdx:i, ssGroup:ex.exA.name+"+"+ex.exB.name, type:"rpe"});
        if (ex.exB.sets[i]) steps.push({ex:ex.exB, setIdx:i, ssGroup:ex.exA.name+"+"+ex.exB.name, type:"rpe"});
      }
    } else if (ex.type==="main") {
      const rm=parseFloat(rms[ex.name]), valid=!!(rm&&!isNaN(rm)&&rm>0);
      const adj = readiness ? readiness.adj/100 : 0;
      const topPct = ex.pat.tl==="94-102%" ? 0.98 : ex.pat.tp;
      const top = valid ? r25(rm*(topPct+adj), unit) : null;
      const W = top ? [r25(top*0.70,unit),r25(top*0.85,unit),top,r25(top*0.88,unit),r25(top*0.82,unit)] : [null,null,null,null,null];
      const rp2 = ex.pat.reps;
      const ROWS = [
        {ro:"i",  lb:"Warm-up 1", reps:rp2[0], w:W[0], tag:"70% of top",  isTop:false},
        {ro:"ii", lb:"Warm-up 2", reps:rp2[1], w:W[1], tag:"85% of top",  isTop:false},
        {ro:"iii",lb:"Top Set",   reps:rp2[2], w:W[2], tag:ex.pat.tl+" 1RM", isTop:true},
        {ro:"iv", lb:"Back-off 1",reps:rp2[3], w:W[3], tag:"−12% of top", isTop:false},
        {ro:"v",  lb:"Back-off 2",reps:rp2[4], w:W[4], tag:"−18% of top", isTop:false},
      ];
      ROWS.forEach((row,i)=>steps.push({ex, setIdx:i, row, type:"main", top}));
    } else {
      ex.sets.forEach((set,i)=>steps.push({ex, setIdx:i, set, type:"rpe"}));
    }
  });

  const total = steps.length;
  const cur = steps[stepIdx] || steps[total-1];
  const progress = total>0 ? stepIdx/total : 0;

  const wtKey = cur ? `${cur.ex.name}:${cur.setIdx}` : "";
  const curWt = weights[wtKey]||"";

  const handleSetDone = () => {
    // log weight if main top set
    if (cur.type==="main" && cur.row.isTop && cur.top) {
      onLog(s.id, cur.ex.name, {topWeight: curWt||cur.top});
    }
    // log acc weight
    if (cur.type==="rpe" && curWt) {
      setAccLog(s.id, cur.ex.name, cur.setIdx, curWt);
    }
    // quality after top set or any main set
    if (cur.type==="main") {
      setPQ(true);
    } else {
      advance();
    }
  };

  const advance = () => {
    setPQ(false);
    if (stepIdx < total-1) setStepIdx(i=>i+1);
    else setPhase("complete_acc");
  };

  const handleComplete = () => { onToggle(); setPhase("wins"); };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(4,4,4,0.97)",zIndex:200,overflowY:"auto",padding:"12px 10px"}}>
      {barTarget!==null&&<BarLoaderSheet seedLbs={barTarget} onClose={()=>setBarTarget(null)}/>}
      <div style={{maxWidth:580,margin:"0 auto",background:G.card,border:`1px solid ${G.border}`,overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:G.card2,padding:"14px 16px",borderBottom:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontFamily:F.display,background:goldGrad,color:G.black,padding:"1px 10px",fontSize:16,letterSpacing:2}}>S{s.id}</span>
            <span style={{fontFamily:F.display,fontSize:20,letterSpacing:2,color:G.text}}>{s.day}</span>
            <span style={{fontFamily:F.display,fontSize:12,color:G.gold,letterSpacing:2,background:`${G.gold}15`,padding:"1px 10px",border:`1px solid ${G.gold}30`}}>{s.focus.toUpperCase()}</span>
            {readiness&&<span style={{fontFamily:F.display,fontSize:11,color:G.muted,background:G.card,padding:"1px 8px",letterSpacing:2,border:`1px solid ${G.border}`}}>{readiness.profile.icon} {readiness.profile.label}</span>}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${G.border}`,color:G.muted,padding:"6px 12px",fontFamily:F.display,fontSize:12,letterSpacing:1,cursor:"pointer"}}>✕</button>
        </div>

        {/* Phase bar */}
        {!isDone&&<div style={{display:"flex",gap:2,height:3}}>
          {PHASES.map((p,i)=>(
            <div key={p} style={{flex:1,background:phase===p?goldGrad:PHASES.indexOf(phase)>i?G.goldDim:G.border}}/>
          ))}
        </div>}

        {isPR&&phase==="session"&&<div style={{background:"#100a00",padding:"9px 16px",borderBottom:`1px solid ${G.gold}30`}}>
          <span style={{fontFamily:F.display,fontSize:16,color:G.gold,letterSpacing:3}}>🏆 PR WEEK — LEAVE EVERYTHING IN THE TANK</span>
        </div>}

        {/* ══ CHECK-IN ══ */}
        {phase==="checkin"&&!isDone&&<ReadinessGate onComplete={data=>{setReadiness(data);setPhase("session");}}/>}

        {/* ══ SESSION: Focus Mode ══ */}
        {(phase==="session"||(isDone&&phase!=="wins"&&phase!=="complete_acc"))&&cur&&(
          <div>
            {readiness&&readiness.adj!==0&&(
              <div style={{padding:"8px 16px",background:G.card2,borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:3}}>LOAD ADJUSTED</span>
                <span style={{fontFamily:F.display,fontSize:14,color:G.gold,letterSpacing:2}}>{readiness.adj}%</span>
              </div>
            )}

            {/* Progress */}
            <div style={{padding:"10px 16px 8px",borderBottom:`1px solid ${G.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:3}}>{cur.ex.name.toUpperCase()}</span>
                <span style={{fontFamily:F.display,fontSize:10,color:G.gold,letterSpacing:2}}>{stepIdx+1}/{total}</span>
              </div>
              <div style={{height:3,background:"#1a1a1a"}}>
                <div style={{height:3,background:goldGrad,width:`${progress*100}%`,transition:"width 0.4s"}}/>
              </div>
            </div>

            {/* ── MAIN LIFT FOCUS CARD ── */}
            {cur.type==="main"&&(
              <div style={{padding:"24px 16px"}}>
                {cur.ssGroup&&<div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:4,marginBottom:8,textAlign:"center"}}>{cur.ssGroup}</div>}

                {/* Exercise name + set label */}
                <div style={{textAlign:"center",marginBottom:20}}>
                  <div style={{fontFamily:F.display,fontSize:11,color:cur.row.isTop?G.gold:G.muted,letterSpacing:4,marginBottom:4}}>
                    {cur.row.ro.toUpperCase()} · {cur.row.lb.toUpperCase()}
                  </div>
                  <div style={{fontFamily:F.display,fontSize:40,color:cur.row.isTop?G.gold:G.text,letterSpacing:3,lineHeight:1,marginBottom:6}}>
                    {cur.ex.name.toUpperCase()}
                  </div>
                  <div style={{fontFamily:F.display,fontSize:72,color:cur.row.isTop?G.gold:G.text,lineHeight:1,marginBottom:4}}>
                    {cur.row.w||"--"}<span style={{fontSize:22,color:G.muted,marginLeft:4}}>{unit}</span>
                  </div>
                  <div style={{fontFamily:F.body,fontSize:13,color:G.muted}}>
                    {cur.row.reps} {cur.row.reps===1?"rep":"reps"} · {cur.row.tag}
                  </div>
                </div>

                {/* Timer + Bar Loader */}
                <div style={{display:"flex",gap:8,marginBottom:20}}>
                  <button onClick={()=>onTimer({proto:cur.ex.proto,exName:cur.ex.name})}
                    style={{flex:1,padding:"10px 0",background:"#0a0a0a",border:`1px solid ${G.border}`,
                      fontFamily:F.display,fontSize:13,letterSpacing:3,color:G.gold,cursor:"pointer"}}>
                    ▶ {cur.ex.proto} TIMER
                  </button>
                  {cur.row.w&&(
                    <button onClick={()=>setBarTarget(Math.round(cur.row.w*2.20462))}
                      style={{flex:1,padding:"10px 0",background:"#0a0a0a",border:`1px solid ${G.border}`,
                        fontFamily:F.display,fontSize:13,letterSpacing:3,color:G.gold,cursor:"pointer"}}>
                      🏋 VIEW PLATES
                    </button>
                  )}
                </div>

                {/* Weight input */}
                <div style={{marginBottom:20}}>
                  <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:4,marginBottom:8}}>
                    {cur.row.isTop?"LOG ACTUAL WEIGHT":"WEIGHT USED (OPTIONAL)"}
                  </div>
                  <div style={{display:"flex",alignItems:"center",background:"#0a0a0a",border:`1px solid ${cur.row.isTop?G.gold:G.border}`}}>
                    <input type="number" value={curWt}
                      onChange={e=>setWeights(p=>({...p,[wtKey]:e.target.value}))}
                      placeholder={cur.row.w?String(cur.row.w):"--"}
                      style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"14px 16px",
                        fontFamily:F.display,fontSize:36,letterSpacing:2,outline:"none"}}/>
                    <span style={{fontFamily:F.display,fontSize:16,color:G.muted,padding:"0 16px",letterSpacing:2}}>{unit.toUpperCase()}</span>
                  </div>
                </div>

                {/* Set progress dots */}
                <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:20}}>
                  {["i","ii","iii","iv","v"].map((ro,i)=>(
                    <div key={ro} style={{width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",
                      fontFamily:F.display,fontSize:12,letterSpacing:1,
                      background:i<stepIdx-steps.findIndex(st=>st.ex.name===cur.ex.name&&st.type==="main")?goldGrad:i===stepIdx-steps.findIndex(st=>st.ex.name===cur.ex.name&&st.type==="main")?`${G.gold}30`:G.card2,
                      border:`1px solid ${i===stepIdx-steps.findIndex(st=>st.ex.name===cur.ex.name&&st.type==="main")?G.gold:G.border}`,
                      color:i<stepIdx-steps.findIndex(st=>st.ex.name===cur.ex.name&&st.type==="main")?G.black:i===stepIdx-steps.findIndex(st=>st.ex.name===cur.ex.name&&st.type==="main")?G.gold:G.muted}}>
                      {ro}
                    </div>
                  ))}
                </div>

                {/* Quality rating */}
                {pendingQuality?(
                  <div>
                    <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:4,textAlign:"center",marginBottom:12}}>HOW DID THAT SET FEEL?</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,marginBottom:10}}>
                      {QUALITY.map(q=>(
                        <button key={q.v} onClick={()=>{
                          setQR(p=>({...p,[cur.ex.name]:[...(p[cur.ex.name]||[]),q.v]}));
                          advance();
                        }} style={{padding:"12px 0",background:`${qColor(q.v)}22`,border:`1px solid ${qColor(q.v)}55`,cursor:"pointer",
                          display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                          <span style={{fontFamily:F.display,fontSize:22,color:qColor(q.v)}}>{q.v}</span>
                          <span style={{fontFamily:F.body,fontSize:7,fontWeight:700,color:qColor(q.v),textTransform:"uppercase",letterSpacing:1,textAlign:"center"}}>{q.label}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={advance}
                      style={{width:"100%",padding:10,background:"transparent",border:`1px solid ${G.border}`,
                        fontFamily:F.body,fontSize:11,color:G.muted,cursor:"pointer",letterSpacing:1}}>SKIP</button>
                  </div>
                ):(
                  <button onClick={handleSetDone}
                    style={{width:"100%",padding:16,background:goldGrad,border:"none",
                      fontFamily:F.display,fontSize:22,letterSpacing:4,color:G.black,cursor:"pointer"}}>
                    ✓ {cur.row.lb.toUpperCase()} DONE
                  </button>
                )}
              </div>
            )}

            {/* ── RPE / ACCESSORY FOCUS CARD ── */}
            {cur.type==="rpe"&&(
              <div style={{padding:"24px 16px"}}>
                {cur.ssGroup&&<div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:4,marginBottom:8,textAlign:"center"}}>SUPERSET — {cur.ssGroup}</div>}

                <div style={{textAlign:"center",marginBottom:20}}>
                  <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:4,marginBottom:4}}>
                    SET {cur.setIdx+1}
                  </div>
                  <div style={{fontFamily:F.display,fontSize:40,color:G.gold,letterSpacing:3,lineHeight:1,marginBottom:8}}>
                    {cur.ex.name.toUpperCase()}
                  </div>
                  <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                    <span style={{fontFamily:F.display,fontSize:20,color:G.text,letterSpacing:2}}>
                      {cur.set?.n>1?`${cur.set.n}×`:""}{cur.set?.reps} reps
                    </span>
                    {cur.set?.rpe!=null&&(
                      <span style={{fontFamily:F.display,fontSize:20,letterSpacing:2,
                        color:rpeClr(cur.set.rpe),background:`${rpeClr(cur.set.rpe)}18`,padding:"2px 12px",border:`1px solid ${rpeClr(cur.set.rpe)}40`}}>
                        RPE {cur.set.rpe}
                      </span>
                    )}
                    {cur.set?.note&&<span style={{fontFamily:F.body,fontSize:13,color:G.muted,fontStyle:"italic"}}>{cur.set.note}</span>}
                  </div>
                </div>

                {/* Timer */}
                <button onClick={()=>onTimer({proto:cur.ex.proto,exName:cur.ex.name})}
                  style={{width:"100%",padding:"10px 0",background:"#0a0a0a",border:`1px solid ${G.border}`,
                    fontFamily:F.display,fontSize:13,letterSpacing:3,color:G.gold,cursor:"pointer",marginBottom:16}}>
                  ▶ {cur.ex.proto} TIMER
                </button>

                {/* Weight input */}
                <div style={{marginBottom:20}}>
                  <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:4,marginBottom:8}}>WEIGHT USED</div>
                  <div style={{display:"flex",alignItems:"center",background:"#0a0a0a",border:`1px solid ${G.border}`}}>
                    <input type="number" value={curWt}
                      onChange={e=>setWeights(p=>({...p,[wtKey]:e.target.value}))}
                      placeholder="Enter weight..."
                      style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"14px 16px",
                        fontFamily:F.display,fontSize:36,letterSpacing:2,outline:"none"}}/>
                    <span style={{fontFamily:F.display,fontSize:16,color:G.muted,padding:"0 16px",letterSpacing:2}}>{unit.toUpperCase()}</span>
                  </div>
                </div>

                <button onClick={handleSetDone}
                  style={{width:"100%",padding:16,background:goldGrad,border:"none",
                    fontFamily:F.display,fontSize:22,letterSpacing:4,color:G.black,cursor:"pointer"}}>
                  ✓ SET {cur.setIdx+1} DONE
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ ALL SETS DONE — COMPLETE ══ */}
        {phase==="complete_acc"&&(
          <div style={{padding:"28px 16px",textAlign:"center"}}>
            <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:4,marginBottom:8}}>ALL WORK DONE</div>
            <div style={{fontFamily:F.display,fontSize:40,color:G.gold,letterSpacing:3,lineHeight:1,marginBottom:16}}>SESSION COMPLETE</div>
            <button onClick={isDone?onClose:handleComplete}
              style={{width:"100%",padding:16,background:goldGrad,border:"none",
                fontFamily:F.display,fontSize:20,letterSpacing:3,color:G.black,cursor:"pointer"}}>
              {isDone?"CLOSE":"MARK AS COMPLETE →"}
            </button>
          </div>
        )}

        {/* ══ WINS ══ */}
        {phase==="wins"&&readiness&&(
          <WinsScreen readiness={readiness} sessionId={s.id} completed={completed} qualityRatings={qualityRatings} onClose={onClose}/>
        )}

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

  const beep = (freq=880, dur=0.15, vol=0.5) => {
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
    } catch(e) {}
  };

  useEffect(()=>{
    if (!running) return;
    const id=setInterval(()=>{
      setSecs(prev=>{
        if (prev<=1) {
          setFlash(true); setTimeout(()=>setFlash(false),800);
          beep(1046, 0.2, 0.7); // high beep on new round
          setTimeout(()=>beep(880, 0.15, 0.5), 200);
          setRound(r=>{ if(r>=roundsRef.current){setRunning(false);setDone(true);beep(523,0.5,0.8);return r;} return r+1; });
          return totalSecs;
        }
        if (prev===4) { beep(440, 0.1, 0.3); } // warning beep at 3s
        if (prev===3) { beep(440, 0.1, 0.3); }
        if (prev===2) { beep(440, 0.1, 0.3); }
        return prev-1;
      });
    },1000);
    return ()=>clearInterval(id);
  },[running,totalSecs]);

  const reset=()=>{setRunning(false);setRound(1);setSecs(totalSecs);setDone(false);};
  const mm=String(Math.floor(secs/60)).padStart(2,"0"),ss2=String(secs%60).padStart(2,"0");
  const pct=(totalSecs-secs)/totalSecs;
  const timeColor=secs>totalSecs*0.6?G.gold:secs>totalSecs*0.3?G.yellow:G.red;
  const R_sm=18,C_sm=2*Math.PI*R_sm;

  return (
    <div style={{position:"fixed",bottom:80,right:12,zIndex:400,background:flash?"#060d06":G.card,
      border:`1px solid ${flash?G.gold:G.border}`,borderRadius:12,minWidth:200,maxWidth:260,
      boxShadow:"0 8px 32px rgba(0,0,0,0.8)",transition:"background 0.2s,border-color 0.2s"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"#0a0a0a",borderRadius:"12px 12px 0 0",borderBottom:`1px solid ${G.border}`}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:F.display,fontSize:13,color:G.gold,letterSpacing:3}}>{proto}</div>
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
            <div style={{fontFamily:F.display,fontSize:18,color:timeColor,letterSpacing:1}}>{mm}:{ss2}</div>
            <div style={{fontSize:9,color:G.muted}}>R {round}/{rounds}</div>
          </div>
          <button onClick={()=>done?reset():setRunning(r=>!r)}
            style={{background:done?G.gold:running?"#3a0808":"#1a1000",border:"none",borderRadius:6,color:done?G.black:G.gold,padding:"6px 10px",fontSize:14,cursor:"pointer"}}>
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
                <div style={{fontFamily:F.display,fontSize:28,color:timeColor,lineHeight:1,letterSpacing:2}}>{mm}:{ss2}</div>
              </div>
            </div>
            <div style={{flex:1}}>
              {done?<div style={{fontSize:13,color:G.gold,fontWeight:800}}>🏆 Done!</div>
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
              style={{flex:3,padding:"9px",background:done?G.gold:running?"#2a0808":"#1a1000",
                border:"none",borderRadius:6,color:done?G.black:running?G.red:G.gold,
                fontWeight:800,fontSize:11,letterSpacing:2,cursor:"pointer"}}>
              {done?"START OVER":running?"⏸ PAUSE":"▶ START"}
            </button>
          </div>
          {flash&&<div style={{marginTop:8,textAlign:"center",fontSize:10,color:G.gold,fontWeight:800,letterSpacing:2}}>NEXT ROUND ▶</div>}
        </div>
      )}
    </div>
  );
}


// ── Coach Dashboard ───────────────────────────────────────────────────────────
function CoachDashboard({profile, onSignOut}) {
  const [athletes, setAthletes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const cardStyle = {background:"#0f0f0f",border:"1px solid #242010",borderRadius:10};

  useEffect(()=>{
    ST.getAthletes().then(a=>{ setAthletes(a); setLoading(false); });
  },[]);

  const selectAthlete = async (a) => {
    setSelected(a);
    const prog = await ST.getAthleteProgress(a.id);
    setProgress(prog);
  };

  if (selected) {
    const completed = new Set(progress?.completed||[]);
    const rms = selected.rms||{};
    const unit = selected.unit||"lbs";
    return (
      <div style={{minHeight:"100vh",background:"#080808",color:"#f0ead8",fontFamily:"system-ui,sans-serif",padding:16}}>
        <div style={{height:3,background:goldGrad,marginBottom:0}}/>
        <div style={{maxWidth:680,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 0",marginBottom:16}}>
            <button onClick={()=>{setSelected(null);setProgress(null);}}
              style={{background:"#111",border:"1px solid #242010",borderRadius:6,color:"#6b6040",padding:"6px 14px",fontSize:11,cursor:"pointer"}}>← BACK</button>
            <div>
              <div style={{fontWeight:900,fontSize:18,color:"#f0ead8"}}>{selected.name}</div>
              <div style={{fontSize:10,color:"#6b6040",letterSpacing:2}}>ATHLETE PROFILE</div>
            </div>
          </div>

          <div style={{...cardStyle,padding:16,marginBottom:14}}>
            <div style={{fontSize:10,color:"#c8a951",fontWeight:800,letterSpacing:3,marginBottom:12}}>PROGRAM PROGRESS</div>
            <div style={{background:"#1a1a1a",borderRadius:99,height:4,marginBottom:10}}>
              <div style={{background:goldGrad,borderRadius:99,height:4,width:`${(completed.size/16)*100}%`}}/>
            </div>
            <div style={{fontSize:12,color:"#c8a951",fontWeight:700}}>{completed.size}/16 sessions completed</div>
          </div>

          <div style={{...cardStyle,padding:16,marginBottom:14}}>
            <div style={{fontSize:10,color:"#c8a951",fontWeight:800,letterSpacing:3,marginBottom:12}}>1RM ({unit})</div>
            {["Hang Clean & Press","Squat","Bench","Deadlift"].map(l=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e1e1e"}}>
                <span style={{fontSize:12,color:"#6b6040"}}>{l}</span>
                <span style={{fontSize:13,fontWeight:800,color:"#f0ead8"}}>{rms[l]||"—"} {rms[l]?unit:""}</span>
              </div>
            ))}
          </div>

          <div style={{...cardStyle,padding:16,marginBottom:14}}>
            <div style={{fontSize:10,color:"#c8a951",fontWeight:800,letterSpacing:3,marginBottom:12}}>SESSION LOG</div>
            {PROGRAM.flatMap(w=>w.sessions).map(s=>{
              const done = completed.has(s.id);
              const sl = progress?.logs?.[s.id];
              return (
                <div key={s.id} style={{padding:"10px 0",borderBottom:"1px solid #1e1e1e"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:done&&sl?6:0}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:10,background:done?"#1a1000":"#1a1a1a",color:done?"#c8a951":"#2a2a2a",padding:"2px 8px",borderRadius:3,fontWeight:800}}>S{s.id}</span>
                      <span style={{fontSize:11,color:done?"#f0ead8":"#2a2a2a"}}>{s.day} — {s.focus}</span>
                    </div>
                    <span style={{fontSize:12}}>{done?"✓":""}</span>
                  </div>
                  {done&&sl&&Object.entries(sl).map(([ex,entries])=>(
                    <div key={ex} style={{paddingLeft:12,marginTop:4}}>
                      {entries.map((e,i)=>(
                        <div key={i} style={{fontSize:10,color:"#6b6040"}}>
                          {ex}: <span style={{color:"#c8a951",fontWeight:700}}>{e.topWeight} {unit}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#080808",color:"#f0ead8",fontFamily:"system-ui,sans-serif"}}>
      <div style={{height:3,background:goldGrad}}/>
      <header style={{background:"rgba(8,8,8,0.97)",borderBottom:"1px solid #242010",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo size="sm"/>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:9,color:"#6b6040",letterSpacing:1}}>COACH</div>
          <div style={{fontSize:13,fontWeight:800,color:"#c8a951"}}>{profile.name}</div>
        </div>
      </header>
      <main style={{maxWidth:680,margin:"0 auto",padding:"16px 14px"}}>
        <div style={{fontSize:10,color:"#c8a951",fontWeight:800,letterSpacing:3,marginBottom:14}}>
          ATHLETES ({athletes.length})
        </div>
        {loading&&<div style={{color:"#6b6040",fontSize:12,textAlign:"center",padding:40}}>Loading athletes...</div>}
        {!loading&&athletes.length===0&&(
          <div style={{...cardStyle,padding:24,textAlign:"center"}}>
            <div style={{fontSize:13,color:"#6b6040"}}>No athletes registered yet.</div>
            <div style={{fontSize:11,color:"#2a2a2a",marginTop:8}}>Athletes will appear here once they sign up.</div>
          </div>
        )}
        {athletes.map(a=>{
          return (
            <button key={a.id} onClick={()=>selectAthlete(a)}
              style={{...cardStyle,width:"100%",padding:"14px 16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"left"}}>
              <div>
                <div style={{fontFamily:"'Bebas Neue', sans-serif",fontSize:20,letterSpacing:2,color:"#f0ead8",marginBottom:2}}>{a.name}</div>
                <div style={{fontSize:10,color:"#6b6040",letterSpacing:1}}>
                  {["Hang Clean & Press","Squat","Bench","Deadlift"].filter(l=>a.rms?.[l]).map(l=>`${l}: ${a.rms[l]} ${a.unit||"lbs"}`).join("  ·  ")||"No 1RMs set"}
                </div>
              </div>
              <span style={{color:"#c8a951",fontSize:18}}>›</span>
            </button>
          );
        })}
        <button onClick={onSignOut}
          style={{width:"100%",padding:12,background:"transparent",border:"1px solid #242010",borderRadius:8,color:"#6b6040",fontSize:11,cursor:"pointer",marginTop:20,letterSpacing:2}}>
          SIGN OUT
        </button>
      </main>
    </div>
  );
}


// ── Bar Loader ────────────────────────────────────────────────────────────────
const BAR_KG = 25;
const PLATES_DATA = [
  { kg:25,   label:"25",   name:"Red",    color:"#CC2200", textColor:"#fff" },
  { kg:20,   label:"20",   name:"Blue",   color:"#1a4fc4", textColor:"#fff" },
  { kg:15,   label:"15",   name:"Yellow", color:"#e8c200", textColor:"#111" },
  { kg:10,   label:"10",   name:"Green",  color:"#2a7a2a", textColor:"#fff" },
  { kg:5,    label:"5",    name:"White",  color:"#e8e8e8", textColor:"#111" },
  { kg:2.5,  label:"2.5",  name:"Black",  color:"#1a1a1a", textColor:"#eee" },
  { kg:1.25, label:"1.25", name:"Silver", color:"#aaaaaa", textColor:"#111" },
];
function calcLoading(targetKg) {
  let rem = (targetKg - BAR_KG) / 2;
  if (rem < 0) return null;
  const counts = [];
  for (const p of PLATES_DATA) {
    const n = Math.floor(rem / p.kg + 0.001);
    counts.push(n); rem -= n * p.kg;
  }
  if (Math.abs(rem) > 0.05) return null;
  return counts;
}
function snapToValid(kg) {
  if (kg <= BAR_KG) return BAR_KG;
  return BAR_KG + Math.round((kg - BAR_KG) / 2.5) * 2.5;
}
function BarLoader() {
  const [blUnit, setBlUnit] = useState("lbs");
  const [inputVal, setInputVal] = useState("225");
  const [loading2, setLoading2] = useState(null);
  const [snapped, setSnapped] = useState(102.06);

  useEffect(()=>{
    const n = parseFloat(inputVal);
    if (isNaN(n)) { setLoading2(null); return; }
    const kg = blUnit==="lbs" ? n/2.20462 : n;
    const s = snapToValid(kg);
    setSnapped(s);
    setLoading2(calcLoading(s));
  },[inputVal, blUnit]);

  const dispSnapped = blUnit==="lbs" ? (snapped*2.20462).toFixed(1) : snapped.toFixed(1);
  const perSide = loading2 ? PLATES_DATA.reduce((s,p,i)=>s+p.kg*loading2[i],0) : 0;

  const PlateBar = ({counts, rev}) => {
    if (!counts) return null;
    let plates = [];
    PLATES_DATA.forEach((p,i)=>{ for(let j=0;j<counts[i];j++) plates.push({...p,key:`${i}-${j}`}); });
    if (rev) plates = [...plates].reverse();
    return (
      <div style={{display:"flex",alignItems:"center",gap:2,flexShrink:0}}>
        {plates.map(p=>{
          const w=Math.max(14,p.kg*1.1), h=60+p.kg*2.2;
          return <div key={p.key} style={{width:w,height:h,background:p.color,border:"1px solid rgba(255,255,255,0.12)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"inset 0 2px 3px rgba(255,255,255,0.1),0 2px 6px rgba(0,0,0,0.5)"}}>
            <span style={{fontSize:7,color:p.textColor,fontFamily:F.display,writingMode:"vertical-rl",transform:"rotate(180deg)",letterSpacing:1}}>{p.label}</span>
          </div>;
        })}
      </div>
    );
  };

  const cs = {background:G.card,border:`1px solid ${G.border}`,borderRadius:0,marginBottom:12};

  return (
    <div>
      <div style={{display:"flex",background:"#0a0a0a",border:`1px solid ${G.border}`,marginBottom:12}}>
        {["lbs","kg"].map(u=>(
          <button key={u} onClick={()=>{
            const n=parseFloat(inputVal);
            if(!isNaN(n)){
              const kg=blUnit==="lbs"?n/2.20462:n;
              setInputVal(u==="lbs"?(kg*2.20462).toFixed(1):kg.toFixed(1));
            }
            setBlUnit(u);
          }} style={{flex:1,padding:"11px 0",border:"none",background:blUnit===u?goldGrad:"transparent",
            color:blUnit===u?G.black:G.muted,fontFamily:F.display,fontSize:16,letterSpacing:3,cursor:"pointer"}}>
            {u.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{...cs,padding:16}}>
        <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:3,marginBottom:8}}>TARGET WEIGHT</div>
        <div style={{display:"flex",alignItems:"center",background:"#0a0a0a",border:`1px solid ${G.border}`}}>
          <input type="number" value={inputVal} onChange={e=>setInputVal(e.target.value)}
            style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"14px 16px",
              fontFamily:F.display,fontSize:40,letterSpacing:2,outline:"none"}}/>
          <span style={{fontFamily:F.display,fontSize:18,color:G.muted,padding:"0 16px",letterSpacing:2}}>{blUnit.toUpperCase()}</span>
        </div>
        {loading2 && parseFloat(inputVal)!==parseFloat(dispSnapped) && (
          <div style={{marginTop:8,fontSize:11,color:G.muted,textAlign:"center",fontFamily:F.body}}>
            Snapped to <span style={{color:G.gold,fontWeight:700}}>{dispSnapped} {blUnit}</span>
          </div>
        )}
        {!loading2 && inputVal && (
          <div style={{marginTop:8,fontSize:11,color:G.gold,textAlign:"center",fontFamily:F.body}}>
            Min: {blUnit==="lbs"?"55.1 lbs":"25 kg"}
          </div>
        )}
      </div>

      {loading2 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
          {[["TOTAL",`${snapped.toFixed(1)} kg`,`${(snapped*2.20462).toFixed(1)} lbs`],
            ["BAR","25.0 kg","55.1 lbs"],
            ["PER SIDE",`${perSide.toFixed(2)} kg`,`${(perSide*2.20462).toFixed(1)} lbs`]
          ].map(([lbl,val,sub])=>(
            <div key={lbl} style={{background:G.card,border:`1px solid ${G.border}`,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:3,marginBottom:4}}>{lbl}</div>
              <div style={{fontFamily:F.display,fontSize:18,color:G.gold,letterSpacing:1}}>{val}</div>
              <div style={{fontSize:10,color:G.muted,marginTop:2,fontFamily:F.body}}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {loading2 && (
        <div style={{...cs,padding:20,overflowX:"auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,minWidth:"max-content",margin:"0 auto"}}>
            <div style={{width:8,height:16,background:G.muted,borderRadius:"2px 0 0 2px",flexShrink:0}}/>
            <PlateBar counts={loading2} rev={false}/>
            <div style={{width:10,height:72,background:G.border,borderRadius:2,flexShrink:0,margin:"0 2px"}}/>
            <div style={{height:20,background:`linear-gradient(180deg,${G.muted} 0%,${G.border} 100%)`,flexShrink:0,minWidth:80,flex:"0 1 120px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:F.display,fontSize:9,letterSpacing:3,color:G.black}}>BAR</span>
            </div>
            <div style={{width:10,height:72,background:G.border,borderRadius:2,flexShrink:0,margin:"0 2px"}}/>
            <PlateBar counts={loading2} rev={true}/>
            <div style={{width:8,height:16,background:G.muted,borderRadius:"0 2px 2px 0",flexShrink:0}}/>
          </div>
        </div>
      )}

      {loading2 && (
        <div style={cs}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${G.border}`,fontFamily:F.display,fontSize:12,color:G.muted,letterSpacing:4}}>PLATE BREAKDOWN</div>
          {PLATES_DATA.map((p,i)=>loading2[i]>0&&(
            <div key={p.name} style={{display:"flex",alignItems:"center",padding:"12px 16px",borderBottom:`1px solid ${G.border2}`,gap:12}}>
              <div style={{width:36,height:36,background:p.color||G.border,border:"1px solid rgba(255,255,255,0.1)",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontFamily:F.display,fontSize:11,color:p.textColor||G.gold,letterSpacing:1}}>{p.label}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:F.display,fontSize:18,letterSpacing:2,color:G.text}}>{p.name.toUpperCase()} — {p.kg} KG</div>
                <div style={{fontSize:10,color:G.muted,fontFamily:F.body}}>{(p.kg*2.20462).toFixed(2)} lbs each</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {[["PER SIDE",loading2[i],true],["TOTAL",loading2[i]*2,false]].map(([lbl,val,hi])=>(
                  <div key={lbl} style={{textAlign:"center"}}>
                    <div style={{fontFamily:F.display,fontSize:9,color:G.muted,letterSpacing:2,marginBottom:3}}>{lbl}</div>
                    <div style={{background:hi?goldGrad:G.card2,color:hi?G.black:G.muted,padding:"4px 12px",fontFamily:F.display,fontSize:22,letterSpacing:1,border:hi?"none":`1px solid ${G.border}`}}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {loading2&&loading2.every(c=>c===0)&&<div style={{padding:16,fontSize:12,color:G.muted,textAlign:"center",fontFamily:F.body}}>Bar only — no plates needed</div>}
        </div>
      )}

      <div style={{...cs,padding:16}}>
        <div style={{fontFamily:F.display,fontSize:11,color:G.muted,letterSpacing:4,marginBottom:10}}>QUICK SELECT</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {(blUnit==="lbs"?[135,185,225,275,315,365,405,455]:[60,80,100,120,140,160,180,200]).map(v=>(
            <button key={v} onClick={()=>setInputVal(String(v))}
              style={{background:parseFloat(dispSnapped)===v?goldGrad:G.card2,color:parseFloat(dispSnapped)===v?G.black:G.muted,
                border:`1px solid ${G.border}`,padding:"8px 14px",fontFamily:F.display,fontSize:16,letterSpacing:2,cursor:"pointer"}}>
              {v}
            </button>
          ))}
        </div>
      </div>
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
    setProfile({id:d.id,name:d.name,email:d.email,role:d.role||'athlete'});
    setMevSel(d.mev||{}); setUnit(d.unit||"lbs"); setRms(d.rms||{});
    setCompleted(d.completed instanceof Set?d.completed:new Set(d.completed||[]));
    setLogs(d.logs||{}); setAccLogs(d.accLogs||{}); saveRef.current=false;
  };

  if (!profile) return <Onboarding onComplete={handleLogin}/>;
  if (profile.role==='coach') return <CoachDashboard profile={profile} onSignOut={()=>setProfile(null)}/>;

  const volScore = Object.values(mevSel).reduce((s,v)=>s+(v||0),0) + calcNumericMevScore(mevSel);
  const toggleDone = id => setCompleted(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const addLog = (sid,exName,entry) => setLogs(p=>({...p,[sid]:{...(p[sid]||{}),[exName]:[...((p[sid]||{})[exName]||[]),entry]}}));
  const setAccLog = (sid,exName,si,wt) => setAccLogs(p=>({...p,[sid]:{...(p[sid]||{}),[exName]:{...((p[sid]||{})[exName]||{}),[si]:wt}}}));
  const nextSession = PROGRAM.flatMap(w=>w.sessions).find(s=>!completed.has(s.id));
  const weekData = PROGRAM.find(w=>w.week===activeWeek);
  const NAV = [{id:"home",icon:"⊞",label:"Home"},{id:"program",icon:"📋",label:"Program"},{id:"volume",icon:"📊",label:"Volume"},{id:"progress",icon:"📈",label:"Progress"},{id:"about",icon:"ℹ",label:"About"},{id:"profile",icon:"⚙",label:"Profile"}];
  const cardStyle = {background:G.card,border:`1px solid ${G.border}`,borderRadius:10};
  const card2Style = {background:G.card2,border:`1px solid ${G.border}`,borderRadius:10};

  return (
    <div style={{minHeight:"100vh",background:G.black,color:G.text,fontFamily:F.body,paddingBottom:72}}>
      <div style={{height:3,background:goldGrad,position:"sticky",top:0,zIndex:51}}/>
      <header style={{background:"rgba(8,8,8,0.98)",borderBottom:`1px solid ${G.border}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:3,zIndex:50}}>
        <Logo size="sm"/>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:3}}>ATHLETE</div>
          <div style={{fontFamily:F.display,fontSize:18,color:G.gold,letterSpacing:2,lineHeight:1}}>{profile.name}</div>
        </div>
      </header>

      <main style={{maxWidth:680,margin:"0 auto",padding:"16px 14px"}}>
        {/* HOME */}
        {tab==="home"&&(
          <div>
            <div style={{...cardStyle,padding:16,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontFamily:F.display,fontSize:12,color:G.muted,letterSpacing:3}}>PROGRAM PROGRESS</span>
                <span style={{fontSize:12,color:G.gold,fontWeight:800}}>{completed.size}/16 SESSIONS</span>
              </div>
              <div style={{background:"#1a1a1a",borderRadius:99,height:4,marginBottom:14}}>
                <div style={{background:goldGrad,borderRadius:99,height:4,width:`${(completed.size/16)*100}%`,transition:"width 0.4s"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {PROGRAM.map(w=>{const wd=w.sessions.filter(s=>completed.has(s.id)).length;return(
                  <div key={w.week} style={{textAlign:"center",background:"#0a0a0a",borderRadius:8,padding:"10px 4px"}}>
                    <div style={{fontSize:18,fontWeight:900,color:wd===4?G.gold:wd>0?G.gold:"#2a2a2a"}}>{wd}/4</div>
                    <div style={{fontSize:9,color:G.muted,letterSpacing:1}}>WK {w.week}</div>
                    <div style={{fontFamily:F.display,fontSize:9,letterSpacing:2,color:"#2a2a2a",marginTop:2}}>{w.theme}</div>
                  </div>
                );})}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
              {[["Done",completed.size],["Left",16-completed.size],["Week",Math.min(4,Math.ceil(completed.size/4)+1)]].map(([l,v])=>(
                <div key={l} style={{...cardStyle,padding:"14px 8px",textAlign:"center"}}>
                  <div style={{fontFamily:F.display,fontSize:42,color:G.gold,lineHeight:1}}>{v}</div>
                  <div style={{fontFamily:F.display,fontSize:10,color:G.muted,letterSpacing:3}}>{l.toUpperCase()}</div>
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
                        <span key={i} style={{fontSize:10,color:e.type==="main"?G.gold:G.gold,background:e.type==="main"?"#1a1000":"#051020",borderRadius:3,padding:"2px 7px"}}>{e.name}</span>
                      ))}
                    </div>
                  </div>
                  <span style={{fontSize:22,color:G.gold,flexShrink:0,marginLeft:10}}>▶</span>
                </div>
              </div>
            )}
            {completed.size===16&&(
              <div style={{...cardStyle,padding:24,textAlign:"center",border:`1px solid ${G.gold}40`,marginBottom:18}}>
                <div style={{fontSize:40,marginBottom:8}}>🏆</div>
                <div style={{fontSize:18,fontWeight:900,color:G.gold,letterSpacing:2}}>PROGRAM COMPLETE</div>
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
                  <div key={s.id} style={{...cardStyle,padding:"13px 14px",border:isDone?`1px solid ${G.gold}30`:undefined}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                          <span style={{background:G.gold,color:G.black,borderRadius:3,padding:"2px 7px",fontWeight:900,fontSize:10}}>S{s.id}</span>
                          <span style={{fontWeight:800,fontSize:14,color:G.text}}>{s.day}</span>
                          <span style={{fontSize:10,fontWeight:700,color:fc,background:`${fc}18`,padding:"2px 8px",borderRadius:12}}>{s.focus}</span>
                          {isDone&&<span style={{fontSize:10,color:G.gold,fontWeight:700}}>✓ DONE</span>}
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
                              ?<span key={i} style={{fontSize:11,color:G.goldDim,background:"#100d00",borderRadius:3,padding:"2px 8px"}}>{e.exA.name}+{e.exB.name}</span>
                              :<span key={i} style={{fontSize:11,color:G.gold,background:"#050d1a",borderRadius:3,padding:"2px 8px"}}>{e.name}</span>
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
                          style={{background:isDone?"#0a0900":"#0a0a0a",border:isDone?`1px solid ${G.gold}40`:`1px solid ${G.border}`,
                            borderRadius:6,color:isDone?G.gold:G.muted,padding:"7px 12px",fontSize:10,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
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
                      <div key={s.id} style={{background:G.card,borderRadius:8,border:`1px solid ${G.gold}20`,marginBottom:8}}>
                        <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:G.text}}>Session {s.id} -- {s.day}</div>
                            <div style={{fontSize:11,color:fc,marginTop:2,letterSpacing:1}}>{s.focus}</div>
                          </div>
                          <span style={{color:G.gold,fontSize:20}}>✓</span>
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
                              return <div key={en} style={{marginBottom:6}}><div style={{fontSize:10,color:G.gold,fontWeight:700,marginBottom:3}}>{en}</div><div style={{fontSize:11,color:G.muted}}>{weights.join(", ")} {unit}</div></div>;
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


        {/* ABOUT */}
        {tab==="about"&&(
          <div>
            <div style={{...cardStyle,padding:"20px 16px",marginBottom:14,textAlign:"center"}}>
              <Logo size="lg"/>
              <div style={{marginTop:16,fontSize:13,color:G.muted,lineHeight:1.7}}>
                A 4-week strength peaking program built for athletes with demanding schedules.
              </div>
            </div>

            <div style={{...cardStyle,padding:"16px",marginBottom:14}}>
              <SH color={G.gold}>PROGRAM OVERVIEW</SH>
              <div style={{fontSize:13,color:G.text,lineHeight:1.8}}>
                <p style={{marginBottom:10}}>Project 4:16 is a 16-session peaking cycle designed to bring your Big 3 lifts to peak strength over 4 weeks. Each week has a distinct training stimulus:</p>
                {[
                  ["Week 1 — Volume","4 sessions at 85% 1RM. Establish your working weights and build baseline volume with the full accessory program."],
                  ["Week 2 — Intensity","4 sessions pushing to 88–91% 1RM. Heavier loads with reduced volume accessories."],
                  ["Week 3 — Accumulation","Return to 88% with higher rep schemes to reinforce technique under fatigue."],
                  ["Week 4 — Peak","91–102% 1RM. Saturday is your PR attempt day."],
                ].map(([title,desc])=>(
                  <div key={title} style={{marginBottom:12,padding:"10px 12px",background:G.card2,borderRadius:8,border:`1px solid ${G.border}`}}>
                    <div style={{fontWeight:800,color:G.gold,fontSize:12,marginBottom:4}}>{title}</div>
                    <div style={{fontSize:12,color:G.muted,lineHeight:1.6}}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{...cardStyle,padding:"16px",marginBottom:14}}>
              <SH color={G.gold}>HOW TO USE THIS APP</SH>
              {[
                ["Set Your 1RMs","Go to Profile → enter your current 1RM for each lift. The app calculates all working weights automatically."],
                ["Start a Session","Tap any session card to open it. Main lifts show your warm-up, top set, and back-off weights."],
                ["Use the EMOM Timer","Tap the timer icon on any lift to start the EMOM countdown. It beeps at the start of each round."],
                ["Log Your Top Set","After completing the top set, enter the weight you used. This tracks your progress over time."],
                ["Log Accessory Work","Enter the weight used for each accessory set. Tap the weight field and type your number."],
                ["Mark Complete","When finished, tap MARK AS COMPLETE at the bottom of the session."],
                ["Track Your Volume","The Volume tab shows your weekly sets per movement pattern against MEV/MRV targets."],
                ["Customize MEV/MRV","In Profile → MEV/MRV Factors, adjust your personal recovery factors to tailor volume targets."],
              ].map(([title,desc],i)=>(
                <div key={i} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
                  <div style={{minWidth:22,height:22,borderRadius:"50%",background:G.gold,color:G.black,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,marginTop:1}}>{i+1}</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:12,color:G.text,marginBottom:2}}>{title}</div>
                    <div style={{fontSize:11,color:G.muted,lineHeight:1.6}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{...cardStyle,padding:"16px",marginBottom:14}}>
              <SH color={G.gold}>SET NOTATION</SH>
              {[
                ["E3MOM","Every 3 Minutes on the Minute — start your set when the timer hits 0"],
                ["E2MOM","Every 2 Minutes on the Minute"],
                ["EMOM","Every Minute on the Minute"],
                ["Top Set","Your heaviest working set at the target percentage of 1RM"],
                ["Back-off","Sets at –12% and –18% below your top set weight"],
                ["RPE","Rate of Perceived Exertion. RPE 10 = absolute max effort."],
              ].map(([term,def])=>(
                <div key={term} style={{display:"flex",gap:10,marginBottom:10,padding:"8px 10px",background:G.card2,borderRadius:6,border:`1px solid ${G.border}`}}>
                  <span style={{fontWeight:800,color:G.gold,fontSize:11,minWidth:80}}>{term}</span>
                  <span style={{fontSize:11,color:G.muted,lineHeight:1.5}}>{def}</span>
                </div>
              ))}
            </div>

            <div style={{...cardStyle,padding:"20px 16px",marginBottom:14,textAlign:"center"}}>
              <SH color={G.gold}>SUPPORT THE PROJECT</SH>
              <p style={{fontSize:12,color:G.muted,marginBottom:16,lineHeight:1.7}}>
                Project 4:16 is free to use. If it has helped your training, consider supporting future development.
              </p>
              <a href="https://buymeacoffee.com" target="_blank" rel="noopener noreferrer"
                style={{display:"inline-block",padding:"12px 28px",background:goldGrad,color:G.black,borderRadius:8,fontWeight:900,fontSize:13,letterSpacing:2,textDecoration:"none"}}>
                ☕ BUY ME A COFFEE
              </a>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {tab==="profile"&&(
          <div>
            <div style={{...cardStyle,padding:"20px 16px",marginBottom:14,textAlign:"center"}}>
              <div style={{width:62,height:62,borderRadius:"50%",background:goldGrad,color:G.black,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,margin:"0 auto 12px"}}>
                {(profile.name||"?")[0].toUpperCase()}
              </div>
              <div style={{fontFamily:F.display,fontSize:28,color:G.text,letterSpacing:3}}>{profile.name}</div>
              <div style={{fontSize:11,color:G.gold,marginTop:4}}>{profile.email||""}</div>
              <div style={{fontSize:9,color:G.muted,letterSpacing:3,marginTop:4}}>PROJECT 4:16 ATHLETE</div>
              <div style={{marginTop:10,fontSize:11,color:G.gold,fontWeight:700}}>{completed.size}/16 sessions completed</div>
            </div>
            <div style={{...cardStyle,padding:"14px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:G.text}}>Weight Unit</span>
              <div style={{display:"flex",background:"#0a0a0a",borderRadius:6,overflow:"hidden"}}>
                {["lbs","kg"].map(u=>(
                  <button key={u} onClick={()=>{setUnit(u);ST.saveProfile(profile.id,{unit:u});}}
                    style={{padding:"8px 16px",background:unit===u?G.gold:"transparent",color:unit===u?G.black:G.muted,border:"none",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{...cardStyle,padding:16,marginBottom:14}}>
              <div style={{fontFamily:F.display,fontSize:16,color:G.gold,letterSpacing:4,marginBottom:14}}>1RM SETTINGS</div>
              {LIFTS.map(l=>{const rm=parseFloat(rms[l]);return(
                <div key={l} style={{marginBottom:14}}>
                  <label style={{fontSize:10,color:G.muted,display:"block",marginBottom:5,letterSpacing:2,fontWeight:700}}>{l.toUpperCase()}</label>
                  <div style={{display:"flex",background:"#111",borderRadius:6,overflow:"hidden",border:`1px solid ${G.border}`}}>
                    <input type="number" value={rms[l]||""} placeholder="Enter 1RM..."
                      onChange={e=>{const v=e.target.value;setRms(p=>{const n={...p,[l]:v};ST.saveProfile(profile.id,{rms:n});return n;});}}
                      style={{flex:1,background:"transparent",border:"none",color:G.text,padding:"10px 12px",fontSize:13,outline:"none"}}/>
                    <span style={{padding:"0 14px",color:G.muted,fontSize:12,display:"flex",alignItems:"center"}}>{unit}</span>
                  </div>
                  {rm>0&&<div style={{marginTop:7,display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[[0.70,"70%"],[0.85,"85%"],[0.88,"88%"],[0.91,"91%"]].map(([p,lbl])=>(
                      <span key={lbl} style={{fontSize:10,color:G.muted,background:"#0f0f0f",border:`1px solid ${G.border}`,borderRadius:3,padding:"3px 8px"}}>
                        <span style={{color:G.gold,fontWeight:700}}>{r25(rm*p, unit)}</span> @ {lbl}
                      </span>
                    ))}
                  </div>}
                </div>
              );})}
            </div>
            <div style={{...cardStyle,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:10,color:G.gold,fontWeight:800,letterSpacing:3}}>MEV/MRV FACTORS</div>
                <div style={{fontSize:12,fontWeight:800,color:volScore>0?G.gold:volScore<0?G.red:G.gold}}>{volScore>0?"+":""}{volScore}</div>
              </div>
              {MEV_NUMERIC.map(f=><FNumeric key={f.key} f={f} mev={mevSel} onChange={(k,v)=>{setMevSel(p=>{const n={...p,[k]:v};ST.saveProfile(profile.id,{mev:n});return n;});}}/>)}
              {MEV_FACTORS.map(f=><FRow key={f.key} f={f} mev={mevSel} tog={(k,v)=>setMevSel(p=>{const n={...p,[k]:p[k]===v?undefined:v};ST.saveProfile(profile.id,{mev:n});return n;})}/>)}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(8,8,8,0.98)",borderTop:`1px solid ${G.border}`,display:"flex",zIndex:50}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:goldGrad}}/>
        {NAV.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:"10px 4px",background:"transparent",border:"none",
              color:tab===t.id?G.gold:G.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              borderTop:tab===t.id?`2px solid ${G.gold}`:"2px solid transparent",marginTop:-2}}>
            <span style={{fontSize:15}}>{t.icon}</span>
            <span style={{fontFamily:F.display,fontSize:9,letterSpacing:2,color:tab===t.id?G.gold:G.muted}}>{t.label.toUpperCase()}</span>
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
