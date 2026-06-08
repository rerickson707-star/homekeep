import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase";
import { lookupProperty } from "./services/property";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const CATEGORIES = ["HVAC","Plumbing","Electrical","Appliances","Roofing","Landscaping","Structural","Safety","Other"];
const STATUS_OPTIONS = ["Scheduled","In Progress","Completed","Overdue"];
const PRIORITY = ["Low","Medium","High","Urgent"];
const HOME_TYPES = ["Single Family","Townhouse","Condo","Mobile Home","Multi-Family","Other"];
const CAT_ICONS = { HVAC:"🌡️", Plumbing:"🛿", Electrical:"⚡", Appliances:"🍳", Roofing:"🏚️", Landscaping:"🌿", Structural:"🧱", Safety:"🔒", Other:"🔧" };
const STATUS_STYLE = {
  "Scheduled":   { bg:"#EBF5FF", text:"#1A6FA0", border:"#93C5E8" },
  "In Progress": { bg:"#FFF8E6", text:"#92610A", border:"#F5CC76" },
  "Completed":   { bg:"#E8F6EE", text:"#1A7A44", border:"#7DCBA1" },
  "Overdue":     { bg:"#FDEEEE", text:"#B91C1C", border:"#F5A0A0" },
};
const PRIORITY_COLOR = { Low:"#6B8F71", Medium:"#E0A84A", High:"#D9622B", Urgent:"#B91C1C" };
const CHART_COLORS = ["#C16140","#4A89B8","#6B8F71","#C9962A","#8B5CF6","#EC4899","#14B8A6","#F97316","#6366F1"];

// ─── CLIMATE ZONE LOOKUP ─────────────────────────────────────────────────────
// Maps first 3 digits of US zip code to IECC climate zone (1–8)
// Zone 1-2: Hot/humid (FL, TX Gulf, HI), Zone 3-4: Mixed (SE, Mid-Atlantic, NW coast)
// Zone 5: Cool (Midwest, CO, NE), Zone 6-7: Cold (MN, ME, MT), Zone 8: Subarctic (AK)
const ZIP_CLIMATE = (() => {
  const z = {};
  // Zone 1 — Very Hot Humid (South FL, HI)
  [967,968,969,      // HI
   330,331,332,333,334,339,340, // South FL
  ].forEach(p => { z[p]=1; });
  // Zone 2 — Hot Humid (Most of FL, Gulf Coast TX/LA/MS/AL)
  [335,336,337,338,  // FL
   700,701,703,704,705,706,707,708, // LA
   395,396,          // MS Gulf
   365,366,367,368,369, // AL coast
   750,751,752,753,754,755,756,757,758,759,760,761,762,763,764,765,766,767,768,769,770,771,772,773,774,775,776,777,778,779, // TX
   850,851,852,853,855,856,857,859,860,861,863,864,865,877,878,879,880,881,882,883,884,885, // AZ south
  ].forEach(p => { z[p]=2; });
  // Zone 3 — Warm (GA, SC, NC piedmont, AR, OK, NM, CA inland valleys, NV south)
  [300,301,302,303,304,305,306,307,308,309, // GA
   290,291,292,293,294,295,296,297,298,299, // SC
   270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289, // NC
   716,717,718,719,720,721,722,723,724,725,726,727,728,729, // AR
   730,731,734,735,736,737,738,739,740,741,743,744,745,746,747,748,749, // OK
   870,871,872,873,874,875,876,          // NM
   890,891,893,894,895,897,898,          // NV south
   900,901,902,903,904,905,906,907,908,909,910,911,912,913,914,915,916,917,918,919,920,921,922,923,924,925,926,927,928,930,931,932,933,934,935, // CA south
  ].forEach(p => { z[p]=3; });
  // Zone 4 — Mixed (VA, TN, KY, KS, MO, OR coast, CA north coast, WA coast, NV north)
  [200,201,202,203,204,205,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246, // VA/DC
   370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394, // TN/MS
   400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,420,421,422,423,424,425,426,427, // KY
   660,661,662,664,665,666,667,668,669,670,671,672,673,674,675,676,677,678,679, // KS
   630,631,633,634,635,636,637,638,639,640,641,644,645,646,647,648,650,651,652,653,654,655,656,657,658, // MO
   970,971,972,973,974,975,976,977,978,979, // OR
   980,981,982,983,984,985,986,988,989,990,991,992,993,994, // WA
   936,937,938,939,940,941,942,943,944,945,946,947,948,949,950,951,952,953,954,955,956,957,958,959,960,961, // CA north
  ].forEach(p => { z[p]=4; });
  // Zone 5 — Cool (OH, IN, IL, IA, NE, CO, UT, WV, PA, NJ, NY downstate, NM north)
  [430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,457,458, // OH
   460,461,462,463,464,465,466,467,468,469,470,471,472,473,474,475,476,477,478,479, // IN
   600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624,625,626,627,628,629, // IL
   500,501,502,503,504,505,506,507,508,509,510,511,512,513,514,515,516,520,521,522,523,524,525,526,527,528, // IA
   680,681,683,684,685,686,687,688,689,690,691,692,693, // NE
   800,801,802,803,804,805,806,807,808,809,810,811,812,813,814,815,816, // CO
   840,841,842,843,844,845,846,847, // UT
   247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268, // WV
   150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196, // PA
   70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89, // NJ
   100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119, // NY downstate/LI
   870,871,872,873,874,875,876,       // NM high
  ].forEach(p => { z[p]=5; });
  // Zone 6 — Cold (NY upstate, New England, MI, WI, MN south, ND south, SD, WY, MT south, ID)
  [120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149, // NY upstate
   10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27, // MA/RI
   30,31,32,33,34,35,36,37,38, // NH
   39,40,41,42,43,44,45,46,47,48,49, // ME south
   60,61,62,63,64,65,66,67,68,69, // CT
   480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499, // MI
   530,531,532,534,535,537,538,539,540,541,542,543,544,545,546,547,548,549, // WI
   550,551,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567, // MN south
   570,571,572,573,574,575,576,577, // SD
   820,821,822,823,824,825,826,827,828,829,830,831, // WY
   590,591,592,593,594,595,596,597,598,599, // MT south
   832,833,834,835,836,837,838, // ID
   830,831,                     // WY east
  ].forEach(p => { z[p]=6; });
  // Zone 7 — Very Cold (MN north, ND, northern ME, northern MT, northern ID, AK south)
  [568,               // MN north
   580,581,582,583,584,585,586,587,588, // ND
   47,48,49,       // ME north
   995,996,997,998,   // AK south
  ].forEach(p => { z[p]=7; });
  // Zone 8 — Subarctic (Interior/North AK)
  [997,998,999].forEach(p => { z[p]=8; });
  return z;
})();

function getClimateZone(profile) {
  if (!profile) return 2; // default to zone 2 (hot/humid) since app is FL-based
  const addr = profile.address || "";
  // Try multiple zip extraction patterns
  // Pattern 1: 5-digit zip anywhere in address
  const match = addr.match(/\b(\d{5})(?:-\d{4})?\b/g);
  // Take the last match — usually the zip is at the end: "123 Main St, Tampa, FL 33601"
  const zip = match ? match[match.length - 1].slice(0, 5) : null;
  if (!zip) return 2; // default hot/humid if no zip found
  const prefix = parseInt(zip.substring(0, 3), 10);
  const zone = ZIP_CLIMATE[prefix];
  return zone || 5; // default zone 5 only if prefix not in table
}

// Climate-aware seasonal maintenance tasks
// Each zone has spring/summer/fall/winter task lists
const CLIMATE_TASKS = {
  // Zone 1-2: Hot/Humid (FL, Gulf Coast, HI)
  hot_humid: {
    label: "Hot & Humid Climate",
    spring: ["Inspect AC system before peak heat","Check for mold or mildew in humid areas","Clean gutters before rainy season","Inspect roof for wind damage","Test sump pump and drainage"],
    summer: ["Replace AC filter monthly","Check attic ventilation for heat buildup","Inspect weatherstripping on all doors","Test smoke & CO detectors","Check for pest entry points"],
    fall:   ["Hurricane/storm season prep","Inspect impact windows and shutters","Service AC before shoulder season","Clean dryer vents","Check outdoor lighting"],
    winter: ["Inspect and clean AC coils","Check for roof leaks after heavy rain","Caulk gaps around windows and doors","Service any gas appliances","Inspect irrigation system"],
    icon: "🌴", color: "#FBF3E8", border: "#E8C89A",
  },
  // Zone 3-4: Warm/Mixed (GA, Carolinas, VA, TN, Pacific NW, CA)
  mixed: {
    label: "Warm/Mixed Climate",
    spring: ["Service AC before summer heat","Clean gutters after pollen season","Check roof and attic ventilation","Inspect deck and outdoor structures","Test smoke & CO detectors"],
    summer: ["Replace HVAC filter every 2 months","Check window seals and weatherstripping","Clean dryer vents","Inspect irrigation system","Caulk exterior gaps before humidity"],
    fall:   ["Service furnace or heat pump","Clean gutters after leaf fall","Drain and store garden hoses","Check weatherstripping on doors","Inspect fireplace and chimney"],
    winter: ["Check pipes in unheated spaces","Inspect roof after heavy rain or frost","Test heating system backup","Check attic insulation levels","Inspect water heater"],
    icon: "🌤️", color: "#FBF0F5", border: "#EEC8D8",
  },
  // Zone 5: Cool (Midwest, CO, NE, PA, NJ, NY)
  cool: {
    label: "Cool Climate",
    spring: ["Service AC unit before summer","Clean gutters after winter debris","Check roof for ice dam damage","Inspect and repair driveway cracks","Test sump pump before spring rain"],
    summer: ["Replace HVAC filter every 2 months","Inspect window AC units","Check attic insulation and ventilation","Clean dryer vents","Inspect deck for winter damage"],
    fall:   ["Service furnace — heating season coming","Insulate exposed pipes in unheated spaces","Clean gutters after leaves fall","Drain outdoor faucets and hoses","Check weatherstripping and door seals"],
    winter: ["Keep heating vents clear of furniture","Check for ice dams on roof edges","Monitor pipes in cold snaps","Test smoke & CO detectors","Inspect water heater pressure relief valve"],
    icon: "🍂", color: "#FBF3E8", border: "#E8C89A",
  },
  // Zone 6-7: Cold (MN, ME, MI, WI, MT, WY)
  cold: {
    label: "Cold Climate",
    spring: ["Inspect roof for ice dam and frost damage","Service AC unit if applicable","Repair driveway heave from freeze/thaw","Clean gutters after winter","Check foundation for freeze damage"],
    summer: ["Brief cooling season — service AC","Check window screens and seals","Inspect deck and outdoor structures","Clean dryer vents","Service irrigation system"],
    fall:   ["Service furnace — critical before winter","Heavily insulate all exposed pipes","Install pipe heat tape on vulnerable lines","Drain and winterize irrigation system","Stock emergency heating supplies"],
    winter: ["Monitor for ice dams daily in heavy snow","Keep cabinet doors open in cold snaps","Know your water shutoff location","Check attic for condensation","Inspect roof snow load after major storms"],
    icon: "❄️", color: "#EBF3FA", border: "#A8C8E8",
  },
  // Zone 8: Subarctic (AK)
  subarctic: {
    label: "Subarctic Climate",
    spring: ["Inspect foundation for permafrost shifting","Check roof for snow/ice damage","Service heating system after long winter","Inspect and test generator","Clear drainage around foundation"],
    summer: ["Short season — inspect all exterior wood","Check window and door seals","Inspect deck and structure","Service any cooling equipment","Check for rodent entry points"],
    fall:   ["Critical pipe insulation before freeze","Full furnace and backup heat service","Winterize all water lines","Stock emergency heat and supplies","Insulate water meter and main line"],
    winter: ["Keep emergency supplies stocked","Monitor pipes in extreme cold","Check that heating vents stay clear of snow","Inspect generator monthly","Keep exterior entry areas clear of ice"],
    icon: "🧊", color: "#EBF3FA", border: "#A8C8E8",
  },
};

function getClimateProfile(zone) {
  if (zone <= 2) return CLIMATE_TASKS.hot_humid;
  if (zone <= 4) return CLIMATE_TASKS.mixed;
  if (zone <= 5) return CLIMATE_TASKS.cool;
  if (zone <= 7) return CLIMATE_TASKS.cold;
  return CLIMATE_TASKS.subarctic;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
/* ── SKIP NAV & FOCUS ── */
.skip-nav{position:absolute;top:-100%;left:8px;padding:8px 16px;background:var(--pine);color:var(--linen);border-radius:0 0 8px 8px;z-index:10000;font-weight:600;font-size:.85rem;text-decoration:none}
.skip-nav:focus{top:0}
:focus-visible{outline:2px solid var(--rust);outline-offset:2px;border-radius:3px}
:focus:not(:focus-visible){outline:none}

@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --cream:#F4EDDF; --cream2:#ECE3D2; --white:#FBF7EE; --stone:#E0D8C9; --stone-text:#5E574F; --mid:#BFB5A8;
  --dark:#2A2723; --brown:#7A5C3E; --rust:#C16140; --rust-light:#F6E9E1; --rust-mid:#D2876A;
  --pine:#234A3D; --pine-deep:#173026;
  --sage:#234A3D; --sage-light:#E7EDE7; --sage-soft:#A7BFA8; --gold:#B8861E; --sky:#3A7AAF; --sky-light:#EBF3FA;
  --red:#C0392B; --red-light:#FDECEA;
  --shadow:0 1px 4px rgba(38,33,28,.06),0 4px 16px rgba(38,33,28,.06);
  --shadow-md:0 4px 20px rgba(38,33,28,.1);
  --shadow-lg:0 12px 40px rgba(38,33,28,.14);
  --r:18px; --r-sm:10px; --r-xs:6px;
  --hdr:60px; --bottom-nav:68px;
  --max:1100px;
}

html{scroll-behavior:smooth}
body{background:var(--cream);font-family:'Hanken Grotesk',sans-serif;color:var(--dark);-webkit-font-smoothing:antialiased;overscroll-behavior:none}
.app{min-height:100vh;display:flex;flex-direction:column;padding-bottom:var(--bottom-nav)}
/* app always pads for bottom-nav */

/* ══ HEADER ══ */
.hdr{height:var(--hdr);background:var(--pine);display:flex;align-items:center;justify-content:space-between;padding:0 1.25rem;position:sticky;top:0;z-index:200;gap:.75rem}
.hdr-logo{display:flex;align-items:center;gap:9px;flex-shrink:0}
.hdr-logo .ico{width:32px;height:32px;background:var(--rust);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.hdr-logo .name{font-family:'Fraunces',serif;font-size:1.1rem;font-weight:500;color:#fff;letter-spacing:-.3px}
.search-wrap{flex:1;max-width:520px;position:relative}
.search-wrap input{width:100%;padding:.42rem .85rem .42rem 2.1rem;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.12);border-radius:22px;font-size:.82rem;color:#fff;outline:none;transition:all .2s;font-family:'Hanken Grotesk',sans-serif}
.search-wrap input::placeholder{color:rgba(255,255,255,.35)}
.search-wrap input:focus{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.28)}
.search-icon{position:absolute;left:.65rem;top:50%;transform:translateY(-50%);font-size:.8rem;pointer-events:none;opacity:.45}
.search-results{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--white);border-radius:var(--r-sm);box-shadow:var(--shadow-lg);border:1px solid var(--stone);overflow:hidden;z-index:300}
.sr-item{padding:.6rem .9rem;display:flex;align-items:center;gap:.65rem;cursor:pointer;transition:background .12s;border-bottom:1px solid var(--stone);font-size:.82rem}
.sr-item:last-child{border-bottom:none}
.sr-item:hover{background:var(--cream)}
.sr-type{font-size:.62rem;padding:1px 7px;border-radius:10px;background:var(--stone);color:#7A7370;font-weight:600;white-space:nowrap}

/* user menu */
.user-menu{position:relative;flex-shrink:0}
.user-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.12);border-radius:22px;padding:.3rem .55rem .3rem .3rem;cursor:pointer;transition:all .18s;color:#fff;font-family:'Hanken Grotesk',sans-serif;font-size:.78rem;font-weight:500}
.user-btn:hover{background:rgba(255,255,255,.17)}
.user-avatar{width:30px;height:30px;border-radius:50%;background:var(--rust);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#fff;flex-shrink:0}
.user-dropdown{position:absolute;top:calc(100% + 8px);right:0;background:var(--white);border-radius:var(--r-sm);box-shadow:var(--shadow-lg);border:1px solid var(--stone);overflow:hidden;min-width:190px;z-index:300}
.user-dd-item{padding:.7rem 1rem;font-size:.83rem;cursor:pointer;display:flex;align-items:center;gap:.6rem;color:var(--dark);border-bottom:1px solid var(--stone);transition:background .12s}
.user-dd-item:last-child{border-bottom:none}
.user-dd-item:hover{background:var(--cream)}
.user-dd-item.danger{color:var(--red)}
.user-dd-email{padding:.65rem 1rem;font-size:.72rem;color:#9E9690;border-bottom:1px solid var(--stone);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ══ BOTTOM NAV (mobile) ══ */
.bottom-nav{display:flex;position:fixed;bottom:0;top:auto;left:0;right:0;background:var(--white);border-top:1px solid var(--stone);z-index:200;height:var(--bottom-nav);padding:0 .5rem;padding-bottom:env(safe-area-inset-bottom);-webkit-transform:translateZ(0);transform:translateZ(0);will-change:transform;-webkit-backface-visibility:hidden;backface-visibility:hidden}
/* bottom-nav always visible on all screen sizes */
.bnav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:none;border:none;cursor:pointer;padding:.5rem .25rem;min-width:0;position:relative;transition:transform .15s}
.bnav-btn:active{transform:scale(.92)}
.bnav-icon{font-size:1.35rem;line-height:1;transition:transform .18s}
.bnav-label{font-size:.58rem;font-weight:600;color:#A8A09A;letter-spacing:.3px;white-space:nowrap;transition:color .15s}
.bnav-btn.active .bnav-icon{transform:scale(1.1)}
.bnav-btn.active .bnav-label{color:var(--rust)}
.bnav-badge{position:absolute;top:6px;right:calc(50% - 18px);background:var(--red);color:#fff;border-radius:10px;font-size:.55rem;padding:1px 5px;font-weight:700;line-height:1.4;min-width:14px;text-align:center}
@media(min-width:769px){.bottom-nav{justify-content:center;gap:.25rem;padding:0 2rem;border-top:1.5px solid var(--stone)}}
@media(min-width:769px){.bnav-btn{max-width:140px;flex:0 1 140px;gap:5px}}
@media(min-width:769px){.bnav-label{font-size:.68rem}}
@media(min-width:769px){.bnav-icon{font-size:1.25rem}}

/* ══ MAIN ══ */
.main{flex:1;padding:1.25rem 1rem;max-width:var(--max);margin:0 auto;width:100%}
@media(min-width:769px){.main{padding:1.75rem 1.5rem}}
@media(max-width:480px){.hdr-logo .name{display:none}}

/* ══ TOAST ══ */
.toast-wrap{position:fixed;bottom:calc(var(--bottom-nav) + .75rem);right:.75rem;z-index:999;display:flex;flex-direction:column;gap:.4rem;pointer-events:none}
@media(min-width:769px){.toast-wrap{bottom:calc(var(--bottom-nav) + 1rem);right:1.25rem}}
.toast{background:var(--dark);color:#fff;padding:.6rem 1rem;border-radius:12px;font-size:.82rem;font-weight:500;box-shadow:var(--shadow-lg);opacity:0;transform:translateY(10px);transition:all .25s;pointer-events:none;max-width:280px}
.toast.show{opacity:1;transform:translateY(0)}
.toast.success{border-left:3px solid var(--sage)}
.toast.error{border-left:3px solid var(--red)}

/* ══ GREETING ══ */
.greeting{margin-bottom:1.25rem}
.greeting-time{font-size:.72rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--rust);margin-bottom:.2rem}
.greeting-name{font-family:'Fraunces',serif;font-size:1.7rem;font-weight:500;line-height:1.15;color:var(--dark)}
.greeting-sub{font-size:.83rem;color:#9E9690;margin-top:.2rem}

/* ══ ALERT BANNER ══ */
.alert-banner{background:var(--red-light);border:1px solid #EFCFCC;border-radius:var(--r-sm);padding:.8rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:.7rem;cursor:pointer;transition:box-shadow .15s}
.alert-banner:hover{box-shadow:var(--shadow-md)}
.alert-banner-text{flex:1;font-size:.83rem;font-weight:500;color:#8B2020}
.alert-banner-count{background:var(--red);color:#fff;border-radius:10px;font-size:.7rem;font-weight:700;padding:2px 8px}

/* ══ STATS ══ */
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:.65rem;margin-bottom:1.25rem}
@media(min-width:480px){.stats{grid-template-columns:repeat(4,1fr)}}
.stat{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1rem 1.1rem;box-shadow:var(--shadow);cursor:pointer;transition:box-shadow .18s,transform .15s;position:relative;overflow:hidden}
.stat:hover{box-shadow:var(--shadow-md);transform:translateY(-1px)}
.stat::before{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0 0 var(--r) var(--r)}
.stat.c-rust::before{background:var(--rust)}
.stat.c-sage::before{background:var(--sage)}
.stat.c-sky::before{background:var(--sky)}
.stat.c-gold::before{background:var(--gold)}
.stat.c-red::before{background:var(--red)}
.stat-label{font-size:.65rem;letter-spacing:.8px;text-transform:uppercase;color:#A8A09A;font-weight:600;margin-bottom:4px}
.stat-val{font-family:'Fraunces',serif;font-size:1.75rem;font-weight:700;line-height:1;color:var(--dark)}
.stat-sub{font-size:.7rem;color:#A8A09A;margin-top:3px}

/* ══ SECTION HEADER ══ */
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;gap:.7rem;flex-wrap:wrap}
.sh-title{font-family:'Fraunces',serif;font-size:1.25rem;font-weight:500;color:var(--dark)}
.sh-right{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}

/* ══ TOOLBAR ══ */
.toolbar{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.85rem;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.toolbar::-webkit-scrollbar{display:none}
.chip{padding:.32rem .8rem;border-radius:22px;font-size:.72rem;font-weight:500;border:1.5px solid var(--stone);background:var(--white);color:#A8A09A;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.chip:hover{border-color:var(--mid);color:var(--dark)}
.chip.on{border-color:var(--rust);background:var(--rust-light);color:var(--rust)}
.sort-select{padding:.32rem .65rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-size:.74rem;font-family:'Hanken Grotesk',sans-serif;color:var(--dark);background:var(--white);cursor:pointer;outline:none;flex-shrink:0}
.sort-select:focus{border-color:var(--rust)}

/* ══ BUTTONS ══ */
.btn{display:inline-flex;align-items:center;gap:5px;padding:.52rem 1.05rem;border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.8rem;font-weight:600;border:none;cursor:pointer;transition:all .18s;white-space:nowrap;flex-shrink:0}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--rust);color:#fff;box-shadow:0 2px 8px rgba(192,90,40,.25)}
.btn-primary:hover{background:#A84820;box-shadow:0 4px 14px rgba(192,90,40,.35)}
.btn-ghost{background:var(--stone);color:var(--dark)}
.btn-ghost:hover{background:var(--mid)}
.btn-sm{padding:.32rem .7rem;font-size:.72rem}
.btn-danger{background:var(--red-light);color:var(--red)}
.btn-danger:hover{background:#F5BFBB}
.btn-icon{width:34px;height:34px;padding:0;justify-content:center;border-radius:10px}

/* ══ CARDS ══ */
.card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);padding:1rem 1.1rem;margin-bottom:.65rem;display:flex;align-items:flex-start;gap:.85rem;transition:box-shadow .18s,transform .15s;cursor:default}
.card:hover{box-shadow:var(--shadow-md)}
.card-ico{font-size:1.3rem;width:42px;height:42px;background:var(--cream2);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.card-body{flex:1;min-width:0}
.card-title-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px}
.card-title{font-weight:600;font-size:.9rem;color:var(--dark)}
.card-meta{font-size:.74rem;color:#A8A09A;display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:3px}
.card-note{font-size:.76rem;color:#7A7370;margin-top:5px;line-height:1.5}
.card-actions{display:flex;gap:4px;flex-shrink:0;align-items:flex-start}

/* ══ BADGES ══ */
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:.65rem;font-weight:700;border:1px solid;letter-spacing:.2px;white-space:nowrap}
.pdot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}

/* ══ QUICK STATUS BUTTONS ══ */
.qs-wrap{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}
.qs-btn{padding:3px 9px;border-radius:12px;font-size:.64rem;font-weight:700;border:1.5px solid transparent;cursor:pointer;transition:all .15s;font-family:'Hanken Grotesk',sans-serif}

/* ══ MODAL / OVERLAY ══ */
.overlay{position:fixed;inset:0;background:rgba(38,33,28,.55);z-index:400;display:flex;align-items:flex-end;justify-content:center;padding:0;backdrop-filter:blur(6px)}
@media(min-width:640px){.overlay{align-items:center;padding:1rem}}
.modal{background:var(--white);border-radius:22px 22px 0 0;width:100%;max-width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(38,33,28,.2);display:flex;flex-direction:column}
@media(min-width:640px){.modal{border-radius:20px;max-width:560px}}
.modal-handle{width:40px;height:4px;border-radius:2px;background:var(--stone);margin:.65rem auto .2rem;flex-shrink:0}
.modal-hdr{padding:.9rem 1.4rem .7rem;border-bottom:1px solid var(--stone);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.modal-title{font-family:'Fraunces',serif;font-size:1.1rem;font-weight:600;color:var(--dark)}
.modal-body{padding:1.1rem 1.4rem;flex:1;overflow-y:auto}
.modal-footer{padding:.8rem 1.4rem 1.1rem;display:flex;gap:.55rem;justify-content:flex-end;border-top:1px solid var(--stone);flex-shrink:0}
.modal-footer .btn{flex:1}
@media(min-width:640px){.modal-footer .btn{flex:0 auto}}

/* confirm */
.confirm-body{padding:1.6rem 1.4rem 1rem;text-align:center}
.confirm-body .ci{font-size:2.8rem;margin-bottom:.7rem}
.confirm-body strong{font-size:1rem;font-family:'Fraunces',serif}
.confirm-body p{font-size:.86rem;color:#7A7370;margin-top:.35rem}

/* ══ FORM FIELDS ══ */
.fg{display:grid;grid-template-columns:1fr 1fr;gap:.85rem}
@media(max-width:480px){.fg{grid-template-columns:1fr}}
.field{display:flex;flex-direction:column;gap:5px}
.field.s2{grid-column:span 2}
@media(max-width:480px){.field.s2{grid-column:span 1}}
label{font-size:.68rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#8A827A}
input,select,textarea{width:100%;padding:.6rem .9rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.88rem;color:var(--dark);background:var(--white);outline:none;transition:border-color .15s;-webkit-appearance:none}
input:focus,select:focus,textarea:focus{border-color:var(--rust);box-shadow:0 0 0 3px rgba(192,90,40,.1)}
textarea{resize:vertical;min-height:70px;line-height:1.5}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A8A09A' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2rem}

/* ══ DASHBOARD SPECIFIC ══ */
.dash-grid{display:grid;grid-template-columns:1fr;gap:1rem;margin-top:1rem}
@media(min-width:769px){.dash-grid{grid-template-columns:1fr 1fr}}
.panel{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1.1rem 1.2rem;box-shadow:var(--shadow)}
.panel-title{font-family:'Fraunces',serif;font-size:1rem;font-weight:500;color:var(--dark);margin-bottom:.85rem;display:flex;align-items:center;gap:.5rem}
.up-item{display:flex;align-items:center;gap:.75rem;padding:.6rem .8rem;border:1px solid var(--stone);border-radius:12px;margin-bottom:.45rem;transition:box-shadow .15s,transform .15s;cursor:pointer;width:100%;background:var(--white);text-align:left;font-family:'Hanken Grotesk',sans-serif;-webkit-tap-highlight-color:rgba(192,90,40,.15)}
.up-item:last-child{margin-bottom:0}
.up-item:hover,.up-item:active{box-shadow:var(--shadow);transform:translateY(-1px);background:var(--cream)}
.up-days{font-size:.66rem;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;flex-shrink:0}

/* ══ WARRANTY BAR ══ */
.wbar{height:5px;border-radius:3px;background:var(--stone);margin-top:8px;overflow:hidden}
.wbar-fill{height:100%;border-radius:3px;transition:width .5s}

/* ══ CHART ══ */
.chart-wrap{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1.1rem 1.2rem;margin-bottom:1.1rem;box-shadow:var(--shadow)}
.chart-title{font-size:.72rem;font-weight:700;color:#A8A09A;letter-spacing:.8px;text-transform:uppercase;margin-bottom:.9rem}
.bar-row{display:flex;align-items:center;gap:.75rem;margin-bottom:.55rem}
.bar-label{font-size:.73rem;min-width:88px;text-align:right;color:#7A7370;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-track{flex:1;height:22px;background:var(--cream);border-radius:5px;overflow:hidden}
.bar-fill{height:100%;border-radius:5px;display:flex;align-items:center;padding-left:8px;font-size:.67rem;font-weight:700;color:#fff;transition:width .6s;white-space:nowrap;overflow:hidden}
.bar-amt{font-size:.71rem;min-width:52px;color:var(--dark);font-weight:600}

/* ══ PROFILE ══ */
.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem;margin-bottom:1.1rem}
.profile-field{background:var(--white);border:1px solid var(--stone);border-radius:var(--r-sm);padding:.85rem 1rem}
.pf-label{font-size:.63rem;text-transform:uppercase;letter-spacing:.8px;color:#A8A09A;font-weight:600;margin-bottom:3px}
.pf-val{font-size:.9rem;font-weight:600;color:var(--dark)}
.home-photo-wrap{position:relative;margin-bottom:1.1rem}
.home-photo-wrap img{width:100%;height:220px;object-fit:cover;object-position:center center;border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow)}
@media(min-width:769px){.home-photo-wrap img{height:300px}}
.home-photo-badge{position:absolute;bottom:.6rem;right:.6rem;background:rgba(38,33,28,.72);color:#fff;font-size:.63rem;padding:3px 8px;border-radius:10px;backdrop-filter:blur(4px)}
.data-panel{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1rem 1.1rem;box-shadow:var(--shadow);margin-bottom:.85rem}
.data-panel-title{font-size:.7rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#A8A09A;margin-bottom:.8rem;display:flex;align-items:center;gap:.4rem}
.tax-row{display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--stone);font-size:.82rem}
.tax-row:last-child{border-bottom:none}
.tax-year{font-weight:700;color:var(--dark);min-width:46px}
.tax-val{color:#7A7370;font-size:.8rem}
.tax-val strong{color:var(--dark);font-weight:600}
.school-item{display:flex;align-items:center;gap:.75rem;padding:.55rem 0;border-bottom:1px solid var(--stone)}
.school-item:last-child{border-bottom:none}
.school-rating{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.88rem;flex-shrink:0}
.school-name{font-size:.83rem;font-weight:600;color:var(--dark)}
.school-meta{font-size:.7rem;color:#A8A09A;margin-top:1px}
.price-event{display:flex;align-items:center;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--stone);font-size:.8rem}
.price-event:last-child{border-bottom:none}
.price-event-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.price-event-label{flex:1;color:#7A7370}
.price-event-val{font-weight:600;color:var(--dark)}

/* ══ LOOKUP BOX ══ */
.lookup-box{background:var(--rust-light);border:1.5px solid #EDCDB8;border-radius:var(--r);padding:1.1rem 1.2rem;margin-bottom:1.1rem}
.lookup-title{font-size:.7rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--rust);margin-bottom:.65rem;display:flex;align-items:center;gap:.45rem}
.lookup-row{display:flex;gap:.55rem;align-items:stretch}
.lookup-row input{flex:1;padding:.6rem .9rem;border:1.5px solid #EDCDB8;border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.86rem;color:var(--dark);background:#fff;outline:none;transition:border-color .15s}
.lookup-row input:focus{border-color:var(--rust);box-shadow:0 0 0 3px rgba(192,90,40,.1)}
.lookup-btn{padding:.6rem 1rem;background:var(--rust);color:#fff;border:none;border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .18s;display:flex;align-items:center;gap:5px}
.lookup-btn:hover{background:#A84820}
.lookup-btn:disabled{opacity:.6;cursor:not-allowed}
.lookup-status{font-size:.77rem;color:#9E9690;margin-top:.55rem;display:flex;align-items:center;gap:.4rem}
.lookup-status.ok{color:var(--sage)}
.lookup-status.err{color:var(--red)}
.lookup-preview{margin-top:.85rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.4rem}
.lookup-chip{background:#fff;border:1px solid #EDCDB8;border-radius:8px;padding:.45rem .75rem}
.lookup-chip-label{font-size:.6rem;text-transform:uppercase;letter-spacing:.8px;color:#A8A09A;font-weight:600}
.lookup-chip-val{font-size:.86rem;font-weight:600;color:var(--dark);margin-top:1px}

/* ══ PHOTO UPLOAD ══ */
.photo-upload-wrap{margin-bottom:1.1rem}
.photo-drop{border:2px dashed var(--stone);border-radius:var(--r);padding:1.8rem 1rem;text-align:center;cursor:pointer;transition:all .18s;background:var(--white);position:relative}
.photo-drop:hover,.photo-drop.drag{border-color:var(--rust);background:var(--rust-light)}
.photo-drop input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.photo-drop-icon{font-size:1.8rem;margin-bottom:.45rem}
.photo-drop-text{font-size:.83rem;color:#9E9690}
.photo-drop-text strong{color:var(--rust)}
.photo-preview{position:relative;display:inline-block;width:100%}
.photo-preview img{width:100%;height:190px;object-fit:cover;border-radius:var(--r);border:1px solid var(--stone)}
.photo-preview-remove{position:absolute;top:.5rem;right:.5rem;background:rgba(38,33,28,.8);color:#fff;border:none;border-radius:7px;padding:4px 9px;font-size:.7rem;cursor:pointer;font-family:'Hanken Grotesk',sans-serif}
.photo-preview-remove:hover{background:var(--red)}
.photo-uploading{display:flex;align-items:center;gap:.55rem;padding:.75rem .9rem;background:var(--rust-light);border-radius:var(--r-sm);font-size:.8rem;color:var(--rust);margin-top:.45rem}

/* ══ EMPTY STATES ══ */
.empty{text-align:center;padding:3rem 1.5rem;color:#A8A09A}
.empty .ei{font-size:2.8rem;margin-bottom:.75rem;display:block}
.empty strong{display:block;font-family:'Fraunces',serif;font-size:1.05rem;color:var(--dark);margin-bottom:.3rem}
.empty p{font-size:.84rem;line-height:1.55;max-width:280px;margin:0 auto .9rem}
.loading{display:flex;align-items:center;justify-content:center;padding:5rem;flex-direction:column;gap:.9rem;color:#A8A09A}
.spinner{width:32px;height:32px;border:2.5px solid var(--stone);border-top-color:var(--rust);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ══ SEASONAL BANNER ══ */
.seasonal-banner{border-radius:var(--r);padding:1rem 1.2rem;margin-bottom:1rem;display:flex;align-items:center;gap:.85rem;cursor:default}
.seasonal-icon{font-size:1.8rem;flex-shrink:0}
.seasonal-title{font-family:'Fraunces',serif;font-size:.95rem;font-weight:500;margin-bottom:.15rem}
.seasonal-tip{font-size:.78rem;line-height:1.5;opacity:.8}

/* ══ HOME HEALTH SCORE ══ */
.health-card{background:var(--white);border:1px solid var(--stone);border-radius:var(--r);padding:1.1rem 1.2rem;box-shadow:var(--shadow);margin-bottom:1rem;display:flex;align-items:center;gap:1.1rem}
.health-ring{position:relative;flex-shrink:0}
.health-ring svg{transform:rotate(-90deg)}
.health-score{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column}
.health-score-num{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:700;line-height:1}
.health-score-label{font-size:.52rem;text-transform:uppercase;letter-spacing:.8px;font-weight:600;margin-top:1px}
.health-desc{flex:1}
.health-title{font-family:'Fraunces',serif;font-size:1rem;font-weight:500;margin-bottom:.25rem}
.health-sub{font-size:.78rem;color:#A8A09A;line-height:1.5}

/* ══ TASK VIEW TOGGLE ══ */
.view-toggle{display:flex;background:var(--cream2);border-radius:10px;padding:3px;gap:2px;flex-shrink:0}
.view-btn{padding:.3rem .75rem;border-radius:8px;font-size:.73rem;font-weight:600;border:none;cursor:pointer;background:none;color:#A8A09A;font-family:'Hanken Grotesk',sans-serif;transition:all .15s;white-space:nowrap}
.view-btn.active{background:var(--white);color:var(--dark);box-shadow:0 1px 4px rgba(38,33,28,.1)}

/* ══ TASK CATEGORY GROUP ══ */
.cat-group{margin-bottom:1.25rem}
.cat-group-header{display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem;padding:.1rem 0}
.cat-group-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.cat-group-name{font-family:'Fraunces',serif;font-size:.95rem;font-weight:500;color:var(--dark)}
.cat-group-count{font-size:.7rem;color:#A8A09A;background:var(--cream2);padding:2px 7px;border-radius:10px}

/* ══ TASK CARD REDESIGN ══ */
.task-card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);padding:.9rem 1rem;margin-bottom:.5rem;transition:box-shadow .18s,transform .15s;position:relative;overflow:hidden}
.task-card:hover{box-shadow:var(--shadow-md);transform:translateY(-1px)}
.task-card.is-overdue{border-left:3px solid var(--red)}
.task-card.is-today{border-left:3px solid var(--rust)}
.task-card.is-done{opacity:.65}
.task-card-top{display:flex;align-items:flex-start;gap:.75rem}
.task-card-check{width:22px;height:22px;border-radius:50%;border:2px solid var(--stone);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .18s;margin-top:1px;background:var(--white)}
.task-card-check:hover{border-color:var(--sage);background:var(--sage-light)}
.task-card-check.done{background:var(--sage);border-color:var(--sage);color:#fff;font-size:.75rem}
.task-card-body{flex:1;min-width:0}
.task-card-title{font-weight:600;font-size:.9rem;color:var(--dark);line-height:1.3;margin-bottom:.25rem}
.task-card-title.done{text-decoration:line-through;color:#A8A09A}
.task-card-meta{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.task-meta-pill{display:inline-flex;align-items:center;gap:3px;font-size:.68rem;padding:2px 7px;border-radius:10px;font-weight:500;white-space:nowrap}
.task-card-note{font-size:.75rem;color:#7A7370;margin-top:.4rem;line-height:1.5}
.task-card-actions{display:flex;gap:3px;flex-shrink:0;opacity:0;transition:opacity .15s}
.task-card:hover .task-card-actions{opacity:1}
.task-card-bottom{margin-top:.65rem;padding-top:.6rem;border-top:1px solid var(--stone);display:flex;gap:.35rem;flex-wrap:wrap}
.task-status-btn{padding:3px 9px;border-radius:10px;font-size:.65rem;font-weight:700;border:1.5px solid transparent;cursor:pointer;transition:all .15s;font-family:'Hanken Grotesk',sans-serif}

/* ══ SEASONAL TASKS ══ */
.seasonal-section{background:var(--cream2);border-radius:var(--r);padding:1rem 1.1rem;margin-bottom:1.1rem;border:1px solid var(--stone)}
.seasonal-section-title{font-size:.7rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A8A09A;margin-bottom:.75rem;display:flex;align-items:center;gap:.4rem}
.seasonal-task-row{display:flex;align-items:center;gap:.7rem;padding:.5rem .6rem;border-radius:10px;margin-bottom:.3rem;background:var(--white);border:1px solid var(--stone);cursor:pointer;transition:box-shadow .12s}
.seasonal-task-row:hover{box-shadow:var(--shadow)}
.seasonal-task-row:last-child{margin-bottom:0}

/* ══ CALENDAR ══ */
.cal-wrap{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);overflow:hidden}
.cal-header{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem;border-bottom:1px solid var(--stone)}
.cal-title{font-family:'Fraunces',serif;font-size:1rem;font-weight:500;color:var(--dark)}
.cal-nav{display:flex;gap:.3rem}
.cal-nav-btn{width:30px;height:30px;border-radius:8px;border:1.5px solid var(--stone);background:var(--white);cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .15s;color:var(--dark)}
.cal-nav-btn:hover{border-color:var(--rust);color:var(--rust)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.cal-dow{text-align:center;font-size:.6rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#A8A09A;padding:.5rem .2rem .4rem}
.cal-day{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:.25rem .15rem;cursor:pointer;border-radius:10px;transition:background .12s;position:relative;min-height:36px}
.cal-day:hover{background:var(--cream2)}
.cal-day.other-month{opacity:.3;cursor:default}
.cal-day.other-month:hover{background:none}
.cal-day.today .cal-day-num{background:var(--rust);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center}
.cal-day.selected{background:var(--rust-light)}
.cal-day.has-overdue .cal-day-num{color:var(--red)}
.cal-day-num{font-size:.78rem;font-weight:500;color:var(--dark);line-height:1;margin-bottom:2px;width:22px;height:22px;display:flex;align-items:center;justify-content:center}
.cal-dots{display:flex;gap:2px;flex-wrap:wrap;justify-content:center;max-width:28px}
.cal-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}

/* mini calendar (dashboard) */
.mini-cal .cal-day{min-height:28px;padding:.15rem .1rem}
.mini-cal .cal-day-num{font-size:.7rem;width:18px;height:18px}
.mini-cal .cal-day.today .cal-day-num{width:18px;height:18px}
.mini-cal .cal-dot{width:4px;height:4px}
.mini-cal .cal-dow{font-size:.55rem;padding:.4rem .1rem .3rem}

/* day detail modal */
.cal-modal-day{font-family:'Fraunces',serif;font-size:1.1rem;font-weight:500;margin-bottom:.85rem;color:var(--dark)}
.cal-modal-empty{text-align:center;padding:1.5rem;color:#A8A09A;font-size:.85rem}
.cal-task-item{display:flex;align-items:flex-start;gap:.65rem;padding:.65rem .8rem;background:var(--cream);border-radius:12px;margin-bottom:.45rem;border:1px solid var(--stone)}
.cal-task-item:last-child{margin-bottom:0}
.cal-task-title{font-size:.87rem;font-weight:600;color:var(--dark);margin-bottom:2px}
.cal-task-meta{font-size:.72rem;color:#A8A09A;display:flex;gap:.5rem;flex-wrap:wrap}

/* ══ EXPENSES REDESIGN ══ */
.invest-hero{background:var(--dark);border-radius:var(--r);padding:1.3rem 1.4rem;margin-bottom:1rem;position:relative;overflow:hidden}
.invest-hero::before{content:'';position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(193,98,43,.18) 0%,transparent 70%);top:-100px;right:-80px;pointer-events:none}
.invest-hero-label{font-size:.65rem;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:.3rem}
.invest-hero-amount{font-family:'Fraunces',serif;font-size:2.4rem;font-weight:700;color:#fff;line-height:1;margin-bottom:.5rem}
.invest-hero-row{display:flex;gap:1.5rem;flex-wrap:wrap}
.invest-hero-stat{display:flex;flex-direction:column}
.invest-hero-stat-val{font-family:'Fraunces',serif;font-size:1.1rem;font-weight:600;color:#fff;line-height:1}
.invest-hero-stat-label{font-size:.65rem;color:rgba(255,255,255,.45);margin-top:2px}
.invest-hero-trend{display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;margin-top:4px}
.trend-up{background:rgba(192,90,40,.25);color:#F0B08A}
.trend-down{background:rgba(78,114,96,.25);color:#7DCBA1}
.trend-flat{background:rgba(255,255,255,.1);color:rgba(255,255,255,.5)}

/* monthly chart */
.month-chart{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1.1rem 1.2rem;margin-bottom:1rem;box-shadow:var(--shadow)}
.month-chart-title{font-size:.7rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#A8A09A;margin-bottom:1rem}
.month-bars{display:flex;align-items:flex-end;gap:3px;height:80px}
.month-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
.month-bar-fill{width:100%;border-radius:4px 4px 0 0;transition:all .3s;min-height:2px}
.month-bar-fill:hover{filter:brightness(1.1)}
.month-bar-label{font-size:.55rem;color:#A8A09A;font-weight:500;white-space:nowrap}
.month-bar-amt{font-size:.55rem;color:#7A7370;font-weight:600;white-space:nowrap}

/* category insight cards */
.cat-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem;margin-bottom:1rem}
.cat-card{background:var(--white);border:1.5px solid var(--stone);border-radius:var(--r-sm);padding:.8rem .9rem;cursor:pointer;transition:all .18s;position:relative;overflow:hidden}
.cat-card:hover{box-shadow:var(--shadow-md);transform:translateY(-1px)}
.cat-card.active{border-color:var(--rust);background:var(--rust-light)}
.cat-card::before{content:'';position:absolute;bottom:0;left:0;right:0;height:3px}
.cat-card-icon{font-size:1.3rem;margin-bottom:.35rem}
.cat-card-name{font-size:.7rem;font-weight:700;color:#7A7370;letter-spacing:.3px;margin-bottom:.2rem}
.cat-card.active .cat-card-name{color:var(--rust)}
.cat-card-amount{font-family:'Fraunces',serif;font-size:1.05rem;font-weight:700;color:var(--dark);line-height:1}
.cat-card-count{font-size:.65rem;color:#A8A09A;margin-top:2px}

/* expense cards (mobile) */
.exp-card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:.85rem 1rem;margin-bottom:.5rem;display:flex;align-items:flex-start;gap:.75rem;box-shadow:var(--shadow);transition:box-shadow .15s}
.exp-card:hover{box-shadow:var(--shadow-md)}
.exp-card-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
.exp-card-body{flex:1;min-width:0}
.exp-card-title{font-weight:600;font-size:.88rem;color:var(--dark);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.exp-card-meta{font-size:.72rem;color:#A8A09A;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.exp-card-amount{font-family:'Fraunces',serif;font-size:1rem;font-weight:700;color:var(--dark);flex-shrink:0}
.exp-project-tag{display:inline-flex;align-items:center;gap:3px;font-size:.65rem;font-weight:600;color:var(--sky);background:var(--sky-light);padding:1px 7px;border-radius:10px;white-space:nowrap}

/* ══ PROJECTS ══ */
.project-card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);margin-bottom:.75rem;overflow:hidden;transition:box-shadow .18s}
.project-card:hover{box-shadow:var(--shadow-md)}
.project-card-header{padding:1rem 1.1rem;display:flex;align-items:flex-start;gap:.85rem;cursor:pointer}
.project-card-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;background:var(--cream2)}
.project-card-body{flex:1;min-width:0}
.project-card-title{font-weight:700;font-size:.95rem;color:var(--dark);margin-bottom:3px}
.project-card-meta{font-size:.73rem;color:#A8A09A;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
.project-card-actions{display:flex;gap:4px;flex-shrink:0}
.project-status{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:700;border:1px solid}
.project-budget-row{padding:.75rem 1.1rem;border-top:1px solid var(--stone);display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap}
.project-budget-stat{display:flex;flex-direction:column}
.project-budget-val{font-family:'Fraunces',serif;font-size:1rem;font-weight:700;color:var(--dark)}
.project-budget-label{font-size:.65rem;color:#A8A09A;margin-top:1px}
.project-progress{flex:1;min-width:120px}
.project-progress-bar{height:6px;border-radius:3px;background:var(--stone);overflow:hidden;margin-top:4px}
.project-progress-fill{height:100%;border-radius:3px;transition:width .5s}
.project-expenses{border-top:1px solid var(--stone);padding:.6rem 1.1rem}
.project-expense-row{display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--stone);font-size:.82rem}
.project-expense-row:last-child{border-bottom:none}
.project-photo{width:100%;height:160px;object-fit:cover;border-top:1px solid var(--stone)}

.exp-card-file{margin-top:.5rem;border-top:1px solid var(--stone);padding-top:.5rem}
.exp-file-thumb{width:100%;max-height:180px;object-fit:cover;border-radius:var(--r-sm);cursor:pointer;transition:opacity .15s}
.exp-file-thumb:hover{opacity:.9}
.exp-file-pdf{display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem;background:var(--cream2);border-radius:var(--r-sm);font-size:.78rem;color:var(--dark);cursor:pointer;text-decoration:none}
.exp-file-pdf:hover{background:var(--stone)}
.exp-upload-inline{border:1.5px dashed var(--stone);border-radius:var(--r-sm);padding:.65rem;text-align:center;cursor:pointer;transition:all .15s;background:var(--white);position:relative;font-size:.75rem;color:#A8A09A}
.exp-upload-inline:hover{border-color:var(--rust);color:var(--rust);background:var(--rust-light)}
.exp-upload-inline input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.exp-upload-progress{font-size:.72rem;color:var(--rust);display:flex;align-items:center;gap:.4rem;margin-top:.3rem}
/* lightbox */
.lightbox{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:999;display:flex;align-items:center;justify-content:center;cursor:pointer}
.lightbox img{max-width:92vw;max-height:88vh;border-radius:var(--r-sm);box-shadow:0 8px 40px rgba(0,0,0,.5)}
.lightbox-close{position:absolute;top:1.2rem;right:1.2rem;background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center}

.lookup-autocomplete{position:relative}
.lookup-suggestions{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--white);border:1.5px solid #EDCDB8;border-radius:var(--r-sm);box-shadow:var(--shadow-lg);z-index:500;overflow:hidden;max-height:220px;overflow-y:auto}
.lookup-suggestion{padding:.65rem .9rem;font-size:.84rem;cursor:pointer;border-bottom:1px solid var(--stone);color:var(--dark);display:flex;align-items:center;gap:.6rem;transition:background .12s}
.lookup-suggestion:last-child{border-bottom:none}
.lookup-suggestion:hover{background:var(--rust-light)}
.lookup-suggestion-icon{font-size:.9rem;flex-shrink:0;opacity:.6}
.lookup-suggestion-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lookup-suggestion-sub{font-size:.72rem;color:#A8A09A;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lookup-not-found{background:var(--cream2);border:1px solid var(--stone);border-radius:var(--r-sm);padding:.8rem 1rem;margin-top:.55rem;font-size:.8rem;color:#7A7370;line-height:1.55}
.lookup-not-found strong{color:var(--dark);display:block;margin-bottom:3px}

/* ══ ASSETS ══ */
.asset-card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);margin-bottom:.75rem;overflow:hidden;transition:box-shadow .18s}
.asset-card:hover{box-shadow:var(--shadow-md)}
.asset-card-header{display:flex;align-items:flex-start;gap:.85rem;padding:1rem 1.1rem}
.asset-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0}
.asset-card-body{flex:1;min-width:0}
.asset-card-title{font-weight:700;font-size:.95rem;color:var(--dark);margin-bottom:3px}
.asset-card-meta{font-size:.73rem;color:#A8A09A;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.asset-card-actions{display:flex;gap:4px;flex-shrink:0}
.asset-condition{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:700;border:1px solid;white-space:nowrap}
.asset-lifespan-row{padding:.7rem 1.1rem;border-top:1px solid var(--stone);display:flex;flex-direction:column;gap:5px}
.asset-lifespan-label{display:flex;justify-content:space-between;font-size:.68rem;color:#A8A09A;font-weight:500}
.asset-lifespan-bar{height:6px;border-radius:3px;background:var(--stone);overflow:hidden}
.asset-lifespan-fill{height:100%;border-radius:3px;transition:width .5s}
.asset-photo{width:100%;height:150px;object-fit:cover;border-top:1px solid var(--stone);cursor:pointer;transition:opacity .15s}
.asset-photo:hover{opacity:.9}
.asset-warranty-row{display:flex;align-items:center;gap:.65rem;padding:.6rem 1.1rem;border-top:1px solid var(--stone);font-size:.8rem}
.asset-service-section{border-top:1px solid var(--stone)}
.asset-service-header{display:flex;align-items:center;justify-content:space-between;padding:.55rem .9rem;background:var(--cream);cursor:pointer}
.asset-service-title{font-size:.68rem;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#A8A09A}
.asset-service-log{padding:.5rem .9rem}
.asset-service-entry{display:flex;align-items:flex-start;gap:.65rem;padding:.55rem 0;border-bottom:1px solid var(--stone);font-size:.82rem}
.asset-service-entry:last-child{border-bottom:none}
.asset-service-dot{width:8px;height:8px;border-radius:50%;background:var(--rust);flex-shrink:0;margin-top:4px}
.asset-service-body{flex:1;min-width:0}
.asset-service-desc{font-weight:600;color:var(--dark);margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.asset-service-meta{font-size:.7rem;color:#A8A09A;display:flex;gap:.5rem}
.asset-service-cost{font-family:'Fraunces',serif;font-weight:700;color:var(--dark);flex-shrink:0;font-size:.88rem}
.asset-stats-row{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--stone)}
.asset-stat{padding:.6rem .7rem;text-align:center;border-right:1px solid var(--stone)}
.asset-stat:last-child{border-right:none}
.asset-stat-val{font-family:'Fraunces',serif;font-size:.95rem;font-weight:700;color:var(--dark);line-height:1}
.asset-stat-label{font-size:.58rem;text-transform:uppercase;letter-spacing:.5px;color:#A8A09A;margin-top:2px;font-weight:600}

/* ══ MY HOME REDESIGN ══ */
.home-hero{border-radius:var(--r);overflow:hidden;margin-bottom:1rem;position:relative}
.home-hero-photo{width:100%;height:240px;object-fit:cover;object-position:center center;display:block}
.photo-pos-bar{display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;background:var(--cream2);border-radius:0 0 var(--r) var(--r);border:1px solid var(--stone);border-top:none;margin-bottom:.75rem}
.photo-pos-label{font-size:.72rem;color:#9E9690;font-weight:600;white-space:nowrap;flex-shrink:0}
.photo-pos-bar input[type=range]{flex:1;accent-color:var(--rust);height:3px;cursor:pointer}
.photo-pos-toggle{font-size:.72rem;font-weight:600;color:var(--rust);background:none;border:none;cursor:pointer;padding:0;white-space:nowrap;font-family:'Hanken Grotesk',sans-serif;flex-shrink:0}
.home-hero-overlay{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(38,33,28,.85) 0%,transparent 100%);padding:1.2rem 1.2rem .9rem}
.home-hero-name{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:500;color:#fff;line-height:1.2}
.home-hero-address{font-size:.78rem;color:rgba(255,255,255,.65);margin-top:3px}
.home-hero-no-photo{background:var(--dark);padding:1.5rem 1.2rem;border-radius:var(--r);margin-bottom:1rem}
.home-hero-no-photo .home-hero-name{color:#fff}
.home-hero-no-photo .home-hero-address{color:rgba(255,255,255,.5)}

/* value hero */
.value-hero{background:var(--dark);border-radius:var(--r);padding:1.2rem 1.3rem;margin-bottom:1rem;position:relative;overflow:hidden}
.value-hero::before{content:'';position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(78,114,96,.2) 0%,transparent 70%);top:-80px;right:-60px;pointer-events:none}
.value-hero-label{font-size:.63rem;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:.25rem}
.value-hero-amount{font-family:'Fraunces',serif;font-size:2.2rem;font-weight:700;color:#fff;line-height:1;margin-bottom:.6rem}
.value-hero-row{display:flex;gap:1.2rem;flex-wrap:wrap;align-items:flex-start}
.value-hero-stat{display:flex;flex-direction:column}
.value-hero-stat-val{font-family:'Fraunces',serif;font-size:.95rem;font-weight:600;color:#fff;line-height:1}
.value-hero-stat-label{font-size:.62rem;color:rgba(255,255,255,.4);margin-top:2px}
.value-appreciation{display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:10px;margin-top:.5rem}
.appreciation-pos{background:rgba(78,114,96,.3);color:#7DCBA1}
.appreciation-neg{background:rgba(192,90,40,.25);color:#F0B08A}

/* home sections */
.home-section{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);margin-bottom:1rem;overflow:hidden}
.home-section-header{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1.1rem;border-bottom:1px solid var(--stone);background:var(--cream)}
.home-section-title{font-family:'Fraunces',serif;font-size:.95rem;font-weight:500;color:var(--dark);display:flex;align-items:center;gap:.5rem}
.home-section-body{padding:.9rem 1.1rem}
.home-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.6rem}
.home-fact{display:flex;flex-direction:column;gap:2px}
.home-fact-label{font-size:.63rem;text-transform:uppercase;letter-spacing:.8px;color:#A8A09A;font-weight:600}
.home-fact-val{font-size:.92rem;font-weight:600;color:var(--dark)}
.home-age-badge{display:inline-flex;align-items:center;gap:.4rem;background:var(--cream2);border:1px solid var(--stone);border-radius:var(--r-sm);padding:.45rem .75rem;font-size:.78rem;color:var(--dark);margin-top:.6rem;flex-wrap:wrap}
.home-age-badge strong{color:var(--rust)}

/* system age warnings */
.system-age-list{display:flex;flex-direction:column;gap:.4rem;margin-top:.65rem}
.system-age-item{display:flex;align-items:center;gap:.65rem;padding:.55rem .75rem;border-radius:var(--r-sm);border:1px solid;transition:box-shadow .15s}
.system-age-item.clickable{cursor:pointer}
.system-age-item.clickable:hover{box-shadow:var(--shadow-md)}
.system-age-item.warn{background:#FFF8E6;border-color:#F5CC76}
.system-age-item.ok{background:var(--sage-light);border-color:#B8D9CC}
.system-age-item.alert{background:var(--red-light);border-color:#EFCFCC}
.system-age-icon{font-size:1.1rem;flex-shrink:0}
.system-age-name{font-size:.82rem;font-weight:600;flex:1}
.system-age-detail{font-size:.72rem;color:#7A7370}

/* insurance */
.ins-card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);margin-bottom:1rem;overflow:hidden}
.ins-header{display:flex;align-items:center;gap:.75rem;padding:1rem 1.1rem;background:var(--dark)}
.ins-header-icon{width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
.ins-header-body{flex:1}
.ins-company{font-family:'Fraunces',serif;font-size:1rem;font-weight:500;color:#fff}
.ins-policy{font-size:.73rem;color:rgba(255,255,255,.45);margin-top:1px}
.ins-renewal-banner{display:flex;align-items:center;gap:.6rem;padding:.6rem 1.1rem;font-size:.78rem;font-weight:500}
.ins-renewal-ok{background:var(--sage-light);color:var(--sage);border-bottom:1px solid #B8D9CC}
.ins-renewal-soon{background:#FFF8E6;color:#92610A;border-bottom:1px solid #F5CC76}
.ins-renewal-urgent{background:var(--red-light);color:var(--red);border-bottom:1px solid #EFCFCC}
.ins-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.6rem;padding:.9rem 1.1rem}
.ins-field{display:flex;flex-direction:column;gap:2px}
.ins-field-label{font-size:.62rem;text-transform:uppercase;letter-spacing:.8px;color:#A8A09A;font-weight:600}
.ins-field-val{font-size:.88rem;font-weight:600;color:var(--dark)}
.ins-empty{text-align:center;padding:1.8rem 1rem;border:2px dashed var(--stone);border-radius:var(--r);cursor:pointer;transition:all .18s}
.ins-empty:hover{border-color:var(--rust);background:var(--rust-light)}
.ins-empty-icon{font-size:2rem;margin-bottom:.5rem}
.ins-empty-title{font-family:'Fraunces',serif;font-size:.95rem;font-weight:500;margin-bottom:.3rem}
.ins-empty-sub{font-size:.78rem;color:#A8A09A}

/* ══ UTILITIES ══ */
.util-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.85rem;margin-bottom:1rem}
.util-card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);overflow:hidden;transition:box-shadow .18s}
.util-card:hover{box-shadow:var(--shadow-md)}
.util-card-header{padding:1rem 1.1rem;display:flex;align-items:center;gap:.85rem}
.util-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0}
.util-card-body{flex:1;min-width:0}
.util-card-name{font-weight:700;font-size:.95rem;color:var(--dark);margin-bottom:1px}
.util-card-provider{font-size:.75rem;color:#A8A09A}
.util-card-actions{display:flex;gap:3px;flex-shrink:0}
.util-stats{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--stone)}
.util-stat{padding:.65rem .8rem;text-align:center;border-right:1px solid var(--stone)}
.util-stat:last-child{border-right:none}
.util-stat-val{font-family:'Fraunces',serif;font-size:1rem;font-weight:700;color:var(--dark);line-height:1}
.util-stat-label{font-size:.6rem;text-transform:uppercase;letter-spacing:.6px;color:#A8A09A;margin-top:2px;font-weight:600}
.util-spike{display:flex;align-items:center;gap:.4rem;padding:.5rem .8rem;background:var(--red-light);border-top:1px solid #EFCFCC;font-size:.75rem;color:var(--red);font-weight:500}
.util-bills-section{border-top:1px solid var(--stone)}
.util-bills-header{display:flex;align-items:center;justify-content:space-between;padding:.6rem .9rem;background:var(--cream)}
.util-bills-title{font-size:.7rem;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#A8A09A}
.util-bill-row{display:flex;align-items:center;gap:.7rem;padding:.55rem .9rem;border-bottom:1px solid var(--stone);font-size:.83rem;transition:background .12s;cursor:default}
.util-bill-row:last-child{border-bottom:none}
.util-bill-row:hover{background:var(--cream)}
.util-bill-date{font-size:.75rem;color:#A8A09A;min-width:80px;flex-shrink:0}
.util-bill-usage{font-size:.75rem;color:#7A7370;flex:1}
.util-bill-amount{font-family:'Fraunces',serif;font-weight:700;color:var(--dark);flex-shrink:0}
.util-bill-actions{display:flex;gap:3px;flex-shrink:0;opacity:0;transition:opacity .15s}
.util-bill-row:hover .util-bill-actions{opacity:1}
.util-mini-chart{display:flex;align-items:flex-end;gap:2px;height:32px;padding:.5rem .9rem .6rem;border-top:1px solid var(--stone)}
.util-mini-bar{flex:1;border-radius:2px 2px 0 0;min-height:2px;transition:height .3s;cursor:pointer;position:relative}
.util-mini-bar:hover{filter:brightness(1.15)}
.util-setup-card{background:var(--white);border:2px dashed var(--stone);border-radius:var(--r);padding:2rem;text-align:center;cursor:pointer;transition:all .18s}
.util-setup-card:hover{border-color:var(--rust);background:var(--rust-light)}
.util-type-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.5rem}
.util-type-btn{padding:.7rem .4rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);background:var(--white);cursor:pointer;text-align:center;transition:all .15s;font-family:'Hanken Grotesk',sans-serif}
.util-type-btn:hover{border-color:var(--rust);background:var(--rust-light)}
.util-type-btn.selected{border-color:var(--rust);background:var(--rust-light)}
.util-type-icon{font-size:1.4rem;display:block;margin-bottom:3px}
.util-type-label{font-size:.68rem;font-weight:600;color:var(--dark)}
.pro-gate{display:flex;align-items:center;gap:.5rem;padding:.6rem .85rem;background:linear-gradient(135deg,#2A2622,#4A3828);border-radius:var(--r-sm);border:1px solid rgba(193,98,43,.3);cursor:pointer;transition:all .18s}
.pro-gate:hover{border-color:rgba(193,98,43,.6)}
.pro-gate-text{flex:1;font-size:.78rem;color:rgba(255,255,255,.8);font-weight:500}
.pro-gate-badge{background:var(--rust);color:#fff;font-size:.6rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 7px;border-radius:10px;flex-shrink:0}

/* ══ DOCUMENT VAULT ══ */
.doc-vault{margin-bottom:1rem}
.doc-category{margin-bottom:1rem;background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);overflow:hidden}
.doc-category-header{display:flex;align-items:center;gap:.75rem;padding:.85rem 1.1rem;cursor:pointer;transition:background .12s;user-select:none}
.doc-category-header:hover{background:var(--cream)}
.doc-category-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
.doc-category-name{font-family:'Fraunces',serif;font-size:.95rem;font-weight:500;color:var(--dark);flex:1}
.doc-category-count{font-size:.7rem;color:#A8A09A;background:var(--cream2);padding:2px 8px;border-radius:10px;font-weight:600}
.doc-category-arrow{font-size:.75rem;color:#A8A09A;transition:transform .2s}
.doc-category-arrow.open{transform:rotate(90deg)}
.doc-list{border-top:1px solid var(--stone)}
.doc-item{display:flex;align-items:center;gap:.75rem;padding:.7rem 1.1rem;border-bottom:1px solid var(--stone);transition:background .12s}
.doc-item:last-child{border-bottom:none}
.doc-item:hover{background:var(--cream)}
.doc-item-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;background:var(--cream2)}
.doc-item-body{flex:1;min-width:0}
.doc-item-name{font-size:.87rem;font-weight:600;color:var(--dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-item-meta{font-size:.7rem;color:#A8A09A;display:flex;gap:.5rem;flex-wrap:wrap;margin-top:2px;align-items:center}
.doc-item-actions{display:flex;gap:3px;flex-shrink:0;opacity:0;transition:opacity .15s}
.doc-item:hover .doc-item-actions{opacity:1}
.doc-add-row{display:flex;align-items:center;gap:.5rem;padding:.6rem 1.1rem;border-top:1px solid var(--stone);background:var(--cream)}
.doc-upload-zone{border:2px dashed var(--stone);border-radius:var(--r-sm);padding:1.2rem;text-align:center;cursor:pointer;transition:all .18s;background:var(--white);position:relative;margin-bottom:.5rem}
.doc-upload-zone:hover,.doc-upload-zone.drag{border-color:var(--rust);background:var(--rust-light)}
.doc-upload-zone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.doc-upload-icon{font-size:1.5rem;margin-bottom:.3rem}
.doc-upload-text{font-size:.8rem;color:#A8A09A}
.doc-upload-text strong{color:var(--rust)}
.doc-expiry-badge{display:inline-flex;align-items:center;gap:3px;font-size:.62rem;font-weight:700;padding:1px 6px;border-radius:8px}
.doc-expiry-ok{background:var(--sage-light);color:var(--sage)}
.doc-expiry-soon{background:#FFF8E6;color:#92610A}
.doc-expiry-expired{background:var(--red-light);color:var(--red)}

/* ══ AI SCAN ══ */
.scan-btn{width:100%;padding:.8rem;border-radius:var(--r-sm);border:none;cursor:pointer;font-family:'Hanken Grotesk',sans-serif;font-size:.9rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:.5rem;transition:all .18s;position:relative;overflow:hidden}
.scan-btn-bg{background:linear-gradient(135deg,#2A2622 0%,#4A3828 50%,#2A2622 100%);background-size:200% 100%;animation:shimmer 3s infinite;color:#fff}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.scan-btn-badge{background:var(--rust);color:#fff;font-size:.58rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 7px;border-radius:10px;flex-shrink:0}
.scan-divider{display:flex;align-items:center;gap:.6rem;margin:.6rem 0;color:#A8A09A;font-size:.75rem}
.scan-divider::before,.scan-divider::after{content:'';flex:1;height:1px;background:var(--stone)}
.pro-modal-wrap{position:fixed;inset:0;background:rgba(38,33,28,.65);z-index:500;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(8px)}
@media(min-width:640px){.pro-modal-wrap{align-items:center}}
.pro-modal{background:var(--dark);border-radius:22px 22px 0 0;width:100%;max-width:480px;padding:2rem 1.8rem 2.5rem;position:relative;z-index:1;box-shadow:0 -8px 40px rgba(0,0,0,.4)}
@media(min-width:640px){.pro-modal{border-radius:22px}}
.pro-modal-handle{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);margin:0 auto 1.5rem}
.pro-modal-icon{font-size:2.5rem;text-align:center;margin-bottom:.75rem}
.pro-modal-title{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:500;color:#fff;text-align:center;margin-bottom:.4rem}
.pro-modal-sub{font-size:.88rem;color:rgba(255,255,255,.55);text-align:center;line-height:1.6;margin-bottom:1.5rem}
.pro-modal-features{display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.5rem}
.pro-modal-feature{display:flex;align-items:center;gap:.7rem;padding:.6rem .8rem;background:rgba(255,255,255,.05);border-radius:10px;border:1px solid rgba(255,255,255,.08)}
.pro-modal-feature-icon{font-size:1.1rem;flex-shrink:0}
.pro-modal-feature-text{font-size:.83rem;color:rgba(255,255,255,.8)}
.pro-modal-feature-text strong{color:#fff;display:block;margin-bottom:1px}
.pro-modal-cta{width:100%;padding:.9rem;background:var(--rust);color:#fff;border:none;border-radius:12px;font-family:'Hanken Grotesk',sans-serif;font-size:.95rem;font-weight:700;cursor:pointer;transition:all .18s;box-shadow:0 4px 20px rgba(192,90,40,.4);margin-bottom:.75rem}
.pro-modal-cta:hover{background:#A84820;transform:translateY(-1px)}
.pro-modal-dismiss{width:100%;padding:.6rem;background:none;border:none;color:rgba(255,255,255,.4);font-family:'Hanken Grotesk',sans-serif;font-size:.83rem;cursor:pointer}
.pro-modal-dismiss:hover{color:rgba(255,255,255,.7)}

/* ══ EXPENSE TABLE ══ */
.exp-table{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);overflow:hidden}
.exp-table table{width:100%;border-collapse:collapse;font-size:.83rem}
.exp-table th{text-align:left;padding:.6rem .9rem;font-size:.66rem;letter-spacing:.8px;text-transform:uppercase;color:#A8A09A;border-bottom:1px solid var(--stone);background:var(--cream);font-weight:600;white-space:nowrap}
.exp-table td{padding:.8rem .9rem;border-bottom:1px solid var(--stone);vertical-align:middle}
.exp-table tr:last-child td{border-bottom:none}
.exp-table .total-row td{border-top:2px solid var(--stone);font-weight:700;background:var(--cream2)}
@media(max-width:600px){.exp-hide{display:none}}

/* ══ AUTH SCREEN ══ */

/* ── LANDING PAGE (redesign) ── */
.lp-root{
  --pine:#234A3D; --pine-deep:#173026; --pine-soft:#2C5A49;
  --terracotta:#C16140; --terracotta-soft:#D2876A; --terracotta-deep:#A84E30;
  --sage:#A7BFA8; --sage-deep:#7FA088;
  --linen:#F4EDDF; --linen-2:#EFE7D7; --linen-3:#E6DCC8; --card:#FBF7EE;
  --ink:#2A2723; --ink-soft:#5A534B; --gold:#B8861E;
  --line:rgba(42,39,35,.10);
  --display:'Fraunces',Georgia,serif;
  --body:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,sans-serif;
  --maxw:1180px;
  min-height:100vh;overflow-x:hidden;position:relative;
  background:var(--linen);color:var(--ink);
  font-family:var(--body);-webkit-font-smoothing:antialiased;
  line-height:1.6;letter-spacing:-.005em;
  -webkit-text-size-adjust:100%;text-size-adjust:100%;overflow-wrap:break-word;
  -webkit-tap-highlight-color:transparent;
}
.lp-root *{box-sizing:border-box}
.lp-root::selection,.lp-root ::selection{background:var(--terracotta);color:#fff}
/* grain overlay */
.lp-root::before{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.05;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.lp-root .wrap{width:100%;max-width:var(--maxw);margin:0 auto;padding:0 28px}

/* reveal-on-scroll */
.lp-root .rv{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
.lp-root .rv.in{opacity:1;transform:none}

/* ---------- NAV ---------- */
.lp-root .lp-nav{position:fixed;top:0;left:0;right:0;z-index:1000;transition:background .35s,box-shadow .35s,border-color .35s,backdrop-filter .35s;border-bottom:1px solid transparent}
.lp-root .lp-nav.solid{background:rgba(244,237,223,.82);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);border-bottom-color:var(--line);box-shadow:0 8px 30px -22px rgba(23,48,38,.5)}
.lp-root .lp-nav-in{display:flex;align-items:center;justify-content:space-between;height:72px;max-width:var(--maxw);margin:0 auto;padding:0 28px}
.lp-root .lp-brand{display:flex;align-items:center;gap:11px}
.lp-root .lp-brand .tile{width:38px;height:38px;border-radius:11px;background:radial-gradient(120% 120% at 30% 18%,var(--pine-soft),var(--pine) 55%,var(--pine-deep));display:flex;align-items:center;justify-content:center;box-shadow:0 10px 22px -12px rgba(23,48,38,.7);flex-shrink:0}
.lp-root .lp-brand .tile svg{width:60%;height:60%;display:block}
.lp-root .lp-brand .wm{font-family:var(--display);font-weight:600;font-size:1.4rem;letter-spacing:-.02em;color:var(--linen);transition:color .35s}
.lp-root .lp-nav.solid .lp-brand .wm{color:var(--pine)}
.lp-root .lp-nav-links{display:flex;align-items:center;gap:34px}
.lp-root .lp-nav-links a{font-size:.92rem;font-weight:500;color:rgba(244,237,223,.78);cursor:pointer;transition:color .25s;position:relative}
.lp-root .lp-nav-links a::after{content:"";position:absolute;left:0;right:100%;bottom:-5px;height:1.5px;background:var(--terracotta-soft);transition:right .3s cubic-bezier(.22,1,.36,1)}
.lp-root .lp-nav-links a:hover::after{right:0}
.lp-root .lp-nav.solid .lp-nav-links a{color:var(--ink-soft)}
.lp-root .lp-nav-cta{display:flex;align-items:center;gap:18px}
.lp-root .lp-signin{font-size:.92rem;font-weight:600;color:rgba(244,237,223,.85);cursor:pointer;transition:color .25s;background:none;border:none;font-family:var(--body)}
.lp-root .lp-nav.solid .lp-signin{color:var(--pine)}
.lp-root .lp-signin:hover{color:var(--terracotta)}

/* buttons */
.lp-root .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:var(--body);font-weight:600;font-size:.95rem;border:none;border-radius:40px;cursor:pointer;transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .25s,background .25s,color .25s;white-space:nowrap;line-height:1}
.lp-root .btn:active{transform:translateY(0) scale(.985)}
.lp-root .btn-terra{background:var(--terracotta);color:#fff;padding:.82rem 1.5rem;box-shadow:0 14px 30px -12px rgba(193,97,64,.7)}
.lp-root .btn-terra:hover{transform:translateY(-2px);background:var(--terracotta-deep);box-shadow:0 20px 40px -14px rgba(193,97,64,.75)}
.lp-root .btn-pine{background:var(--pine);color:var(--linen);padding:.82rem 1.5rem;box-shadow:0 14px 30px -14px rgba(23,48,38,.65)}
.lp-root .btn-pine:hover{transform:translateY(-2px);background:var(--pine-deep)}
.lp-root .btn-ghost{background:rgba(255,255,255,.06);color:rgba(244,237,223,.92);padding:.8rem 1.4rem;border:1.5px solid rgba(255,255,255,.2);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.lp-root .btn-ghost:hover{background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.4)}
.lp-root .btn-outline{background:transparent;color:var(--pine);padding:.82rem 1.5rem;border:1.5px solid rgba(35,74,61,.28)}
.lp-root .btn-outline:hover{border-color:var(--pine);background:rgba(35,74,61,.04)}
.lp-root .btn-xl{font-size:1.05rem;padding:1.05rem 2.1rem}

/* ---------- HERO ---------- */
.lp-root .hero{position:relative;background:var(--pine-deep);color:var(--linen);padding:148px 0 90px;overflow:hidden;isolation:isolate}
.lp-root .hero-bg{position:absolute;inset:0;z-index:-1;overflow:hidden}
.lp-root .hero-bg .glow1{position:absolute;width:760px;height:760px;top:-280px;right:-180px;border-radius:50%;background:radial-gradient(circle,rgba(44,90,73,.85),transparent 62%)}
.lp-root .hero-bg .glow2{position:absolute;width:620px;height:620px;bottom:-300px;left:-200px;border-radius:50%;background:radial-gradient(circle,rgba(193,97,64,.22),transparent 65%)}
.lp-root .hero-bg .contour{position:absolute;inset:0;opacity:.5;color:rgba(167,191,168,.14)}
.lp-root .hero-bg .contour svg{width:100%;height:100%}
.lp-root .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
.lp-root .hero-badge{display:inline-flex;align-items:center;gap:9px;font-size:.78rem;font-weight:600;letter-spacing:.02em;color:rgba(244,237,223,.9);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);padding:.42rem .9rem;border-radius:40px;margin-bottom:30px}
.lp-root .hero-badge .pdot{width:7px;height:7px;border-radius:50%;background:var(--terracotta-soft);box-shadow:0 0 0 0 rgba(210,135,106,.6);animation:lp-pulse 2.4s infinite}
@keyframes lp-pulse{0%{box-shadow:0 0 0 0 rgba(210,135,106,.5)}70%{box-shadow:0 0 0 8px rgba(210,135,106,0)}100%{box-shadow:0 0 0 0 rgba(210,135,106,0)}}
.lp-root .hero h1{font-family:var(--display);font-weight:340;font-size:clamp(3rem,6.6vw,5.4rem);line-height:.98;letter-spacing:-.035em;color:#fff;margin:0 0 1.5rem;font-optical-sizing:auto}
.lp-root .hero h1 em{font-style:italic;font-weight:400;color:var(--terracotta-soft)}
.lp-root .hero-p{font-size:clamp(1.05rem,1.5vw,1.22rem);line-height:1.62;color:rgba(244,237,223,.74);max-width:30rem;margin:0 0 2rem}
/* faux address bar */
.lp-root .hero-addr{display:flex;align-items:center;gap:12px;background:rgba(251,247,238,.96);border-radius:16px;padding:.7rem .7rem .7rem 1.1rem;max-width:30rem;box-shadow:0 24px 50px -22px rgba(0,0,0,.55);margin-bottom:1.6rem}
.lp-root .hero-addr .pin{color:var(--terracotta);flex-shrink:0;display:flex}
.lp-root .hero-addr .pin svg{width:20px;height:20px}
.lp-root .hero-addr .typed{flex:1;font-size:.98rem;color:var(--ink);font-weight:500;min-width:0;overflow:hidden;white-space:nowrap}
.lp-root .hero-addr .typed .caret{display:inline-block;width:2px;height:1.05em;background:var(--terracotta);margin-left:1px;vertical-align:-2px;animation:lp-blink 1.1s steps(1) infinite}
@keyframes lp-blink{50%{opacity:0}}
.lp-root .hero-addr .go{background:var(--pine);color:#fff;border-radius:11px;padding:.6rem .95rem;font-size:.85rem;font-weight:600;display:flex;align-items:center;gap:6px;flex-shrink:0}
.lp-root .hero-btns{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:1.3rem}
.lp-root .hero-micro{font-size:.86rem;color:rgba(244,237,223,.55)}
.lp-root .hero-micro b{color:rgba(244,237,223,.85);font-weight:600}

/* product preview card */
.lp-root .hero-vis{position:relative}
.lp-root .hero-vis .blob{position:absolute;inset:-8% -6% -12% -4%;background:radial-gradient(120% 120% at 70% 20%,rgba(167,191,168,.22),transparent 60%);border-radius:30px;z-index:-1}
.lp-root .pv{background:var(--card);border-radius:20px;box-shadow:0 40px 90px -30px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04);overflow:hidden;transform:perspective(1600px) rotateY(-6deg) rotateX(2.5deg);transform-origin:center;transition:transform .5s cubic-bezier(.22,1,.36,1)}
.lp-root .hero-vis:hover .pv{transform:perspective(1600px) rotateY(-2deg) rotateX(1deg)}
.lp-root .pv-bar{display:flex;align-items:center;gap:8px;padding:.7rem .9rem;background:var(--linen-2);border-bottom:1px solid var(--line)}
.lp-root .pv-bar i{width:9px;height:9px;border-radius:50%;background:rgba(42,39,35,.16)}
.lp-root .pv-url{margin-left:8px;font-size:.7rem;color:var(--ink-soft);background:var(--card);border-radius:20px;padding:.2rem .8rem}
.lp-root .pv-body{padding:1.2rem 1.3rem 1.4rem}
.lp-root .pv-greet{font-family:var(--display);font-size:1.25rem;font-weight:500;color:var(--pine);letter-spacing:-.01em}
.lp-root .pv-sub{font-size:.78rem;color:var(--ink-soft);margin:.2rem 0 1rem}
.lp-root .pv-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin-bottom:1rem}
.lp-root .pv-stat{border-radius:12px;padding:.7rem .75rem;background:var(--linen);border:1px solid var(--line)}
.lp-root .pv-stat.accent{background:rgba(193,97,64,.1);border-color:rgba(193,97,64,.2)}
.lp-root .pv-stat.amber{background:rgba(184,134,30,.1);border-color:rgba(184,134,30,.22)}
.lp-root .pv-stat .k{font-size:.62rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft);font-weight:600}
.lp-root .pv-stat .v{font-family:var(--display);font-size:1.35rem;font-weight:600;color:var(--pine);margin-top:2px}
.lp-root .pv-stat.accent .v{color:var(--terracotta)}
.lp-root .pv-stat.amber .v{color:var(--gold)}
.lp-root .pv-row{display:flex;align-items:center;gap:.7rem;padding:.6rem .2rem;border-top:1px solid var(--line)}
.lp-root .pv-row .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.lp-root .pv-row .tl{flex:1;font-size:.82rem;color:var(--ink);font-weight:500}
.lp-root .pv-row .tr{font-size:.72rem;color:var(--ink-soft);font-weight:600}

/* ---------- STATS BAND ---------- */
.lp-root .stats{display:block;background:var(--linen);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.lp-root .stats-in{display:grid;grid-template-columns:repeat(4,1fr);padding:44px 0;align-items:start}
.lp-root .stat-cell{text-align:center;padding:0 18px;border-right:1px solid var(--line)}
.lp-root .stat-cell:last-child{border-right:none}
.lp-root .stat-n{font-family:var(--display);font-weight:600;font-size:clamp(2rem,3.5vw,2.8rem);color:var(--pine);line-height:1;letter-spacing:-.02em;white-space:nowrap}
.lp-root .stat-n .suf{color:var(--terracotta);font-size:.52em;letter-spacing:-.01em;vertical-align:.1em}
.lp-root .stat-l{font-size:.82rem;color:var(--ink-soft);margin-top:.5rem;font-weight:500}

/* ---------- MARQUEE ---------- */
.lp-root .qs{background:var(--pine);color:var(--linen);padding:34px 0;overflow:hidden;position:relative}
.lp-root .qs-label{text-align:center;font-size:.74rem;text-transform:uppercase;letter-spacing:.22em;color:rgba(167,191,168,.85);font-weight:700;margin-bottom:22px}
.lp-root .qs-track{display:flex;gap:14px;width:max-content;animation:lp-marquee 38s linear infinite}
.lp-root .qs:hover .qs-track{animation-play-state:paused}
@keyframes lp-marquee{to{transform:translateX(-50%)}}
.lp-root .q-pill{flex-shrink:0;font-family:var(--display);font-style:italic;font-size:1.05rem;color:rgba(244,237,223,.9);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);padding:.6rem 1.3rem;border-radius:40px;white-space:nowrap}
.lp-root .qs::before,.lp-root .qs::after{content:"";position:absolute;top:0;bottom:0;width:90px;z-index:2;pointer-events:none}
.lp-root .qs::before{left:0;background:linear-gradient(90deg,var(--pine),transparent)}
.lp-root .qs::after{right:0;background:linear-gradient(270deg,var(--pine),transparent)}

/* ---------- SECTION SHELL ---------- */
.lp-root .block{padding:clamp(72px,9vw,118px) 0}
.lp-root .eyebrow{font-size:.76rem;letter-spacing:.2em;text-transform:uppercase;color:var(--terracotta);font-weight:700;margin-bottom:18px}
.lp-root .h2{font-family:var(--display);font-weight:380;font-size:clamp(2.1rem,4.6vw,3.4rem);line-height:1.04;letter-spacing:-.028em;color:var(--pine);margin:0}
.lp-root .h2 em{font-style:italic;color:var(--terracotta)}
.lp-root .head{max-width:36rem;margin-bottom:56px}
.lp-root .head.center{margin-left:auto;margin-right:auto;text-align:center}
.lp-root .sub{font-size:1.06rem;line-height:1.6;color:var(--ink-soft);margin:18px 0 0}

/* editorial statement band */
.lp-root .band{background:var(--linen-2);padding:clamp(76px,10vw,128px) 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.lp-root .band .stmt{font-family:var(--display);font-weight:380;font-size:clamp(2rem,4.6vw,3.5rem);line-height:1.12;letter-spacing:-.025em;color:var(--pine);max-width:22ch;margin:0 auto;text-align:center}
.lp-root .band .stmt em{font-style:italic;color:var(--terracotta)}

/* ---------- FEATURES BENTO ---------- */
.lp-root .bento{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.lp-root .feat{position:relative;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:30px;overflow:hidden;transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s,border-color .3s}
.lp-root .feat::after{content:"";position:absolute;inset:0;border-radius:22px;opacity:0;transition:opacity .35s;background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%),rgba(193,97,64,.08),transparent 45%);pointer-events:none}
.lp-root .feat:hover{transform:translateY(-4px);box-shadow:0 28px 60px -34px rgba(23,48,38,.4);border-color:rgba(35,74,61,.16)}
.lp-root .feat:hover::after{opacity:1}
.lp-root .feat .ic{width:46px;height:46px;border-radius:13px;background:var(--sage-light,#E7EDE7);color:var(--pine);display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.lp-root .feat .ic svg{width:23px;height:23px}
.lp-root .feat h3{font-family:var(--display);font-weight:560;font-size:1.32rem;line-height:1.15;letter-spacing:-.015em;color:var(--pine);margin:0 0 .55rem}
.lp-root .feat p{font-size:.93rem;line-height:1.58;color:var(--ink-soft);margin:0 0 1.1rem}
.lp-root .feat .tag{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--terracotta);background:rgba(193,97,64,.09);padding:.3rem .7rem;border-radius:30px}
/* big spotlight feature */
.lp-root .feat.spot{grid-column:1 / -1;display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:center;background:var(--pine);border-color:transparent;color:var(--linen);padding:40px 44px}
.lp-root .feat.spot h3{color:#fff;font-size:clamp(1.6rem,2.6vw,2.1rem)}
.lp-root .feat.spot p{color:rgba(244,237,223,.78);font-size:1rem;max-width:30rem}
.lp-root .feat.spot .ic{background:rgba(255,255,255,.1);color:var(--terracotta-soft)}
.lp-root .feat.spot .tag{color:var(--terracotta-soft);background:rgba(255,255,255,.08)}
.lp-root .feat.spot::after{display:none}
.lp-root .feat.spot:hover{transform:none;box-shadow:none}
.lp-root .spot-vis{background:var(--card);border-radius:16px;padding:18px 20px;box-shadow:0 30px 60px -28px rgba(0,0,0,.55)}
.lp-root .spot-vis .addr{display:flex;align-items:center;gap:8px;font-size:.86rem;font-weight:600;color:var(--pine);padding-bottom:14px;border-bottom:1px solid var(--line);margin-bottom:14px}
.lp-root .spot-vis .addr svg{width:18px;height:18px;color:var(--terracotta)}
.lp-root .spot-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lp-root .spot-grid>div{font-size:.72rem;color:var(--ink-soft);display:flex;flex-direction:column;gap:3px}
.lp-root .spot-grid b{font-family:var(--display);font-size:1.15rem;font-weight:600;color:var(--ink)}
.lp-root .feat.third{grid-column:auto}

/* ---------- HOW ---------- */
.lp-root .how{background:var(--pine-deep);color:var(--linen)}
.lp-root .how .eyebrow{color:var(--terracotta-soft)}
.lp-root .how .h2{color:#fff}
.lp-root .how .sub{color:rgba(244,237,223,.72)}
.lp-root .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;position:relative}
.lp-root .steps::before{content:"";position:absolute;top:26px;left:8%;right:8%;height:1px;background:linear-gradient(90deg,transparent,rgba(167,191,168,.3),rgba(167,191,168,.3),transparent)}
.lp-root .step{position:relative}
.lp-root .step .num{width:54px;height:54px;border-radius:16px;background:var(--pine);border:1px solid rgba(167,191,168,.25);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:1.4rem;font-weight:600;color:var(--terracotta-soft);margin-bottom:20px;position:relative;z-index:1}
.lp-root .step h3{font-family:var(--display);font-weight:560;font-size:1.2rem;color:#fff;margin:0 0 .4rem}
.lp-root .step p{font-size:.92rem;line-height:1.55;color:rgba(244,237,223,.66);margin:0}

/* ---------- TESTIMONIALS ---------- */
.lp-root .proof{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.lp-root .tcard{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:30px 28px;display:flex;flex-direction:column;transition:transform .3s,box-shadow .3s}
.lp-root .tcard:hover{transform:translateY(-3px);box-shadow:0 26px 56px -34px rgba(23,48,38,.4)}
.lp-root .tcard .mark{font-family:var(--display);font-size:3rem;line-height:.6;color:var(--sage-deep);height:1rem}
.lp-root .tcard .quote{font-size:1rem;line-height:1.62;color:var(--ink);margin:1.4rem 0 1.6rem;flex:1}
.lp-root .tcard .who{display:flex;align-items:center;gap:12px}
.lp-root .tcard .av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.82rem;flex-shrink:0}
.lp-root .tcard .nm{font-weight:600;font-size:.92rem;color:var(--ink)}
.lp-root .tcard .ro{font-size:.78rem;color:var(--ink-soft)}

/* ---------- PRICING ---------- */
.lp-root .pricing{background:var(--linen-2);border-top:1px solid var(--line)}
.lp-root .price-wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:1060px;margin:0 auto}
.lp-root .pcard{position:relative;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:32px 26px;display:flex;flex-direction:column}
.lp-root .pcard.plus{background:var(--pine);color:var(--linen);border-color:transparent;box-shadow:0 36px 80px -36px rgba(23,48,38,.6)}
.lp-root .pcard.prem{background:var(--card);border:1.5px solid var(--terracotta);border-radius:24px;padding:32px 26px;display:flex;flex-direction:column}
.lp-root .pbadge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--terracotta);color:#fff;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.35rem .9rem;border-radius:30px;box-shadow:0 10px 22px -10px rgba(193,97,64,.7)}
.lp-root .plan{font-size:.82rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.lp-root .pcard.plus .plan{color:var(--sage)}
.lp-root .pcard.prem .plan{color:var(--terracotta)}
.lp-root .price{font-family:var(--display);font-weight:600;font-size:3rem;color:var(--pine);line-height:1;margin:.6rem 0 .2rem;letter-spacing:-.02em}
.lp-root .pcard.plus .price{color:#fff}
.lp-root .price span{font-family:var(--body);font-size:1rem;font-weight:500;color:var(--ink-soft)}
.lp-root .pcard.plus .price span{color:rgba(244,237,223,.6)}
.lp-root .pdesc{font-size:.92rem;color:var(--ink-soft);margin:.6rem 0 1.5rem;line-height:1.5}
.lp-root .pcard.plus .pdesc{color:rgba(244,237,223,.72)}
.lp-root .plist{list-style:none;padding:0;margin:0 0 1.8rem;display:flex;flex-direction:column;gap:.7rem;flex:1}
.lp-root .plist li{display:flex;align-items:flex-start;gap:10px;font-size:.92rem;color:var(--ink)}
.lp-root .pcard.plus .plist li{color:rgba(244,237,223,.9)}
.lp-root .plist .ck{width:18px;height:18px;border-radius:50%;background:rgba(167,191,168,.35);color:var(--pine);display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:800;flex-shrink:0;margin-top:2px}
.lp-root .pcard.plus .plist .ck{background:var(--terracotta);color:#fff}
.lp-root .pcard.prem .plist .ck{background:rgba(193,97,64,.18);color:var(--terracotta)}
.lp-root .pbtn{width:100%}

/* ---------- FINAL CTA ---------- */
.lp-root .final{position:relative;background:var(--pine-deep);color:var(--linen);padding:clamp(86px,11vw,140px) 0;overflow:hidden;text-align:center;isolation:isolate}
.lp-root .final .glow{position:absolute;width:700px;height:700px;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(193,97,64,.22),transparent 60%);z-index:-1}
.lp-root .final h2{font-family:var(--display);font-weight:360;font-size:clamp(2.4rem,5.4vw,4rem);line-height:1.02;letter-spacing:-.03em;color:#fff;margin:0 0 1.2rem}
.lp-root .final h2 em{font-style:italic;color:var(--terracotta-soft)}
.lp-root .final p{font-size:1.1rem;color:rgba(244,237,223,.72);max-width:34rem;margin:0 auto 2.4rem;line-height:1.6}

/* ---------- FOOTER ---------- */
.lp-root .foot{background:var(--pine-deep);color:rgba(244,237,223,.7);padding:40px 0;border-top:1px solid rgba(167,191,168,.12)}
.lp-root .foot-in{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.lp-root .foot-brand{display:flex;align-items:center;gap:11px}
.lp-root .foot-brand .tile{width:32px;height:32px;border-radius:9px;background:var(--terracotta);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lp-root .foot-brand .tile svg{width:60%;height:60%}
.lp-root .foot-brand .wm{font-family:var(--display);font-weight:600;color:var(--linen);font-size:1.1rem}
.lp-root .foot-tag{font-size:.84rem;color:rgba(244,237,223,.5)}
.lp-root .foot-links{display:flex;gap:26px}
.lp-root .foot-links a{font-size:.88rem;color:rgba(244,237,223,.72);cursor:pointer;transition:color .2s}
.lp-root .foot-links a:hover{color:#fff}
.lp-root .foot-copy{max-width:var(--maxw);margin:26px auto 0;padding-top:22px;border-top:1px solid rgba(167,191,168,.1);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:.8rem;color:rgba(244,237,223,.45)}

/* ---------- RESPONSIVE ---------- */
@media(max-width:960px){
  .lp-root .hero-grid{grid-template-columns:1fr;gap:48px}
  .lp-root .hero-vis{max-width:480px}
  .lp-root .feat.spot{grid-template-columns:1fr;gap:26px;padding:32px 30px}
  .lp-root .bento{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:860px){
  .lp-root .lp-nav-links{display:none}
  .lp-root .steps{grid-template-columns:1fr 1fr;gap:30px 22px}
  .lp-root .steps::before{display:none}
  .lp-root .proof{grid-template-columns:1fr}
}
@media(max-width:680px){
  .lp-root .wrap{padding:0 20px}
  .lp-root .hero{padding:116px 0 64px}
  .lp-root .hero-grid{gap:40px}
  .lp-root .hero-vis{margin:0 auto;max-width:420px;width:100%}
  .lp-root .hero-p{font-size:1.05rem}
  .lp-root .stats-in{grid-template-columns:1fr 1fr;gap:34px 0;padding:34px 0}
  .lp-root .stat-cell:nth-child(2){border-right:none}
  .lp-root .stat-cell{padding:0 10px}
  .lp-root .bento{grid-template-columns:1fr;gap:16px}
  .lp-root .feat{padding:26px 24px}
  .lp-root .feat.spot{padding:28px 24px}
  .lp-root .feat.spot h3{font-size:1.5rem}
  .lp-root .price-wrap{grid-template-columns:1fr;max-width:460px}
  .lp-root .foot-in{flex-direction:column;align-items:flex-start;gap:18px}
  .lp-root .foot-copy{justify-content:flex-start;flex-direction:column;gap:4px}
  .lp-root .hero-btns{gap:10px}
  .lp-root .hero-btns .btn{flex:1 1 100%}
  .lp-root .pv{transform:none}
  .lp-root::before{display:none}
}
@media(max-width:430px){
  .lp-root .lp-nav-in{padding:0 16px;height:62px}
  .lp-root .lp-nav-cta{gap:11px}
  .lp-root .lp-nav .btn-pine{padding:.6rem 1.05rem;font-size:.86rem}
  .lp-root .lp-signin{font-size:.88rem}
  .lp-root .hero{padding:104px 0 60px}
  .lp-root .hero h1{font-size:clamp(2.5rem,10vw,3.2rem)}
  .lp-root .h2{font-size:clamp(1.85rem,8vw,2.4rem)}
  .lp-root .band .stmt{font-size:clamp(1.7rem,7.6vw,2.4rem)}
  .lp-root .steps{grid-template-columns:1fr}
  .lp-root .hero-addr{padding:.6rem .6rem .6rem .9rem;gap:9px}
  .lp-root .hero-addr .go{padding:.55rem .7rem;font-size:.8rem}
  .lp-root .pv-stats{grid-template-columns:1fr 1fr}
  .lp-root .pv-stat:nth-child(3){grid-column:span 2}
  .lp-root .pcard{padding:30px 24px}
  .lp-root .tcard{padding:26px 24px}
}
/* touch devices: disable 3D tilt + cursor glow (can shimmer/alias on mobile GPUs) */
@media(hover:none){
  .lp-root .pv,.lp-root .hero-vis:hover .pv{transform:none}
  .lp-root .feat::after{display:none}
  .lp-root::before{display:none}
}
@media(max-width:380px){
  .lp-root .lp-nav-in{padding:0 13px}
  .lp-root .lp-brand{gap:8px}
  .lp-root .lp-brand .tile{width:34px;height:34px}
  .lp-root .lp-brand .wm{font-size:1.16rem}
  .lp-root .lp-nav-cta{gap:9px}
  .lp-root .lp-signin{font-size:.82rem}
  .lp-root .lp-nav .btn-pine{padding:.5rem .8rem;font-size:.81rem}
  .lp-root .hero h1{font-size:clamp(2.25rem,11vw,3rem)}
}
@media(prefers-reduced-motion:reduce){
  .lp-root .rv{opacity:1;transform:none;transition:none}
  .lp-root .qs-track{animation:none}
  .lp-root .hero-badge .pdot,.lp-root .hero-addr .typed .caret{animation:none}
  .lp-root .pv{transform:none}
}

/* ── AUTH SCREEN ── */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:var(--dark)}
.auth-bg{position:fixed;inset:0;background:var(--dark);overflow:hidden;pointer-events:none}
/* ══ ONBOARDING WIZARD ══ */
.wizard-wrap{min-height:100vh;background:var(--dark);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;position:relative;overflow:hidden}
.wizard-wrap::before{content:'';position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(193,98,43,.15) 0%,transparent 70%);top:-150px;right:-150px;pointer-events:none}
.wizard-wrap::after{content:'';position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(74,137,184,.1) 0%,transparent 70%);bottom:-100px;left:-100px;pointer-events:none}
.wizard-card{background:var(--white);border-radius:22px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.4);position:relative;z-index:1}
.wizard-progress{display:flex;gap:4px;padding:1.2rem 1.4rem .8rem}
.wizard-step-dot{flex:1;height:4px;border-radius:2px;transition:background .3s}
.wizard-step-dot.done{background:var(--rust)}
.wizard-step-dot.active{background:var(--rust);opacity:.5}
.wizard-step-dot.pending{background:var(--stone)}
.wizard-body{padding:1.4rem 1.6rem 1rem}
.wizard-icon{font-size:2.5rem;margin-bottom:.8rem;display:block}
.wizard-title{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:500;color:var(--dark);margin-bottom:.4rem;line-height:1.2}
.wizard-sub{font-size:.88rem;color:#9E9690;line-height:1.6;margin-bottom:1.4rem}
.wizard-footer{padding:.8rem 1.6rem 1.4rem;display:flex;gap:.6rem;justify-content:space-between;align-items:center;border-top:1px solid var(--stone)}
.wizard-back{background:none;border:none;font-family:'Hanken Grotesk',sans-serif;font-size:.84rem;color:#9E9690;cursor:pointer;padding:.4rem 0}
.wizard-back:hover{color:var(--dark)}
.wizard-next{padding:.75rem 1.6rem;background:var(--rust);color:#fff;border:none;border-radius:10px;font-family:'Hanken Grotesk',sans-serif;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .18s;box-shadow:0 3px 12px rgba(192,90,40,.3)}
.wizard-next:hover{background:#A84820;transform:translateY(-1px)}
.wizard-next:disabled{opacity:.5;cursor:not-allowed;transform:none}
.wizard-skip{background:none;border:none;font-family:'Hanken Grotesk',sans-serif;font-size:.82rem;color:#9E9690;cursor:pointer;padding:.4rem 0}
.wizard-skip:hover{color:var(--dark)}
.wizard-field{display:flex;flex-direction:column;gap:5px;margin-bottom:.9rem}
.wizard-field label{font-size:.7rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#8A827A}
.wizard-field input,.wizard-field select,.wizard-field textarea{width:100%;padding:.65rem .9rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.9rem;color:var(--dark);background:var(--white);outline:none;transition:border-color .15s}
.wizard-field input:focus,.wizard-field select:focus{border-color:var(--rust);box-shadow:0 0 0 3px rgba(192,90,40,.1)}
.wizard-lookup-btn{width:100%;padding:.72rem;background:var(--rust);color:#fff;border:none;border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:.5rem}
.wizard-lookup-btn:hover{background:#A84820}
.wizard-lookup-btn:disabled{opacity:.6;cursor:not-allowed}
.wizard-found{background:var(--sage-light);border:1px solid #B8D9CC;border-radius:var(--r-sm);padding:.75rem 1rem;margin-top:.7rem;font-size:.82rem;color:var(--sage);font-weight:500}
.wizard-notfound{background:var(--cream2);border:1px solid var(--stone);border-radius:var(--r-sm);padding:.75rem 1rem;margin-top:.7rem;font-size:.82rem;color:#7A7370;line-height:1.5}
.wizard-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem}
.wizard-chip{background:var(--white);border:1px solid #B8D9CC;border-radius:8px;padding:.35rem .7rem;font-size:.75rem;font-weight:600;color:var(--dark)}
.wizard-done-list{display:flex;flex-direction:column;gap:.6rem;margin-bottom:1rem}
.wizard-done-item{display:flex;align-items:center;gap:.75rem;padding:.75rem .9rem;background:var(--cream);border-radius:12px;border:1px solid var(--stone)}
.wizard-done-icon{font-size:1.3rem;flex-shrink:0}
.wizard-done-title{font-weight:600;font-size:.88rem;color:var(--dark)}
.wizard-done-sub{font-size:.74rem;color:#9E9690;margin-top:1px}
.wizard-autocomplete{position:relative}
.wizard-suggestions{position:absolute;top:calc(100% + 3px);left:0;right:0;background:var(--white);border:1.5px solid var(--stone);border-radius:var(--r-sm);box-shadow:var(--shadow-lg);z-index:500;overflow:hidden;max-height:200px;overflow-y:auto}
.wizard-suggestion{padding:.6rem .9rem;font-size:.84rem;cursor:pointer;border-bottom:1px solid var(--stone);color:var(--dark);display:flex;align-items:flex-start;gap:.5rem;transition:background .12s}
.wizard-suggestion:last-child{border-bottom:none}
.wizard-suggestion:hover{background:var(--rust-light)}

/* ══ AUTH SCREEN ══ */
.auth-bg{position:fixed;inset:0;background:var(--dark);overflow:hidden;pointer-events:none}
.auth-bg::before{content:'';position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(192,90,40,.15) 0%,transparent 70%);top:-100px;right:-100px}
.auth-bg::after{content:'';position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(58,122,175,.1) 0%,transparent 70%);bottom:-50px;left:-50px}
.auth-card{background:var(--white);border-radius:22px;width:100%;max-width:420px;padding:2.5rem 2.5rem 2rem;box-shadow:0 32px 80px rgba(0,0,0,.4);position:relative;z-index:1}
.auth-logo{display:flex;align-items:center;gap:12px;margin-bottom:2rem}
.auth-logo-icon{width:44px;height:44px;background:var(--pine);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem}
.auth-logo-text{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:500;color:var(--dark)}
.auth-logo-sub{font-size:.63rem;color:#9E9690;letter-spacing:1.5px;text-transform:uppercase}
.auth-title{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:500;margin-bottom:.3rem;color:var(--dark)}
.auth-sub{font-size:.84rem;color:#9E9690;margin-bottom:1.7rem}
.auth-field{display:flex;flex-direction:column;gap:5px;margin-bottom:1rem}
.auth-field label{font-size:.68rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#8A827A}
.auth-field input{padding:.72rem 1rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.9rem;color:var(--dark);background:var(--white);outline:none;transition:border-color .15s}
.auth-field input:focus{border-color:var(--rust);box-shadow:0 0 0 3px rgba(192,90,40,.1)}
.auth-btn{width:100%;padding:.82rem;border-radius:var(--r-sm);font-family:'Hanken Grotesk',sans-serif;font-size:.9rem;font-weight:600;border:none;cursor:pointer;transition:all .18s;margin-top:.4rem}
.auth-btn-primary{background:var(--rust);color:#fff;box-shadow:0 3px 12px rgba(192,90,40,.3)}
.auth-btn-primary:hover{background:#A84820}
.auth-btn-primary:disabled{opacity:.6;cursor:not-allowed}
.auth-switch{text-align:center;margin-top:1.3rem;font-size:.83rem;color:#9E9690}
.auth-switch button{background:none;border:none;color:var(--rust);font-weight:600;cursor:pointer;font-family:'Hanken Grotesk',sans-serif;font-size:.83rem}
.auth-switch button:hover{text-decoration:underline}
.auth-error{background:var(--red-light);border:1px solid #EFCFCC;color:#8B2020;padding:.62rem .9rem;border-radius:var(--r-sm);font-size:.81rem;margin-bottom:.9rem}
.auth-success{background:var(--sage-light);border:1px solid #B8D9CC;color:#2A5E48;padding:.62rem .9rem;border-radius:var(--r-sm);font-size:.81rem;margin-bottom:.9rem}
.auth-forgot{background:none;border:none;color:#9E9690;font-size:.77rem;cursor:pointer;font-family:'Hanken Grotesk',sans-serif;padding:0;margin-top:.2rem;text-align:right;display:block;width:100%}
.auth-forgot:hover{color:var(--rust)}


/* ══ CALENDAR TAB ══ */
.ct-wrap{display:flex;flex-direction:column;gap:1rem}
.ct-head{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap}
.ct-vtoggle{display:flex;background:var(--cream2);border-radius:8px;padding:2px;gap:2px}
.ct-vbtn{padding:.3rem .75rem;border-radius:6px;font-size:.77rem;font-weight:600;border:none;cursor:pointer;background:none;color:#9E9690;transition:all .15s;font-family:'Hanken Grotesk',sans-serif}
.ct-vbtn.on{background:var(--white);color:var(--dark);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.ct-gen-btn{display:flex;align-items:center;gap:6px;font-size:.82rem;font-weight:600;padding:.45rem .9rem;border-radius:22px;border:1.5px solid var(--rust-light);background:none;color:var(--rust);cursor:pointer;transition:all .18s;font-family:'Hanken Grotesk',sans-serif}
.ct-gen-btn:hover{background:var(--rust-light)}

/* alerts strip */
.ct-alerts{display:flex;gap:.55rem;overflow-x:auto;padding:.15rem 0 .4rem;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.ct-alerts::-webkit-scrollbar{display:none}
.ct-alert{flex-shrink:0;display:flex;align-items:center;gap:.55rem;background:var(--white);border:1px solid var(--stone);border-radius:10px;padding:.52rem .8rem;cursor:pointer;transition:box-shadow .12s;max-width:210px}
.ct-alert:hover{box-shadow:var(--shadow)}
.ct-alert-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.ct-alert-body{min-width:0}
.ct-alert-title{font-size:.77rem;font-weight:600;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
.ct-alert-when{font-size:.67rem;color:#9E9690}

/* body grid: calendar + panel */
.ct-body{display:grid;grid-template-columns:1fr;gap:1rem}
@media(min-width:769px){.ct-body{grid-template-columns:1fr 320px}}

/* calendar card */
.ct-cal{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);overflow:hidden}
.ct-cal-hdr{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;border-bottom:1px solid var(--stone)}
.ct-month-lbl{font-family:'Fraunces',serif;font-size:1.05rem;font-weight:500;color:var(--dark)}
.ct-navs{display:flex;align-items:center;gap:4px}
.ct-nav-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--stone);background:none;cursor:pointer;color:var(--dark);font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:background .12s}
.ct-nav-btn:hover{background:var(--cream2)}
.ct-today-btn{font-size:.62rem;font-weight:700;letter-spacing:.3px;padding:0 .5rem}
.ct-cg{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--stone)}
.ct-dow{background:var(--cream2);padding:.42rem 0;text-align:center;font-size:.63rem;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9E9690}
.ct-day{background:var(--white);padding:.32rem .38rem .4rem;min-height:58px;cursor:pointer;transition:background .1s;position:relative;user-select:none}
.ct-day:hover:not(.ct-other){background:rgba(193,97,64,.05)}
.ct-other{background:#F9F7F4;cursor:default}
.ct-other .ct-dn{color:#C2B8AE}
.ct-sel{background:rgba(193,97,64,.07) !important;box-shadow:inset 0 0 0 2px rgba(193,97,64,.3)}
.ct-today .ct-dn{background:var(--rust);color:#fff;border-radius:50%;width:21px;height:21px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.74rem;line-height:1;margin-bottom:2px}
.ct-dn{font-size:.77rem;font-weight:500;color:var(--dark);line-height:1;margin-bottom:3px}
.ct-dots{display:flex;flex-wrap:wrap;gap:2px}
.ct-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ct-dotx{font-size:.54rem;color:#9E9690;font-weight:700;line-height:1;align-self:center}

/* day panel */
.ct-panel{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);display:flex;flex-direction:column;max-height:600px}
.ct-ph{padding:.85rem 1rem;border-bottom:1px solid var(--stone);display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-shrink:0}
.ct-pdate{font-family:'Fraunces',serif;font-size:.95rem;font-weight:500;color:var(--dark)}
.ct-add-btn{display:flex;align-items:center;gap:5px;font-size:.78rem;font-weight:600;padding:.35rem .75rem;border-radius:20px;border:1.5px solid var(--stone);background:none;color:var(--dark);cursor:pointer;transition:all .15s;font-family:'Hanken Grotesk',sans-serif}
.ct-add-btn:hover{border-color:var(--rust);color:var(--rust)}
.ct-pb{flex:1;overflow-y:auto;padding:.7rem .75rem;display:flex;flex-direction:column;gap:.45rem}
.ct-pe{display:flex;align-items:flex-start;gap:.6rem;background:var(--cream2);border-radius:10px;padding:.62rem .7rem;border:1px solid var(--stone)}
.ct-pe-bar{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:28px}
.ct-pe-info{flex:1;min-width:0}
.ct-pe-title{font-size:.83rem;font-weight:600;color:var(--dark);line-height:1.3}
.ct-pe-meta{font-size:.7rem;color:#9E9690;margin-top:2px;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.ct-pe-create{flex-shrink:0;font-size:.7rem;font-weight:700;padding:.28rem .6rem;border-radius:12px;border:1.5px solid var(--sage-deep);background:none;color:var(--sage-deep);cursor:pointer;transition:all .15s;font-family:'Hanken Grotesk',sans-serif;white-space:nowrap}
.ct-pe-create:hover{background:var(--sage-deep);color:#fff}
.ct-pe-create.done{border-color:#9E9690;color:#9E9690;cursor:default}
.ct-suggest-hdr{font-size:.67rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9E9690;padding:.2rem .2rem .1rem;margin-top:.2rem}
.ct-p-empty{text-align:center;color:#9E9690;font-size:.82rem;padding:2rem 1rem;line-height:1.6}

/* upcoming list */
.ct-upcoming{display:flex;flex-direction:column;gap:.35rem}
.ct-up-group-lbl{font-size:.67rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9E9690;padding:.4rem .6rem;background:var(--cream2);border-radius:6px;margin-top:.4rem}
.ct-up-row{display:flex;align-items:center;gap:.65rem;padding:.58rem .75rem;background:var(--white);border:1px solid var(--stone);border-radius:10px}
.ct-up-bar{width:3px;height:30px;border-radius:2px;flex-shrink:0}
.ct-up-info{flex:1;min-width:0}
.ct-up-title{font-size:.83rem;font-weight:500;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ct-up-type{font-size:.68rem;color:#9E9690}
.ct-up-date{font-size:.72rem;font-weight:700;color:var(--dark);white-space:nowrap}

/* generate modal */
.ct-gen-intro{font-size:.86rem;color:#5A534B;margin-bottom:1rem;line-height:1.55}
.ct-gen-season{font-size:.7rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9E9690;padding:.4rem .4rem .15rem;margin-top:.5rem}
.ct-gen-list{display:flex;flex-direction:column;gap:.35rem;max-height:52vh;overflow-y:auto;padding-right:.25rem}
.ct-gen-item{display:flex;align-items:center;gap:.75rem;padding:.55rem .7rem;background:var(--cream2);border-radius:9px;border:1px solid var(--stone);cursor:pointer;transition:background .1s}
.ct-gen-item:hover{background:rgba(193,97,64,.07)}
.ct-gen-item input[type=checkbox]{accent-color:var(--rust);width:15px;height:15px;flex-shrink:0;cursor:pointer}
.ct-gen-info{flex:1;min-width:0}
.ct-gen-title{font-size:.82rem;font-weight:500;color:var(--dark);line-height:1.3}
.ct-gen-sub{font-size:.7rem;color:#9E9690;margin-top:1px}

/* ══ DASHBOARD WEEK TILE + QUICK ACTIONS ══ */
.week-tile{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:.85rem .9rem .75rem;margin-bottom:.75rem}
.week-tile-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
.week-tile-title{font-family:'Fraunces',serif;font-size:.95rem;font-weight:500;color:var(--dark)}
.week-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:.65rem}
.wd{display:flex;flex-direction:column;align-items:center;gap:4px;padding:.5rem .1rem .4rem;border-radius:10px;transition:background .12s;cursor:default}
.wd.has-ev{cursor:pointer}
.wd.has-ev:hover:not(.wd-today){background:var(--cream2)}
.wd-today{background:var(--pine)}
.wd-today .wd-label{color:rgba(244,237,223,.7)}
.wd-today .wd-num{color:#fff;font-weight:700}
.wd-label{font-size:.58rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#A8A09A;line-height:1}
.wd-num{font-size:.86rem;font-weight:600;color:var(--dark);line-height:1}
.wd-today .wd-dots .wd-dot{background:rgba(255,255,255,.75) !important}
.wd-dots{display:flex;gap:2px;min-height:8px;align-items:center;justify-content:center}
.wd-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.week-summary{font-size:.74rem;color:#A8A09A;display:flex;gap:.4rem;flex-wrap:wrap;padding-top:.55rem;border-top:1px solid var(--stone)}
.quick-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin-bottom:.85rem}
.qa-btn{display:flex;flex-direction:column;align-items:center;gap:.45rem;padding:.8rem .5rem;background:var(--white);border:1px solid var(--stone);border-radius:var(--r);cursor:pointer;transition:all .18s;font-family:'Hanken Grotesk',sans-serif;color:var(--dark)}
.qa-btn:hover{background:var(--cream2);border-color:rgba(193,97,64,.35);transform:translateY(-2px);box-shadow:0 6px 18px -8px rgba(0,0,0,.14)}
.qa-icon{font-size:1.35rem;line-height:1}
.qa-btn span:last-child{font-size:.7rem;font-weight:600;letter-spacing:.01em;text-align:center;line-height:1.3}

/* ══ FEEDBACK ══ */
.feedback-type-row{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.85rem}
.feedback-type-btn{padding:.35rem .85rem;border-radius:20px;border:1.5px solid var(--stone);background:none;font-size:.78rem;font-weight:600;font-family:'Hanken Grotesk',sans-serif;color:#7A7370;cursor:pointer;transition:all .15s}
.feedback-type-btn:hover{border-color:var(--pine);color:var(--pine)}
.feedback-type-btn.sel{background:var(--pine);color:#fff;border-color:var(--pine)}
.feedback-success{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1rem;text-align:center;gap:.75rem}
.feedback-success-icon{font-size:2.5rem}
.feedback-success-title{font-family:'Fraunces',serif;font-size:1.1rem;font-weight:500;color:var(--dark)}
.feedback-success-sub{font-size:.83rem;color:#7A7370;line-height:1.5}
.user-dd-item{display:flex;align-items:center;gap:.6rem;padding:.6rem .9rem;font-size:.82rem;font-weight:500;color:var(--dark);cursor:pointer;transition:background .12s;border:none;background:none;width:100%;font-family:'Hanken Grotesk',sans-serif;text-align:left}
.user-dd-item:hover{background:var(--cream2)}
.user-dd-item.danger{color:#C0392B}
.user-dd-item.danger:hover{background:#FFF0EE}
.user-dd-divider{height:1px;background:var(--stone);margin:.25rem 0}

/* ══ PLAN SYSTEM ══ */
.plan-badge{display:inline-flex;align-items:center;gap:4px;font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:.04em}
.plan-badge.free{background:var(--cream2);color:#7A7370;border:1px solid var(--stone)}
.plan-badge.plus{background:#EEF4FF;color:#3B5FBF;border:1px solid #C5D5F7}
.plan-badge.pro{background:#FBF0E6;color:#A0511A;border:1px solid #F5D5B0}

/* upgrade prompt */
.upgrade-prompt{background:var(--white);border:1.5px solid var(--stone);border-radius:var(--r);padding:.9rem 1.1rem;display:flex;align-items:center;gap:.85rem;margin:.75rem 0}
.upgrade-prompt-icon{font-size:1.4rem;flex-shrink:0}
.upgrade-prompt-text{flex:1;min-width:0}
.upgrade-prompt-title{font-size:.85rem;font-weight:600;color:var(--dark);margin-bottom:2px}
.upgrade-prompt-sub{font-size:.75rem;color:#7A7370;line-height:1.4}
.upgrade-prompt-btn{flex-shrink:0;padding:.4rem .9rem;border-radius:20px;border:none;background:var(--pine);color:#fff;font-size:.75rem;font-weight:700;cursor:pointer;font-family:'Hanken Grotesk',sans-serif;white-space:nowrap;transition:opacity .15s}
.upgrade-prompt-btn:hover{opacity:.85}

/* health score widget */
.health-wrap{background:var(--white);border:1px solid var(--stone);border-radius:var(--r);padding:1rem 1.1rem;margin-bottom:.75rem}
.health-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
.health-title{font-family:'Fraunces',serif;font-size:.9rem;font-weight:500;color:var(--dark)}
.health-score-row{display:flex;align-items:center;gap:1.25rem}
.health-score-circle{position:relative;width:76px;height:76px;flex-shrink:0}
.health-score-svg{width:76px;height:76px;transform:rotate(-90deg)}
.health-score-num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.health-score-val{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:600;color:var(--dark)}
.health-score-label{font-size:.48rem;color:#A8A09A;text-transform:uppercase;letter-spacing:.04em;max-width:60px;text-align:center}
.health-factors{flex:1;min-width:0;display:flex;flex-direction:column;gap:.45rem}
.health-factor{display:grid;grid-template-columns:64px 1fr 24px;align-items:center;gap:.5rem;font-size:.72rem}
.health-factor-bar{height:5px;border-radius:3px;background:var(--stone);overflow:hidden}
.health-factor-fill{height:100%;border-radius:3px}
.health-factor-label{color:#7A7370;font-size:.7rem;white-space:nowrap}
.health-factor-val{color:var(--dark);font-weight:600;font-size:.7rem;text-align:right}

/* cost forecast widget */
.forecast-wrap{background:var(--white);border:1px solid var(--stone);border-radius:var(--r);padding:1rem 1.1rem;margin-bottom:.75rem}
.forecast-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.65rem}
.forecast-title{font-family:'Fraunces',serif;font-size:.9rem;font-weight:500;color:var(--dark)}
.forecast-chart{display:flex;align-items:flex-end;gap:.35rem;height:90px}
.forecast-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;min-width:0}
.forecast-bar{width:100%;border-radius:4px 4px 0 0;min-height:3px;flex-shrink:0}
.forecast-bar-label{font-size:.58rem;color:#A8A09A;text-align:center;white-space:nowrap;margin-top:.25rem}
.forecast-bar-val{font-size:.62rem;color:var(--dark);font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;margin-bottom:.2rem}
.forecast-footer{display:flex;align-items:center;justify-content:space-between;margin-top:.5rem}
.forecast-total{font-size:.74rem;color:#7A7370}
.forecast-total strong{color:var(--dark)}

/* ══ PLAN SYSTEM ══ */
.setup-banner{background:var(--white);border:1.5px dashed var(--rust-light);border-radius:var(--r);padding:1.1rem 1.2rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.1rem;flex-wrap:wrap}
.setup-banner-text strong{font-size:.92rem;color:var(--dark);display:block;margin-bottom:2px}
.setup-banner-text p{font-size:.78rem;color:#7A7370;margin:0}
.setup-done{display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:var(--sage-deep);font-weight:600;margin-bottom:1rem}

/* wizard pages */
.hsw-wrap{padding:.25rem 0}
.hsw-progress{display:flex;gap:4px;margin-bottom:1.25rem}
.hsw-prog-seg{flex:1;height:4px;border-radius:2px;background:var(--stone);transition:background .3s}
.hsw-prog-seg.done{background:var(--pine)}
.hsw-prog-seg.active{background:var(--rust)}
.hsw-section-title{font-family:'Fraunces',serif;font-size:1.1rem;font-weight:500;color:var(--dark);margin-bottom:.25rem}
.hsw-section-sub{font-size:.82rem;color:#7A7370;margin-bottom:1.25rem;line-height:1.5}
.hsw-q{margin-bottom:1rem}
.hsw-q-label{font-size:.83rem;font-weight:600;color:var(--dark);margin-bottom:.5rem}
.hsw-q-sub{font-size:.74rem;color:#9E9690;margin-bottom:.45rem}
.yn-row{display:flex;gap:.5rem;flex-wrap:wrap}
.yn{padding:.45rem 1.25rem;border-radius:20px;border:1.5px solid var(--stone);background:none;cursor:pointer;font-size:.82rem;font-weight:600;font-family:'Hanken Grotesk',sans-serif;color:#7A7370;transition:all .15s;white-space:nowrap}
.yn:hover{border-color:var(--pine);color:var(--pine)}
.yn.sel-yes{background:var(--pine);color:#fff;border-color:var(--pine)}
.yn.sel-no{background:#5A534B;color:#fff;border-color:#5A534B}
.yn.sel-opt{background:var(--pine);color:#fff;border-color:var(--pine)}
.hsw-sub-q{margin-top:.65rem;padding:.75rem;background:var(--cream2);border-radius:10px;border:1px solid var(--stone);display:flex;flex-direction:column;gap:.65rem}
.hsw-free{width:100%;padding:.5rem .75rem;border:1.5px solid var(--stone);border-radius:10px;font-size:.82rem;font-family:'Hanken Grotesk',sans-serif;color:var(--dark);background:var(--white);resize:none;outline:none}
.hsw-free:focus{border-color:var(--pine)}
.hsw-nav{display:flex;justify-content:space-between;align-items:center;margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--stone)}

/* review screen */
.hsw-review-tabs{display:flex;background:var(--cream2);border-radius:8px;padding:2px;gap:2px;margin-bottom:1rem}
.hsw-rtab{flex:1;padding:.35rem .5rem;border-radius:6px;border:none;background:none;font-size:.77rem;font-weight:600;font-family:'Hanken Grotesk',sans-serif;color:#9E9690;cursor:pointer;transition:all .15s}
.hsw-rtab.on{background:var(--white);color:var(--dark);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.hsw-review-list{display:flex;flex-direction:column;gap:.4rem;max-height:46vh;overflow-y:auto;padding-right:.25rem}
.hsw-item{display:flex;align-items:flex-start;gap:.65rem;padding:.6rem .75rem;background:var(--cream2);border-radius:9px;border:1px solid var(--stone);cursor:pointer;transition:background .1s}
.hsw-item:hover{background:rgba(193,97,64,.05)}
.hsw-item input[type=checkbox]{accent-color:var(--rust);width:15px;height:15px;flex-shrink:0;margin-top:2px;cursor:pointer}
.hsw-item-info{flex:1;min-width:0}
.hsw-item-title{font-size:.83rem;font-weight:500;color:var(--dark);line-height:1.3}
.hsw-item-sub{font-size:.7rem;color:#9E9690;margin-top:2px}
.hsw-dup-badge{font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:8px;background:#FFF3CD;color:#856404;border:1px solid #FFEEBA;flex-shrink:0;white-space:nowrap}
.hsw-dup-block{background:#FFFBF0;border:1px solid #F0E0A0;border-radius:10px;padding:.6rem .75rem;margin-top:.35rem;font-size:.75rem;color:#7A6030}
.hsw-dup-choices{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.4rem}
.hsw-dup-btn{padding:.28rem .65rem;border-radius:10px;border:1.5px solid var(--stone);background:none;font-size:.72rem;font-weight:600;cursor:pointer;font-family:'Hanken Grotesk',sans-serif;transition:all .15s}
.hsw-dup-btn.active{background:var(--pine);color:#fff;border-color:var(--pine)}
.hsw-util-chips{display:flex;flex-wrap:wrap;gap:.4rem;padding:.5rem 0}
.hsw-util-chip{padding:.3rem .75rem;border-radius:20px;background:var(--cream2);border:1px solid var(--stone);font-size:.76rem;font-weight:600;color:#5A534B}
.hsw-summary-row{display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.85rem}
.hsw-summary-stat{background:var(--cream2);border-radius:10px;padding:.55rem .85rem;text-align:center;flex:1;min-width:60px}
.hsw-summary-num{font-family:'Fraunces',serif;font-size:1.2rem;font-weight:600;color:var(--pine)}
.hsw-summary-label{font-size:.65rem;color:#9E9690;margin-top:1px}

/* ══ SAFE RESPONSIVE FIXES ══ */

/* iOS Safari: inputs <16px font-size cause the viewport to zoom on focus */
@media(max-width:768px){
  input,select,textarea{font-size:1rem}
  .search-wrap input{font-size:1rem}
  .wizard-field input,.wizard-field select,.wizard-field textarea{font-size:1rem}
}

/* Touch devices: card action buttons are hover-only by default — always show on touch */
@media(hover:none){
  .task-card-actions{opacity:1}
  .exp-card-actions{opacity:1}
  .asset-card-actions{opacity:1}
}

/* Calendar: allow horizontal scroll on narrow screens */
.cal-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}

/* Asset stats: wrap to 2-col on very narrow phones */
@media(max-width:380px){
  .asset-stats-row{grid-template-columns:1fr 1fr}
  .asset-stat:nth-child(2){border-right:none}
  .asset-stat:nth-child(3){grid-column:span 2;border-top:1px solid var(--stone);border-right:none}
}

/* Search bar: shrink on narrow screens */
@media(max-width:480px){.search-wrap{max-width:180px}}
@media(max-width:360px){.search-wrap{max-width:120px}}

/* Desktop: wider padding and layout improvements */
@media(min-width:1100px){
  .main{padding:1.75rem 2.5rem}
  .hdr{padding:0 2.5rem}
}

/* Desktop header: more breathing room */
@media(min-width:769px){
  .hdr{padding:0 2rem}
  .search-wrap{max-width:420px}
}

/* Prevent text overflow on narrow cards */
.task-card-title,.exp-card-title{word-break:break-word;overflow-wrap:break-word}

/* ══ END SAFE RESPONSIVE FIXES ══ */
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt$ = v => "$" + Number(v||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtD = d => { if(!d) return "—"; const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const daysTo = d => { if(!d) return null; return Math.ceil((new Date(d+"T00:00:00")-new Date())/86400000); };
// Local-timezone YYYY-MM-DD (avoids UTC off-by-one from toISOString in evening hours)
const localISO = (date = new Date()) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const offsetDate = (str, days) => { const d = new Date(str+"T00:00:00"); d.setDate(d.getDate()+days); return localISO(d); };

// Recurring task engine — computes next due date from current due date + recurrence rule
function getNextRecurringDate(dueDateStr, recurring) {
  if (!dueDateStr || !recurring) return null;
  const r = (recurring || "").toLowerCase().trim();
  const d = new Date(dueDateStr + "T00:00:00");
  if      (r === "daily"  || r.includes("every day"))                                    d.setDate(d.getDate() + 1);
  else if (r === "weekly" || (r.includes("week") && !r.includes("2") && !r.includes("bi"))) d.setDate(d.getDate() + 7);
  else if (r === "biweekly" || r.includes("2 week") || r.includes("every other week"))   d.setDate(d.getDate() + 14);
  else if (r === "monthly"|| (r.includes("month") && !r.includes("3") && !r.includes("6") && !r.includes("quart"))) d.setMonth(d.getMonth() + 1);
  else if (r === "quarterly" || r.includes("quart") || (r.includes("3") && r.includes("month"))) d.setMonth(d.getMonth() + 3);
  else if (r === "every 6 months" || (r.includes("6") && r.includes("month")) || r.includes("biannual") || r.includes("semi-annual")) d.setMonth(d.getMonth() + 6);
  else if (r === "annually" || r.includes("annual") || r.includes("year"))               d.setFullYear(d.getFullYear() + 1);
  else return null; // unrecognised
  return localISO(d);
}

// Smart recurrence suggestion from task title + category
function suggestRecurrence(title, category) {
  const t = ((title||"") + " " + (category||"")).toLowerCase();
  if (/hvac.*(filter|clean|replace)|air filter|filter.*(change|replace)/.test(t)) return "monthly";
  if (/hvac.*service|ac.*service|furnace.*service|furnace.*check|ac.*tune/.test(t))  return "every 6 months";
  if (/gutter/.test(t))                  return "every 6 months";
  if (/dryer.*vent|vent.*clean/.test(t)) return "annually";
  if (/smoke.*detector|co.*detector|carbon.*monoxide|fire.*alarm/.test(t)) return "annually";
  if (/water.*heater.*flush|flush.*water/.test(t)) return "annually";
  if (/pest.*control|pest.*inspect/.test(t))       return "quarterly";
  if (/roof.*inspect|inspect.*roof/.test(t))       return "annually";
  if (/lawn|mow|grass/.test(t))                    return "weekly";
  if (/pool.*clean|clean.*pool/.test(t))           return "weekly";
  if (/exterior.*paint|paint.*exterior/.test(t))   return "annually";
  if (/chimney|fireplace/.test(t))                 return "annually";
  if (/septic/.test(t))                            return "annually";
  return "";
}

// Shared event map — used by both Dashboard Week Ahead and CalendarTab
// so both tabs always show identical data from the same sources.
function buildHomeEvents(tasks, warranties, profile, serviceLogs) {
  const map = {};
  const add = (date, ev) => {
    if (!date) return;
    const k = date.slice(0,10);
    if (!map[k]) map[k] = [];
    if (!map[k].find(e => e.id === ev.id)) map[k].push(ev);
  };
  const today = new Date();

  // 1. Tasks
  tasks.filter(t => t.due_date).forEach(t => {
    const d = daysTo(t.due_date);
    const type = t.status==="Completed" ? "task_done"
      : t.status==="In Progress"       ? "task_progress"
      : (d!==null && d<0)              ? "task_overdue"
      : "task";
    add(t.due_date, { id:"t-"+t.id, type, title:t.title, status:t.status, category:t.category, priority:t.priority, sourceId:t.id });
  });

  // 2. Warranty expiry + 30-day warning
  warranties.forEach(w => {
    if (!w.expiry_date) return;
    const d = daysTo(w.expiry_date);
    if (d===null || d<-30) return;
    add(w.expiry_date, { id:"wex-"+w.id, type:"warranty", title:w.item+" warranty expires", category:w.category, canCreate:true });
    if (d>30) add(offsetDate(w.expiry_date,-30), { id:"ww-"+w.id, type:"warranty_warn", title:w.item+" warranty expires in 30 days", category:w.category, canCreate:true });
  });

  // 3. Insurance renewal + 30-day reminder
  if (profile?.ins_renewal_date) {
    const d = daysTo(profile.ins_renewal_date);
    if (d!==null && d>-30) {
      add(profile.ins_renewal_date, { id:"ins", type:"insurance", title:"Insurance renewal"+(profile.ins_company?" — "+profile.ins_company:""), canCreate:true });
      if (d>30) add(offsetDate(profile.ins_renewal_date,-30), { id:"ins-w", type:"insurance_warn", title:"Insurance renewal coming up in 30 days" });
    }
  }

  // 4. Asset service reminders (last service log + category interval)
  const lastSvc = {};
  serviceLogs.forEach(sl => {
    if (!sl.service_date || !sl.asset_id) return;
    if (!lastSvc[sl.asset_id] || sl.service_date>lastSvc[sl.asset_id]) lastSvc[sl.asset_id] = sl.service_date;
  });
  const SVC_MONTHS = { HVAC:6, Plumbing:12, Electrical:24, Appliance:12, Roofing:24, Safety:12, Structure:36, Landscaping:12, Other:12 };
  warranties.forEach(w => {
    const last = lastSvc[w.id];
    if (!last) return;
    const next = new Date(last+"T00:00:00");
    next.setMonth(next.getMonth()+(SVC_MONTHS[w.category]||12));
    const nextStr = localISO(next);
    const d = daysTo(nextStr);
    if (d!==null && d>=-7 && d<=400) add(nextStr, { id:"svc-"+w.id, type:"service", title:w.item+" — service due", category:w.category, canCreate:true });
  });

  // 5. Seasonal suggestions (current + next year)
  const zone = profile?.address ? getClimateZone({address:profile.address}) : 5;
  const cp = getClimateProfile(zone);
  const SEASON_MO = { spring:2, summer:5, fall:8, winter:11 };
  [today.getFullYear(), today.getFullYear()+1].forEach(yr => {
    Object.entries(SEASON_MO).forEach(([season, mo]) => {
      (cp[season]||[]).forEach((title, i) => {
        add(localISO(new Date(yr, mo, 1+i*2)), { id:`ss-${yr}-${season}-${i}`, type:"seasonal", title, canCreate:true, seasonal:season });
      });
    });
  });

  return map;
}
const wPct = (p,e) => { const start=new Date(p+"T00:00:00"),end=new Date(e+"T00:00:00"),now=new Date(); return Math.min(100,Math.max(0,Math.round(((now-start)/(end-start))*100))); };
const initials = email => email ? email.substring(0,2).toUpperCase() : "?";

// ─── TOAST HOOK ──────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type="success") => {
    const id = Date.now();
    setToasts(t => [...t, {id, msg, type, visible:false}]);
    setTimeout(() => setToasts(t => t.map(x => x.id===id ? {...x, visible:true} : x)), 30);
    setTimeout(() => setToasts(t => t.map(x => x.id===id ? {...x, visible:false} : x)), 2800);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), 3200);
  };
  return { toasts, show };
}

// Lock background scroll while an overlay/modal is mounted (mobile UX)
function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
}

function Toasts({ toasts }) {
  return (
    <div className="toast-wrap" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map(t => <div key={t.id} className={`toast ${t.type} ${t.visible?"show":""}`}>{t.msg}</div>)}
    </div>
  );
}

function Confirm({ message, onConfirm, onCancel }) {
  useBodyScrollLock();
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget && onCancel()}>
      <div className="modal" style={{maxWidth:340}}>
        <div className="confirm-body">
          <div className="ci">🗑️</div>
          <strong>Are you sure?</strong>
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, onSave, children }) {
  useBodyScrollLock();
  return (
    <div className="overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-hdr">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── LANDING PAGE ────────────────────────────────────────────────────────────

// ─── LANDING PAGE ────────────────────────────────────────────────────────────
function LandingPage({ onSignIn, onSignUp }) {
  const [scrolled, setScrolled] = useState(false);
  const [typed, setTyped] = useState("1420 Maple Grove Dr");

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Hero typewriter — cycles through example addresses
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const addrs = ["1420 Maple Grove Dr", "88 Lakeview Ave", "327 Birchwood Ln"];
    let ai = 0, ci = addrs[0].length, deleting = true, timer;
    const tick = () => {
      const full = addrs[ai];
      ci += deleting ? -1 : 1;
      setTyped(full.slice(0, ci));
      let delay = deleting ? 45 : 95;
      if (!deleting && ci === full.length) { deleting = false; delay = 1900; setTimeout(() => { deleting = true; timer = setTimeout(tick, 45); }, delay); return; }
      if (deleting && ci === 0) { deleting = false; ai = (ai + 1) % addrs.length; delay = 360; }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 2200);
    return () => clearTimeout(timer);
  }, []);

  // Scroll reveals, count-up, and feature glow
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".lp-root .rv").forEach(el => io.observe(el));

    const countIO = new IntersectionObserver((es) => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target, to = +el.dataset.to;
        let start = null;
        const step = ts => {
          if (!start) start = ts;
          const pct = Math.min((ts - start) / 1500, 1);
          el.textContent = Math.round((1 - Math.pow(1 - pct, 3)) * to);
          if (pct < 1) requestAnimationFrame(step); else el.textContent = to;
        };
        requestAnimationFrame(step);
        countIO.unobserve(el);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll(".lp-root .cnt").forEach(el => countIO.observe(el));

    const cards = document.querySelectorAll(".lp-root .feat");
    const glow = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
      e.currentTarget.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
    };
    cards.forEach(c => c.addEventListener("mousemove", glow));
    return () => { io.disconnect(); countIO.disconnect(); cards.forEach(c => c.removeEventListener("mousemove", glow)); };
  }, []);

  const HouseMark = ({ stroke = "#F4EDDF" }) => (
    <svg viewBox="0 0 48 48" fill="none" width="62%" height="62%" style={{ display: "block" }}>
      <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 34 L21 27.5 A3 3 0 0 1 27 27.5 L27 34" stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 34.5 L37 34.5" stroke={stroke} strokeWidth="2.8" strokeLinecap="round"/>
      <circle cx="24" cy="18.3" r="1.5" fill="#D2876A"/>
    </svg>
  );

  const questions = [
    "How old is my water heater?", "What maintenance is due this season?",
    "How much have I spent on my home?", "When does my HVAC warranty expire?",
    "Are my utility bills unusually high?", "What has my home sold for historically?",
  ];

  const features = [
    { ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3C9 7 7 9.5 7 13a5 5 0 0 0 10 0c0-3.5-2-6-5-10z"/></svg>, title: "Climate-aware upkeep", desc: "Maintenance tuned to your zip code's climate zone and the season — so you're prepping for what your home actually faces.", tag: "Seasonal" },
    { ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>, title: "Utility spike alerts", desc: "Log your bills and Steadwell flags unusual jumps in usage — catch a leak or a failing system before it becomes a crisis.", tag: "Unique to Steadwell" },
    { ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3.5v5c0 4-3 6.5-7 8.5-4-2-7-4.5-7-8.5v-5z"/><path d="M9 12l2 2 4-4"/></svg>, title: "Warranties & assets", desc: "Every appliance, model number, and warranty with expiry alerts — plus service history that follows each asset.", tag: "Never lose a receipt" },
    { ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="11" width="3" height="5"/><rect x="12" y="7" width="3" height="9"/><rect x="17" y="13" width="3" height="3"/></svg>, title: "Costs & investment", desc: "See every dollar your home has cost you, broken down by category — and weigh it against what your home is worth.", tag: "Know your numbers" },
    { ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v5h5"/></svg>, title: "Document vault", desc: "Deeds, permits, inspections, insurance — filed, searchable, and tied to the asset or project they belong to.", tag: "All your paperwork" },
    { ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 9h16"/><path d="M9 4v16"/></svg>, title: "Tax & sale history", desc: "Years of property tax records and every past sale — your home's full financial story, on one timeline.", tag: "Property data" },
  ];

  return (
    <div className="lp-root">
      <a href="#lp-main" className="skip-nav">Skip to main content</a>

      {/* ── NAV ── */}
      <nav className={`lp-nav ${scrolled ? "solid" : ""}`} aria-label="Primary">
        <div className="lp-nav-in">
          <div className="lp-brand">
            <span className="tile"><HouseMark/></span>
            <span className="wm">Steadwell</span>
          </div>
          <div className="lp-nav-links">
            <a onClick={() => scrollTo("features")}>Features</a>
            <a onClick={() => scrollTo("how")}>How it works</a>
            <a onClick={() => scrollTo("pricing")}>Pricing</a>
          </div>
          <div className="lp-nav-cta">
            <button className="lp-signin" onClick={onSignIn}>Sign in</button>
            <button className="btn btn-pine" onClick={onSignUp}>Join the beta</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="hero" id="lp-main" tabIndex={-1}>
        <div className="hero-bg" aria-hidden="true">
          <div className="glow1"/><div className="glow2"/>
          <div className="contour">
            <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M-50 540 C 220 470 360 600 600 520 S 1000 420 1260 500"/>
              <path d="M-50 600 C 240 540 380 660 620 580 S 1010 490 1260 560"/>
              <path d="M-50 470 C 200 400 380 520 600 450 S 1010 360 1260 430"/>
              <path d="M-50 400 C 220 350 360 440 600 380 S 1010 300 1260 360"/>
              <path d="M-50 330 C 230 290 360 370 600 320 S 1010 250 1260 300"/>
            </svg>
          </div>
        </div>
        <div className="wrap hero-grid">
          <div className="rv">
            <span className="hero-badge"><span className="pdot"/> Now in beta — free to join</span>
            <h1>Your home,<br/><em>kept well.</em></h1>
            <p className="hero-p">Type your address and Steadwell fills in the rest — then keeps your maintenance, costs, and records in order, year after year.</p>
            <div className="hero-addr" role="presentation">
              <span className="pin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
              <span className="typed">{typed}<span className="caret"/></span>
              <span className="go">Look up <span aria-hidden="true">→</span></span>
            </div>
            <div className="hero-btns">
              <button className="btn btn-terra" onClick={onSignUp}>Join the beta — it's free <span aria-hidden="true">→</span></button>
              <button className="btn btn-ghost" onClick={() => scrollTo("features")}>See how it works</button>
            </div>
            <p className="hero-micro"><b>No credit card.</b> Free forever plan available.</p>
          </div>
          <div className="hero-vis rv" style={{ transitionDelay: ".14s" }}>
            <div className="blob" aria-hidden="true"/>
            <div className="pv">
              <div className="pv-bar"><i/><i/><i/><span className="pv-url">steadwell.app</span></div>
              <div className="pv-body">
                <div className="pv-greet">Good morning, Alex.</div>
                <div className="pv-sub">Your home is in good shape — 2 things coming up this week.</div>
                <div className="pv-stats">
                  <div className="pv-stat"><div className="k">Home value</div><div className="v">$418k</div></div>
                  <div className="pv-stat accent"><div className="k">Tasks due</div><div className="v">2</div></div>
                  <div className="pv-stat amber"><div className="k">This year</div><div className="v">$3.2k</div></div>
                </div>
                <div className="pv-row"><span className="dot" style={{ background: "var(--terracotta)" }}/><span className="tl">Service HVAC filter</span><span className="tr">in 5 days</span></div>
                <div className="pv-row"><span className="dot" style={{ background: "var(--sage-deep)" }}/><span className="tl">Roof inspection due</span><span className="tr">in 12 days</span></div>
                <div className="pv-row"><span className="dot" style={{ background: "var(--pine)" }}/><span className="tl">Water heater warranty</span><span className="tr">3 yrs left</span></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── STATS ── */}
      <section className="stats">
        <div className="wrap">
          <div className="stats-in rv">
            <div className="stat-cell"><div className="stat-n"><span className="cnt" data-to="50">50</span><span className="suf">+</span></div><div className="stat-l">Data fields per home</div></div>
            <div className="stat-cell"><div className="stat-n">$0</div><div className="stat-l">To get started</div></div>
            <div className="stat-cell"><div className="stat-n"><span className="cnt" data-to="3">3</span><span className="suf"> min</span></div><div className="stat-l">To set up your home</div></div>
            <div className="stat-cell"><div className="stat-n"><span className="cnt" data-to="100">100</span><span className="suf">%</span></div><div className="stat-l">Your data, private</div></div>
          </div>
        </div>
      </section>

      {/* ── QUESTIONS MARQUEE ── */}
      <section className="qs" aria-label="Questions Steadwell answers">
        <div className="qs-label">Questions Steadwell answers for you</div>
        <div className="qs-track">
          {[...questions, ...questions].map((q, i) => <span key={i} className="q-pill">{q}</span>)}
        </div>
      </section>

      {/* ── EDITORIAL STATEMENT ── */}
      <section className="band">
        <div className="wrap rv">
          <p className="stmt">Most home apps are built for buying and selling. Steadwell is built for <em>the years in between.</em></p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="block" id="features">
        <div className="wrap">
          <div className="head center rv">
            <div className="eyebrow">Everything in one place</div>
            <h2 className="h2">Built for homeowners,<br/>not real estate agents</h2>
            <p className="sub">From the moment you move in, Steadwell quietly keeps the whole picture — what your home is, what it needs, and what it's worth.</p>
          </div>
          <div className="bento">
            <div className="feat spot rv">
              <div>
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div>
                <h3>Type your address. We do the rest.</h3>
                <p>Steadwell pulls 50+ fields from public records in seconds — year built, square footage, beds &amp; baths, tax history, every past sale, and nearby schools. No forms, no manual entry.</p>
                <span className="tag">Instant property lookup</span>
              </div>
              <div className="spot-vis" aria-hidden="true">
                <div className="addr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg> 1420 Maple Grove Dr</div>
                <div className="spot-grid">
                  <div>Year built<b>1987</b></div>
                  <div>Square feet<b>2,140</b></div>
                  <div>Last sale<b>$352,000</b></div>
                  <div>Est. value<b>$418,000</b></div>
                </div>
              </div>
            </div>
            {features.map((f, i) => (
              <div key={i} className="feat third rv" style={{ transitionDelay: (i % 3 * 0.07) + "s" }}>
                <div className="ic">{f.ic}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="tag">{f.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="block how" id="how">
        <div className="wrap">
          <div className="head center rv">
            <div className="eyebrow">Up and running in minutes</div>
            <h2 className="h2">No manual entry for<br/>the boring stuff</h2>
            <p className="sub">Steadwell does the heavy lifting from your address. You just keep it pointed in the right direction.</p>
          </div>
          <div className="steps">
            {[
              { n: "1", t: "Create your account", d: "Email and you're in — under 60 seconds, no card." },
              { n: "2", t: "Enter your address", d: "We pull 50+ fields from public records automatically." },
              { n: "3", t: "Start tracking", d: "Tasks, warranties, costs, and documents — all in one place." },
              { n: "4", t: "Stay ahead", d: "Reminders surface what's due before it slips." },
            ].map((s, i) => (
              <div key={i} className="step rv" style={{ transitionDelay: (i * 0.08) + "s" }}>
                <div className="num">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="block">
        <div className="wrap">
          <div className="head center rv">
            <div className="eyebrow">Early homeowners</div>
            <h2 className="h2">Real homes, kept well</h2>
          </div>
          <div className="proof">
            {[
              { q: "I typed my address and it instantly knew my home was built in 1987, showed me the last three sales, and pulled 5 years of property tax records. That alone is worth it.", n: "Mike R.", r: "Homeowner · Tampa, FL", i: "MR", c: "#3A7AAF" },
              { q: "Finally somewhere to track all our warranties. Our dishwasher broke and I actually knew exactly where the warranty was. First time ever.", n: "Sarah L.", r: "First-time homeowner · Austin, TX", i: "SL", c: "#7FA088" },
              { q: "The expense tracker showed me I've spent $14,000 on my home in 2 years. I had no idea. Now I actually have data to plan with.", n: "James T.", r: "Homeowner · Denver, CO", i: "JT", c: "#C16140" },
            ].map((p, i) => (
              <div key={i} className="tcard rv" style={{ transitionDelay: (i * 0.09) + "s" }}>
                <div className="mark">&ldquo;</div>
                <p className="quote">{p.q}</p>
                <div className="who">
                  <span className="av" style={{ background: p.c }}>{p.i}</span>
                  <div><div className="nm">{p.n}</div><div className="ro">{p.r}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="block pricing" id="pricing">
        <div className="wrap">
          <div className="head center rv">
            <div className="eyebrow">Simple pricing</div>
            <h2 className="h2">Start free. Upgrade when ready.</h2>
            <p className="sub">Use Steadwell free for as long as you like. Unlock more when your home needs more.</p>
          </div>
          <div className="price-wrap">

            {/* FREE */}
            <div className="pcard rv">
              <div className="plan">Free</div>
              <div className="price">$0<span> / month</span></div>
              <p className="pdesc">Everything you need to get started and stay organized.</p>
              <ul className="plist">
                {[
                  "Unlimited tasks + basic recurring",
                  "Unlimited assets & expenses",
                  "5 documents",
                  "1 property",
                  "Property auto-fill",
                  "Contractor rolodex",
                  "Weekly digest email",
                  "Basic reminders",
                ].map(f => <li key={f}><span className="ck">✓</span> {f}</li>)}
              </ul>
              <button className="btn btn-outline pbtn" onClick={onSignUp}>Get started free</button>
            </div>

            {/* PLUS */}
            <div className="pcard plus rv" style={{transitionDelay:".06s"}}>
              <span className="pbadge">Most popular</span>
              <div className="plan">Plus</div>
              <div className="price">$4.99<span> / month</span></div>
              <p className="pdesc">Automation and intelligence for the serious homeowner.</p>
              <ul className="plist">
                {[
                  "Everything in Free",
                  "Full recurring task engine",
                  "Home health score",
                  "5-year cost forecasting",
                  "Daily reminders & warranty alerts",
                  "25 documents",
                  "AI receipt scan",
                  "Full Home Setup Wizard",
                ].map(f => <li key={f}><span className="ck">✓</span> {f}</li>)}
              </ul>
              <button className="btn btn-terra pbtn" onClick={onSignUp}>Start Plus</button>
            </div>

            {/* PRO */}
            <div className="pcard prem rv" style={{transitionDelay:".12s"}}>
              <div className="plan">Pro</div>
              <div className="price">$9.99<span> / month</span></div>
              <p className="pdesc">Multiple properties, shared access, and the full platform.</p>
              <ul className="plist">
                {[
                  "Everything in Plus",
                  "Up to 3 properties",
                  "Unlimited documents",
                  "Shared home access",
                  "Pre-sale home report included",
                  "Contractor verified badge",
                  "Regional price benchmarking",
                  "Priority support",
                ].map(f => <li key={f}><span className="ck">✓</span> {f}</li>)}
              </ul>
              <button className="btn btn-terra pbtn" onClick={onSignUp}>Start Pro</button>
            </div>

          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="final">
        <div className="glow" aria-hidden="true"/>
        <div className="wrap rv">
          <h2>Your home is your<br/><em>biggest investment.</em></h2>
          <p>Start keeping it well — free forever, set up in minutes, no credit card required.</p>
          <button className="btn btn-terra btn-xl" onClick={onSignUp}>Create your free account <span aria-hidden="true">→</span></button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-in">
            <div className="foot-brand">
              <span className="tile"><HouseMark/></span>
              <span className="wm">Steadwell</span>
              <span className="foot-tag">— Your home, kept well.</span>
            </div>
            <div className="foot-links">
              <a onClick={() => scrollTo("features")}>Features</a>
              <a onClick={() => scrollTo("pricing")}>Pricing</a>
              <a onClick={onSignIn}>Sign in</a>
            </div>
          </div>
          <div className="foot-copy">
            <span>&copy; 2026 Steadwell. Built for homeowners.</span>
            <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap"}}>
              <a href="/terms" style={{color:"rgba(244,237,223,.45)",textDecoration:"none",fontSize:".8rem"}}>Terms of Service</a>
              <a href="/privacy" style={{color:"rgba(244,237,223,.45)",textDecoration:"none",fontSize:".8rem"}}>Privacy Policy</a>
              <a href="/ada" style={{color:"rgba(244,237,223,.45)",textDecoration:"none",fontSize:".8rem"}}>Accessibility</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── ONBOARDING WIZARD ───────────────────────────────────────────────────────
function OnboardingWizard({ session, onComplete }) {
  const TOTAL_STEPS = 4;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Name
  const [name, setName] = useState("");

  // Step 2 — Address
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lookupState, setLookupState] = useState("idle"); // idle | loading | found | notfound
  const [propertyData, setPropertyData] = useState(null);
  const [suggesting, setSuggesting] = useState(false); // spinner while fetching suggestions
  const [selectedAddress, setSelectedAddress] = useState(""); // only set via dropdown pick
  const debounceRef = useRef(null);
  const suggestRef = useRef(null);
  const GEO_KEY = import.meta.env.VITE_GEOAPIFY_KEY;

  // Step 3 — First task
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState("Other");
  const [taskDate, setTaskDate] = useState(localISO(new Date(Date.now() + 7*86400000)));

  // Close suggestions on outside click
  useEffect(() => {
    const handler = e => { if(suggestRef.current && !suggestRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Geoapify autocomplete — faster debounce, lower min chars, loading indicator
  const handleAddressInput = (val) => {
    setAddress(val);
    setShowSuggestions(true);
    setLookupState("idle");
    setPropertyData(null);
    setSelectedAddress("");
    clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); setSuggesting(false); return; }
    setSuggesting(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(val)}&filter=countrycode:us&type=street&limit=5&apiKey=${GEO_KEY}`;
        const resp = await fetch(url);
        const json = await resp.json();
        setSuggestions((json.features||[]).map(f => ({
          formatted: f.properties.formatted,
          line1: f.properties.address_line1 || f.properties.street || "",
          city:  f.properties.city || "",
          state: f.properties.state_code || f.properties.state || "",
          zip:   f.properties.postcode || "",
        })));
      } catch { setSuggestions([]); }
      finally { setSuggesting(false); }
    }, 200);
  };

  // Only trigger lookup when user picks a verified suggestion — prevents partial-address mismatches
  const selectSuggestion = async (s) => {
    const addr = [s.line1, s.city, s.state, s.zip].filter(Boolean).join(", ");
    setAddress(addr);
    setSelectedAddress(addr);
    setSuggestions([]);
    setShowSuggestions(false);
    setSuggesting(false);
    setLookupState("loading");
    try {
      const result = await lookupProperty(addr);
      if (result) { setPropertyData(result); setLookupState("found"); }
      else setLookupState("notfound");
    } catch { setLookupState("notfound"); }
  };

  const resetAddress = () => {
    setAddress(""); setSelectedAddress(""); setSuggestions([]);
    setLookupState("idle"); setPropertyData(null); setSuggesting(false);
  };

  // Fallback for manual entry (keep but don't expose prominently)
  const handleLookup = async () => {
    if (!address.trim()) return;
    setSelectedAddress(address.trim());
    setLookupState("loading");
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      const result = await lookupProperty(address.trim());
      if (result) { setPropertyData(result); setLookupState("found"); }
      else setLookupState("notfound");
    } catch { setLookupState("notfound"); }
  };

  // Progress dots
  const ProgressDots = () => (
    <div className="wizard-progress">
      {Array.from({length:TOTAL_STEPS}).map((_,i) => (
        <div key={i} className={`wizard-step-dot ${i+1 < step ? "done" : i+1 === step ? "active" : "pending"}`}/>
      ))}
    </div>
  );

  // Step 1 — Welcome + name
  if (step === 1) return (
    <div className="wizard-wrap">
      <div className="wizard-card">
        <ProgressDots />
        <div className="wizard-body">
          <span className="wizard-icon">🏠</span>
          <div className="wizard-title">Welcome to Steadwell</div>
          <div className="wizard-sub">Your home's command center. Let's get you set up in about 2 minutes.</div>
          <div className="wizard-field">
            <label>What should we call you?</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="First name"
              onKeyDown={e => e.key === "Enter" && name.trim() && setStep(2)}
            />
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:".5rem",marginTop:".25rem"}}>
            {[
              {icon:"🔍", text:"Auto-fill your home's details from public records"},
              {icon:"✓",  text:"Track maintenance tasks with climate-aware tips"},
              {icon:"💲", text:"Log expenses and track your home investment"},
              {icon:"🛡️", text:"Store warranties, assets, and insurance info"},
            ].map((f,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:".7rem",padding:".55rem .75rem",background:"var(--cream)",borderRadius:"10px"}}>
                <span style={{fontSize:"1.1rem"}}>{f.icon}</span>
                <span style={{fontSize:".84rem",color:"#4A4440"}}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="wizard-footer" style={{justifyContent:"flex-end"}}>
          <button className="wizard-next" disabled={!name.trim()} onClick={() => setStep(2)}>
            {name.trim() ? `Let's go, ${name.split(" ")[0]} →` : "Get started →"}
          </button>
        </div>
      </div>
    </div>
  );

  // Step 2 — Address (required)
  if (step === 2) return (
    <div className="wizard-wrap">
      <div className="wizard-card">
        <ProgressDots />
        <div className="wizard-body">
          <span className="wizard-icon">📍</span>
          <div className="wizard-title">What's your home address?</div>
          <div className="wizard-sub">Start typing and <strong>select your address from the list</strong> — we'll look it up automatically.</div>

          {/* Hide input once address confirmed, show reset instead */}
          {lookupState === "idle" || lookupState === "loading" ? (
            <div className="wizard-autocomplete" ref={suggestRef}>
              <div className="wizard-field" style={{position:"relative"}}>
                <label>Home Address</label>
                <input
                  autoFocus
                  value={address}
                  onChange={e => handleAddressInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="e.g. 123 Maple Street, Tampa, FL"
                  autoComplete="off"
                  onKeyDown={e => { if(e.key === "Escape") setShowSuggestions(false); }}
                  style={{paddingRight: suggesting ? "2.2rem" : undefined}}
                />
                {suggesting && (
                  <span style={{position:"absolute",right:"10px",top:"calc(50% + 10px)",transform:"translateY(-50%)"}}>
                    <span className="spinner" style={{width:14,height:14,borderWidth:2}}/>
                  </span>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="wizard-suggestions">
                  {suggestions.map((s,i) => (
                    <div key={i} className="wizard-suggestion" onMouseDown={() => selectSuggestion(s)}>
                      <span>📍</span>
                      <div>
                        <div style={{fontWeight:500}}>{s.line1}</div>
                        <div style={{fontSize:".72rem",color:"#A8A09A"}}>{[s.city,s.state,s.zip].filter(Boolean).join(", ")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showSuggestions && !suggesting && suggestions.length === 0 && address.length >= 5 && (
                <div style={{fontSize:".8rem",color:"#A8A09A",padding:".5rem .75rem",background:"var(--cream)",borderRadius:"8px",marginTop:".35rem"}}>
                  No suggestions yet — keep typing your full address.
                </div>
              )}
            </div>
          ) : (
            /* Show selected address + reset option once lookup completes */
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".65rem .85rem",background:"var(--cream)",borderRadius:"10px",border:"1px solid var(--stone)"}}>
              <div style={{display:"flex",alignItems:"center",gap:".5rem",minWidth:0}}>
                <span style={{fontSize:"1rem",flexShrink:0}}>📍</span>
                <span style={{fontSize:".84rem",fontWeight:500,color:"var(--dark)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedAddress || address}</span>
              </div>
              <button onClick={resetAddress} style={{flexShrink:0,marginLeft:".75rem",fontSize:".75rem",color:"var(--rust)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>
                Change
              </button>
            </div>
          )}

          {lookupState === "loading" && (
            <div style={{display:"flex",alignItems:"center",gap:".6rem",padding:".75rem",background:"var(--cream)",borderRadius:"10px",fontSize:".85rem",color:"#5A534B",marginTop:".5rem"}}>
              <span className="spinner" style={{width:14,height:14,borderWidth:2}}/>
              Looking up your home details…
            </div>
          )}

          {lookupState === "found" && propertyData && (
            <div className="wizard-found">
              <div style={{fontWeight:600,marginBottom:".4rem"}}>✓ Home found</div>
              <div style={{fontSize:".78rem",color:"#5A534B",marginBottom:".6rem",fontStyle:"italic"}}>
                {propertyData.address || selectedAddress}
              </div>
              <div className="wizard-chips">
                {[
                  propertyData.type,
                  propertyData.year ? `Built ${propertyData.year}` : null,
                  propertyData.sqft ? `${Number(propertyData.sqft).toLocaleString()} sqft` : null,
                  propertyData.bedrooms ? `${propertyData.bedrooms} bed` : null,
                  propertyData.bathrooms ? `${propertyData.bathrooms} bath` : null,
                ].filter(Boolean).map((v,i) => (
                  <span key={i} className="wizard-chip">{v}</span>
                ))}
              </div>
              <div style={{marginTop:".6rem",fontSize:".75rem",color:"#A8A09A"}}>
                Not the right property? <button onClick={resetAddress} style={{background:"none",border:"none",color:"var(--rust)",cursor:"pointer",fontSize:".75rem",fontWeight:600,padding:0}}>Search again</button>
              </div>
            </div>
          )}

          {lookupState === "notfound" && (
            <div className="wizard-notfound">
              No property data found for this address — that's okay. You can fill in your home details manually in the My Home tab after setup.
              <div style={{marginTop:".5rem"}}>
                <button onClick={resetAddress} style={{background:"none",border:"none",color:"var(--rust)",cursor:"pointer",fontSize:".78rem",fontWeight:600,padding:0}}>← Try a different address</button>
              </div>
            </div>
          )}
        </div>
        <div className="wizard-footer">
          <button className="wizard-back" onClick={() => { resetAddress(); setStep(1); }}>← Back</button>
          <button
            className="wizard-next"
            disabled={!address.trim() || lookupState === "loading"}
            onClick={() => setStep(3)}
          >
            {lookupState === "found" ? "Looks good →" : lookupState === "notfound" ? "Continue anyway →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );

  // Step 3 — First task (skippable)
  if (step === 3) return (
    <div className="wizard-wrap">
      <div className="wizard-card">
        <ProgressDots />
        <div className="wizard-body">
          <span className="wizard-icon">✓</span>
          <div className="wizard-title">What's on your home to-do list?</div>
          <div className="wizard-sub">Add one maintenance task to get started. You can always add more later.</div>
          <div className="wizard-field">
            <label>Task</label>
            <input
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              placeholder="e.g. Replace HVAC filter, clean gutters…"
              autoFocus
            />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".7rem"}}>
            <div className="wizard-field" style={{marginBottom:0}}>
              <label>Category</label>
              <select value={taskCategory} onChange={e => setTaskCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="wizard-field" style={{marginBottom:0}}>
              <label>Due Date</label>
              <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="wizard-footer">
          <button className="wizard-back" onClick={() => setStep(2)}>← Back</button>
          <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
            <button className="wizard-skip" onClick={() => setStep(4)}>Skip</button>
            <button
              className="wizard-next"
              disabled={!taskTitle.trim()}
              onClick={() => setStep(4)}
            >
              Add task →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Step 4 — Done
  if (step === 4) {
    const handleFinish = async () => {
      setSaving(true);
      const uid = session.user.id;
      try {
        // Save profile
        const profilePayload = {
          user_id: uid,
          name: name.trim() || "",
          address: propertyData?.address || address,
          type: propertyData?.type || "",
          year: propertyData?.year || "",
          sqft: propertyData?.sqft || "",
          bedrooms: propertyData?.bedrooms || "",
          bathrooms: propertyData?.bathrooms || "",
          lot_size: propertyData?.lot_size || "",
          last_sale_price: propertyData?.last_sale_price || "",
          last_sale_date: propertyData?.last_sale_date || "",
          zestimate: propertyData?.zestimate || "",
          rent_zestimate: propertyData?.rent_zestimate || "",
          hoa_fee: propertyData?.hoa_fee || "",
          photo_url: propertyData?.photo_url || "",
          tax_history: propertyData?.tax_history ? JSON.stringify(propertyData.tax_history) : "",
          price_history: propertyData?.price_history ? JSON.stringify(propertyData.price_history) : "",
          schools: propertyData?.schools ? JSON.stringify(propertyData.schools) : "",
          onboarding_complete: true,
        };

        // Upsert profile
        const {data: existing} = await supabase.from("profiles").select("id").eq("user_id", uid).limit(1);
        if (existing && existing.length > 0) {
          await supabase.from("profiles").update(profilePayload).eq("user_id", uid);
        } else {
          await supabase.from("profiles").insert([profilePayload]);
        }

        // Save first task — wait for it to complete before calling onComplete
        if (taskTitle.trim()) {
          const {error: taskError} = await supabase.from("tasks").insert([{
            user_id: uid,
            title: taskTitle.trim(),
            category: taskCategory,
            due_date: taskDate,
            status: "Scheduled",
            priority: "Medium",
          }]);
          if (taskError) console.error("Task insert error:", taskError);
        }

        // Call onComplete — this reloads profile and tasks from Supabase
        await onComplete();
      } catch(e) {
        console.error("Onboarding save error:", e);
        setSaving(false);
        await onComplete(); // still proceed even on error
      }
    };

    return (
      <div className="wizard-wrap">
        <div className="wizard-card">
          <ProgressDots />
          <div className="wizard-body">
            <span className="wizard-icon">🎉</span>
            <div className="wizard-title">You're all set!</div>
            <div className="wizard-sub">Your home is ready to manage. Here's what you can do next.</div>
            <div className="wizard-done-list">
              {[
                {icon:"🏡", title:"Complete your home profile", sub:"Add a nickname, photo, and insurance details in My Home"},
                {icon:"💲", title:"Log your first expense", sub:"Track what you spend maintaining your home over time"},
                {icon:"🏠", title:"Add home assets", sub:"Track your HVAC, appliances, roof, and their service history"},
              ].map((item,i) => (
                <div key={i} className="wizard-done-item">
                  <span className="wizard-done-icon">{item.icon}</span>
                  <div>
                    <div className="wizard-done-title">{item.title}</div>
                    <div className="wizard-done-sub">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="wizard-footer" style={{justifyContent:"flex-end"}}>
            <button className="wizard-next" onClick={handleFinish} disabled={saving}>
              {saving ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/>Saving…</> : "Go to my dashboard →"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // login | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clear = () => { setError(""); setSuccess(""); };

  const handleLogin = async () => {
    clear();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const handleSignup = async () => {
    clear();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // Fire welcome email — async, don't block signup UX
    fetch("https://hjkyameroqufaojuerns.supabase.co/functions/v1/welcome-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: email.split("@")[0] }),
    }).catch(() => {}); // silent fail — email is best-effort
    setSuccess("Account created! Check your email to confirm, then log in.");
  };

  const handleReset = async () => {
    clear();
    if (!email) { setError("Enter your email address."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) setError(error.message);
    else setSuccess("Password reset link sent! Check your email.");
  };

  const switchMode = (m) => { setMode(m); clear(); setPassword(""); setConfirm(""); };

  return (
    <div className="auth-wrap" role="main">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><svg viewBox="0 0 48 48" fill="none" width="60%" height="60%" style={{display:'block'}}><path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 34 L21 27.5 A3 3 0 0 1 27 27.5 L27 34" stroke="#F4EDDF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 34.5 L37 34.5" stroke="#F4EDDF" strokeWidth="2.8" strokeLinecap="round"/><circle cx="24" cy="18.3" r="1.5" fill="#D2876A"/></svg></div>
          <div>
            <div className="auth-logo-text">Steadwell</div>
            <div className="auth-logo-sub">Your home, kept well</div>
          </div>
        </div>

        {mode === "login" && <>
          <div className="auth-title">Welcome back</div>
          <div className="auth-sub">Sign in to manage your home</div>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            <button className="auth-forgot" onClick={()=>switchMode("reset")}>Forgot password?</button>
          </div>
          <button className="auth-btn auth-btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <div className="auth-switch">Don't have an account? <button onClick={()=>switchMode("signup")}>Create one</button></div>
        </>}

        {mode === "signup" && <>
          <div className="auth-title">Create account</div>
          <div className="auth-sub">Start managing your home today</div>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <div className="auth-field">
            <label>Confirm Password</label>
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSignup()} />
          </div>
          <button className="auth-btn auth-btn-primary" onClick={handleSignup} disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
          <div className="auth-switch">Already have an account? <button onClick={()=>switchMode("login")}>Sign in</button></div>
        </>}

        {mode === "reset" && <>
          <div className="auth-title">Reset password</div>
          <div className="auth-sub">We'll send you a reset link</div>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&handleReset()} />
          </div>
          <button className="auth-btn auth-btn-primary" onClick={handleReset} disabled={loading}>
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
          <div className="auth-switch"><button onClick={()=>switchMode("login")}>← Back to sign in</button></div>
        </>}
      </div>
    </div>
  );
}

// ─── USER MENU ────────────────────────────────────────────────────────────────
function UserMenu({ user, onSignOut, onFeedback }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="user-menu" ref={ref} role="navigation" aria-label="User menu">
      <div className="user-btn" onClick={()=>setOpen(o=>!o)}>
        <span className="user-avatar">{initials(user.email)}</span>
        <span style={{opacity:.5,fontSize:".7rem"}}>▾</span>
      </div>
      {open && (
        <div className="user-dropdown">
          <div className="user-dd-email">{user.email}</div>
          <button className="user-dd-item" onClick={()=>{setOpen(false);onFeedback();}}>
            <span>💬</span> Send Feedback
          </button>
          <div className="user-dd-divider"/>
          <button className="user-dd-item danger" onClick={()=>{setOpen(false);onSignOut();}}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── FEEDBACK MODAL ───────────────────────────────────────────────────────────
function FeedbackModal({ user, userId, currentTab, onClose }) {
  const TYPES = ["Bug", "Suggestion", "Question", "Other"];
  const [type, setType]       = useState("Suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      // 1. Save to Supabase feedback table
      await supabase.from("feedback").insert([{
        user_id:  userId,
        email:    user.email,
        type,
        subject:  subject.trim() || null,
        message:  message.trim(),
        page:     currentTab,
      }]);

      // 2. Send notification email via Edge Function
      fetch("https://hjkyameroqufaojuerns.supabase.co/functions/v1/feedback-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:   user.email,
          type,
          subject: subject.trim() || `${type} from ${user.email}`,
          message: message.trim(),
          page:    currentTab,
        }),
      }).then(r => r.json()).then(d => console.log("Feedback email:", d)).catch(err => console.warn("Feedback email failed:", err));

      setDone(true);
      setTimeout(onClose, 2500);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-header">
          <span className="modal-title">💬 Send Feedback</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {done ? (
            <div className="feedback-success">
              <span className="feedback-success-icon">🙌</span>
              <div className="feedback-success-title">Thanks, {user.email.split("@")[0]}!</div>
              <div className="feedback-success-sub">We read every message and usually respond within 24 hours.</div>
            </div>
          ) : (
            <>
              <div style={{fontSize:".78rem",color:"#7A7370",marginBottom:".75rem"}}>
                From: <strong>{user.email}</strong> · Page: <strong>{currentTab}</strong>
              </div>

              <div style={{marginBottom:".75rem"}}>
                <label style={{fontSize:".78rem",fontWeight:600,color:"var(--dark)",display:"block",marginBottom:".4rem"}}>What kind of feedback?</label>
                <div className="feedback-type-row">
                  {TYPES.map(t => (
                    <button key={t} className={`feedback-type-btn ${type===t?"sel":""}`} onClick={()=>setType(t)}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="field" style={{marginBottom:".65rem"}}>
                <label>Subject <span style={{fontWeight:400,color:"#9E9690"}}>(optional)</span></label>
                <input
                  value={subject}
                  onChange={e=>setSubject(e.target.value)}
                  placeholder={type==="Bug"?"e.g. Calendar not loading":type==="Suggestion"?"e.g. Add dark mode":"What's on your mind?"}
                />
              </div>

              <div className="field">
                <label>Message *</label>
                <textarea
                  value={message}
                  onChange={e=>setMessage(e.target.value)}
                  placeholder={type==="Bug"
                    ? "Describe what happened, what you expected, and steps to reproduce…"
                    : "Tell us what you're thinking…"}
                  rows={5}
                  style={{resize:"vertical"}}
                  autoFocus
                />
              </div>
            </>
          )}
        </div>
        {!done && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving||!message.trim()}>
              {saving ? "Sending…" : "Send feedback →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FORMS ───────────────────────────────────────────────────────────────────
function TaskForm({ data, onChange, assets=[], planData, onUpgrade }) {
  const f = (k,v) => onChange({...data,[k]:v});
  const canRecur = planData?.recurring === "full";
  const basicIntervals = ["","monthly","annually"];

  // Smart suggestion — when title changes, auto-suggest a recurrence if none set
  const handleTitle = (val) => {
    const suggestion = suggestRecurrence(val, data.category);
    onChange({...data, title:val, recurring: data.recurring || suggestion});
  };

  const RECUR_OPTIONS = [
    {value:"",             label:"Does not repeat"},
    {value:"daily",        label:"Daily"},
    {value:"weekly",       label:"Weekly"},
    {value:"biweekly",     label:"Every 2 weeks"},
    {value:"monthly",      label:"Monthly"},
    {value:"quarterly",    label:"Every 3 months"},
    {value:"every 6 months", label:"Every 6 months"},
    {value:"annually",     label:"Annually"},
  ];

  return (
    <div className="fg">
      <div className="field s2"><label>Task Title *</label><input value={data.title||""} onChange={e=>handleTitle(e.target.value)} placeholder="e.g. Replace HVAC Filter" /></div>
      <div className="field"><label>Category</label><select value={data.category||""} onChange={e=>f("category",e.target.value)}><option value="">Select…</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="field"><label>Priority</label><select value={data.priority||""} onChange={e=>f("priority",e.target.value)}><option value="">Select…</option>{PRIORITY.map(p=><option key={p}>{p}</option>)}</select></div>
      <div className="field"><label>Status</label><select value={data.status||""} onChange={e=>f("status",e.target.value)}><option value="">Select…</option>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="field"><label>Due Date</label><input type="date" value={data.due_date||""} onChange={e=>f("due_date",e.target.value)} /></div>
      <div className="field">
        <label>🔁 Repeat {!canRecur && <span style={{fontSize:".65rem",color:"#3B5FBF",background:"#EEF4FF",padding:"1px 6px",borderRadius:"8px",marginLeft:"4px"}}>Plus</span>}</label>
        <select value={data.recurring||""} onChange={e=>f("recurring",e.target.value)}
          disabled={!canRecur && data.recurring && !basicIntervals.includes(data.recurring)}>
          {canRecur
            ? RECUR_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)
            : [
                {value:"",label:"Does not repeat"},
                {value:"monthly",label:"Monthly"},
                {value:"annually",label:"Annually"},
              ].map(o=><option key={o.value} value={o.value}>{o.label}</option>)
          }
        </select>
        {!canRecur && (
          <div style={{fontSize:".72rem",color:"#3B5FBF",marginTop:"3px",cursor:"pointer"}} onClick={onUpgrade}>
            Weekly, biweekly, quarterly & more intervals — upgrade to Plus →
          </div>
        )}
        {data.recurring && data.recurring !== "" && data.due_date && (
          <div style={{fontSize:".72rem",color:"var(--rust)",marginTop:"4px",fontWeight:500}}>
            ↻ Next: {new Date(getNextRecurringDate(data.due_date, data.recurring)+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
          </div>
        )}
      </div>
      <div className="field"><label>Est. Cost ($)</label><input type="number" value={data.cost||""} onChange={e=>f("cost",e.target.value)} placeholder="0" /></div>
      <div className="field"><label>Vendor / Contractor</label><input value={data.vendor||""} onChange={e=>f("vendor",e.target.value)} placeholder="DIY or company name" /></div>
      {assets.length > 0 && (
        <div className="field s2">
          <label>Linked Asset (optional)</label>
          <select value={data.asset_id||""} onChange={e=>f("asset_id",e.target.value||null)}>
            <option value="">No asset linked</option>
            {assets.map(a=>(
              <option key={a.id} value={a.id}>{ASSET_ICONS[a.category]||"🔧"} {a.item}{a.category?` · ${a.category}`:""}</option>
            ))}
          </select>
        </div>
      )}
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Details, part numbers, access instructions…" /></div>
    </div>
  );
}

const ASSET_CATEGORIES = ["HVAC","Appliance","Roofing","Plumbing","Electrical","Structure","Safety","Landscaping","Other"];
const ASSET_CONDITIONS = ["Good","Fair","Needs Attention","Failed"];
const CONDITION_STYLE = {
  "Good":            {bg:"var(--sage-light)",  text:"var(--sage)",  border:"#B8D9CC"},
  "Fair":            {bg:"#FFF8E6",            text:"#92610A",      border:"#F5CC76"},
  "Needs Attention": {bg:"var(--rust-light)",  text:"var(--rust)",  border:"#EDCDB8"},
  "Failed":          {bg:"var(--red-light)",   text:"var(--red)",   border:"#EFCFCC"},
};
// Default lifespans by category (years)
const DEFAULT_LIFESPAN = {
  HVAC:20, Appliance:12, Roofing:25, Plumbing:50,
  Electrical:40, Structure:50, Safety:10, Landscaping:15, Other:15,
};
const ASSET_ICONS = {
  HVAC:"🌡️", Appliance:"🍳", Roofing:"🏚️", Plumbing:"🚿",
  Electrical:"⚡", Structure:"🧱", Safety:"🔒", Landscaping:"🌿", Other:"🔧",
};

function AssetForm({ data, onChange, userId, planData, onUpgrade }) {
  const f = (k,v) => onChange({...data,[k]:v});
  // Auto-set lifespan when category changes
  const handleCategory = (cat) => {
    onChange({...data, category:cat, lifespan_years: data.lifespan_years || DEFAULT_LIFESPAN[cat] || 15});
  };
  return (
    <div>
      <AIScanButton
        onScanComplete={fields => onChange({...data,...fields})}
        label="Scan Receipt or Warranty Card"
        description="Auto-fill asset name, model, purchase date, cost & warranty expiry"
        scanType="warranty"
        planData={planData}
        onUpgrade={onUpgrade}
      />
      <div className="scan-divider">or fill in manually</div>
      <div className="fg">
      <div className="field s2"><label>Asset Name *</label><input value={data.item||""} onChange={e=>f("item",e.target.value)} placeholder="e.g. Carrier HVAC System, Samsung Fridge" /></div>
      <div className="field"><label>Category</label>
        <select value={data.category||""} onChange={e=>handleCategory(e.target.value)}>
          <option value="">Select…</option>
          {ASSET_CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="field"><label>Condition</label>
        <select value={data.condition||"Good"} onChange={e=>f("condition",e.target.value)}>
          {ASSET_CONDITIONS.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="field"><label>Model / Serial #</label><input value={data.model||""} onChange={e=>f("model",e.target.value)} /></div>
      <div className="field"><label>Vendor / Store</label><input value={data.vendor||""} onChange={e=>f("vendor",e.target.value)} /></div>
      <div className="field"><label>Purchase Date</label><input type="date" value={data.purchase_date||""} onChange={e=>f("purchase_date",e.target.value)} /></div>
      <div className="field"><label>Install Date</label><input type="date" value={data.install_date||""} onChange={e=>f("install_date",e.target.value)} /></div>
      <div className="field"><label>Purchase Cost ($)</label><input type="number" value={data.cost||""} onChange={e=>f("cost",e.target.value)} /></div>
      <div className="field"><label>Replacement Cost ($)</label><input type="number" value={data.replacement_cost||""} onChange={e=>f("replacement_cost",e.target.value)} placeholder="Est. today's cost" /></div>
      <div className="field"><label>Expected Lifespan (yrs)</label><input type="number" value={data.lifespan_years||""} onChange={e=>f("lifespan_years",e.target.value)} placeholder="e.g. 20" /></div>
      <div className="field"><label>Warranty Expiry</label><input type="date" value={data.expiry_date||""} onChange={e=>f("expiry_date",e.target.value)} /></div>
      <div className="field"><label>Last Serviced</label><input type="date" value={data.last_serviced||""} onChange={e=>f("last_serviced",e.target.value)} /></div>
      <div className="field s2"><label>Document Location</label><input value={data.document_ref||""} onChange={e=>f("document_ref",e.target.value)} placeholder="e.g. Filing Cabinet, Google Drive" /></div>
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Coverage details, serial numbers, service contacts…" /></div>
      <ExpenseFileUpload
        userId={userId}
        expenseId={data.id ? `asset-${data.id}` : undefined}
        currentUrl={data.asset_photo_url||""}
        onUploaded={url=>f("asset_photo_url",url)}
        label="Asset Photo"
        planData={planData}
        onUpgrade={onUpgrade}
      />
      </div>
    </div>
  );
}

function ServiceLogForm({ data, onChange, planData, onUpgrade }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div>
      <AIScanButton
        onScanComplete={fields => onChange({...data,...fields})}
        label="Scan Contractor Invoice"
        description="Auto-fill service description, date & cost from an invoice"
        scanType="invoice"
        planData={planData}
        onUpgrade={onUpgrade}
      />
      <div className="scan-divider">or fill in manually</div>
      <div className="fg">
        <div className="field s2"><label>Description *</label><input value={data.description||""} onChange={e=>f("description",e.target.value)} placeholder="e.g. Annual tune-up, replaced capacitor" /></div>
        <div className="field"><label>Service Date *</label><input type="date" value={data.service_date||""} onChange={e=>f("service_date",e.target.value)} /></div>
        <div className="field"><label>Cost ($)</label><input type="number" value={data.cost||""} onChange={e=>f("cost",e.target.value)} placeholder="0" /></div>
        <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Technician, parts used, findings…" /></div>
      </div>
    </div>
  );
}

// ─── PRO UPGRADE MODAL ───────────────────────────────────────────────────────
function ProUpgradeModal({ onClose }) {
  return (
    <div className="pro-modal-wrap" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="pro-modal">
        <div className="pro-modal-handle"/>
        <div className="pro-modal-icon">✨</div>
        <div className="pro-modal-title">Steadwell Pro</div>
        <div className="pro-modal-sub">
          Unlock AI-powered features that automate your home management — so you spend less time logging and more time living.
        </div>
        <div className="pro-modal-features">
          {[
            {icon:"📷", title:"AI Receipt Scanning", desc:"Photograph any receipt — amount, vendor, and category fill in automatically"},
            {icon:"⚡", title:"AI Utility Bill Scanning", desc:"Snap your electric or gas bill — usage and cost extracted instantly"},
            {icon:"📧", title:"Email Import (coming soon)", desc:"Forward any home-related email to your personal Steadwell address"},
            {icon:"🔔", title:"Smart Reminders", desc:"Weekly digest emails and alerts for overdue tasks and renewals"},
          ].map((f,i) => (
            <div key={i} className="pro-modal-feature">
              <span className="pro-modal-feature-icon">{f.icon}</span>
              <div className="pro-modal-feature-text">
                <strong>{f.title}</strong>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
        <button className="pro-modal-cta" onClick={() => {
          alert("Pro subscriptions are coming soon! We'll notify you when they launch.");
          onClose();
        }}>
          Join the Pro waitlist →
        </button>
        <button className="pro-modal-dismiss" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ─── AI SCAN BUTTON ───────────────────────────────────────────────────────────
const AI_SCAN_URL = "https://hjkyameroqufaojuerns.supabase.co/functions/v1/ai-document-scan";

function AIScanButton({ onScanComplete, label="Scan with AI", description, scanType="receipt", planData, onUpgrade }) {
  const [scanning, setScanning]   = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const fileRef = useRef(null);
  const canScan = planData?.aiScan;

  const handleClick = () => {
    if (!canScan) { if (onUpgrade) onUpgrade(); return; }
    setError(""); setSuccess(false);
    fileRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be re-selected

    const isPdf  = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) { setError("Please select an image or PDF."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("File must be under 20MB."); return; }

    setScanning(true); setError("");

    try {
      // Read as base64
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result.split(",")[1]);
        reader.onerror = () => rej(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const resp = await fetch(AI_SCAN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mimeType: file.type, scanType }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "Scan failed");

      onScanComplete(data.fields);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Scan failed — please try again");
    }
    setScanning(false);
  };

  return (
    <div style={{marginBottom:".85rem"}}>
      <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFile}/>
      <button type="button" className="scan-btn scan-btn-bg" onClick={handleClick} disabled={scanning}>
        <span style={{fontSize:"1rem"}}>{scanning ? "⏳" : success ? "✓" : "✨"}</span>
        {scanning ? "Scanning…" : success ? "Fields filled!" : label}
        {!canScan && <span className="scan-btn-badge">Plus</span>}
      </button>
      {description && !error && !success && (
        <div style={{fontSize:".72rem",color:"#A8A09A",textAlign:"center",marginTop:".35rem"}}>{description}</div>
      )}
      {error   && <div style={{fontSize:".72rem",color:"var(--rust)",textAlign:"center",marginTop:".35rem"}}>⚠ {error}</div>}
      {success && <div style={{fontSize:".72rem",color:"#2A9D6A",textAlign:"center",marginTop:".35rem"}}>✓ Form filled from scan — review and save</div>}
    </div>
  );
}

// ─── LIGHTBOX ────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useBodyScrollLock();
  useEffect(() => {
    const handler = e => { if(e.key==="Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <img src={src} alt="Receipt" onClick={e=>e.stopPropagation()} />
    </div>
  );
}

// ─── EXPENSE FILE UPLOAD ──────────────────────────────────────────────────────
function ExpenseFileUpload({ userId, expenseId, currentUrl, onUploaded, label="Receipt / Photo", planData, onUpgrade }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const maxMB = planData?.maxFileMB ?? 50;

  const handleFile = async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) { setError("Please select an image or PDF."); return; }
    if (file.size > maxMB * 1024 * 1024) { setError(`File must be under ${maxMB}MB on your plan.`); return; }
    setError("");

    // Check total file count before uploading
    if (!currentUrl) { // only check when adding new, not replacing
      const limit = await checkFileLimit(userId, planData);
      if (!limit.ok) {
        if (onUpgrade) onUpgrade();
        else setError(`File limit reached (${limit.max} files on ${planData?.label||"Free"}). Upgrade to add more.`);
        return;
      }
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/expense-${expenseId || Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("expense-files")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) { setError("Upload failed — " + upErr.message); setUploading(false); return; }

    const { data } = supabase.storage.from("expense-files").getPublicUrl(path);
    onUploaded(data.publicUrl + "?t=" + Date.now());
    setUploading(false);
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    // Extract path from URL
    const path = currentUrl.split("/expense-files/")[1]?.split("?")[0];
    if (path) await supabase.storage.from("expense-files").remove([path]);
    onUploaded("");
  };

  return (
    <div className="field s2">
      <label>{label}</label>
      {currentUrl ? (
        <div>
          {currentUrl.match(/\.(jpg|jpeg|png|webp|heic)/i) ? (
            <img src={currentUrl} alt="Receipt" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:"var(--r-sm)",marginBottom:"6px"}} />
          ) : (
            <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="exp-file-pdf">
              📄 View PDF receipt
            </a>
          )}
          <button className="btn btn-danger btn-sm" style={{marginTop:"6px"}} onClick={handleRemove}>✕ Remove file</button>
        </div>
      ) : (
        <div className="exp-upload-inline">
          <input type="file" accept="image/*,.pdf" onChange={e=>handleFile(e.target.files[0])} />
          📎 Attach receipt or photo (JPG, PNG, PDF — up to 20MB)
        </div>
      )}
      {uploading && <div className="exp-upload-progress"><span className="spinner" style={{width:12,height:12,borderWidth:2}}/>Uploading…</div>}
      {error && <div style={{color:"var(--red)",fontSize:".75rem",marginTop:"3px"}}>⚠️ {error}</div>}
    </div>
  );
}

function ExpenseForm({ data, onChange, projects=[], userId, planData, onUpgrade }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div>
      {/* AI Scan — Pro gate */}
      <AIScanButton
        onScanComplete={fields => onChange({...data,...fields})}
        label="Scan Receipt with AI"
        description="Auto-fill amount, vendor, date & category from a photo"
        scanType="receipt"
        planData={planData}
        onUpgrade={onUpgrade}
      />
      <div className="scan-divider">or fill in manually</div>
      <div className="fg">
        <div className="field s2"><label>Description *</label><input value={data.description||""} onChange={e=>f("description",e.target.value)} placeholder="e.g. HVAC Service Call" /></div>
        <div className="field"><label>Category</label><select value={data.category||""} onChange={e=>f("category",e.target.value)}><option value="">Select…</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="field"><label>Amount ($)</label><input type="number" value={data.amount||""} onChange={e=>f("amount",e.target.value)} placeholder="0" /></div>
        <div className="field"><label>Date</label><input type="date" value={data.date||""} onChange={e=>f("date",e.target.value)} /></div>
        <div className="field s2"><label>Vendor / Contractor</label><input value={data.vendor||""} onChange={e=>f("vendor",e.target.value)} /></div>
        {projects.length > 0 && (
          <div className="field s2">
            <label>Link to Project (optional)</label>
            <select value={data.project_id||""} onChange={e=>f("project_id",e.target.value?Number(e.target.value):null)}>
              <option value="">No project</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Invoice #, notes…" /></div>
        <ExpenseFileUpload
          userId={userId}
          expenseId={data.id}
          currentUrl={data.file_url||""}
          onUploaded={url=>f("file_url",url)}
          planData={planData}
          onUpgrade={onUpgrade}
        />
      </div>
    </div>
  );
}

const PROJECT_STATUSES = ["Planning","In Progress","Completed","On Hold"];
const PROJECT_STATUS_STYLE = {
  "Planning":    {bg:"var(--sky-light)",   text:"var(--sky)",   border:"#93C5E8"},
  "In Progress": {bg:"#FFF8E6",            text:"#92610A",      border:"#F5CC76"},
  "Completed":   {bg:"var(--sage-light)",  text:"var(--sage)",  border:"#B8D9CC"},
  "On Hold":     {bg:"var(--cream2)",      text:"#7A7370",      border:"var(--stone)"},
};

function ProjectForm({ data, onChange, userId }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div className="fg">
      <div className="field s2"><label>Project Name *</label><input value={data.name||""} onChange={e=>f("name",e.target.value)} placeholder="e.g. Kitchen Remodel" /></div>
      <div className="field"><label>Status</label><select value={data.status||"Planning"} onChange={e=>f("status",e.target.value)}>{PROJECT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="field"><label>Budget ($)</label><input type="number" value={data.budget||""} onChange={e=>f("budget",e.target.value)} placeholder="0" /></div>
      <div className="field"><label>Start Date</label><input type="date" value={data.start_date||""} onChange={e=>f("start_date",e.target.value)} /></div>
      <div className="field"><label>End Date</label><input type="date" value={data.end_date||""} onChange={e=>f("end_date",e.target.value)} /></div>
      <div className="field s2"><label>Description</label><textarea value={data.description||""} onChange={e=>f("description",e.target.value)} placeholder="What work is being done…" /></div>
      <div className="field s2"><label>Contractor / Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Contractors, permits, decisions…" /></div>
      <ExpenseFileUpload
        userId={userId}
        expenseId={data.id ? `project-${data.id}` : undefined}
        currentUrl={data.photo_url||""}
        onUploaded={url=>f("photo_url", url)}
        label="Project Photo"
        bucket="expense-files"
      />
    </div>
  );
}

// ─── PHOTO UPLOAD ─────────────────────────────────────────────────────────────
function PhotoUpload({ userId, currentUrl, onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || null);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Image must be under 10MB."); return; }
    setError("");
    setUploading(true);

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    // Upload to Supabase Storage under user's folder
    const ext = file.name.split(".").pop();
    const path = `${userId}/home-photo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("home-photos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setError("Upload failed — " + uploadError.message);
      setPreview(currentUrl || null);
      setUploading(false);
      return;
    }

    // Get public URL
    const { data } = supabase.storage.from("home-photos").getPublicUrl(path);
    const publicUrl = data.publicUrl + "?t=" + Date.now(); // cache bust
    setPreview(publicUrl);
    onUploaded(publicUrl);
    setUploading(false);
  };

  const handleRemove = async () => {
    const path = `${userId}/home-photo`;
    // Try common extensions
    for (const ext of ["jpg","jpeg","png","webp","heic"]) {
      await supabase.storage.from("home-photos").remove([`${path}.${ext}`]);
    }
    setPreview(null);
    onUploaded("");
  };

  return (
    <div className="photo-upload-wrap">
      <label style={{fontSize:".7rem",fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",color:"#7A7370",display:"block",marginBottom:"6px"}}>
        Home Photo
      </label>

      {preview ? (
        <div className="photo-preview">
          <img src={preview} alt="Your home" />
          <button className="photo-preview-remove" onClick={handleRemove}>✕ Remove</button>
        </div>
      ) : (
        <div
          className={`photo-drop ${dragging ? "drag" : ""}`}
          onDragOver={e=>{e.preventDefault();setDragging(true);}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
        >
          <input
            type="file"
            accept="image/*"
            onChange={e=>handleFile(e.target.files[0])}
          />
          <div className="photo-drop-icon">📷</div>
          <div className="photo-drop-text">
            <strong>Click to upload</strong> or drag & drop<br/>
            JPG, PNG, HEIC up to 10MB
          </div>
        </div>
      )}

      {uploading && (
        <div className="photo-uploading">
          <span className="spinner" style={{width:14,height:14,borderWidth:2}}/>
          Uploading photo…
        </div>
      )}
      {error && <div style={{color:"var(--red)",fontSize:".78rem",marginTop:".4rem"}}>⚠️ {error}</div>}
    </div>
  );
}


function ProfileForm({ data, onChange, userId, photoPos=40, onPhotoPos }) {
  const f = (k,v) => onChange({...data,[k]:v});
  const [lookupAddr, setLookupAddr] = useState(data.address || "");
  const [lookupState, setLookupState] = useState("idle");
  const [lookupMsg, setLookupMsg] = useState("");
  const [preview, setPreview] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestRef = useRef(null);
  const debounceRef = useRef(null);
  const GEO_KEY = import.meta.env.VITE_GEOAPIFY_KEY;

  // Close suggestions on outside click
  useEffect(() => {
    const handler = e => { if(suggestRef.current && !suggestRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced address autocomplete via Geoapify
  const handleAddrInput = (val) => {
    setLookupAddr(val);
    setShowSuggestions(true);
    clearTimeout(debounceRef.current);
    if (val.length < 4) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(val)}&filter=countrycode:us&type=street&limit=6&apiKey=${GEO_KEY}`;
        const resp = await fetch(url);
        const json = await resp.json();
        const features = json.features || [];
        setSuggestions(features.map(f => ({
          formatted: f.properties.formatted,
          line1: f.properties.address_line1 || f.properties.street || "",
          city:  f.properties.city || f.properties.county || "",
          state: f.properties.state_code || f.properties.state || "",
          zip:   f.properties.postcode || "",
        })));
      } catch(e) {
        setSuggestions([]);
      }
      setSuggestLoading(false);
    }, 350);
  };

  const selectSuggestion = (s) => {
    const addr = [s.line1, s.city, s.state, s.zip].filter(Boolean).join(", ");
    setLookupAddr(addr);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleLookup = async () => {
    if (!lookupAddr.trim()) return;
    setLookupState("loading");
    setLookupMsg("Looking up property data — this takes 10–30 seconds…");
    setPreview(null);
    setSuggestions([]);
    setShowSuggestions(false);
    // Always pre-fill address so user isn't left with nothing
    onChange({...data, address: lookupAddr.trim()});
    try {
      const result = await lookupProperty(lookupAddr.trim());
      if (!result) {
        setLookupState("notfound");
        setLookupMsg("");
        // Still save the address they typed
        return;
      }
      onChange({
        ...data,
        address:         result.address        || lookupAddr,
        type:            result.type           || data.type,
        year:            result.year           || data.year,
        sqft:            result.sqft           || data.sqft,
        bedrooms:        result.bedrooms       || data.bedrooms,
        bathrooms:       result.bathrooms      || data.bathrooms,
        lot_size:        result.lot_size       || data.lot_size,
        last_sale_price: result.last_sale_price|| data.last_sale_price,
        last_sale_date:  result.last_sale_date || data.last_sale_date,
        zestimate:       result.zestimate      || data.zestimate,
        rent_zestimate:  result.rent_zestimate || data.rent_zestimate,
        hoa_fee:         result.hoa_fee        || data.hoa_fee,
        photo_url:       result.photo_url      || data.photo_url,
        description:     result.description    || data.description,
        zpid:            result.zpid           || data.zpid,
        tax_history:     result.tax_history    || data.tax_history,
        price_history:   result.price_history  || data.price_history,
        schools:         result.schools        || data.schools,
      });
      setPreview(result);
      setLookupState("ok");
      setLookupMsg("Property found! Fields have been filled in — review and edit anything below.");
    } catch (err) {
      setLookupState("notfound");
      setLookupMsg("");
    }
  };

  return (
    <div>
      {/* ── Property Lookup Box ── */}
      <div className="lookup-box">
        <div className="lookup-title">🔍 Auto-Fill from Address</div>
        <div className="lookup-autocomplete" ref={suggestRef}>
          <div className="lookup-row">
            <input
              value={lookupAddr}
              onChange={e => handleAddrInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Start typing your address…"
              onKeyDown={e => { if(e.key === "Enter") { setShowSuggestions(false); handleLookup(); } if(e.key === "Escape") setShowSuggestions(false); }}
              autoComplete="off"
            />
            <button
              className="lookup-btn"
              onClick={handleLookup}
              disabled={lookupState === "loading"}
            >
              {lookupState === "loading" ? (
                <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/>Looking up…</>
              ) : "Look Up"}
            </button>
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && (suggestions.length > 0 || suggestLoading) && (
            <div className="lookup-suggestions">
              {suggestLoading && suggestions.length === 0 && (
                <div className="lookup-suggestion" style={{color:"#A8A09A",cursor:"default"}}>
                  <span className="spinner" style={{width:12,height:12,borderWidth:2,flexShrink:0}}/>
                  <span>Finding addresses…</span>
                </div>
              )}
              {suggestions.map((s, i) => (
                <div key={i} className="lookup-suggestion" onMouseDown={()=>selectSuggestion(s)}>
                  <span className="lookup-suggestion-icon">📍</span>
                  <div>
                    <div className="lookup-suggestion-text">{s.line1}</div>
                    <div className="lookup-suggestion-sub">{[s.city, s.state, s.zip].filter(Boolean).join(", ")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status messages */}
        {lookupState === "ok" && lookupMsg && (
          <div className="lookup-status ok">✓ {lookupMsg}</div>
        )}
        {lookupState === "loading" && (
          <div className="lookup-status">⏳ {lookupMsg}</div>
        )}

        {/* Not found — friendly message */}
        {lookupState === "notfound" && (
          <div className="lookup-not-found">
            <strong>No property data found for this address</strong>
            This can happen with older homes, rural properties, or addresses not yet indexed. Your address has been saved — fill in the details below manually. Everything is editable.
          </div>
        )}

        {/* Preview chips on success */}
        {preview && (
          <div className="lookup-preview">
            {[
              { label: "Type",          val: preview.type },
              { label: "Year Built",    val: preview.year },
              { label: "Sq Ft",         val: preview.sqft ? Number(preview.sqft).toLocaleString() : null },
              { label: "Beds",          val: preview.bedrooms },
              { label: "Baths",         val: preview.bathrooms },
              { label: "Lot Size",      val: preview.lot_size },
              { label: "Last Sale",     val: preview.last_sale_price ? `$${Number(preview.last_sale_price).toLocaleString()}` : null },
              { label: "Zestimate",     val: preview.zestimate ? `$${Number(preview.zestimate).toLocaleString()}` : null },
              { label: "Rent Estimate", val: preview.rent_zestimate ? `$${Number(preview.rent_zestimate).toLocaleString()}/mo` : null },
              { label: "HOA Fee",       val: preview.hoa_fee ? `$${Number(preview.hoa_fee).toLocaleString()}/mo` : null },
              { label: "Tax Records",   val: preview.tax_history?.length ? `${preview.tax_history.length} years` : null },
              { label: "Schools",       val: preview.schools?.length ? `${preview.schools.length} nearby` : null },
            ].filter(c => c.val).map(c => (
              <div key={c.label} className="lookup-chip">
                <div className="lookup-chip-label">{c.label}</div>
                <div className="lookup-chip-val">{c.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Photo Upload ── */}
      <PhotoUpload
        userId={userId}
        currentUrl={data.user_photo_url || ""}
        onUploaded={url => onChange({...data, user_photo_url: url})}
      />

      {/* ── Photo Position ── only shown when a photo exists */}
      {(data.user_photo_url || data.photo_url) && onPhotoPos && (
        <div style={{marginBottom:"1rem"}}>
          <label style={{display:"block",fontSize:".78rem",fontWeight:600,color:"#5A534B",marginBottom:".4rem"}}>Photo position</label>
          <div style={{display:"flex",alignItems:"center",gap:".75rem",background:"var(--cream2)",borderRadius:"10px",padding:".6rem .85rem",border:"1px solid var(--stone)"}}>
            <span style={{fontSize:".72rem",color:"#9E9690",flexShrink:0}}>Top</span>
            <input
              type="range" min={0} max={100} value={photoPos}
              onChange={e => onPhotoPos(Number(e.target.value))}
              style={{flex:1, accentColor:"var(--rust)", cursor:"pointer"}}
            />
            <span style={{fontSize:".72rem",color:"#9E9690",flexShrink:0}}>Bottom</span>
          </div>
          <div style={{fontSize:".72rem",color:"#A8A09A",marginTop:".3rem"}}>Drag to choose which part of your photo shows.</div>
        </div>
      )}

      {/* ── Manual Fields ── */}
      <div className="fg">
        <div className="field s2"><label>Home Name / Nickname</label><input value={data.name||""} onChange={e=>f("name",e.target.value)} placeholder="e.g. The Johnson Home" /></div>
        <div className="field s2"><label>Address</label><input value={data.address||""} onChange={e=>f("address",e.target.value)} placeholder="123 Main St, City, State ZIP" /></div>
        <div className="field"><label>Home Type</label><select value={data.type||""} onChange={e=>f("type",e.target.value)}><option value="">Select…</option>{HOME_TYPES.map(h=><option key={h}>{h}</option>)}</select></div>
        <div className="field"><label>Year Built</label><input type="number" value={data.year||""} onChange={e=>f("year",e.target.value)} placeholder="e.g. 1998" /></div>
        <div className="field"><label>Square Footage</label><input value={data.sqft||""} onChange={e=>f("sqft",e.target.value)} placeholder="e.g. 2,150" /></div>
        <div className="field"><label>Bedrooms</label><input type="number" value={data.bedrooms||""} onChange={e=>f("bedrooms",e.target.value)} /></div>
        <div className="field"><label>Bathrooms</label><input type="number" value={data.bathrooms||""} onChange={e=>f("bathrooms",e.target.value)} /></div>
        <div className="field"><label>Lot Size</label><input value={data.lot_size||""} onChange={e=>f("lot_size",e.target.value)} placeholder="e.g. 8,500 sqft" /></div>
        <div className="field"><label>Last Sale Price</label><input value={data.last_sale_price||""} onChange={e=>f("last_sale_price",e.target.value)} placeholder="e.g. 425000" /></div>
        <div className="field"><label>Last Sale Date</label><input type="date" value={data.last_sale_date||""} onChange={e=>f("last_sale_date",e.target.value)} /></div>
        <div className="field"><label>Zestimate</label><input value={data.zestimate||""} onChange={e=>f("zestimate",e.target.value)} placeholder="Estimated value" /></div>
        <div className="field"><label>Rent Estimate / mo</label><input value={data.rent_zestimate||""} onChange={e=>f("rent_zestimate",e.target.value)} placeholder="e.g. 2400" /></div>
        <div className="field"><label>HOA Fee / mo</label><input value={data.hoa_fee||""} onChange={e=>f("hoa_fee",e.target.value)} placeholder="e.g. 350" /></div>
        <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Key systems, past renovations…" /></div>
      </div>
    </div>
  );
}

function InsuranceForm({ data, onChange, planData, onUpgrade }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div>
      <AIScanButton
        onScanComplete={fields => onChange({...data,...fields})}
        label="Scan Policy Document"
        description="Auto-fill company, policy number, premium, coverage & renewal date"
        scanType="insurance"
        planData={planData}
        onUpgrade={onUpgrade}
      />
      <div className="scan-divider">or fill in manually</div>
      <div className="fg">
        <div className="field s2"><label>Insurance Company *</label><input value={data.ins_company||""} onChange={e=>f("ins_company",e.target.value)} placeholder="e.g. State Farm" /></div>
        <div className="field s2"><label>Policy Number</label><input value={data.ins_policy_number||""} onChange={e=>f("ins_policy_number",e.target.value)} placeholder="e.g. HO-123456789" /></div>
        <div className="field"><label>Agent Name</label><input value={data.ins_agent_name||""} onChange={e=>f("ins_agent_name",e.target.value)} placeholder="Agent's name" /></div>
        <div className="field"><label>Agent Phone</label><input value={data.ins_agent_phone||""} onChange={e=>f("ins_agent_phone",e.target.value)} placeholder="(555) 555-5555" /></div>
        <div className="field"><label>Annual Premium ($)</label><input type="number" value={data.ins_premium||""} onChange={e=>f("ins_premium",e.target.value)} placeholder="e.g. 1800" /></div>
        <div className="field"><label>Deductible ($)</label><input type="number" value={data.ins_deductible||""} onChange={e=>f("ins_deductible",e.target.value)} placeholder="e.g. 1000" /></div>
        <div className="field"><label>Dwelling Coverage ($)</label><input type="number" value={data.ins_dwelling_coverage||""} onChange={e=>f("ins_dwelling_coverage",e.target.value)} placeholder="e.g. 350000" /></div>
        <div className="field"><label>Liability Coverage ($)</label><input type="number" value={data.ins_liability_coverage||""} onChange={e=>f("ins_liability_coverage",e.target.value)} placeholder="e.g. 100000" /></div>
        <div className="field s2"><label>Policy Renewal Date</label><input type="date" value={data.ins_renewal_date||""} onChange={e=>f("ins_renewal_date",e.target.value)} /></div>
        <div className="field s2"><label>Notes</label><textarea value={data.ins_notes||""} onChange={e=>f("ins_notes",e.target.value)} placeholder="Special riders, flood/earthquake coverage, claim history…" /></div>
      </div>
    </div>
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
function SearchBar({ tasks, warranties, expenses, onNavigate }) { // role="search" added to container
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = q.trim().length < 2 ? [] : [
    ...tasks.filter(t => t.title?.toLowerCase().includes(q.toLowerCase()) || t.category?.toLowerCase().includes(q.toLowerCase())).slice(0,3).map(t => ({type:"Task",icon:CAT_ICONS[t.category]||"🔧",label:t.title,sub:t.status,tab:"tasks"})),
    ...warranties.filter(w => w.item?.toLowerCase().includes(q.toLowerCase())).slice(0,2).map(w => ({type:"Asset",icon:ASSET_ICONS[w.category]||"🔧",label:w.item,sub:w.condition||w.vendor,tab:"warranties"})),
    ...expenses.filter(e => e.description?.toLowerCase().includes(q.toLowerCase())).slice(0,2).map(e => ({type:"Expense",icon:"💲",label:e.description,sub:fmt$(e.amount),tab:"expenses"})),
  ];

  return (
    <div className="search-wrap" ref={ref}>
      <span className="search-icon">🔍</span>
      <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="Search…" aria-label="Search tasks, assets and expenses" />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r,i) => (
            <div key={i} className="sr-item" onClick={()=>{onNavigate(r.tab);setQ("");setOpen(false);}}>
              <span>{r.icon}</span>
              <span style={{flex:1,fontWeight:500}}>{r.label}</span>
              <span style={{fontSize:".72rem",color:"#9E9690"}}>{r.sub}</span>
              <span className="sr-type">{r.type}</span>
            </div>
          ))}
        </div>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && (
        <div className="search-results"><div className="sr-item" style={{color:"#9E9690",justifyContent:"center"}}>No results found</div></div>
      )}
    </div>
  );
}

// ─── CALENDAR ────────────────────────────────────────────────────────────────
function Calendar({ tasks, mini = false, onDayClick }) {
  const today = new Date();
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth());

  const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const firstDay = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const daysInPrev = new Date(curYear, curMonth, 0).getDate();

  const prevMonth = () => {
    if(curMonth === 0) { setCurMonth(11); setCurYear(y => y-1); }
    else setCurMonth(m => m-1);
  };
  const nextMonth = () => {
    if(curMonth === 11) { setCurMonth(0); setCurYear(y => y+1); }
    else setCurMonth(m => m+1);
  };

  // Build task map: "YYYY-MM-DD" -> tasks[]
  const taskMap = {};
  tasks.forEach(t => {
    if(!t.due_date) return;
    const key = t.due_date.slice(0,10);
    if(!taskMap[key]) taskMap[key] = [];
    taskMap[key].push(t);
  });

  // Build grid cells
  const cells = [];
  // Prev month padding
  for(let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, month: "prev", date: null });
  }
  // Current month
  for(let d = 1; d <= daysInMonth; d++) {
    const mm = String(curMonth+1).padStart(2,"0");
    const dd = String(d).padStart(2,"0");
    const dateStr = `${curYear}-${mm}-${dd}`;
    cells.push({ day: d, month: "cur", date: dateStr, tasks: taskMap[dateStr] || [] });
  }
  // Next month padding to complete grid
  const remaining = 42 - cells.length;
  for(let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: "next", date: null });
  }

  const todayStr = localISO(today);
  const STATUS_COLOR = {
    "Scheduled": "#4A89B8",
    "In Progress": "#B8861E",
    "Completed": "#234A3D",
    "Overdue": "#C16140",
  };

  return (
    <div className={`cal-wrap ${mini?"mini-cal":""}`}>
      <div className="cal-header">
        <div className="cal-title">{MONTHS[curMonth]} {curYear}</div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <button className="cal-nav-btn" onClick={()=>{setCurMonth(today.getMonth());setCurYear(today.getFullYear())}} style={{fontSize:".6rem",fontWeight:700,letterSpacing:".3px"}}>Today</button>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>
      </div>
      <div className="cal-grid" style={{padding:mini?".2rem .3rem .4rem":".3rem .5rem .6rem"}}>
        {DAYS.map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((cell, i) => {
          const isToday = cell.date === todayStr;
          const isOther = cell.month !== "cur";
          const hasTasks = cell.tasks?.length > 0;
          const hasOverdue = cell.tasks?.some(t => t.status === "Overdue" || (t.status !== "Completed" && cell.date < todayStr));
          return (
            <div
              key={i}
              className={`cal-day ${isOther?"other-month":""} ${isToday?"today":""} ${hasOverdue?"has-overdue":""}`}
              onClick={() => !isOther && hasTasks && onDayClick && onDayClick(cell.date, cell.tasks)}
              style={{cursor: !isOther && hasTasks ? "pointer" : isOther ? "default" : "default"}}
            >
              <div className="cal-day-num">{cell.day}</div>
              {hasTasks && (
                <div className="cal-dots">
                  {cell.tasks.slice(0, mini?2:4).map((t,j) => (
                    <div key={j} className="cal-dot" style={{background: STATUS_COLOR[t.status] || "#A8A09A"}} title={t.title} />
                  ))}
                  {cell.tasks.length > (mini?2:4) && (
                    <div className="cal-dot" style={{background:"#C2B8AE"}} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DAY DETAIL MODAL ────────────────────────────────────────────────────────
function DayDetail({ date, tasks, onClose, onEdit }) {
  const dt = new Date(date + "T00:00:00");
  const label = dt.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric", year:"numeric"});
  const STATUS_STYLE_LOCAL = {
    "Scheduled":   {bg:"#EBF5FF",text:"#1A6FA0",border:"#93C5E8"},
    "In Progress": {bg:"#FFF8E6",text:"#92610A",border:"#F5CC76"},
    "Completed":   {bg:"#E8F6EE",text:"#1A7A44",border:"#7DCBA1"},
    "Overdue":     {bg:"#FDEEEE",text:"#B91C1C",border:"#F5A0A0"},
  };
  return (
    <div className="overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-hdr">
          <span className="modal-title">📅 {label}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {tasks.length === 0 ? (
            <div className="cal-modal-empty">No tasks scheduled for this day</div>
          ) : tasks.map(t => {
            const sc = STATUS_STYLE_LOCAL[t.status] || STATUS_STYLE_LOCAL.Scheduled;
            return (
              <div key={t.id} className="cal-task-item">
                <span style={{fontSize:"1.2rem",flexShrink:0}}>{CAT_ICONS[t.category]||"🔧"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div className="cal-task-title">{t.title}</div>
                  <div className="cal-task-meta">
                    <span className="badge" style={{background:sc.bg,color:sc.text,borderColor:sc.border}}>{t.status}</span>
                    {t.category && <span>{t.category}</span>}
                    {t.vendor && <span>👤 {t.vendor}</span>}
                    {t.cost > 0 && <span>{fmt$(t.cost)}</span>}
                  </div>
                  {t.notes && <div style={{fontSize:".76rem",color:"#7A7370",marginTop:"4px",lineHeight:1.4}}>{t.notes}</div>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>onEdit(t)} style={{flexShrink:0}}>Edit</button>
              </div>
            );
          })}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ tasks, warranties, expenses, profile, onNavigate, greeting, username, serviceLogs=[], planData, onUpgrade }) {
  const overdue  = tasks.filter(t => t.status==="Overdue").length;
  const upcoming = tasks.filter(t => { const d=daysTo(t.due_date); return d!==null&&d>=0&&d<=30&&t.status!=="Completed"; }).sort((a,b)=>daysTo(a.due_date)-daysTo(b.due_date));
  const yr = new Date().getFullYear();
  const serviceAllTime = serviceLogs.reduce((s,l)=>s+Number(l.cost||0),0);
  const serviceThisYr  = serviceLogs.filter(l=>l.service_date?.startsWith(String(yr))).reduce((s,l)=>s+Number(l.cost||0),0);
  const totalSpend = expenses.reduce((s,e)=>s+Number(e.amount||0),0) + serviceAllTime;
  const yrSpend    = expenses.filter(e=>e.date?.startsWith(String(yr))).reduce((s,e)=>s+Number(e.amount||0),0) + serviceThisYr;
  const expiringW = warranties.filter(w=>{ const d=daysTo(w.expiry_date); return d!==null&&d>=0&&d<=90; });
  const activeW  = warranties.length; // total assets tracked
  const expiringWCount = warranties.filter(w=>{ const d=daysTo(w.expiry_date); return d!==null&&d>=0; }).length;
  const completed = tasks.filter(t=>t.status==="Completed").length;
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState([]);

  const handleDayClick = (date, dayTasks) => {
    setSelectedDay(date);
    setSelectedDayTasks(dayTasks);
  };

  // ── Home Health Score
  const healthScore = (() => {
    if(tasks.length === 0 && warranties.length === 0) return null;
    let score = 100;
    if(tasks.length > 0) score -= Math.min(40, overdue * 10);
    if(expiringW.length > 0) score -= Math.min(20, expiringW.length * 7);
    const completionRate = tasks.length > 0 ? completed / tasks.length : 1;
    score = Math.round(score * (.6 + completionRate * .4));
    return Math.max(10, Math.min(100, score));
  })();
  const healthColor = healthScore >= 80 ? "#234A3D" : healthScore >= 55 ? "#B8861E" : "#C16140";
  const healthLabel = healthScore >= 80 ? "Great shape" : healthScore >= 55 ? "Needs attention" : "Action required";
  const circumference = 2 * Math.PI * 30;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  // ── Seasonal tip — climate aware
  const month = new Date().getMonth();
  const season = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "fall" : "winter";
  const dashClimateZone = getClimateZone(profile);
  const dashClimate = getClimateProfile(dashClimateZone);
  const seasonIcons = {spring:"🌸", summer:"☀️", fall:"🍂", winter:"❄️"};
  const tip = {
    icon:   dashClimate.icon || seasonIcons[season],
    color:  dashClimate.color,
    border: dashClimate.border,
    title:  `${season.charAt(0).toUpperCase()+season.slice(1)} checklist · ${dashClimate.label}`,
    tip:    (dashClimate[season] || []).slice(0, 3).join(" · "),
  };

  return (
    <div>
      {/* Greeting */}
      <div className="greeting">
        <div className="greeting-time">{greeting}</div>
        <div className="greeting-name">{profile?.name || username}</div>
        {profile?.address && <div className="greeting-sub">📍 {profile.address}</div>}
      </div>

      {/* Health score + cost forecast */}
      {planData && (
        <div style={{marginBottom:".85rem"}}>
          <HealthScoreWidget tasks={tasks} warranties={warranties} profile={profile} planData={planData} onUpgrade={onUpgrade}/>
          <CostForecastWidget warranties={warranties} planData={planData} onUpgrade={onUpgrade}/>
        </div>
      )}

      {/* Overdue alert */}
      {overdue > 0 && (
        <div className="alert-banner" onClick={() => onNavigate("tasks")}>
          <span style={{fontSize:"1.2rem"}}>⚠️</span>
          <span className="alert-banner-text">You have overdue tasks that need attention</span>
          <span className="alert-banner-count">{overdue} overdue</span>
          <span style={{color:"var(--red)",fontSize:".85rem"}}>→</span>
        </div>
      )}

      {/* Insurance renewal alert */}
      {(() => {
        const d = profile?.ins_renewal_date ? daysTo(profile.ins_renewal_date) : null;
        if (d === null || d > 90) return null;
        const urgent = d <= 30;
        return (
          <div className="alert-banner" style={{background:urgent?"var(--red-light)":"#FFF8E6",borderColor:urgent?"#EFCFCC":"#F5CC76"}} onClick={() => onNavigate("profile")}>
            <span style={{fontSize:"1.2rem"}}>{urgent?"🚨":"⚠️"}</span>
            <span className="alert-banner-text" style={{color:urgent?"#8B2020":"#92610A"}}>
              {d < 0 ? "Insurance renewal date has passed" : `Insurance renews in ${d} day${d!==1?"s":""}`}
            </span>
            <span style={{fontSize:".75rem",fontWeight:600,color:urgent?"var(--red)":"#92610A"}}>View →</span>
          </div>
        );
      })()}

      {/* Health score + stats */}
      <div style={{display:"flex",flexDirection:"column",gap:".75rem",marginBottom:".85rem"}}>
        {healthScore !== null && (
          <div className="health-card" style={{marginBottom:0}}>
            <div className="health-ring">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="var(--stone)" strokeWidth="6"/>
                <circle cx="36" cy="36" r="30" fill="none" stroke={healthColor} strokeWidth="6"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  strokeLinecap="round" style={{transition:"stroke-dashoffset .8s ease"}}/>
              </svg>
              <div className="health-score">
                <span className="health-score-num" style={{color:healthColor}}>{healthScore}</span>
                <span className="health-score-label" style={{color:healthColor}}>/ 100</span>
              </div>
            </div>
            <div className="health-desc">
              <div className="health-title">Home Health</div>
              <div className="health-sub" style={{color:healthColor,fontWeight:600,fontSize:".8rem"}}>{healthLabel}</div>
              <div className="health-sub" style={{marginTop:"2px"}}>
                {overdue > 0 ? `${overdue} overdue task${overdue>1?"s":""}` : completed > 0 ? `${completed} task${completed>1?"s":""} completed` : "Add tasks to track your home"}
              </div>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".65rem"}}>
          <div className="stat c-gold" onClick={() => onNavigate("expenses")} style={{marginBottom:0}}>
            <div className="stat-label">{yr} Spend</div>
            <div className="stat-val" style={{fontSize:"1.35rem"}}>{fmt$(yrSpend)}</div>
            <div className="stat-sub">{fmt$(totalSpend)} lifetime</div>
          </div>
          <div className="stat c-sage" onClick={() => onNavigate("warranties")} style={{marginBottom:0}}>
            <div className="stat-label">Assets</div>
            <div className="stat-val">{activeW}</div>
            <div className="stat-sub">{expiringW.length > 0 ? `${expiringW.length} warranty expiring` : "tracked"}</div>
          </div>
        </div>
      </div>

      {/* Seasonal banner */}
      <div className="seasonal-banner" style={{background:tip.color,border:`1px solid ${tip.border}`}}>
        <div className="seasonal-icon">{tip.icon}</div>
        <div>
          <div className="seasonal-title">{tip.title}</div>
          <div className="seasonal-tip">{tip.tip}</div>
        </div>
      </div>

      {/* ── Week Ahead tile ── */}
      {(() => {
        const now = new Date();
        const evMap = buildHomeEvents(tasks, warranties, profile, serviceLogs);
        const EV_COLOR = { task:"#234A3D", task_progress:"#B8861E", task_overdue:"#C16140", task_done:"#A8A09A", warranty:"#C16140", warranty_warn:"#B8861E", insurance:"#B8861E", insurance_warn:"#E8A030", service:"#7FA088", seasonal:"#3A7AAF" };
        const days = Array.from({length:7}, (_,i) => {
          const d = new Date(now); d.setDate(d.getDate()+i);
          const dateStr = localISO(d);
          const allEvs = (evMap[dateStr]||[]).filter(e => e.type !== "task_done");
          return { d, dateStr, allEvs, isToday:i===0 };
        });
        const weekEvCount = days.reduce((s,d)=>s+d.allEvs.length,0);
        const overdueCount = tasks.filter(t=>t.status==="Overdue").length;
        return (
          <div className="week-tile">
            <div className="week-tile-hdr">
              <span className="week-tile-title">Week ahead</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>onNavigate("tasks")}>Calendar →</button>
            </div>
            <div className="week-days">
              {days.map(({d, dateStr, allEvs, isToday},i) => (
                <div key={i} className={`wd${isToday?" wd-today":""}${allEvs.length>0?" has-ev":""}`}
                  onClick={()=>allEvs.length>0 && onNavigate("tasks")}
                >
                  <div className="wd-label">{["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]}</div>
                  <div className="wd-num">{d.getDate()}</div>
                  <div className="wd-dots">
                    {allEvs.slice(0,3).map((e,j)=><div key={j} className="wd-dot" style={{background:EV_COLOR[e.type]||"#A8A09A"}}/>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="week-summary">
              {weekEvCount > 0
                ? <span>{weekEvCount} event{weekEvCount>1?"s":""} this week</span>
                : <span style={{color:"var(--sage-deep)"}}>✓ Clear week ahead</span>
              }
              {overdueCount > 0 && <span style={{color:"var(--rust)",fontWeight:600}}>· {overdueCount} overdue</span>}
              {weekEvCount > 0 && <span style={{color:"#C2B8AE"}}>· tap a dot to view</span>}
            </div>
          </div>
        );
      })()}

      {/* ── Quick Actions ── */}
      <div className="quick-acts">
        {[
          {icon:"✓", label:"Add Task",     tab:"tasks"},
          {icon:"💲", label:"Log Expense",  tab:"expenses"},
          {icon:"🔧", label:"Add Asset",    tab:"warranties"},
        ].map(({icon,label,tab})=>(
          <button key={tab} className="qa-btn" onClick={()=>onNavigate(tab)}>
            <span className="qa-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-title" style={{cursor:"pointer"}} onClick={() => onNavigate("tasks")}>📋 Coming up <span style={{fontSize:".7rem",color:"#A8A09A",fontWeight:400,fontFamily:"'Hanken Grotesk',sans-serif"}}>· tap to view all →</span></div>
          {upcoming.length===0 ? (
            <div className="empty" style={{padding:"1.5rem .5rem"}}>
              <span className="ei">✅</span>
              <strong>All clear!</strong>
              <p>No tasks due in the next 30 days</p>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate("tasks")}>Add a task</button>
            </div>
          ) : upcoming.slice(0,5).map(t => {
            const d = daysTo(t.due_date);
            return (
              <button className="up-item" key={t.id} onClick={() => onNavigate("tasks")}>
                <span style={{fontSize:"1.15rem"}}>{CAT_ICONS[t.category]||"🔧"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:".85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                  <div style={{fontSize:".71rem",color:"#A8A09A",marginTop:"1px"}}>{t.category} · {fmtD(t.due_date)}</div>
                </div>
                <div className="up-days" style={{background:d===0?"var(--red-light)":d<=7?"#FFF8E6":"var(--sky-light)",color:d===0?"var(--red)":d<=7?"#92610A":"var(--sky)"}}>
                  {d===0?"Today":d===1?"Tomorrow":`${d}d`}
                </div>
                <span style={{color:"#C2B8AE",fontSize:".8rem",marginLeft:"2px",flexShrink:0}}>›</span>
              </button>
            );
          })}
          {upcoming.length > 5 && (
            <button className="btn btn-ghost btn-sm" style={{width:"100%",marginTop:".5rem",justifyContent:"center"}} onClick={() => onNavigate("tasks")}>
              See all {upcoming.length} upcoming →
            </button>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">🏠 Asset warranty alerts</div>
          {expiringW.length===0 ? (
            <div className="empty" style={{padding:"1.5rem .5rem"}}>
              <span className="ei">🛡️</span>
              <strong>All covered</strong>
              <p>No warranties expiring in 90 days</p>
            </div>
          ) : expiringW.sort((a,b)=>daysTo(a.expiry_date)-daysTo(b.expiry_date)).slice(0,5).map(w => {
            const d = daysTo(w.expiry_date);
            return (
              <button className="up-item" key={w.id} onClick={() => onNavigate("warranties")}>
                <span style={{fontSize:"1.15rem"}}>📋</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:".85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.item}</div>
                  <div style={{fontSize:".71rem",color:"#A8A09A",marginTop:"1px"}}>Expires {fmtD(w.expiry_date)}</div>
                </div>
                <div className="up-days" style={{background:d<=30?"var(--red-light)":"#FFF8E6",color:d<=30?"var(--red)":"#92610A"}}>{d}d left</div>
                <span style={{color:"#C2B8AE",fontSize:".8rem",marginLeft:"2px",flexShrink:0}}>›</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Set up home CTA */}
      {!profile?.name && (
        <div style={{textAlign:"center",padding:"2.5rem 1.5rem",background:"var(--white)",borderRadius:"var(--r)",border:"2px dashed var(--stone)"}}>
          <div style={{fontSize:"2.5rem",marginBottom:".75rem"}}>🏡</div>
          <strong style={{fontFamily:"'Fraunces',serif",fontSize:"1.05rem"}}>Set up your home profile</strong>
          <p style={{fontSize:".84rem",color:"#A8A09A",margin:".4rem 0 1.1rem",lineHeight:1.55}}>Add your address to auto-fill your home's details, tax history, and more</p>
          <button className="btn btn-primary" onClick={() => onNavigate("profile")}>Set up my home →</button>
        </div>
      )}

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetail
          date={selectedDay}
          tasks={selectedDayTasks}
          onClose={() => setSelectedDay(null)}
          onEdit={() => { setSelectedDay(null); onNavigate("tasks"); }}
        />
      )}
    </div>
  );
}
// ─── TASKS ────────────────────────────────────────────────────────────────────
function Tasks({ tasks, setTasks, toast, userId, profile, warranties: assets=[], serviceLogs, setServiceLogs }) {
  const zone = getClimateZone(profile);
  const climate = getClimateProfile(zone);
  const month = new Date().getMonth();
  const season = month>=2&&month<=4?"spring":month>=5&&month<=7?"summer":month>=8&&month<=10?"fall":"winter";
  const seasonLabel = season.charAt(0).toUpperCase()+season.slice(1);
  const seasonIcon = {spring:"🌸",summer:"☀️",fall:"🍂",winter:"❄️"}[season];
  const seasonalSuggestions = climate[season] || [];

  const [statusF, setStatusF] = useState("All");
  const [catF, setCatF] = useState("All");
  const [sort, setSort] = useState("due_date");
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showSeasonal, setShowSeasonal] = useState(true);

  const openNew = (cat) => {
    setEditData({status:"Scheduled",priority:"Medium",due_date:localISO(),category:cat||""});
    setEditId(null);
    setModal(true);
  };
  const openEdit = t => { setEditData({...t}); setEditId(t.id); setModal(true); };

  const save = async () => {
    if(!editData.title?.trim()) return;
    // Ensure asset_id is numeric or null
    const payload = {
      ...editData,
      asset_id: editData.asset_id || null,
    };
    if(editId) {
      const {error} = await supabase.from("tasks").update(payload).eq("id",editId).eq("user_id",userId);
      if(!error) { setTasks(tasks.map(t=>t.id===editId?{...payload,id:editId}:t)); toast("Task updated ✓"); }
      else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("tasks").insert([{...payload,user_id:userId}]).select();
      if(!error&&data) { setTasks([...tasks,data[0]]); toast("Task added ✓"); }
      else toast("Error adding","error");
    }
    setModal(false);
  };

  const confirmDel = async () => {
    const {error} = await supabase.from("tasks").delete().eq("id",confirm).eq("user_id",userId);
    if(!error) { setTasks(tasks.filter(t=>t.id!==confirm)); toast("Task deleted","error"); }
    setConfirm(null);
  };

  const toggleStatus = async (t, s) => {
    const {error} = await supabase.from("tasks").update({status:s}).eq("id",t.id).eq("user_id",userId);
    if(!error) {
      setTasks(tasks.map(x=>x.id===t.id?{...x,status:s}:x));

      // Auto-create next occurrence when a recurring task is completed
      if (s === "Completed" && t.recurring && t.recurring !== "") {
        const nextDate = getNextRecurringDate(t.due_date || localISO(), t.recurring);
        if (nextDate) {
          const nextPayload = {
            title:     t.title,
            category:  t.category  || null,
            priority:  t.priority  || "Medium",
            status:    "Scheduled",
            due_date:  nextDate,
            notes:     t.notes     || null,
            recurring: t.recurring,
            asset_id:  t.asset_id  || null,
            vendor:    t.vendor    || null,
            cost:      t.cost      || null,
            user_id:   userId,
          };
          const { data: created } = await supabase.from("tasks").insert([nextPayload]).select();
          if (created) {
            setTasks(prev => [...prev, created[0]]);
            const nextFmt = new Date(nextDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
            toast(`✓ Done! Next scheduled for ${nextFmt}`);
          }
        }
      } else {
        toast(`Marked as ${s} ✓`);
      }

      // Auto-log service entry when task linked to an asset is completed
      const isServiceTask = t.notes?.startsWith("[Service]") || t.notes?.startsWith("[Auto-created from service");
      if(s === "Completed" && t.asset_id && !isServiceTask) {
        await supabase.from("asset_service_log").insert([{
          user_id:      userId,
          asset_id:     t.asset_id,
          service_date: localISO(),
          description:  t.title,
          cost:         t.cost ? Number(t.cost) : null,
          notes:        `Auto-logged from task completion${t.vendor ? ` · ${t.vendor}` : ""}`,
        }]);
        await supabase.from("warranties").update({last_serviced: localISO()}).eq("id",t.asset_id).eq("user_id",userId);
        const {data: sl} = await supabase.from("asset_service_log").select("*").eq("user_id",userId).order("service_date",{ascending:false});
        if(sl) setServiceLogs(sl);
      }
    }
  };

  const addSeasonalTask = (title) => {
    setEditData({title, status:"Scheduled", priority:"Medium", category:"Other", due_date:localISO()});
    setEditId(null);
    setModal(true);
  };

  let filtered = tasks.filter(t => (statusF==="All"||t.status===statusF) && (catF==="All"||t.category===catF));
  filtered = [...filtered].sort((a,b) => {
    if(sort==="due_date") return new Date(a.due_date||"9999")-new Date(b.due_date||"9999");
    if(sort==="priority") return PRIORITY.indexOf(b.priority)-PRIORITY.indexOf(a.priority);
    if(sort==="title") return (a.title||"").localeCompare(b.title||"");
    if(sort==="cost") return Number(b.cost||0)-Number(a.cost||0);
    return 0;
  });

  const TaskCard = ({ t }) => {
    const sc = STATUS_STYLE[t.status]||STATUS_STYLE.Scheduled;
    const d = daysTo(t.due_date);
    const isDone = t.status==="Completed";
    const isOverdue = t.status==="Overdue" || (d!==null && d<0 && !isDone);
    const isToday = d===0 && !isDone;
    return (
      <div className={`task-card ${isOverdue?"is-overdue":""} ${isToday?"is-today":""} ${isDone?"is-done":""}`}>
        <div className="task-card-top">
          <div
            className={`task-card-check ${isDone?"done":""}`}
            onClick={() => toggleStatus(t, isDone?"Scheduled":"Completed")}
            title={isDone?"Mark as scheduled":"Mark as complete"}
          >
            {isDone && "✓"}
          </div>
          <div
            className="task-card-body"
            onClick={() => openEdit(t)}
            style={{cursor:"pointer", flex:1, minWidth:0}}
          >
            <div className={`task-card-title ${isDone?"done":""}`}>{t.title}</div>
            <div className="task-card-meta">
              {t.due_date && (
                <span className="task-meta-pill" style={{background:isOverdue?"var(--red-light)":isToday?"var(--rust-light)":"var(--cream2)",color:isOverdue?"var(--red)":isToday?"var(--rust)":"#7A7370"}}>
                  📅 {d===0?"Today":d===1?"Tomorrow":isOverdue?`${Math.abs(d)}d overdue`:fmtD(t.due_date)}
                </span>
              )}
              {t.priority && t.priority!=="Medium" && (
                <span className="task-meta-pill" style={{background:t.priority==="Urgent"?"var(--red-light)":t.priority==="High"?"#FBF0E8":"var(--sage-light)",color:t.priority==="Urgent"?"var(--red)":t.priority==="High"?"var(--rust)":"var(--sage)"}}>
                  {t.priority==="Urgent"?"🔴":t.priority==="High"?"🟠":"🟢"} {t.priority}
                </span>
              )}
              {t.vendor && (
                <span className="task-meta-pill" style={{background:"var(--cream2)",color:"#7A7370"}}>👤 {t.vendor}</span>
              )}
              {t.cost>0 && (
                <span className="task-meta-pill" style={{background:"var(--cream2)",color:"#7A7370"}}>{fmt$(t.cost)}</span>
              )}
              {t.recurring && (
                <span className="task-meta-pill" style={{background:"var(--sky-light)",color:"var(--sky)"}}>🔁 {t.recurring}</span>
              )}
              {(t.notes?.startsWith("[Service]") || t.notes?.startsWith("[Auto-created from service")) && (
                <span className="task-meta-pill" style={{background:"var(--cream2)",color:"#7A7370"}}>🔧 Service record</span>
              )}
              {t.asset_id && (() => {
                const linked = assets.find(a => a.id === t.asset_id);
                return linked ? (
                  <span className="task-meta-pill" style={{background:"var(--rust-light)",color:"var(--rust)"}}>
                    {ASSET_ICONS[linked.category]||"🔧"} {linked.item}
                  </span>
                ) : null;
              })()}
            </div>
            {t.notes && <div className="task-card-note">{t.notes}</div>}
          </div>
          <div className="task-card-actions">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(t)} title="Edit">✏️</button>
            <button className="btn btn-danger btn-sm btn-icon" onClick={()=>setConfirm(t.id)} title="Delete">🗑️</button>
          </div>
        </div>
        {!isDone && (
          <div className="task-card-bottom">
            {STATUS_OPTIONS.filter(s=>s!==t.status).map(s => {
              const sc2=STATUS_STYLE[s];
              return (
                <button key={s} className="task-status-btn" style={{background:sc2.bg,color:sc2.text,borderColor:sc2.border}} onClick={()=>toggleStatus(t,s)}>
                  → {s}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="sh">
        <span className="sh-title">Tasks</span>
        <button className="btn btn-primary" onClick={()=>openNew()}>＋ Add Task</button>
      </div>

      {/* Calendar — always on top */}
      <CalendarTab tasks={tasks} setTasks={setTasks} warranties={assets} profile={profile} serviceLogs={serviceLogs} toast={toast} userId={userId} onEditTask={openEdit}/>

      {/* ── Task List ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"1.25rem 0 .6rem",flexWrap:"wrap",gap:".5rem"}}>
        <span style={{fontFamily:"'Fraunces',serif",fontSize:".95rem",fontWeight:500,color:"var(--dark)"}}>
          All Tasks {filtered.length > 0 && <span style={{fontSize:".75rem",color:"#A8A09A",fontWeight:400,fontFamily:"'Hanken Grotesk',sans-serif"}}>· {filtered.length}</span>}
        </span>
        <select className="sort-select" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="due_date">Due Date</option>
          <option value="priority">Priority</option>
          <option value="title">A–Z</option>
          <option value="cost">Cost</option>
        </select>
      </div>

      {/* Status filters */}
      <div className="toolbar" style={{marginBottom:".4rem"}}>
        {["All",...STATUS_OPTIONS].map(s=>(
          <button key={s} className={`chip ${statusF===s?"on":""}`} onClick={()=>setStatusF(s)}>{s}</button>
        ))}
      </div>

      {/* Category filters */}
      <div className="toolbar">
        {["All",...CATEGORIES].map(c=>(
          <button key={c} className={`chip ${catF===c?"on":""}`} onClick={()=>setCatF(c)}>{CAT_ICONS[c]||""} {c}</button>
        ))}
      </div>

      {/* Seasonal suggestions */}
      {showSeasonal && (
        <div className="seasonal-section" style={{background:climate.color, borderColor:climate.border}}>
          <div className="seasonal-section-title">
            {seasonIcon} {seasonLabel} checklist — {climate.label}
            <button onClick={()=>setShowSeasonal(false)} style={{marginLeft:"auto",background:"none",border:"none",color:"#A8A09A",cursor:"pointer",fontSize:".8rem",fontFamily:"'Hanken Grotesk',sans-serif"}}>Dismiss</button>
          </div>
          {seasonalSuggestions.slice(0,4).map((title,i) => (
            <div key={i} className="seasonal-task-row" onClick={()=>addSeasonalTask(title)}>
              <span style={{fontSize:".9rem"}}>{["🌡️","🔧","⚡","🏚️"][i%4]}</span>
              <span style={{flex:1,fontSize:".83rem",fontWeight:500}}>{title}</span>
              <span style={{fontSize:".75rem",color:"var(--rust)",fontWeight:600}}>＋ Add</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length===0 && (
        <div className="empty">
          <span className="ei">🔧</span>
          <strong>{tasks.length===0?"No tasks yet":"No matching tasks"}</strong>
          <p>{tasks.length===0?"Add your first maintenance task to start keeping your home in top shape":"Try a different filter"}</p>
          {tasks.length===0 && <button className="btn btn-primary" onClick={()=>openNew()}>＋ Add your first task</button>}
        </div>
      )}

      {/* Task list */}
      {filtered.map(t => <TaskCard key={t.id} t={t} />)}

      {modal && <Modal title={editId?"Edit Task":"New Task"} onClose={()=>setModal(false)} onSave={save}><TaskForm data={editData} onChange={setEditData} assets={assets}/></Modal>}
      {confirm && <Confirm message="This task will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

// ─── ASSETS ───────────────────────────────────────────────────────────────────
function Assets({ warranties: assets, setWarranties: setAssets, toast, userId, serviceLogs, setServiceLogs, tasks, setTasks, planData, onUpgrade }) {
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({condition:"Good"});
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [filter, setFilter] = useState("All");
  const [lightbox, setLightbox] = useState(null);
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceEditData, setServiceEditData] = useState({});
  const [serviceEditId, setServiceEditId] = useState(null);
  const [serviceAssetId, setServiceAssetId] = useState(null);
  const [serviceConfirm, setServiceConfirm] = useState(null);
  const [expandedService, setExpandedService] = useState(null);

  // Asset CRUD
  const openNew = () => { setEditData({condition:"Good"}); setEditId(null); setModal(true); };
  const openEdit = a => { setEditData({...a}); setEditId(a.id); setModal(true); };

  const save = async () => {
    if(!editData.item?.trim()) return;
    const payload = {
      item:             editData.item||"",
      category:         editData.category||"",
      model:            editData.model||"",
      vendor:           editData.vendor||"",
      purchase_date:    editData.purchase_date||null,
      install_date:     editData.install_date||null,
      expiry_date:      editData.expiry_date||null,
      cost:             editData.cost ? Number(editData.cost) : null,
      replacement_cost: editData.replacement_cost ? Number(editData.replacement_cost) : null,
      lifespan_years:   editData.lifespan_years ? Number(editData.lifespan_years) : null,
      last_serviced:    editData.last_serviced||null,
      condition:        editData.condition||"Good",
      asset_photo_url:  editData.asset_photo_url||"",
      document_ref:     editData.document_ref||"",
      notes:            editData.notes||"",
    };
    if(editId) {
      const {error} = await supabase.from("warranties").update(payload).eq("id",editId).eq("user_id",userId);
      if(!error) { setAssets(assets.map(a=>a.id===editId?{...editData,...payload,id:editId}:a)); toast("Asset updated ✓"); }
      else { console.error("Asset update error:", error); toast("Error saving: "+error.message,"error"); }
    } else {
      const {data,error} = await supabase.from("warranties").insert([{...payload,user_id:userId}]).select();
      if(!error&&data) { setAssets([...assets,data[0]]); toast("Asset added ✓"); }
      else { console.error("Asset insert error:", error); toast("Error adding: "+error.message,"error"); }
    }
    setModal(false);
  };

  const confirmDel = async () => {
    const {error} = await supabase.from("warranties").delete().eq("id",confirm).eq("user_id",userId);
    if(!error) { setAssets(assets.filter(a=>a.id!==confirm)); toast("Asset deleted","error"); }
    setConfirm(null);
  };

  // Service log CRUD
  const openNewService = (assetId) => {
    setServiceEditData({service_date:localISO(), asset_id:assetId});
    setServiceEditId(null);
    setServiceAssetId(assetId);
    setServiceModal(true);
  };
  const openEditService = (s) => {
    setServiceEditData({...s});
    setServiceEditId(s.id);
    setServiceAssetId(s.asset_id);
    setServiceModal(true);
  };

  const reloadServiceLogs = async () => {
    const {data} = await supabase.from("asset_service_log").select("*").eq("user_id",userId).order("service_date",{ascending:false});
    if(data) setServiceLogs(data);
  };

  const saveService = async () => {
    if(!serviceEditData.description?.trim()||!serviceEditData.service_date) return;
    const payload = {
      asset_id:     serviceEditData.asset_id,
      service_date: serviceEditData.service_date,
      description:  serviceEditData.description||"",
      cost:         serviceEditData.cost ? Number(serviceEditData.cost) : null,
      notes:        serviceEditData.notes||"",
    };
    if(serviceEditId) {
      const {error} = await supabase.from("asset_service_log").update(payload).eq("id",serviceEditId).eq("user_id",userId);
      if(!error) {
        await reloadServiceLogs();
        await supabase.from("warranties").update({last_serviced:payload.service_date}).eq("id",payload.asset_id).eq("user_id",userId);
        setAssets(assets.map(a=>a.id===payload.asset_id?{...a,last_serviced:payload.service_date}:a));
        toast("Service log updated ✓");
      } else { console.error("Service update error:", error); toast("Error saving: "+error.message,"error"); }
    } else {
      const {error} = await supabase.from("asset_service_log").insert([{...payload,user_id:userId}]);
      if(!error) {
        await reloadServiceLogs();
        await supabase.from("warranties").update({last_serviced:payload.service_date}).eq("id",payload.asset_id).eq("user_id",userId);
        setAssets(assets.map(a=>a.id===payload.asset_id?{...a,last_serviced:payload.service_date}:a));

        // Auto-create a Completed task for this service entry
        // Find the asset to get its category
        const linkedAsset = assets.find(a => a.id === payload.asset_id);
        const taskPayload = {
          user_id:    userId,
          title:      payload.description,
          status:     "Completed",
          priority:   "Medium",
          due_date:   payload.service_date,
          cost:       payload.cost || null,
          notes:      payload.notes ? `[Service] ${payload.notes}` : "[Auto-created from service log]",
          asset_id:   payload.asset_id,
          category:   linkedAsset?.category || "Other",
          vendor:     serviceEditData.vendor || "",
        };
        const {data: taskData, error: taskError} = await supabase.from("tasks").insert([taskPayload]).select();
        if(!taskError && taskData) {
          setTasks(prev => [taskData[0], ...prev]);
        } else if(taskError) {
          console.error("Auto-task error:", taskError);
        }

        toast("Service logged + task created ✓");
      } else { console.error("Service insert error:", error); toast("Error logging: "+error.message,"error"); }
    }
    setServiceModal(false);
  };

  const confirmDelService = async () => {
    const {error} = await supabase.from("asset_service_log").delete().eq("id",serviceConfirm).eq("user_id",userId);
    if(!error) { setServiceLogs(serviceLogs.filter(s=>s.id!==serviceConfirm)); toast("Service log deleted","error"); }
    setServiceConfirm(null);
  };

  // Filter list
  const FILTER_OPTIONS = ["All","Good","Fair","Needs Attention","Failed","Warranty Active","Warranty Expiring"];
  let list = [...assets];
  if(filter==="Warranty Active")   list = list.filter(a=>{ const d=daysTo(a.expiry_date); return d!==null&&d>=0; });
  if(filter==="Warranty Expiring") list = list.filter(a=>{ const d=daysTo(a.expiry_date); return d!==null&&d>=0&&d<=90; });
  if(ASSET_CONDITIONS.includes(filter)) list = list.filter(a=>a.condition===filter);
  list = list.sort((a,b)=>(a.item||"").localeCompare(b.item||""));

  // Summary stats
  const totalValue = assets.reduce((s,a)=>s+Number(a.cost||0),0);
  const totalReplacement = assets.reduce((s,a)=>s+Number(a.replacement_cost||0),0);
  const needsAttention = assets.filter(a=>a.condition==="Needs Attention"||a.condition==="Failed").length;

  return (
    <div>
      <div className="sh">
        <span className="sh-title">Assets</span>
        <button className="btn btn-primary" onClick={openNew}>＋ Add Asset</button>
      </div>

      {/* Summary stats */}
      {assets.length > 0 && (
        <div className="stats" style={{marginBottom:"1rem"}}>
          <div className="stat c-rust">
            <div className="stat-label">Total Assets</div>
            <div className="stat-val">{assets.length}</div>
            <div className="stat-sub">tracked items</div>
          </div>
          <div className="stat c-sage">
            <div className="stat-label">Original Value</div>
            <div className="stat-val" style={{fontSize:"1.35rem"}}>{fmt$(totalValue)}</div>
            <div className="stat-sub">purchase price</div>
          </div>
          <div className="stat c-gold">
            <div className="stat-label">Replacement Cost</div>
            <div className="stat-val" style={{fontSize:"1.35rem"}}>{fmt$(totalReplacement)}</div>
            <div className="stat-sub">today's estimate</div>
          </div>
          {needsAttention > 0 && (
            <div className="stat c-red">
              <div className="stat-label">Needs Attention</div>
              <div className="stat-val" style={{color:"var(--red)"}}>{needsAttention}</div>
              <div className="stat-sub">items</div>
            </div>
          )}
        </div>
      )}

      {/* Filter chips */}
      <div className="toolbar">
        {FILTER_OPTIONS.map(f=>(
          <button key={f} className={`chip ${filter===f?"on":""}`} onClick={()=>setFilter(f)}>{f}</button>
        ))}
      </div>

      {/* Empty state */}
      {list.length===0 && (
        <div className="empty">
          <span className="ei">🏠</span>
          <strong>{assets.length===0?"No assets yet":"No matching assets"}</strong>
          <p>{assets.length===0?"Track your home's major systems and appliances — HVAC, roof, appliances, electrical. Know their age, condition, and when they need service.":"Try a different filter"}</p>
          {assets.length===0 && <button className="btn btn-primary" onClick={openNew}>＋ Add your first asset</button>}
        </div>
      )}

      {/* Asset cards */}
      {list.map(a => {
        const sc = CONDITION_STYLE[a.condition||"Good"]||CONDITION_STYLE.Good;
        const icon = ASSET_ICONS[a.category]||"🔧";
        const installDate = a.install_date || a.purchase_date;
        const ageYears = installDate ? Math.floor((new Date()-new Date(installDate+"T00:00:00"))/(365.25*86400000)) : null;
        const lifespanYears = Number(a.lifespan_years || DEFAULT_LIFESPAN[a.category] || 15);
        const lifespanPct = ageYears !== null ? Math.min(100, Math.round((ageYears/lifespanYears)*100)) : null;
        const lifespanStatus = lifespanPct === null ? "ok" : lifespanPct >= 100 ? "alert" : lifespanPct >= 75 ? "warn" : "ok";
        const warrantyDays = a.expiry_date ? daysTo(a.expiry_date) : null;
        const warrantyExpired = warrantyDays !== null && warrantyDays < 0;
        const warrantySoon = warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 90;
        const assetLogs = serviceLogs.filter(s => s.asset_id === a.id);
        const totalServiceCost = assetLogs.reduce((s,l)=>s+Number(l.cost||0),0);
        const isExpanded = expandedService===a.id;

        return (
          <div key={a.id} className="asset-card">
            {/* Header */}
            <div className="asset-card-header">
              <div className="asset-card-icon" style={{background:CONDITION_STYLE[a.condition||"Good"].bg}}>
                {icon}
              </div>
              <div className="asset-card-body">
                <div className="asset-card-title">{a.item}</div>
                <div className="asset-card-meta">
                  <span className="asset-condition" style={{background:sc.bg,color:sc.text,borderColor:sc.border}}>
                    {a.condition||"Good"}
                  </span>
                  {a.category && <span>{a.category}</span>}
                  {a.model && <span>#{a.model}</span>}
                  {ageYears !== null && <span>{ageYears}yr old</span>}
                  {a.vendor && <span>🏪 {a.vendor}</span>}
                </div>
                {a.notes && <div className="card-note">{a.notes}</div>}
              </div>
              <div className="asset-card-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>openNewService(a.id)} title="Log service">🔧</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(a)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={()=>setConfirm(a.id)}>✕</button>
              </div>
            </div>

            {/* Asset photo */}
            {a.asset_photo_url && (
              <img src={a.asset_photo_url} alt={a.item} className="asset-photo" onClick={()=>setLightbox(a.asset_photo_url)} />
            )}

            {/* Stats row */}
            <div className="asset-stats-row">
              <div className="asset-stat">
                <div className="asset-stat-val">{a.cost>0?fmt$(a.cost):"—"}</div>
                <div className="asset-stat-label">Paid</div>
              </div>
              <div className="asset-stat">
                <div className="asset-stat-val">{a.replacement_cost>0?fmt$(a.replacement_cost):"—"}</div>
                <div className="asset-stat-label">Replace</div>
              </div>
              <div className="asset-stat">
                <div className="asset-stat-val">{assetLogs.length > 0 ? (totalServiceCost > 0 ? fmt$(totalServiceCost) : "$0") : "—"}</div>
                <div className="asset-stat-label">Serviced</div>
              </div>
            </div>

            {/* Lifespan bar */}
            {lifespanPct !== null && (
              <div className="asset-lifespan-row">
                <div className="asset-lifespan-label">
                  <span>Lifespan · {ageYears}yr of ~{lifespanYears}yr</span>
                  <span style={{color:lifespanStatus==="alert"?"var(--red)":lifespanStatus==="warn"?"#92610A":"var(--sage)",fontWeight:700}}>
                    {lifespanStatus==="alert"?"Past expected lifespan":lifespanStatus==="warn"?"Aging":"Good"}
                  </span>
                </div>
                <div className="asset-lifespan-bar">
                  <div className="asset-lifespan-fill" style={{
                    width:`${lifespanPct}%`,
                    background:lifespanStatus==="alert"?"var(--red)":lifespanStatus==="warn"?"var(--gold)":"var(--sage)"
                  }}/>
                </div>
              </div>
            )}

            {/* Warranty row */}
            {a.expiry_date && (
              <div className="asset-warranty-row" style={{
                background:warrantyExpired?"var(--cream)":warrantySoon?"#FFF8E6":"var(--sage-light)",
                color:warrantyExpired?"#A8A09A":warrantySoon?"#92610A":"var(--sage)"
              }}>
                <span style={{fontSize:"1rem"}}>🛡️</span>
                <span style={{flex:1,fontSize:".78rem",fontWeight:500}}>
                  {warrantyExpired ? `Warranty expired ${fmtD(a.expiry_date)}` :
                   warrantySoon ? `Warranty expires in ${warrantyDays} days — ${fmtD(a.expiry_date)}` :
                   `Warranty active — expires ${fmtD(a.expiry_date)}`}
                </span>
                {a.last_serviced && <span style={{fontSize:".7rem",color:"#A8A09A"}}>Last serviced {fmtD(a.last_serviced)}</span>}
              </div>
            )}

            {/* Service log */}
            <div className="asset-service-section">
              <div className="asset-service-header" onClick={()=>setExpandedService(isExpanded?null:a.id)}>
                <span className="asset-service-title">
                  Service Log · {assetLogs.length} entr{assetLogs.length!==1?"ies":"y"}
                </span>
                <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                  <button className="btn btn-ghost btn-sm" style={{fontSize:".68rem"}} onClick={e=>{e.stopPropagation();openNewService(a.id);}}>＋ Log</button>
                  <span style={{fontSize:".72rem",color:"#A8A09A"}}>{isExpanded?"▲":"▼"}</span>
                </div>
              </div>
              {isExpanded && (
                <div className="asset-service-log">
                  {assetLogs.length===0 ? (
                    <div style={{textAlign:"center",padding:"1rem",fontSize:".82rem",color:"#A8A09A"}}>
                      No service history yet — <button className="btn btn-ghost btn-sm" onClick={()=>openNewService(a.id)}>Log first service</button>
                    </div>
                  ) : assetLogs.map(s=>(
                    <div key={s.id} className="asset-service-entry">
                      <div className="asset-service-dot"/>
                      <div className="asset-service-body">
                        <div className="asset-service-desc">{s.description}</div>
                        <div className="asset-service-meta">
                          <span>{fmtD(s.service_date)}</span>
                          {s.notes && <span>{s.notes}</span>}
                        </div>
                      </div>
                      <div className="asset-service-cost">{s.cost>0?fmt$(s.cost):"—"}</div>
                      <div style={{display:"flex",gap:"3px",marginLeft:".3rem"}}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>openEditService(s)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>setServiceConfirm(s.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {modal && <Modal title={editId?"Edit Asset":"Add Asset"} onClose={()=>setModal(false)} onSave={save}><AssetForm data={editData} onChange={setEditData} userId={userId} planData={planData} onUpgrade={onUpgrade}/></Modal>}
      {confirm && <Confirm message="This asset and its service history will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
      {serviceModal && <Modal title={serviceEditId?"Edit Service Log":"Log Service"} onClose={()=>setServiceModal(false)} onSave={saveService}><ServiceLogForm data={serviceEditData} onChange={setServiceEditData} planData={planData} onUpgrade={onUpgrade}/></Modal>}
      {serviceConfirm && <Confirm message="This service log entry will be permanently deleted." onConfirm={confirmDelService} onCancel={()=>setServiceConfirm(null)}/>}
      {lightbox && <Lightbox src={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const UTIL_TYPES = {
  electric: { icon:"⚡", label:"Electric",  color:"#F5CC76", bg:"#FFF8E6", unit:"kWh"    },
  gas:      { icon:"🔥", label:"Gas",       color:"#F0A070", bg:"#FBF0E8", unit:"therms" },
  water:    { icon:"💧", label:"Water",     color:"#93C5E8", bg:"#EBF5FF", unit:"gallons"},
  internet: { icon:"📡", label:"Internet",  color:"#B8D9CC", bg:"#EAF2EE", unit:""       },
  trash:    { icon:"🗑️", label:"Trash",     color:"#C2B8AE", bg:"var(--cream2)", unit:"" },
  sewer:    { icon:"🪣", label:"Sewer",     color:"#B8D0C8", bg:"#EAF2EE", unit:"CCF"   },
  other:    { icon:"🏠", label:"Other",     color:"#C2B8AE", bg:"var(--cream2)", unit:"" },
};

function UtilityForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div>
      {/* Type selector */}
      <div className="field s2" style={{gridColumn:"span 2",marginBottom:".85rem"}}>
        <label>Utility Type</label>
        <div className="util-type-grid" style={{marginTop:"6px"}}>
          {Object.entries(UTIL_TYPES).map(([key,t])=>(
            <button
              key={key}
              type="button"
              className={`util-type-btn ${data.type===key?"selected":""}`}
              onClick={()=>f("type",key)}
            >
              <span className="util-type-icon">{t.icon}</span>
              <span className="util-type-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="fg">
        <div className="field s2"><label>Name *</label><input value={data.name||""} onChange={e=>f("name",e.target.value)} placeholder={`e.g. Home ${UTIL_TYPES[data.type||"electric"]?.label||"Electric"}`} /></div>
        <div className="field s2"><label>Provider / Company</label><input value={data.provider||""} onChange={e=>f("provider",e.target.value)} placeholder="e.g. Duke Energy" /></div>
        <div className="field s2"><label>Account Number (optional)</label><input value={data.account_number||""} onChange={e=>f("account_number",e.target.value)} placeholder="For reference only" /></div>
        <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Any details about this utility…" /></div>
      </div>
    </div>
  );
}

function BillForm({ data, onChange, utility, userId }) {
  const f = (k,v) => onChange({...data,[k]:v});
  const ut = UTIL_TYPES[utility?.type] || UTIL_TYPES.electric;
  return (
    <div className="fg">
      <div className="field"><label>Bill Date *</label><input type="date" value={data.bill_date||""} onChange={e=>f("bill_date",e.target.value)} /></div>
      <div className="field"><label>Amount ($) *</label><input type="number" value={data.amount||""} onChange={e=>f("amount",e.target.value)} placeholder="0.00" step="0.01" /></div>
      {ut.unit && (
        <>
          <div className="field"><label>Usage ({ut.unit})</label><input type="number" value={data.usage||""} onChange={e=>f("usage",e.target.value)} placeholder="0" /></div>
          <div className="field"><label>Usage Unit</label><input value={data.usage_unit||ut.unit} onChange={e=>f("usage_unit",e.target.value)} placeholder={ut.unit} /></div>
        </>
      )}
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Any notes about this bill…" /></div>
      {/* Pro gate for AI scan */}
      <div className="field s2">
        <AIScanButton
          onScanComplete={fields => { if(fields.amount) onChange({...data, amount: fields.amount}); }}
          label="Scan Utility Bill with AI"
          description="Auto-fill amount & usage from your bill photo"
        />
      </div>
    </div>
  );
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
function Expenses({ expenses, setExpenses, toast, userId, serviceLogs=[], planData, onUpgrade }) {
  const [view, setView] = useState("expenses");
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editId, setEditId] = useState(null);
  const [catF, setCatF] = useState("All");
  const [sort, setSort] = useState("date_desc");
  const [confirm, setConfirm] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectModal, setProjectModal] = useState(false);
  const [projectEditData, setProjectEditData] = useState({});
  const [projectEditId, setProjectEditId] = useState(null);
  const [projectConfirm, setProjectConfirm] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [utilities, setUtilities] = useState([]);
  const [bills, setBills] = useState([]);
  const [utilModal, setUtilModal] = useState(false);
  const [utilEditData, setUtilEditData] = useState({type:"electric"});
  const [utilEditId, setUtilEditId] = useState(null);
  const [utilConfirm, setUtilConfirm] = useState(null);
  const [billModal, setBillModal] = useState(false);
  const [billEditData, setBillEditData] = useState({});
  const [billEditId, setBillEditId] = useState(null);
  const [billConfirm, setBillConfirm] = useState(null);
  const [activeUtil, setActiveUtil] = useState(null);
  const [expandedUtil, setExpandedUtil] = useState(null);

  // Load projects
  useEffect(() => {
    if(!userId) return;
    supabase.from("projects").select("*").eq("user_id", userId).order("created_at", {ascending:false})
      .then(({data}) => { if(data) setProjects(data); });
    supabase.from("utilities").select("*").eq("user_id", userId).order("created_at", {ascending:true})
      .then(({data}) => { if(data) setUtilities(data); });
    supabase.from("utility_bills").select("*").eq("user_id", userId).order("bill_date", {ascending:false})
      .then(({data}) => { if(data) setBills(data); });
  }, [userId]);

  // ── Expense CRUD
  const openNew = () => { setEditData({date:localISO()}); setEditId(null); setModal(true); };
  const openEdit = e => { setEditData({...e}); setEditId(e.id); setModal(true); };

  const save = async () => {
    if(!editData.description?.trim()) return;
    const payload = {...editData};
    if(!payload.project_id) payload.project_id = null;
    if(editId) {
      const {error} = await supabase.from("expenses").update(payload).eq("id",editId).eq("user_id",userId);
      if(!error) { setExpenses(expenses.map(e=>e.id===editId?{...payload,id:editId}:e)); toast("Expense updated ✓"); }
      else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("expenses").insert([{...payload,user_id:userId}]).select();
      if(!error&&data) { setExpenses([...expenses,data[0]]); toast("Expense logged ✓"); }
      else toast("Error adding","error");
    }
    setModal(false);
  };

  const confirmDel = async () => {
    const {error} = await supabase.from("expenses").delete().eq("id",confirm).eq("user_id",userId);
    if(!error) { setExpenses(expenses.filter(e=>e.id!==confirm)); toast("Expense deleted","error"); }
    setConfirm(null);
  };

  // ── Project CRUD
  const openNewProject = () => { setProjectEditData({status:"Planning",start_date:localISO()}); setProjectEditId(null); setProjectModal(true); };
  const openEditProject = p => { setProjectEditData({...p}); setProjectEditId(p.id); setProjectModal(true); };

  const saveProject = async () => {
    if(!projectEditData.name?.trim()) return;
    if(projectEditId) {
      const {error} = await supabase.from("projects").update(projectEditData).eq("id",projectEditId).eq("user_id",userId);
      if(!error) { setProjects(projects.map(p=>p.id===projectEditId?{...projectEditData,id:projectEditId}:p)); toast("Project updated ✓"); }
      else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("projects").insert([{...projectEditData,user_id:userId}]).select();
      if(!error&&data) { setProjects([...projects,data[0]]); toast("Project created ✓"); }
      else toast("Error creating","error");
    }
    setProjectModal(false);
  };

  const confirmDelProject = async () => {
    const {error} = await supabase.from("projects").delete().eq("id",projectConfirm).eq("user_id",userId);
    if(!error) { setProjects(projects.filter(p=>p.id!==projectConfirm)); toast("Project deleted","error"); }
    setProjectConfirm(null);
  };

  // ── Utility CRUD
  const openNewUtil = () => { setUtilEditData({type:"electric"}); setUtilEditId(null); setUtilModal(true); };
  const openEditUtil = u => { setUtilEditData({...u}); setUtilEditId(u.id); setUtilModal(true); };

  const saveUtil = async () => {
    if(!utilEditData.name?.trim()) return;
    if(utilEditId) {
      const {error} = await supabase.from("utilities").update(utilEditData).eq("id",utilEditId).eq("user_id",userId);
      if(!error) { setUtilities(utilities.map(u=>u.id===utilEditId?{...utilEditData,id:utilEditId}:u)); toast("Utility updated ✓"); }
      else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("utilities").insert([{...utilEditData,user_id:userId}]).select();
      if(!error&&data) { setUtilities([...utilities,data[0]]); toast("Utility added ✓"); }
      else toast("Error adding","error");
    }
    setUtilModal(false);
  };

  const confirmDelUtil = async () => {
    const {error} = await supabase.from("utilities").delete().eq("id",utilConfirm).eq("user_id",userId);
    if(!error) {
      setUtilities(utilities.filter(u=>u.id!==utilConfirm));
      setBills(bills.filter(b=>b.utility_id!==utilConfirm));
      toast("Utility deleted","error");
    }
    setUtilConfirm(null);
  };

  // ── Bill CRUD
  const openNewBill = (utilId) => {
    setBillEditData({bill_date:localISO().slice(0,7)+"-01", utility_id:utilId});
    setBillEditId(null);
    setBillModal(true);
    setActiveUtil(utilities.find(u=>u.id===utilId));
  };
  const openEditBill = (b) => {
    setBillEditData({...b});
    setBillEditId(b.id);
    setBillModal(true);
    setActiveUtil(utilities.find(u=>u.id===b.utility_id));
  };

  const saveBill = async () => {
    if(!billEditData.amount || !billEditData.bill_date) return;
    const payload = {...billEditData};
    if(billEditId) {
      const {error} = await supabase.from("utility_bills").update(payload).eq("id",billEditId).eq("user_id",userId);
      if(!error) { setBills(bills.map(b=>b.id===billEditId?{...payload,id:billEditId}:b)); toast("Bill updated ✓"); }
      else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("utility_bills").insert([{...payload,user_id:userId}]).select();
      if(!error&&data) { setBills([...bills,data[0]]); toast("Bill logged ✓"); }
      else toast("Error logging","error");
    }
    setBillModal(false);
  };

  const confirmDelBill = async () => {
    const {error} = await supabase.from("utility_bills").delete().eq("id",billConfirm).eq("user_id",userId);
    if(!error) { setBills(bills.filter(b=>b.id!==billConfirm)); toast("Bill deleted","error"); }
    setBillConfirm(null);
  };

  // ── Analytics
  const yr = new Date().getFullYear();

  // Convert service logs to expense-like objects for display
  const serviceAsExpenses = serviceLogs
    .filter(s => s.cost > 0)
    .map(s => {
      // Find linked asset name
      const asset = projects; // placeholder — we use the description directly
      return {
        id: `svc-${s.id}`,
        description: s.description,
        amount: s.cost,
        date: s.service_date,
        category: "Maintenance",
        vendor: "",
        notes: s.notes || "",
        _isServiceLog: true,
        _serviceLogId: s.id,
      };
    });

  // Combine expenses + service log line items for display
  const allExpenseItems = [...expenses, ...serviceAsExpenses];

  const thisYear = allExpenseItems.filter(e=>e.date?.startsWith(String(yr)));
  const lastYear = expenses.filter(e=>e.date?.startsWith(String(yr-1)));
  const thisYrTotal = thisYear.reduce((s,e)=>s+Number(e.amount||0),0);
  const lastYrTotal = lastYear.reduce((s,e)=>s+Number(e.amount||0),0);
  const utilThisYr = bills.filter(b=>b.bill_date?.startsWith(String(yr))).reduce((s,b)=>s+Number(b.amount||0),0);
  const allTotal = allExpenseItems.reduce((s,e)=>s+Number(e.amount||0),0) + bills.reduce((s,b)=>s+Number(b.amount||0),0);
  const thisYrTotalWithService = thisYrTotal + utilThisYr;
  const trend = lastYrTotal > 0 ? ((thisYrTotalWithService - lastYrTotal) / lastYrTotal * 100).toFixed(0) : null;

  // Monthly chart data — current year, ALL sources: expenses + service logs + utility bills
  const curMonth = new Date().getMonth();
  const monthlyData = Array.from({length:12},(_,i)=>{
    const m = String(i+1).padStart(2,"0");
    const expTotal  = allExpenseItems.filter(e=>e.date?.startsWith(`${yr}-${m}`)).reduce((s,e)=>s+Number(e.amount||0),0);
    const billTotal = bills.filter(b=>b.bill_date?.startsWith(`${yr}-${m}`)).reduce((s,b)=>s+Number(b.amount||0),0);
    const total = expTotal + billTotal;
    return {month:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i], total, isCur: i===curMonth};
  });
  const maxMonth = Math.max(...monthlyData.map(m=>m.total), 1);

  // Category breakdown — include service as "Maintenance"
  const bycat = {};
  allExpenseItems.forEach(e=>{ if(e.category) { bycat[e.category]=(bycat[e.category]||{total:0,count:0}); bycat[e.category].total+=Number(e.amount||0); bycat[e.category].count+=1; }});
  const catData = Object.entries(bycat).sort((a,b)=>b[1].total-a[1].total);

  // Filtered expense list — includes service log line items
  const filtered = catF==="All" ? allExpenseItems : allExpenseItems.filter(e=>e.category===catF);
  const sorted = [...filtered].sort((a,b) => {
    if(sort==="date_desc") return new Date(b.date||0)-new Date(a.date||0);
    if(sort==="date_asc")  return new Date(a.date||0)-new Date(b.date||0);
    if(sort==="amount_desc") return Number(b.amount||0)-Number(a.amount||0);
    if(sort==="amount_asc")  return Number(a.amount||0)-Number(b.amount||0);
    if(sort==="desc_az") return (a.description||"").localeCompare(b.description||"");
    return 0;
  });
  const filteredTotal = filtered.reduce((s,e)=>s+Number(e.amount||0),0);

  // Biggest single expense this year
  const biggestThisYear = thisYear.reduce((max,e)=>Number(e.amount||0)>Number(max?.amount||0)?e:max, null);

  return (
    <div>
      {/* View toggle */}
      <div className="sh">
        <span className="sh-title">Finances</span>
        <div className="sh-right">
          <div className="view-toggle">
            <button className={`view-btn ${view==="expenses"?"active":""}`} onClick={()=>setView("expenses")}>Expenses</button>
            <button className={`view-btn ${view==="projects"?"active":""}`} onClick={()=>setView("projects")}>Projects {projects.length>0&&`(${projects.length})`}</button>
            <button className={`view-btn ${view==="utilities"?"active":""}`} onClick={()=>setView("utilities")}>Utilities {utilities.length>0&&`(${utilities.length})`}</button>
          </div>
          {view==="expenses"
            ? <button className="btn btn-primary" onClick={openNew}>＋ Log Expense</button>
            : view==="projects"
            ? <button className="btn btn-primary" onClick={openNewProject}>＋ New Project</button>
            : <button className="btn btn-primary" onClick={openNewUtil}>＋ Add Utility</button>
          }
        </div>
      </div>

      {/* ══ EXPENSES VIEW ══ */}
      {view==="expenses" && (
        <div>
          {/* Investment hero */}
          <div className="invest-hero">
            <div className="invest-hero-label">Total home investment</div>
            <div className="invest-hero-amount">{fmt$(allTotal)}</div>
            <div className="invest-hero-row">
              <div className="invest-hero-stat">
                <div className="invest-hero-stat-val">{fmt$(thisYrTotalWithService)}</div>
                <div className="invest-hero-stat-label">{yr}</div>
                {trend !== null && (
                  <div className={`invest-hero-trend ${Number(trend)>0?"trend-up":Number(trend)<0?"trend-down":"trend-flat"}`}>
                    {Number(trend)>0?"↑":"↓"} {Math.abs(Number(trend))}% vs last year
                  </div>
                )}
              </div>
              <div className="invest-hero-stat">
                <div className="invest-hero-stat-val">{fmt$(lastYrTotal)}</div>
                <div className="invest-hero-stat-label">{yr-1}</div>
              </div>
              {biggestThisYear && (
                <div className="invest-hero-stat">
                  <div className="invest-hero-stat-val" style={{fontSize:".85rem",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{biggestThisYear.description}</div>
                  <div className="invest-hero-stat-label">Largest this year · {fmt$(biggestThisYear.amount)}</div>
                </div>
              )}
              {utilThisYr > 0 && (
                <div className="invest-hero-stat">
                  <div className="invest-hero-stat-val">{fmt$(utilThisYr)}</div>
                  <div className="invest-hero-stat-label">Utilities {yr}</div>
                </div>
              )}
            </div>
          </div>
          {thisYear.length > 0 && (() => {
            const CHART_H = 160, PAD_TOP = 28, PAD_BOT = 30, LABEL_W = 48, PAD_R = 8;
            const SVG_W = 700, SVG_H = PAD_TOP + CHART_H + PAD_BOT;
            const barAreaW = SVG_W - LABEL_W - PAD_R;
            const slotW = barAreaW / 12;
            const barW = Math.max(slotW * 0.62, 16);
            // Round max up to a nice number
            const mag = Math.pow(10, Math.floor(Math.log10(maxMonth)));
            const niceMax = Math.ceil(maxMonth / (mag/2)) * (mag/2) || 1;
            const fmtY = v => v === 0 ? "$0" : v >= 1000 ? `$${(v/1000)%1===0?(v/1000):(v/1000).toFixed(1)}k` : `$${v}`;
            const gridPcts = [0, 0.25, 0.5, 0.75, 1];
            const font = "'Hanken Grotesk', Arial, sans-serif";
            return (
              <div className="month-chart">
                <div className="month-chart-title">{yr} monthly spending — all sources</div>
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{width:"100%",height:"auto",display:"block"}}>
                  {/* Y-axis gridlines */}
                  {gridPcts.map(pct => {
                    const gy = PAD_TOP + CHART_H * (1 - pct);
                    return (
                      <g key={pct}>
                        <line x1={LABEL_W} y1={gy} x2={SVG_W-PAD_R} y2={gy}
                          stroke={pct===0?"#C2B8AE":"#EDE8E1"} strokeWidth={pct===0?1.5:1}/>
                        <text x={LABEL_W-6} y={gy+4} textAnchor="end"
                          fontSize="10" fill="#A8A09A" fontFamily={font}>{fmtY(Math.round(niceMax*pct))}</text>
                      </g>
                    );
                  })}
                  {/* Bars */}
                  {monthlyData.map((m, i) => {
                    const barH = Math.max((m.total/niceMax)*CHART_H, m.total>0?4:0);
                    const bx = LABEL_W + i*slotW + (slotW-barW)/2;
                    const by = PAD_TOP + CHART_H - barH;
                    const amtLabel = m.total>=1000 ? `$${(m.total/1000)%1===0?(m.total/1000):(m.total/1000).toFixed(1)}k` : m.total>0 ? `$${Math.round(m.total)}` : "";
                    const color = m.isCur ? "#C16140" : "#234A3D";
                    return (
                      <g key={i}>
                        <rect x={bx} y={by} width={barW} height={Math.max(barH,0)} rx="3"
                          fill={m.total>0?color:"#E8E2D9"}/>
                        {m.total>0 && (
                          <text x={bx+barW/2} y={by-5} textAnchor="middle"
                            fontSize="9.5" fill={color} fontWeight="700" fontFamily={font}>{amtLabel}</text>
                        )}
                        <text x={bx+barW/2} y={PAD_TOP+CHART_H+18} textAnchor="middle"
                          fontSize="9.5" fill={m.isCur?color:"#A8A09A"} fontWeight={m.isCur?"700":"500"} fontFamily={font}>
                          {m.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}

          {/* Category insight cards */}
          {catData.length > 0 && (
            <div className="cat-cards">
              <div
                className={`cat-card ${catF==="All"?"active":""}`}
                onClick={()=>setCatF("All")}
                style={{"--cat-color":"var(--rust)"}}
              >
                <div className="cat-card-icon">🏠</div>
                <div className="cat-card-name">All</div>
                <div className="cat-card-amount">{fmt$(allTotal)}</div>
                <div className="cat-card-count">{expenses.length} expenses</div>
              </div>
              {catData.map(([cat,{total,count}],i)=>(
                <div
                  key={cat}
                  className={`cat-card ${catF===cat?"active":""}`}
                  onClick={()=>setCatF(catF===cat?"All":cat)}
                  style={{"--cat-color":CHART_COLORS[i%CHART_COLORS.length]}}
                >
                  <div className="cat-card-icon">{CAT_ICONS[cat]||"🔧"}</div>
                  <div className="cat-card-name">{cat}</div>
                  <div className="cat-card-amount">{fmt$(total)}</div>
                  <div className="cat-card-count">{count} expense{count!==1?"s":""}</div>
                </div>
              ))}
            </div>
          )}

          {/* Expense list */}
          {sorted.length===0 ? (
            <div className="empty">
              <span className="ei">💲</span>
              <strong>{expenses.length===0?"No expenses yet":"No matching expenses"}</strong>
              <p>{expenses.length===0?"Start tracking your home costs to understand your true investment over time":"Try a different category"}</p>
              {expenses.length===0 && <button className="btn btn-primary" onClick={openNew}>＋ Log your first expense</button>}
            </div>
          ) : (
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:".6rem",flexWrap:"wrap",gap:".4rem"}}>
                <span style={{fontSize:".75rem",color:"#A8A09A"}}>{filtered.length} expense{filtered.length!==1?"s":""}{catF!=="All"?` in ${catF}`:""}</span>
                <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
                  <select className="sort-select" value={sort} onChange={e=>setSort(e.target.value)}>
                    <option value="date_desc">Newest first</option>
                    <option value="date_asc">Oldest first</option>
                    <option value="amount_desc">Highest amount</option>
                    <option value="amount_asc">Lowest amount</option>
                    <option value="desc_az">A–Z</option>
                  </select>
                </div>
              </div>
              {sorted.map(e=>{
                const proj = e.project_id ? projects.find(p=>p.id===e.project_id) : null;
                const isImage = e.file_url && e.file_url.match(/\.(jpg|jpeg|png|webp|heic)/i);
                const isPdf = e.file_url && e.file_url.match(/\.pdf/i);
                const isServiceLog = e._isServiceLog;
                return (
                  <div key={e.id} className="exp-card" style={{flexDirection:"column",gap:0}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:".75rem"}}>
                      <div className="exp-card-icon" style={{background: isServiceLog ? "var(--rust-light)" : CHART_COLORS[CATEGORIES.indexOf(e.category)%CHART_COLORS.length]+"22"}}>
                        {isServiceLog ? "🔧" : CAT_ICONS[e.category]||"🔧"}
                      </div>
                      <div className="exp-card-body">
                        <div className="exp-card-title">{e.description}</div>
                        <div className="exp-card-meta">
                          {e.date && <span>{fmtD(e.date)}</span>}
                          {e.category && <span>{e.category}</span>}
                          {e.vendor && <span>👤 {e.vendor}</span>}
                          {proj && <span className="exp-project-tag">🔨 {proj.name}</span>}
                          {isServiceLog && (
                            <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:".65rem",fontWeight:600,color:"var(--rust)",background:"var(--rust-light)",padding:"1px 7px",borderRadius:10}}>
                              🔧 Asset service
                            </span>
                          )}
                          {e.file_url && <span style={{color:"var(--rust)",fontSize:".65rem",fontWeight:600}}>📎 receipt</span>}
                        </div>
                        {e.notes && !isServiceLog && <div style={{fontSize:".72rem",color:"#7A7370",marginTop:"3px"}}>{e.notes}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px",flexShrink:0}}>
                        <div className="exp-card-amount">{fmt$(e.amount)}</div>
                        {!isServiceLog && (
                          <div style={{display:"flex",gap:"3px"}}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(e)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={()=>setConfirm(e.id)}>✕</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* File preview — only for regular expenses */}
                    {!isServiceLog && e.file_url && (
                      <div className="exp-card-file">
                        {isImage ? (
                          <img src={e.file_url} alt="Receipt" className="exp-file-thumb" onClick={()=>setLightbox(e.file_url)} />
                        ) : isPdf ? (
                          <a href={e.file_url} target="_blank" rel="noopener noreferrer" className="exp-file-pdf">
                            📄 View PDF receipt — tap to open
                          </a>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ PROJECTS VIEW ══ */}
      {view==="projects" && (
        <div>
          {projects.length===0 ? (
            <div className="empty">
              <span className="ei">🔨</span>
              <strong>No projects yet</strong>
              <p>Track remodels, renovations, and major work. Group expenses under a project to see true costs and build a record for resale.</p>
              <button className="btn btn-primary" onClick={openNewProject}>＋ Create your first project</button>
            </div>
          ) : projects.map(p=>{
            const projExpenses = expenses.filter(e=>e.project_id===p.id);
            const spent = projExpenses.reduce((s,e)=>s+Number(e.amount||0),0);
            const budget = Number(p.budget||0);
            const pct = budget > 0 ? Math.min(100, Math.round((spent/budget)*100)) : null;
            const isOver = budget > 0 && spent > budget;
            const sc = PROJECT_STATUS_STYLE[p.status]||PROJECT_STATUS_STYLE.Planning;
            const isExpanded = expandedProject===p.id;
            return (
              <div key={p.id} className="project-card">
                <div className="project-card-header" onClick={()=>setExpandedProject(isExpanded?null:p.id)}>
                  <div className="project-card-icon">🔨</div>
                  <div className="project-card-body">
                    <div className="project-card-title">{p.name}</div>
                    <div className="project-card-meta">
                      <span className="project-status" style={{background:sc.bg,color:sc.text,borderColor:sc.border}}>{p.status}</span>
                      {p.start_date && <span>Started {fmtD(p.start_date)}</span>}
                      {p.status==="Completed" && p.end_date && <span style={{color:"var(--sage)"}}>✓ Completed {fmtD(p.end_date)}</span>}
                      {projExpenses.length>0 && <span>{projExpenses.length} expense{projExpenses.length!==1?"s":""}</span>}
                    </div>
                    {p.description && <div style={{fontSize:".78rem",color:"#7A7370",marginTop:"4px",lineHeight:1.4}}>{p.description}</div>}
                  </div>
                  <div className="project-card-actions" onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEditProject(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>setProjectConfirm(p.id)}>✕</button>
                  </div>
                </div>

                {/* Project photo */}
                {p.photo_url && (
                  <img
                    src={p.photo_url}
                    alt={p.name}
                    className="project-photo"
                    style={{cursor:"pointer"}}
                    onClick={()=>setLightbox(p.photo_url)}
                  />
                )}

                {/* Budget progress */}
                <div className="project-budget-row">
                  <div className="project-budget-stat">
                    <div className="project-budget-val" style={{color:isOver?"var(--red)":"var(--dark)"}}>{fmt$(spent)}</div>
                    <div className="project-budget-label">spent</div>
                  </div>
                  {budget > 0 && <>
                    <div className="project-budget-stat">
                      <div className="project-budget-val">{fmt$(budget)}</div>
                      <div className="project-budget-label">budget</div>
                    </div>
                    <div className="project-progress">
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:".65rem",color:isOver?"var(--red)":"#A8A09A"}}>
                        <span>{isOver?"Over budget":"On track"}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="project-progress-bar">
                        <div className="project-progress-fill" style={{width:`${pct}%`,background:isOver?"var(--red)":pct>80?"var(--gold)":"var(--sage)"}}/>
                      </div>
                    </div>
                    {budget > 0 && !isOver && (
                      <div className="project-budget-stat">
                        <div className="project-budget-val" style={{color:"var(--sage)"}}>{fmt$(budget-spent)}</div>
                        <div className="project-budget-label">remaining</div>
                      </div>
                    )}
                  </>}
                  <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>{setEditData({date:localISO(),project_id:p.id});setEditId(null);setModal(true);}}>
                    ＋ Add expense
                  </button>
                </div>

                {/* Expanded expense list */}
                {isExpanded && (
                  <div className="project-expenses">
                    {projExpenses.length===0
                      ? <div style={{fontSize:".82rem",color:"#A8A09A",padding:".5rem 0",textAlign:"center"}}>No expenses logged yet</div>
                      : projExpenses.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(e=>(
                          <div key={e.id} className="project-expense-row">
                            <span style={{fontSize:"1rem"}}>{CAT_ICONS[e.category]||"🔧"}</span>
                            <span style={{flex:1,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.description}</span>
                            <span style={{fontSize:".75rem",color:"#A8A09A",flexShrink:0}}>{fmtD(e.date)}</span>
                            <span style={{fontFamily:"'Fraunces',serif",fontWeight:700,flexShrink:0,marginLeft:".5rem"}}>{fmt$(e.amount)}</span>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ UTILITIES VIEW ══ */}
      {view==="utilities" && (
        <div>
          {utilities.length===0 ? (
            <div>
              <div className="empty">
                <span className="ei">⚡</span>
                <strong>No utilities set up yet</strong>
                <p>Track your electric, gas, water, and other monthly bills. See trends, spot spikes, and understand your true home running cost.</p>
                <button className="btn btn-primary" onClick={openNewUtil}>＋ Add your first utility</button>
              </div>
              {/* Quick-add type buttons */}
              <div style={{marginTop:"1rem"}}>
                <div style={{fontSize:".72rem",color:"#A8A09A",textAlign:"center",marginBottom:".65rem",fontWeight:600,letterSpacing:".5px",textTransform:"uppercase"}}>Quick add</div>
                <div style={{display:"flex",gap:".5rem",flexWrap:"wrap",justifyContent:"center"}}>
                  {Object.entries(UTIL_TYPES).slice(0,4).map(([key,t])=>(
                    <button key={key} className="btn btn-ghost" style={{gap:".4rem"}} onClick={()=>{setUtilEditData({type:key,name:t.label});setUtilEditId(null);setUtilModal(true);}}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Utility summary bar */}
              <div style={{display:"flex",gap:".65rem",marginBottom:"1rem",overflowX:"auto",paddingBottom:"2px"}}>
                {[
                  {label:"Monthly avg", val: fmt$(bills.length>0 ? bills.slice(0,12).reduce((s,b)=>s+Number(b.amount||0),0)/Math.min(bills.length,12) : 0)},
                  {label:`${yr} utilities`, val: fmt$(utilThisYr)},
                  {label:"Total bills logged", val: bills.length},
                ].map(s=>(
                  <div key={s.label} style={{background:"var(--white)",border:"1px solid var(--stone)",borderRadius:"var(--r-sm)",padding:".65rem .9rem",flexShrink:0,boxShadow:"var(--shadow)"}}>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.05rem",fontWeight:700,color:"var(--dark)",lineHeight:1}}>{s.val}</div>
                    <div style={{fontSize:".65rem",color:"#A8A09A",marginTop:"2px",textTransform:"uppercase",letterSpacing:".5px",fontWeight:600}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Utility cards */}
              <div className="util-grid">
                {utilities.map(u=>{
                  const ut = UTIL_TYPES[u.type]||UTIL_TYPES.other;
                  const utilBills = bills.filter(b=>b.utility_id===u.id).sort((a,b)=>new Date(b.bill_date)-new Date(a.bill_date));
                  const lastBill = utilBills[0];
                  const avg = utilBills.length>0 ? utilBills.slice(0,6).reduce((s,b)=>s+Number(b.amount||0),0)/Math.min(utilBills.length,6) : 0;
                  const ytdTotal = utilBills.filter(b=>b.bill_date?.startsWith(String(yr))).reduce((s,b)=>s+Number(b.amount||0),0);
                  const isSpike = lastBill && avg > 0 && Number(lastBill.amount) > avg * 1.4;
                  const isExpanded = expandedUtil===u.id;

                  // Mini chart data — last 6 bills
                  const chartBills = [...utilBills].slice(0,6).reverse();
                  const maxBill = Math.max(...chartBills.map(b=>Number(b.amount||0)),1);

                  return (
                    <div key={u.id} className="util-card">
                      <div className="util-card-header">
                        <div className="util-card-icon" style={{background:ut.bg}}>{ut.icon}</div>
                        <div className="util-card-body">
                          <div className="util-card-name">{u.name}</div>
                          <div className="util-card-provider">{u.provider||ut.label}{u.account_number?` · ${u.account_number}`:""}</div>
                        </div>
                        <div className="util-card-actions">
                          <button className="btn btn-primary btn-sm" onClick={()=>openNewBill(u.id)}>＋ Bill</button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>openEditUtil(u)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>setUtilConfirm(u.id)}>✕</button>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="util-stats">
                        <div className="util-stat">
                          <div className="util-stat-val">{lastBill ? fmt$(lastBill.amount) : "—"}</div>
                          <div className="util-stat-label">Last bill</div>
                        </div>
                        <div className="util-stat">
                          <div className="util-stat-val">{avg>0 ? fmt$(avg) : "—"}</div>
                          <div className="util-stat-label">6mo avg</div>
                        </div>
                        <div className="util-stat">
                          <div className="util-stat-val">{ytdTotal>0 ? fmt$(ytdTotal) : "—"}</div>
                          <div className="util-stat-label">{yr} total</div>
                        </div>
                      </div>

                      {/* Spike warning */}
                      {isSpike && (
                        <div className="util-spike">
                          ⚠️ Last bill is {Math.round((Number(lastBill.amount)/avg-1)*100)}% above your average
                        </div>
                      )}

                      {/* Mini trend chart */}
                      {chartBills.length > 1 && (
                        <div className="util-mini-chart">
                          {chartBills.map((b,i)=>(
                            <div
                              key={i}
                              className="util-mini-bar"
                              style={{
                                height:`${Math.max((Number(b.amount)/maxBill)*100,8)}%`,
                                background: i===chartBills.length-1 ? ut.color : ut.color+"88",
                              }}
                              title={`${fmtD(b.bill_date)}: ${fmt$(b.amount)}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Bills list toggle */}
                      {utilBills.length > 0 && (
                        <div className="util-bills-section">
                          <div className="util-bills-header" onClick={()=>setExpandedUtil(isExpanded?null:u.id)} style={{cursor:"pointer"}}>
                            <span className="util-bills-title">{utilBills.length} bill{utilBills.length!==1?"s":""} logged</span>
                            <span style={{fontSize:".75rem",color:"#A8A09A"}}>{isExpanded?"Hide ▲":"Show ▼"}</span>
                          </div>
                          {isExpanded && utilBills.slice(0,12).map(b=>(
                            <div key={b.id} className="util-bill-row">
                              <span className="util-bill-date">{fmtD(b.bill_date)}</span>
                              <span className="util-bill-usage">
                                {b.usage ? `${Number(b.usage).toLocaleString()} ${b.usage_unit||ut.unit}` : b.notes||""}
                              </span>
                              {b.file_url && (
                                <span style={{color:"var(--rust)",fontSize:".65rem",marginRight:".3rem",flexShrink:0}}>📎</span>
                              )}
                              <span className="util-bill-amount">{fmt$(b.amount)}</span>
                              <div className="util-bill-actions">
                                <button className="btn btn-ghost btn-sm" onClick={()=>openEditBill(b)}>Edit</button>
                                <button className="btn btn-danger btn-sm" onClick={()=>setBillConfirm(b.id)}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add utility card */}
                <div className="util-setup-card" onClick={openNewUtil}>
                  <div style={{fontSize:"1.8rem",marginBottom:".5rem"}}>＋</div>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:"1rem",fontWeight:500,marginBottom:".3rem"}}>Add a utility</div>
                  <div style={{fontSize:".8rem",color:"#A8A09A"}}>Electric, gas, water, internet…</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && <Modal title={editId?"Edit Expense":"Log Expense"} onClose={()=>setModal(false)} onSave={save}><ExpenseForm data={editData} onChange={setEditData} projects={projects} userId={userId} planData={planData} onUpgrade={onUpgrade}/></Modal>}
      {confirm && <Confirm message="This expense will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
      {projectModal && <Modal title={projectEditId?"Edit Project":"New Project"} onClose={()=>setProjectModal(false)} onSave={saveProject}><ProjectForm data={projectEditData} onChange={setProjectEditData} userId={userId}/></Modal>}
      {projectConfirm && <Confirm message="This project will be permanently deleted. Expenses linked to it will remain but lose the project link." onConfirm={confirmDelProject} onCancel={()=>setProjectConfirm(null)}/>}
      {utilModal && <Modal title={utilEditId?"Edit Utility":"Add Utility"} onClose={()=>setUtilModal(false)} onSave={saveUtil}><UtilityForm data={utilEditData} onChange={setUtilEditData}/></Modal>}
      {utilConfirm && <Confirm message="This utility and all its bill history will be permanently deleted." onConfirm={confirmDelUtil} onCancel={()=>setUtilConfirm(null)}/>}
      {billModal && <Modal title={billEditId?"Edit Bill":"Log Bill"} onClose={()=>setBillModal(false)} onSave={saveBill}><BillForm data={billEditData} onChange={setBillEditData} utility={activeUtil} userId={userId}/></Modal>}
      {billConfirm && <Confirm message="This bill will be permanently deleted." onConfirm={confirmDelBill} onCancel={()=>setBillConfirm(null)}/>}
      {lightbox && <Lightbox src={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}

// ─── DOCUMENT VAULT ───────────────────────────────────────────────────────────
const DOC_CATEGORIES = [
  { id:"legal",      label:"Legal & Ownership",     icon:"📜", color:"#F3EFFC", desc:"Deed, title, survey, closing docs, easements" },
  { id:"mortgage",   label:"Mortgage & Finance",     icon:"🏦", color:"#EBF5FF", desc:"Loan docs, statements, refinance, HELOC" },
  { id:"inspection", label:"Inspection Reports",     icon:"🔍", color:"#FBF0E8", desc:"Home, pest, radon, mold, septic, pool" },
  { id:"insurance",  label:"Insurance Policies",     icon:"🛡️", color:"#EAF2EE", desc:"Homeowners, flood, umbrella, full policy docs" },
  { id:"permits",    label:"Permits & Work",         icon:"🔨", color:"#FFF8E6", desc:"Building permits, certificates of occupancy" },
  { id:"tax",        label:"Property Tax",           icon:"🧾", color:"#FBF3E8", desc:"Tax bills, assessments, payment records" },
  { id:"contracts",  label:"Contracts & Agreements", icon:"📝", color:"#F3EFFC", desc:"HOA docs, service contracts, home warranty plan" },
  { id:"other",      label:"Other",                  icon:"📁", color:"var(--cream2)", desc:"Any other home documents" },
];

function DocumentForm({ data, onChange, userId, assets=[], projects=[], planData, onUpgrade }) {
  const f = (k,v) => onChange({...data,[k]:v});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);

  const maxMB = planData?.maxFileMB ?? 50;

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) { setUploadError(`File must be under ${maxMB}MB on your plan.`); return; }
    setUploadError("");

    // Check shared file limit before upload (only for new files, not replacements)
    if (!data.file_url) {
      const limit = await checkFileLimit(userId, planData);
      if (!limit.ok) {
        if (onUpgrade) onUpgrade();
        else setUploadError(`File limit reached (${limit.max} files on ${planData?.label||"Free"}). Upgrade to add more.`);
        return;
      }
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g,"_");
    const path = `${userId}/documents/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("expense-files").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setUploadError("Upload failed — " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("expense-files").getPublicUrl(path);
    onChange({...data, file_url: urlData.publicUrl, file_type: file.type, name: data.name || file.name.replace(/\.[^/.]+$/,"")});
    setUploading(false);
  };

  return (
    <div className="fg">
      {/* File upload */}
      <div className="field s2">
        <label>Document File</label>
        {data.file_url ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:".65rem",padding:".65rem .9rem",background:"var(--sage-light)",border:"1px solid #B8D9CC",borderRadius:"var(--r-sm)",marginBottom:".5rem"}}>
              <span style={{fontSize:"1.2rem"}}>{data.file_type?.includes("pdf")?"📄":"🖼️"}</span>
              <span style={{flex:1,fontSize:".82rem",fontWeight:600,color:"var(--sage)"}}>File attached ✓</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>onChange({...data,file_url:"",file_type:""})}>Remove</button>
            </div>
            {/* AI extract button — appears after file is attached */}
            <AIScanButton
              onScanComplete={fields => onChange({...data,...fields})}
              label="Extract info with AI"
              description="Auto-fill document name, category & description"
              scanType="document"
              planData={planData}
              onUpgrade={onUpgrade}
            />
          </div>
        ) : (
          <div
            className={`doc-upload-zone ${dragging?"drag":""}`}
            onDragOver={e=>{e.preventDefault();setDragging(true)}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
          >
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx" onChange={e=>handleFile(e.target.files[0])} />
            <div className="doc-upload-icon">📎</div>
            <div className="doc-upload-text"><strong>Click to upload</strong> or drag & drop<br/>PDF, JPG, PNG, HEIC, DOC — up to 50MB</div>
          </div>
        )}
        {uploading && <div style={{fontSize:".75rem",color:"var(--rust)",marginTop:".3rem",display:"flex",alignItems:"center",gap:".4rem"}}><span className="spinner" style={{width:12,height:12,borderWidth:2}}/>Uploading…</div>}
        {uploadError && <div style={{fontSize:".75rem",color:"var(--red)",marginTop:".3rem"}}>⚠️ {uploadError}</div>}
      </div>

      <div className="field s2"><label>Document Name *</label><input value={data.name||""} onChange={e=>f("name",e.target.value)} placeholder="e.g. Home Inspection Report 2024" /></div>
      <div className="field s2">
        <label>Category</label>
        <select value={data.category||""} onChange={e=>f("category",e.target.value)}>
          <option value="">Select…</option>
          {DOC_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="field s2"><label>Description</label><input value={data.description||""} onChange={e=>f("description",e.target.value)} placeholder="Brief description of this document" /></div>
      <div className="field"><label>Expiry / Review Date</label><input type="date" value={data.expiry_date||""} onChange={e=>f("expiry_date",e.target.value)} /></div>
      {assets.length > 0 && (
        <div className="field">
          <label>Linked Asset (optional)</label>
          <select value={data.asset_id||""} onChange={e=>f("asset_id",e.target.value||null)}>
            <option value="">No asset</option>
            {assets.map(a=><option key={a.id} value={a.id}>{a.item}</option>)}
          </select>
        </div>
      )}
      {projects.length > 0 && (
        <div className="field">
          <label>Linked Project (optional)</label>
          <select value={data.project_id||""} onChange={e=>f("project_id",e.target.value?Number(e.target.value):null)}>
            <option value="">No project</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Any notes about this document…" /></div>
    </div>
  );
}

function DocumentVault({ userId, warranties: assets=[], lightbox, setLightbox, planData, onUpgrade }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");

  const maxDocs = planData?.maxDocs ?? Infinity;
  const atLimit = documents.length >= maxDocs;

  const openNew = (category="") => {
    if (atLimit && onUpgrade) { onUpgrade(); return; }
    setEditData({category}); setEditId(null); setModal(true);
  };

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from("home_documents").select("*").eq("user_id", userId).order("created_at", {ascending:false}),
      supabase.from("projects").select("id,name").eq("user_id", userId),
    ]).then(([docs, proj]) => {
      if (docs.data) setDocuments(docs.data);
      if (proj.data) setProjects(proj.data);
      setLoading(false);
    });
  }, [userId]);

  const openEdit = d => { setEditData({...d}); setEditId(d.id); setModal(true); };

  const save = async () => {
    if (!editData.name?.trim()) return;
    if (editId) {
      const {error} = await supabase.from("home_documents").update(editData).eq("id",editId).eq("user_id",userId);
      if (!error) setDocuments(documents.map(d=>d.id===editId?{...editData,id:editId}:d));
    } else {
      const {data,error} = await supabase.from("home_documents").insert([{...editData,user_id:userId}]).select();
      if (!error&&data) setDocuments([data[0],...documents]);
    }
    setModal(false);
  };

  const confirmDel = async () => {
    const doc = documents.find(d=>d.id===confirm);
    if (doc?.file_url) {
      const path = doc.file_url.split("/expense-files/")[1]?.split("?")[0];
      if (path) await supabase.storage.from("expense-files").remove([path]);
    }
    await supabase.from("home_documents").delete().eq("id",confirm).eq("user_id",userId);
    setDocuments(documents.filter(d=>d.id!==confirm));
    setConfirm(null);
  };

  const toggleExpanded = (id) => setExpanded(e=>({...e,[id]:!e[id]}));

  const searchFiltered = search
    ? documents.filter(d=>d.name?.toLowerCase().includes(search.toLowerCase())||d.description?.toLowerCase().includes(search.toLowerCase()))
    : null;

  const totalDocs = documents.length;

  const getExpiryStatus = (date) => {
    if (!date) return null;
    const d = daysTo(date);
    if (d < 0) return "expired";
    if (d <= 30) return "soon";
    return "ok";
  };

  const fileIcon = (type) => {
    if (!type) return "📄";
    if (type.includes("pdf")) return "📄";
    if (type.includes("image")) return "🖼️";
    if (type.includes("word") || type.includes("document")) return "📝";
    return "📎";
  };

  if (loading) return <div className="loading" style={{padding:"2rem"}}><div className="spinner"/></div>;

  return (
    <div className="home-section">
      <div className="home-section-header">
        <span className="home-section-title">📂 Document Vault</span>
        <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
          {maxDocs !== Infinity ? (
            <span style={{
              fontSize:".72rem",fontWeight:600,
              color: atLimit ? "#C16140" : documents.length >= maxDocs * 0.8 ? "#B8861E" : "#A8A09A"
            }}>
              {documents.length} / {maxDocs}
            </span>
          ) : (
            totalDocs > 0 && <span style={{fontSize:".72rem",color:"#A8A09A"}}>{totalDocs} doc{totalDocs!==1?"s":""}</span>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={()=>openNew()}
            style={atLimit ? {background:"#A8A09A",borderColor:"#A8A09A"} : {}}
          >
            {atLimit ? "🔒 Upgrade" : "＋ Add"}
          </button>
        </div>
      </div>

      {/* At-limit banner */}
      {atLimit && maxDocs !== Infinity && (
        <div style={{margin:".5rem 1.1rem .25rem",padding:".6rem .85rem",background:"#FBF0E6",border:"1px solid #F5D5B0",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:".75rem"}}>
          <span style={{fontSize:".78rem",color:"#A0511A",lineHeight:1.4}}>
            You've reached the {maxDocs}-document limit on Free.
          </span>
          <button onClick={onUpgrade} style={{fontSize:".72rem",fontWeight:700,color:"#A0511A",background:"none",border:"1px solid #F5D5B0",borderRadius:"8px",padding:"3px 10px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Hanken Grotesk',sans-serif"}}>
            Upgrade → Plus
          </button>
        </div>
      )}

      <div style={{padding:".75rem 1.1rem",borderBottom:"1px solid var(--stone)"}}>
        {/* Search */}
        {totalDocs > 3 && (
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Search documents…"
            style={{width:"100%",padding:".5rem .85rem",border:"1.5px solid var(--stone)",borderRadius:"var(--r-sm)",fontFamily:"'Hanken Grotesk',sans-serif",fontSize:".84rem",color:"var(--dark)",background:"var(--cream)",outline:"none",marginBottom:".75rem"}}
            onFocus={e=>e.target.style.borderColor="var(--rust)"}
            onBlur={e=>e.target.style.borderColor="var(--stone)"}
          />
        )}

        {/* Search results */}
        {searchFiltered && (
          <div>
            {searchFiltered.length === 0 ? (
              <div style={{textAlign:"center",padding:"1rem",color:"#A8A09A",fontSize:".84rem"}}>No documents match "{search}"</div>
            ) : searchFiltered.map(d => (
              <DocItem key={d.id} doc={d} assets={assets} onEdit={openEdit} onDelete={setConfirm} onView={setLightbox} fileIcon={fileIcon} getExpiryStatus={getExpiryStatus} />
            ))}
          </div>
        )}
      </div>

      {/* Category folders */}
      {!searchFiltered && (
        <div style={{padding:".75rem 1.1rem"}}>
          {documents.length === 0 ? (
            <div className="empty" style={{padding:"2rem .5rem"}}>
              <span className="ei">📂</span>
              <strong>No documents yet</strong>
              <p>Store your deed, mortgage, inspection report, insurance policy, and any other important home documents — all in one secure place</p>
              <button className="btn btn-primary" onClick={()=>openNew()}>＋ Add your first document</button>
            </div>
          ) : (
            DOC_CATEGORIES.map(cat => {
              const catDocs = documents.filter(d=>d.category===cat.id);
              const isOpen = expanded[cat.id];
              const expiringCount = catDocs.filter(d=>getExpiryStatus(d.expiry_date)==="soon"||getExpiryStatus(d.expiry_date)==="expired").length;
              return (
                <div key={cat.id} className="doc-category">
                  <div className="doc-category-header" onClick={()=>toggleExpanded(cat.id)}>
                    <div className="doc-category-icon" style={{background:cat.color}}>{cat.icon}</div>
                    <div style={{flex:1}}>
                      <div className="doc-category-name">{cat.label}</div>
                      <div style={{fontSize:".7rem",color:"#A8A09A"}}>{cat.desc}</div>
                    </div>
                    <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                      {expiringCount > 0 && <span style={{fontSize:".65rem",fontWeight:700,color:"var(--red)",background:"var(--red-light)",padding:"1px 6px",borderRadius:"8px"}}>⚠️ {expiringCount}</span>}
                      {catDocs.length > 0 && <span className="doc-category-count">{catDocs.length}</span>}
                      <button className="btn btn-ghost btn-sm" style={{padding:"2px 6px",fontSize:".7rem"}} onClick={e=>{e.stopPropagation();openNew(cat.id);}}>＋</button>
                      <span className={`doc-category-arrow ${isOpen?"open":""}`}>›</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="doc-list">
                      {catDocs.length === 0 ? (
                        <div style={{padding:".8rem 1.1rem",fontSize:".82rem",color:"#A8A09A",textAlign:"center"}}>
                          No documents yet — <button className="btn btn-ghost btn-sm" onClick={()=>openNew(cat.id)}>Add one</button>
                        </div>
                      ) : catDocs.map(d => (
                        <DocItem key={d.id} doc={d} assets={assets} onEdit={openEdit} onDelete={setConfirm} onView={setLightbox} fileIcon={fileIcon} getExpiryStatus={getExpiryStatus} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {modal && (
        <Modal title={editId?"Edit Document":"Add Document"} onClose={()=>setModal(false)} onSave={save}>
          <DocumentForm data={editData} onChange={setEditData} userId={userId} assets={assets} projects={projects} planData={planData} onUpgrade={onUpgrade}/>
        </Modal>
      )}
      {confirm && <Confirm message="This document and its file will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

function DocItem({ doc, assets, onEdit, onDelete, onView, fileIcon, getExpiryStatus }) {
  const expiryStatus = getExpiryStatus(doc.expiry_date);
  const linkedAsset = doc.asset_id ? assets.find(a=>a.id===doc.asset_id) : null;
  const isImage = doc.file_url && doc.file_url.match(/\.(jpg|jpeg|png|webp|heic)/i);

  return (
    <div className="doc-item">
      <div className="doc-item-icon">{fileIcon(doc.file_type)}</div>
      <div className="doc-item-body">
        <div className="doc-item-name">{doc.name}</div>
        <div className="doc-item-meta">
          {doc.description && <span>{doc.description}</span>}
          {linkedAsset && <span style={{color:"var(--rust)"}}>🔧 {linkedAsset.item}</span>}
          {expiryStatus && (
            <span className={`doc-expiry-badge ${
              expiryStatus==="expired"?"doc-expiry-expired":
              expiryStatus==="soon"?"doc-expiry-soon":"doc-expiry-ok"
            }`}>
              {expiryStatus==="expired"?"Expired":expiryStatus==="soon"?`Expires ${fmtD(doc.expiry_date)}`:`Valid to ${fmtD(doc.expiry_date)}`}
            </span>
          )}
        </div>
      </div>
      <div className="doc-item-actions">
        {doc.file_url && (
          <button className="btn btn-ghost btn-sm" onClick={()=> isImage ? onView(doc.file_url) : window.open(doc.file_url,"_blank")} title="View">
            {isImage ? "👁️" : "↗️"}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={()=>onEdit(doc)}>Edit</button>
        <button className="btn btn-danger btn-sm" onClick={()=>onDelete(doc.id)}>✕</button>
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function Profile({ profile, setProfile, tasks, expenses, warranties, serviceLogs=[], toast, userId, onNavigate, planData, onUpgrade }) {
  const [modal, setModal] = useState(false);
  const [insModal, setInsModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [insData, setInsData] = useState({});
  const [docLightbox, setDocLightbox] = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  // Home setup completion — DB is source of truth, localStorage is fallback
  const setupDone = profile?.home_setup_complete ||
    (() => { try { return !!localStorage.getItem(`sw_setup_${userId}`); } catch { return false; } })();

  // Photo vertical position (0=top, 100=bottom) — saved to localStorage per user
  const [photoPos, setPhotoPos] = useState(() => {
    try { return parseInt(localStorage.getItem(`sw_pp_${userId}`) || "40"); } catch { return 40; }
  });
  const [showPosSlider, setShowPosSlider] = useState(false);
  const handlePhotoPos = (val) => {
    setPhotoPos(val);
    try { localStorage.setItem(`sw_pp_${userId}`, String(val)); } catch {}
  };

  const openEdit = () => { setEditData({...profile}); setModal(true); };
  const openIns  = () => { setInsData({...profile}); setInsModal(true); };

  const save = async () => {
    const payload = {...editData};
    if (typeof payload.tax_history === "object") payload.tax_history = JSON.stringify(payload.tax_history);
    if (typeof payload.price_history === "object") payload.price_history = JSON.stringify(payload.price_history);
    if (typeof payload.schools === "object") payload.schools = JSON.stringify(payload.schools);
    if(profile?.id) {
      const {error} = await supabase.from("profiles").update(payload).eq("id",profile.id).eq("user_id",userId);
      if(!error) { setProfile({...editData,id:profile.id}); toast("Home profile saved ✓"); }
      else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("profiles").insert([{...payload,user_id:userId}]).select();
      if(!error&&data) { setProfile({...editData,id:data[0].id}); toast("Home profile saved ✓"); }
      else toast("Error saving","error");
    }
    setModal(false);
  };

  const saveIns = async () => {
    const insFields = {
      ins_company:          insData.ins_company||"",
      ins_policy_number:    insData.ins_policy_number||"",
      ins_agent_name:       insData.ins_agent_name||"",
      ins_agent_phone:      insData.ins_agent_phone||"",
      ins_premium:          insData.ins_premium||"",
      ins_deductible:       insData.ins_deductible||"",
      ins_dwelling_coverage:insData.ins_dwelling_coverage||"",
      ins_liability_coverage:insData.ins_liability_coverage||"",
      ins_renewal_date:     insData.ins_renewal_date||"",
      ins_notes:            insData.ins_notes||"",
    };
    if(profile?.id) {
      const {error} = await supabase.from("profiles").update(insFields).eq("id",profile.id).eq("user_id",userId);
      if(!error) { setProfile({...profile,...insFields}); toast("Insurance saved ✓"); }
      else toast("Error saving","error");
    }
    setInsModal(false);
  };

  // Parse JSON fields
  const taxHistory  = (() => { try { return typeof profile?.tax_history==="string"?JSON.parse(profile.tax_history):(profile?.tax_history||[]); } catch { return []; } })();
  const priceHistory = (() => { try { return typeof profile?.price_history==="string"?JSON.parse(profile.price_history):(profile?.price_history||[]); } catch { return []; } })();
  const schools     = (() => { try { return typeof profile?.schools==="string"?JSON.parse(profile.schools):(profile?.schools||[]); } catch { return []; } })();

  // Value calculations
  const zestimate    = Number(profile?.zestimate||0);
  const lastSalePrice= Number(profile?.last_sale_price||0);
  const appreciation = zestimate > 0 && lastSalePrice > 0 ? zestimate - lastSalePrice : null;
  const appreciationPct = appreciation && lastSalePrice > 0 ? ((appreciation/lastSalePrice)*100).toFixed(1) : null;

  // Home age
  const homeAge = profile?.year ? new Date().getFullYear() - Number(profile.year) : null;

  // System age warnings — linked to real assets where available
  const SYSTEMS = [
    {name:"HVAC System",          icon:"🌡️", lifespan:20, ageNote:"15–20 year lifespan", categories:["HVAC"],        keywords:["hvac","heat","air","furnace","ac","cooling"]},
    {name:"Water Heater",         icon:"🚿", lifespan:12, ageNote:"10–15 year lifespan", categories:["Plumbing"],    keywords:["water heater","hot water"]},
    {name:"Roof",                 icon:"🏚️", lifespan:25, ageNote:"20–30 year lifespan", categories:["Roofing"],     keywords:["roof"]},
    {name:"Electrical Panel",     icon:"⚡", lifespan:40, ageNote:"30–40 year lifespan", categories:["Electrical"],  keywords:["panel","electrical","breaker"]},
    {name:"Plumbing",             icon:"🛠️", lifespan:50, ageNote:"40–70 year lifespan", categories:["Plumbing"],    keywords:["plumbing","pipe"]},
  ];

  const systemAlerts = homeAge ? SYSTEMS.map(s => {
    // Try to find a matching asset — check category and item name keywords
    const linkedAsset = warranties.find(a => {
      const catMatch = s.categories.includes(a.category);
      const nameMatch = s.keywords.some(kw => a.item?.toLowerCase().includes(kw));
      return catMatch || nameMatch;
    }) || null;

    let ageYears, status, detail, fromAsset;

    if (linkedAsset) {
      // Use actual asset data
      const installDate = linkedAsset.install_date || linkedAsset.purchase_date;
      ageYears = installDate
        ? Math.floor((new Date() - new Date(installDate + "T00:00:00")) / (365.25 * 86400000))
        : homeAge;
      const lifespan = Number(linkedAsset.lifespan_years || s.lifespan);
      const pct = ageYears / lifespan;

      // Condition overrides age calculation
      if (linkedAsset.condition === "Good") {
        status = "ok";
      } else if (linkedAsset.condition === "Failed") {
        status = "alert";
      } else if (linkedAsset.condition === "Needs Attention") {
        status = "warn";
      } else {
        status = pct >= 1 ? "alert" : pct >= 0.75 ? "warn" : "ok";
      }

      fromAsset = true;
      detail = `${linkedAsset.item}${installDate ? ` · installed ${fmtD(installDate)}` : ""} · ${ageYears}yr old`;
    } else {
      // Fall back to home age estimate
      const pct = homeAge / s.lifespan;
      status = pct >= 1 ? "alert" : pct >= 0.75 ? "warn" : "ok";
      ageYears = homeAge;
      fromAsset = false;
      detail = `${s.ageNote} · estimated from home age (${homeAge}yr)`;
    }

    return {...s, ageYears, status, detail, fromAsset, linkedAsset};
  }) : [];

  // Insurance renewal
  const insRenewalDays = profile?.ins_renewal_date ? daysTo(profile.ins_renewal_date) : null;
  const insRenewalStatus = insRenewalDays === null ? null : insRenewalDays < 0 ? "expired" : insRenewalDays <= 30 ? "urgent" : insRenewalDays <= 90 ? "soon" : "ok";

  // Stats — match Tasks tab: expenses + service log costs
  const serviceLogTotal = serviceLogs.reduce((s,l)=>s+Number(l.cost||0),0);
  const totalCost = expenses.reduce((s,e)=>s+Number(e.amount||0),0) + serviceLogTotal;
  const activeW   = warranties.filter(w=>{ const d=daysTo(w.expiry_date); return d!==null&&d>=0; }).length;

  const schoolRatingColor = r => !r ? "#C2B8AE" : r>=8 ? "#1A7A44" : r>=6 ? "#E0A84A" : "#B91C1C";

  // Empty state
  if (!profile?.name && !profile?.address) {
    return (
      <div>
        <div className="sh"><span className="sh-title">My Home</span></div>
        <div style={{textAlign:"center",padding:"3rem 1.5rem",background:"var(--white)",borderRadius:"var(--r)",border:"2px dashed var(--stone)"}}>
          <div style={{fontSize:"2.8rem",marginBottom:".8rem"}}>🏡</div>
          <strong style={{fontFamily:"'Fraunces',serif",fontSize:"1.1rem"}}>Set up your home profile</strong>
          <p style={{fontSize:".84rem",color:"#A8A09A",margin:".5rem 0 1.2rem",lineHeight:1.6}}>Add your address to auto-fill your home's details — year built, tax history, school ratings, and more</p>
          <button className="btn btn-primary" onClick={openEdit}>Get Started →</button>
        </div>
        {modal && <Modal title="Edit Home Profile" onClose={()=>setModal(false)} onSave={save}><ProfileForm data={editData} onChange={setEditData} userId={userId} photoPos={photoPos} onPhotoPos={handlePhotoPos}/></Modal>}
      </div>
    );
  }

  return (
    <div>
      <div className="sh">
        <span className="sh-title">My Home</span>
        <button className="btn btn-ghost" onClick={openEdit}>✏️ Edit</button>
      </div>

      {/* ── Home Setup Banner ── */}
      {showSetup ? (
        <div className="wizard-card" style={{marginBottom:"1rem"}}>
          <HomeSetupWizard
            existingAssets={warranties}
            profile={profile}
            setProfile={setProfile}
            toast={toast}
            userId={userId}
            planData={planData}
            onComplete={()=>setShowSetup(false)}
          />
        </div>
      ) : setupDone ? (
        <div className="setup-done">✓ Home profile set up · <button className="btn btn-ghost btn-sm" onClick={()=>setShowSetup(true)}>Update</button></div>
      ) : (
        <div className="setup-banner">
          <div className="setup-banner-text">
            <strong>Set up your home profile</strong>
            <p>Tell us about your systems and we'll build a custom maintenance schedule, populate your assets, and suggest projects — all in one step.</p>
          </div>
          <button className="btn btn-primary" onClick={()=>setShowSetup(true)}>Get started →</button>
        </div>
      )}
      {(profile?.user_photo_url || profile?.photo_url) ? (
        <div style={{marginBottom:"1rem"}}>
          <div className="home-hero">
            <img
              className="home-hero-photo"
              src={profile.user_photo_url || profile.photo_url}
              alt="Your home"
              style={{objectPosition:`center ${photoPos}%`}}
              onError={e=>{ if(e.target.src!==profile.photo_url) e.target.src=profile.photo_url; else e.target.style.display="none"; }}
            />
            <div className="home-hero-overlay">
              <div className="home-hero-name">{profile.name || "My Home"}</div>
              {profile.address && <div className="home-hero-address">📍 {profile.address}</div>}
              {homeAge && <div style={{fontSize:".7rem",color:"rgba(255,255,255,.5)",marginTop:"3px"}}>Built {profile.year} · {homeAge} years old</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="home-hero-no-photo" style={{marginBottom:"1rem"}}>
          <div className="home-hero-name">{profile.name || "My Home"}</div>
          {profile.address && <div className="home-hero-address">📍 {profile.address}</div>}
          {homeAge && <div style={{fontSize:".7rem",color:"rgba(255,255,255,.4)",marginTop:"3px"}}>Built {profile.year} · {homeAge} years old</div>}
        </div>
      )}

      {/* ── Home Value Hero ── */}
      {zestimate > 0 && (
        <div className="value-hero">
          <div className="value-hero-label">Estimated home value</div>
          <div className="value-hero-amount">{fmt$(zestimate)}</div>
          <div className="value-hero-row">
            {lastSalePrice > 0 && (
              <div className="value-hero-stat">
                <div className="value-hero-stat-val">{fmt$(lastSalePrice)}</div>
                <div className="value-hero-stat-label">Purchase price{profile.last_sale_date?` · ${fmtD(profile.last_sale_date)}`:""}</div>
              </div>
            )}
            {profile.rent_zestimate > 0 && (
              <div className="value-hero-stat">
                <div className="value-hero-stat-val">{fmt$(profile.rent_zestimate)}/mo</div>
                <div className="value-hero-stat-label">Rent estimate</div>
              </div>
            )}
          </div>
          {appreciation !== null && (
            <div className={`value-appreciation ${appreciation >= 0 ? "appreciation-pos" : "appreciation-neg"}`}>
              {appreciation >= 0 ? "↑" : "↓"} {fmt$(Math.abs(appreciation))} ({appreciationPct}%) estimated appreciation
            </div>
          )}
        </div>
      )}

      {/* ── Property Details ── */}
      <div className="home-section">
        <div className="home-section-header">
          <span className="home-section-title">🏠 Property Details</span>
        </div>
        <div className="home-section-body">
          <div className="home-facts">
            {[
              {label:"Type",         val:profile?.type},
              {label:"Year Built",   val:profile?.year},
              {label:"Square Feet",  val:profile?.sqft?Number(profile.sqft).toLocaleString()+" sqft":null},
              {label:"Bedrooms",     val:profile?.bedrooms},
              {label:"Bathrooms",    val:profile?.bathrooms},
              {label:"Lot Size",     val:profile?.lot_size},
              {label:"HOA Fee",      val:profile?.hoa_fee?"$"+Number(profile.hoa_fee).toLocaleString()+"/mo":null},
            ].filter(f=>f.val).map(f=>(
              <div key={f.label} className="home-fact">
                <div className="home-fact-label">{f.label}</div>
                <div className="home-fact-val">{f.val}</div>
              </div>
            ))}
          </div>

          {/* Home age context */}
          {homeAge && (
            <div className="home-age-badge">
              🏠 Your home is <strong>{homeAge} years old</strong>
              {homeAge >= 20 && " — some major systems may be nearing end of life"}
              {homeAge < 10 && " — most systems should still be in good shape"}
            </div>
          )}

          {/* System age alerts */}
          {systemAlerts.length > 0 && homeAge >= 10 && (
            <div className="system-age-list">
              {systemAlerts.filter(s=>s.status!=="ok").map((s,i)=>(
                <div
                  key={i}
                  className={`system-age-item ${s.status} ${onNavigate?"clickable":""}`}
                  onClick={() => onNavigate && onNavigate("warranties")}
                >
                  <span className="system-age-icon">{s.icon}</span>
                  <div style={{flex:1}}>
                    <div className="system-age-name">
                      {s.name}
                      {s.fromAsset && (
                        <span style={{fontSize:".65rem",fontWeight:400,color:"#A8A09A",marginLeft:"6px"}}>
                          linked to asset
                        </span>
                      )}
                    </div>
                    <div className="system-age-detail">{s.detail}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"3px",flexShrink:0}}>
                    <span style={{fontSize:".7rem",fontWeight:700,color:s.status==="alert"?"var(--red)":"#92610A"}}>
                      {s.status==="alert"?"Past lifespan":"Aging"}
                    </span>
                    {onNavigate && (
                      <span style={{fontSize:".65rem",color:"#A8A09A"}}>
                        {s.fromAsset ? "Update asset →" : "Add to assets →"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div style={{fontSize:".7rem",color:"#A8A09A",marginTop:".3rem",paddingLeft:".2rem"}}>
                💡 Add these systems to your Assets tab to track their actual age and condition
              </div>
            </div>
          )}

          {profile?.notes && (
            <div style={{marginTop:".85rem",padding:".75rem .9rem",background:"var(--cream)",borderRadius:"var(--r-sm)"}}>
              <div style={{fontSize:".62rem",textTransform:"uppercase",letterSpacing:".8px",color:"#A8A09A",fontWeight:600,marginBottom:"4px"}}>Notes</div>
              <p style={{fontSize:".85rem",lineHeight:1.6,color:"#4A4440"}}>{profile.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Insurance ── */}
      <div className="home-section">
        <div className="home-section-header">
          <span className="home-section-title">🛡️ Homeowners Insurance</span>
          <button className="btn btn-ghost btn-sm" onClick={openIns}>
            {profile?.ins_company ? "✏️ Edit" : "＋ Add"}
          </button>
        </div>
        {profile?.ins_company ? (
          <div>
            {/* Renewal banner */}
            {insRenewalStatus && (
              <div className={`ins-renewal-banner ${
                insRenewalStatus==="expired"||insRenewalStatus==="urgent" ? "ins-renewal-urgent" :
                insRenewalStatus==="soon" ? "ins-renewal-soon" : "ins-renewal-ok"
              }`}>
                {insRenewalStatus==="ok" && "✓"}
                {insRenewalStatus==="soon" && "⚠️"}
                {(insRenewalStatus==="urgent"||insRenewalStatus==="expired") && "🚨"}
                {insRenewalStatus==="ok" && ` Policy renews ${fmtD(profile.ins_renewal_date)} — ${insRenewalDays} days away`}
                {insRenewalStatus==="soon" && ` Policy renews in ${insRenewalDays} days — ${fmtD(profile.ins_renewal_date)}`}
                {insRenewalStatus==="urgent" && ` Policy renews in ${insRenewalDays} days — contact your agent soon`}
                {insRenewalStatus==="expired" && ` Policy renewal date has passed — verify your coverage`}
              </div>
            )}
            <div className="ins-header">
              <div className="ins-header-icon">🛡️</div>
              <div className="ins-header-body">
                <div className="ins-company">{profile.ins_company}</div>
                {profile.ins_policy_number && <div className="ins-policy">Policy #{profile.ins_policy_number}</div>}
              </div>
            </div>
            <div className="ins-grid">
              {[
                {label:"Annual Premium",    val:profile.ins_premium?"$"+Number(profile.ins_premium).toLocaleString():null},
                {label:"Deductible",        val:profile.ins_deductible?"$"+Number(profile.ins_deductible).toLocaleString():null},
                {label:"Dwelling Coverage", val:profile.ins_dwelling_coverage?"$"+Number(profile.ins_dwelling_coverage).toLocaleString():null},
                {label:"Liability",         val:profile.ins_liability_coverage?"$"+Number(profile.ins_liability_coverage).toLocaleString():null},
                {label:"Agent",             val:profile.ins_agent_name||null},
                {label:"Agent Phone",       val:profile.ins_agent_phone||null},
                {label:"Renewal Date",      val:profile.ins_renewal_date?fmtD(profile.ins_renewal_date):null},
              ].filter(f=>f.val).map(f=>(
                <div key={f.label} className="ins-field">
                  <div className="ins-field-label">{f.label}</div>
                  <div className="ins-field-val">{f.val}</div>
                </div>
              ))}
            </div>
            {profile.ins_notes && (
              <div style={{padding:".6rem 1.1rem",borderTop:"1px solid var(--stone)",fontSize:".8rem",color:"#7A7370",lineHeight:1.5}}>
                {profile.ins_notes}
              </div>
            )}
          </div>
        ) : (
          <div className="home-section-body">
            <div className="ins-empty" onClick={openIns}>
              <div className="ins-empty-icon">🛡️</div>
              <div className="ins-empty-title">Add your insurance policy</div>
              <div className="ins-empty-sub">Store your policy number, agent contact, coverage amounts, and renewal date</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Home Stats ── */}
      <div className="home-section">
        <div className="home-section-header">
          <span className="home-section-title">📊 Home at a Glance</span>
        </div>
        <div className="home-section-body">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:".65rem"}}>
            {[
              {label:"Total Tasks",      val:tasks.length,                                   sub:"maintenance records",color:"var(--sky)"},
              {label:"Completed",        val:tasks.filter(t=>t.status==="Completed").length,  sub:"tasks done",        color:"var(--sage)"},
              {label:"Active Warranties",val:activeW,                                         sub:"assets covered",     color:"#B8861E"},
              {label:"Lifetime Spend",   val:fmt$(totalCost),                                 sub:"tracked",           color:"var(--rust)"},
            ].map(s=>(
              <div key={s.label} style={{background:"var(--cream)",border:"1px solid var(--stone)",borderRadius:"var(--r-sm)",padding:".8rem .9rem"}}>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.5rem",fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:".68rem",color:"#A8A09A",marginTop:"3px",fontWeight:600,letterSpacing:".3px"}}>{s.label}</div>
                <div style={{fontSize:".65rem",color:"#C2B8AE"}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Financial Data ── */}
      {(taxHistory.length > 0 || priceHistory.length > 0) && (
        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-title">💰 Financial History</span>
          </div>
          <div className="home-section-body" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
            {taxHistory.length > 0 && (
              <div>
                <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".8px",textTransform:"uppercase",color:"#A8A09A",marginBottom:".6rem"}}>Property Tax History</div>
                {taxHistory.map((t,i)=>(
                  <div key={i} className="tax-row">
                    <span className="tax-year">{t.year}</span>
                    <span className="tax-val">Tax: <strong>{t.tax_paid?"$"+Number(t.tax_paid).toLocaleString():"—"}</strong></span>
                    <span className="tax-val">Assessed: <strong>{t.assessed_value?"$"+Number(t.assessed_value).toLocaleString():"—"}</strong></span>
                  </div>
                ))}
              </div>
            )}
            {priceHistory.length > 0 && (
              <div>
                <div style={{fontSize:".7rem",fontWeight:700,letterSpacing:".8px",textTransform:"uppercase",color:"#A8A09A",marginBottom:".6rem"}}>Price History</div>
                {priceHistory.slice(0,8).map((h,i)=>{
                  const isSold=h.event?.toLowerCase().includes("sold");
                  const isListed=h.event?.toLowerCase().includes("list");
                  return (
                    <div key={i} className="price-event">
                      <div className="price-event-dot" style={{background:isSold?"#1A7A44":isListed?"#4A89B8":"#C2B8AE"}}/>
                      <span className="price-event-label">{h.event}{h.date?" · "+h.date:""}</span>
                      <span className="price-event-val">{h.price?"$"+Number(h.price).toLocaleString():"—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Neighborhood ── */}
      {schools.length > 0 && (
        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-title">🎓 Nearby Schools</span>
          </div>
          <div className="home-section-body">
            {schools.map((s,i)=>(
              <div key={i} className="school-item">
                <div className="school-rating" style={{background:schoolRatingColor(s.rating)+"22",color:schoolRatingColor(s.rating)}}>{s.rating||"?"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="school-name">{s.name}</div>
                  <div className="school-meta">{[s.grades,s.distance?s.distance+" mi":null].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Document Vault ── */}
      <DocumentVault
        userId={userId}
        warranties={warranties}
        lightbox={docLightbox}
        setLightbox={setDocLightbox}
        planData={planData}
        onUpgrade={onUpgrade}
      />
      {docLightbox && <Lightbox src={docLightbox} onClose={()=>setDocLightbox(null)}/>}

      {modal && <Modal title="Edit Home Profile" onClose={()=>setModal(false)} onSave={save}><ProfileForm data={editData} onChange={setEditData} userId={userId} photoPos={photoPos} onPhotoPos={handlePhotoPos}/></Modal>}
      {insModal && <Modal title={profile?.ins_company?"Edit Insurance":"Add Insurance"} onClose={()=>setInsModal(false)} onSave={saveIns}><InsuranceForm data={insData} onChange={setInsData} planData={planData} onUpgrade={onUpgrade}/></Modal>}
    </div>
  );
}


// ─── APP ROOT ─────────────────────────────────────────────────────────────────
// ─── HOME PROFILE GENERATION ENGINE ──────────────────────────────────────────
//
// generateHomeProfile(answers) → { assets, tasks, utilities, projects }
//
// Pure function — no Supabase, no React, no side effects.
// The wizard UI calls this and shows a review screen before any DB writes.
//
// Answers shape:
// {
//   hvac:      { hasCentralAC, acType, acAge, hasFurnace, furnaceFuel, furnaceAge, hasHumidifier, notes }
//   water:     { source, hasPressureTank, hasWaterHeater, heaterType, heaterAge, hasSoftener, notes }
//   structure: { roofType, roofAge, exteriorType, foundationType, hasChimney, notes }
//   extras:    { hasPool, poolType, poolChemistry, hasIrrigation, hasSolar, hasSeptic, hasGenerator, notes }
//   custom:    string  (free-form, stored as a note for manual follow-up)
// }
//
// Output:
//   assets   → ready to insert into warranties table (minus user_id)
//   tasks    → ready to insert into tasks table (minus user_id, asset_id resolved after insert)
//   utilities → string[] of suggested utility types to start tracking
//   projects → ready to insert into projects table (minus user_id)
//
// Internal fields stripped before DB insert:
//   asset._key     → unique string used to link tasks to their parent asset
//   task._assetKey → matches asset._key; resolved to real asset_id after insert
//
// ─────────────────────────────────────────────────────────────────────────────

function generateHomeProfile(answers) {
  const now     = new Date();
  const yr      = now.getFullYear();
  const assets  = [];
  const tasks   = [];
  const projects= [];
  const utilSet = new Set(["Electric"]); // Electric is universal

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Estimated install year from age bracket
  const installYr = (age) => {
    if (!age) return null;
    const mid = { "0-5":2, "6-10":8, "11-15":13, "16+":20 };
    return yr - (mid[age] || 0);
  };

  // Due date string N days from today
  const dueIn = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return localISO(d);
  };

  // Age urgency helpers
  const isOld  = (age) => age === "16+";
  const isAging= (age) => age === "11-15";
  const isMid  = (age) => age === "6-10";

  // Priority based on age
  const agePriority = (age) => isOld(age) ? "Urgent" : isAging(age) ? "High" : "Medium";

  // Add an asset (ready for warranties table insert)
  const addAsset = (key, item, category, opts = {}) => {
    assets.push({ _key: key, item, category, condition: "Good", ...opts });
  };

  // Add a task (ready for tasks table insert)
  const addTask = (assetKey, title, recurring, opts = {}) => {
    tasks.push({
      _assetKey: assetKey,
      title,
      recurring: recurring || "",
      status:    "Scheduled",
      priority:  "Medium",
      due_date:  dueIn(30),
      category:  opts.category || null,
      notes:     opts.notes    || "",
      ...opts,
    });
  };

  // Add a suggested project (ready for projects table insert)
  const addProject = (name, description, budget, notes = "") => {
    projects.push({
      name,
      description,
      budget,
      status:     "Planning",
      start_date: localISO(now),
      notes,
    });
  };

  const { hvac, water, structure, extras, custom } = answers;

  // ── HVAC ─────────────────────────────────────────────────────────────────────

  if (hvac?.hasCentralAC) {
    const isHeatPump = hvac.acType === "heat_pump" || hvac.acType === "both";
    const label      = isHeatPump ? "Heat Pump" : "Central AC Unit";
    const year       = installYr(hvac.acAge);

    addAsset("hvac_ac", label, "HVAC", {
      notes: [
        hvac.acType ? `Type: ${hvac.acType.replace(/_/g," ")}` : null,
        hvac.acAge  ? `Age: ${hvac.acAge} years` : null,
        year        ? `Est. installed: ${year}` : null,
      ].filter(Boolean).join(" · "),
    });

    // Filter — monthly regardless of type
    addTask("hvac_ac", "Replace HVAC filter", "monthly", {
      priority: "High",
      due_date: dueIn(14),
      category: "HVAC",
      notes: "Replace 1-inch filters monthly, 4-inch media filters every 3-6 months",
    });

    // Seasonal tune-up
    addTask("hvac_ac", isHeatPump ? "Heat pump seasonal service" : "AC tune-up (spring)", "every 6 months", {
      priority: "Medium",
      due_date: dueIn(45),
      category: "HVAC",
      notes: "Refrigerant check, coil cleaning, electrical inspection, thermostat calibration",
    });

    // Age-based tasks and projects
    if (isAging(hvac.acAge)) {
      addTask("hvac_ac", `${label} efficiency inspection`, "annually", {
        priority: "High",
        due_date: dueIn(30),
        category: "HVAC",
        notes: "System entering later life — check for refrigerant leaks, failing capacitors, compressor wear",
      });
      addProject(
        `${label} Replacement Planning`,
        `Your ${label.toLowerCase()} is 11-15 years old. Central AC units typically last 15-20 years. Get a professional assessment and start budgeting for replacement within 3-7 years.`,
        isHeatPump ? 6000 : 9000,
        "Recommended timeline: 3-7 years"
      );
    }

    if (isOld(hvac.acAge)) {
      addTask("hvac_ac", `${label} replacement assessment`, "", {
        priority: "Urgent",
        due_date: dueIn(7),
        category: "HVAC",
        notes: "System is past typical lifespan — evaluate replacement immediately to avoid failure during peak season",
      });
      addProject(
        `${label} Replacement — Priority`,
        `Your ${label.toLowerCase()} is 16+ years old, past its expected lifespan. Schedule a replacement assessment immediately.`,
        isHeatPump ? 7000 : 11000,
        "Recommended timeline: 0-2 years"
      );
    }
  }

  if (hvac?.hasFurnace) {
    const fuelMap = { gas:"Gas", oil:"Oil", electric:"Electric", propane:"Propane" };
    const fuel    = fuelMap[hvac.furnaceFuel] || "";
    const label   = `${fuel} Furnace`.trim();
    const year    = installYr(hvac.furnaceAge);

    addAsset("hvac_furnace", label, "HVAC", {
      notes: [
        fuel        ? `Fuel: ${fuel}` : null,
        hvac.furnaceAge ? `Age: ${hvac.furnaceAge} years` : null,
        year        ? `Est. installed: ${year}` : null,
      ].filter(Boolean).join(" · "),
    });

    addTask("hvac_furnace", "Annual furnace tune-up and inspection", "annually", {
      priority: "High",
      due_date: dueIn(60),
      category: "HVAC",
      notes: "Clean burners, check heat exchanger for cracks, inspect flue, test safety controls",
    });

    addTask("hvac_furnace", "Test carbon monoxide detectors", "annually", {
      _assetKey: null,
      priority: "High",
      due_date: dueIn(30),
      category: "Safety",
      notes: "Essential for all gas and oil heating — replace CO detectors every 7 years",
    });

    // Fuel-specific
    if (hvac.furnaceFuel === "gas") {
      utilSet.add("Natural Gas");
      addTask("hvac_furnace", "Check gas connections and smell for leaks", "annually", {
        priority: "High",
        due_date: dueIn(45),
        category: "HVAC",
        notes: "Inspect all accessible gas lines — call utility immediately if any odor detected",
      });
    }
    if (hvac.furnaceFuel === "oil") {
      utilSet.add("Heating Oil");
      addTask("hvac_furnace", "Oil furnace annual service and cleaning", "annually", {
        priority: "High",
        due_date: dueIn(45),
        category: "HVAC",
        notes: "Replace oil filter, nozzle, and strainer — clean combustion chamber",
      });
      addTask("hvac_furnace", "Monitor oil tank level", "monthly", {
        priority: "Medium",
        due_date: dueIn(14),
        category: "HVAC",
      });
    }
    if (hvac.furnaceFuel === "propane") {
      utilSet.add("Propane");
      addTask("hvac_furnace", "Check propane tank level", "monthly", {
        priority: "Medium",
        due_date: dueIn(14),
        category: "HVAC",
        notes: "Schedule refill before tank drops below 20% — never let it run empty",
      });
    }

    if (isAging(hvac.furnaceAge)) {
      addProject(
        `${label} Replacement Planning`,
        `Your ${label.toLowerCase()} is 11-15 years old. Gas furnaces typically last 15-20 years. Get a professional assessment and start budgeting.`,
        fuel === "Gas" ? 3500 : 4500,
        "Recommended timeline: 3-7 years"
      );
    }
    if (isOld(hvac.furnaceAge)) {
      addTask("hvac_furnace", `${label} replacement assessment — urgent`, "", {
        priority: "Urgent",
        due_date: dueIn(7),
        category: "HVAC",
        notes: "System is 16+ years old — inspect heat exchanger for cracks (CO risk) and plan replacement",
      });
      addProject(
        `${label} Replacement — Priority`,
        `Your ${label.toLowerCase()} is 16+ years old. Cracked heat exchangers in aging furnaces can leak carbon monoxide. Replace soon.`,
        fuel === "Gas" ? 4000 : 5500,
        "Recommended timeline: 0-2 years"
      );
    }
  }

  if (hvac?.hasHumidifier) {
    addAsset("humidifier", "Whole-House Humidifier", "HVAC", {
      notes: "Whole-house humidifier — attached to HVAC system",
    });
    addTask("humidifier", "Replace humidifier water panel / evaporator pad", "annually", {
      priority: "Medium",
      due_date: dueIn(60),
      category: "HVAC",
      notes: "Replace at start of heating season. Check for scale buildup and mineral deposits.",
    });
    addTask("humidifier", "Clean humidifier reservoir and water distribution tray", "annually", {
      priority: "Low",
      due_date: dueIn(90),
      category: "HVAC",
    });
  }

  if (hvac?.notes?.trim()) {
    assets.push({
      _key:      "hvac_custom",
      item:      hvac.notes.trim(),
      category:  "HVAC",
      condition: "Good",
      notes:     "Added from home setup — review and add maintenance tasks manually",
    });
  }

  // ── WATER ────────────────────────────────────────────────────────────────────

  if (water?.source === "city" || water?.source === "both") {
    utilSet.add("Water");
  }

  if (water?.source === "well" || water?.source === "both") {
    addAsset("well", "Well & Pump System", "Plumbing", {
      notes: [
        "Water source: private well",
        water.hasPressureTank ? "Has pressure tank" : null,
      ].filter(Boolean).join(" · "),
    });

    addTask("well", "Annual well water quality test", "annually", {
      priority: "High",
      due_date: dueIn(30),
      category: "Plumbing",
      notes: "Test for bacteria (coliform), nitrates, pH, hardness, and any local contaminants of concern",
    });

    addTask("well", "Well pump and system inspection", "annually", {
      priority: "Medium",
      due_date: dueIn(60),
      category: "Plumbing",
      notes: "Check pump pressure, flow rate, electrical connections, and wellhead seal",
    });

    if (water.hasPressureTank) {
      addTask("well", "Pressure tank inspection", "every 6 months", {
        priority: "Medium",
        due_date: dueIn(45),
        category: "Plumbing",
        notes: "Check air charge pressure, listen for waterlogged tank (short cycling pump is a sign), inspect bladder",
      });
    }
  }

  if (water?.hasWaterHeater) {
    const isTankless = water.heaterType === "tankless";
    const label      = isTankless ? "Tankless Water Heater" : "Water Heater (Tank)";
    const year       = installYr(water.heaterAge);

    addAsset("water_heater", label, "Plumbing", {
      notes: [
        `Type: ${isTankless ? "Tankless/on-demand" : "Storage tank"}`,
        water.heaterAge ? `Age: ${water.heaterAge} years` : null,
        year ? `Est. installed: ${year}` : null,
      ].filter(Boolean).join(" · "),
    });

    if (isTankless) {
      addTask("water_heater", "Descale and flush tankless water heater", "annually", {
        priority: "High",
        due_date: dueIn(45),
        category: "Plumbing",
        notes: "Mineral buildup reduces efficiency — use white vinegar or descaling solution through heat exchanger",
      });
      addTask("water_heater", "Inspect tankless water heater inlet filter screens", "every 6 months", {
        priority: "Low",
        due_date: dueIn(30),
        category: "Plumbing",
        notes: "Remove and clean inlet screens to maintain flow rate",
      });

      if (isOld(water.heaterAge)) {
        addProject(
          "Tankless Water Heater Replacement Planning",
          "Your tankless water heater is 16+ years old. Tankless units typically last 20+ years but should be inspected annually at this age.",
          2800,
          "Recommended timeline: 2-5 years"
        );
      }
    } else {
      addTask("water_heater", "Flush water heater tank", "annually", {
        priority: "Medium",
        due_date: dueIn(30),
        category: "Plumbing",
        notes: "Flush sediment from bottom of tank annually to maintain efficiency and extend lifespan",
      });
      addTask("water_heater", "Inspect water heater anode rod", "annually", {
        priority: "Medium",
        due_date: dueIn(60),
        category: "Plumbing",
        notes: "Replace if more than 50% depleted. Sacrificial anode rod prevents tank corrosion.",
      });
      addTask("water_heater", "Test pressure relief valve (T&P valve)", "annually", {
        priority: "High",
        due_date: dueIn(45),
        category: "Plumbing",
        notes: "Lift lever briefly to verify it opens and closes — replace if it drips after testing",
      });

      if (isAging(water.heaterAge)) {
        addTask("water_heater", "Water heater inspection — mid-life assessment", "", {
          priority: "High",
          due_date: dueIn(14),
          category: "Plumbing",
          notes: "Tank is 11-15 years old (typical lifespan is 8-12 years). Inspect for rust, corrosion, and leaks. Plan replacement.",
        });
        addProject(
          "Water Heater Replacement",
          "Your tank water heater is 11-15 years old — past the typical 8-12 year lifespan. Replace proactively to avoid a failed water heater causing water damage.",
          1300,
          "Recommended timeline: 0-2 years"
        );
      }

      if (isOld(water.heaterAge)) {
        addTask("water_heater", "Replace water heater — past expected lifespan", "", {
          priority: "Urgent",
          due_date: dueIn(7),
          category: "Plumbing",
          notes: "Water heater is 16+ years old. A failed tank can cause significant water damage. Replace immediately.",
        });
        addProject(
          "Water Heater Replacement — Urgent",
          "Your tank water heater is 16+ years old and well past its expected lifespan. A failing water heater can cause flooding and water damage. Replace now.",
          1500,
          "Recommended timeline: Immediate"
        );
      }
    }
  }

  if (water?.hasSoftener) {
    addAsset("softener", "Water Softener", "Plumbing", {
      notes: "Whole-house water softening system",
    });
    addTask("softener", "Refill water softener salt", "monthly", {
      priority: "Low",
      due_date: dueIn(14),
      category: "Plumbing",
      notes: "Keep brine tank at least half full. Use pellet salt for cleaner operation.",
    });
    addTask("softener", "Clean water softener brine tank", "annually", {
      priority: "Low",
      due_date: dueIn(90),
      category: "Plumbing",
      notes: "Flush brine tank and remove salt bridges or mushing annually",
    });
    addTask("softener", "Check water softener regeneration schedule", "every 6 months", {
      priority: "Low",
      due_date: dueIn(60),
      category: "Plumbing",
      notes: "Adjust regeneration frequency based on water usage and hardness level",
    });
  }

  if (water?.notes?.trim()) {
    assets.push({
      _key:      "water_custom",
      item:      water.notes.trim(),
      category:  "Plumbing",
      condition: "Good",
      notes:     "Added from home setup — review and add maintenance tasks manually",
    });
  }

  // ── STRUCTURE ────────────────────────────────────────────────────────────────

  // Roof
  const roofLabels = {
    shingle: "Roof (Asphalt Shingle)",
    metal:   "Roof (Metal)",
    tile:    "Roof (Tile/Clay)",
    flat:    "Roof (Flat/Built-Up)",
    unknown: "Roof",
  };

  const roofLabel = roofLabels[structure?.roofType] || "Roof";
  const roofYear  = installYr(structure?.roofAge);

  addAsset("roof", roofLabel, "Roofing", {
    notes: [
      structure?.roofType && structure.roofType !== "unknown" ? `Type: ${structure.roofType.replace(/_/g," ")}` : null,
      structure?.roofAge  ? `Age: ${structure.roofAge} years` : null,
      roofYear            ? `Est. installed: ${roofYear}` : null,
    ].filter(Boolean).join(" · "),
  });

  addTask("roof", "Annual roof inspection", "annually", {
    priority: "Medium",
    due_date: dueIn(60),
    category: "Roofing",
    notes: "Check for missing, cracked, or curling shingles; damaged flashing; moss or algae growth; and deteriorating caulk around penetrations",
  });

  addTask("roof", "Gutter cleaning and inspection", "every 6 months", {
    priority: "Medium",
    due_date: dueIn(45),
    category: "Roofing",
    notes: "Clear debris, check for sags or separations, flush downspouts, verify water flows away from foundation",
  });

  if (structure?.roofType === "flat") {
    addTask("roof", "Clear flat roof drains and scuppers", "quarterly", {
      priority: "High",
      due_date: dueIn(14),
      category: "Roofing",
      notes: "Blocked drains cause ponding water which rapidly degrades flat roof membranes",
    });
    addTask("roof", "Inspect flat roof membrane for blistering or seam failure", "every 6 months", {
      priority: "High",
      due_date: dueIn(45),
      category: "Roofing",
      notes: "Check seams, flashings, and penetrations — patch any bubbles or open seams immediately",
    });
  }

  if (structure?.roofType === "shingle" && isAging(structure?.roofAge)) {
    addProject(
      "Roof Assessment & Replacement Planning",
      "Your asphalt shingle roof is 11-15 years old. Shingle roofs typically last 20-30 years. Get a professional inspection now and start budgeting for replacement within 5-10 years.",
      14000,
      "Recommended timeline: 5-10 years"
    );
  }
  if (structure?.roofType === "shingle" && isOld(structure?.roofAge)) {
    addProject(
      "Roof Replacement",
      "Your asphalt shingle roof is 16+ years old. Get a professional inspection immediately to assess remaining lifespan and begin replacement planning.",
      17000,
      "Recommended timeline: 0-5 years"
    );
  }
  if (structure?.roofType === "metal" && isOld(structure?.roofAge)) {
    addProject(
      "Metal Roof Restoration & Inspection",
      "Your metal roof is 16+ years old. While metal roofs can last 40-70 years, fasteners and sealants degrade. Have it professionally inspected and recoated if needed.",
      3000,
      "Recommended timeline: 0-3 years"
    );
  }

  // Exterior
  const extLabels = {
    brick:        "Brick Exterior",
    vinyl_siding: "Vinyl Siding",
    stucco:       "Stucco Exterior",
    wood:         "Wood Siding",
    mixed:        "Mixed Exterior",
  };
  const extLabel = extLabels[structure?.exteriorType] || "Exterior";

  addAsset("exterior", extLabel, "Structural", {
    notes: structure?.exteriorType
      ? `Material: ${structure.exteriorType.replace(/_/g," ")}`
      : "Exterior cladding",
  });

  const extTaskMap = {
    wood: {
      title: "Inspect and re-caulk wood siding — check for rot and peeling paint",
      notes: "Scrape and repaint any peeling areas. Seal all gaps around windows and trim. Wood typically needs repainting every 5-7 years.",
    },
    vinyl_siding: {
      title: "Clean and inspect vinyl siding",
      notes: "Power wash from top down. Check for warping, cracks, or loose panels — particularly after storms.",
    },
    stucco: {
      title: "Inspect stucco for cracks and water intrusion",
      notes: "Even hairline cracks allow moisture infiltration. Seal any cracks with elastomeric caulk before water season.",
    },
    brick: {
      title: "Inspect brick and repoint mortar joints",
      notes: "Look for spalling, efflorescence (white staining), and mortar crumbling. Tuckpoint deteriorated joints to prevent water damage.",
    },
    mixed: {
      title: "Annual exterior inspection — all materials",
      notes: "Inspect each material type separately. Pay special attention to transitions where different materials meet.",
    },
  };

  const extTask = extTaskMap[structure?.exteriorType] || { title: "Annual exterior inspection", notes: "" };
  addTask("exterior", extTask.title, "annually", {
    priority: "Low",
    due_date: dueIn(90),
    category: "Structural",
    notes: extTask.notes,
  });

  // Foundation
  if (structure?.foundationType === "crawlspace") {
    addAsset("crawlspace", "Crawl Space", "Structural", {
      notes: "Foundation type: crawl space",
    });
    addTask("crawlspace", "Inspect crawl space for moisture, mold, and pest activity", "annually", {
      priority: "High",
      due_date: dueIn(45),
      category: "Structural",
      notes: "Check vapor barrier condition, look for standing water, wood rot, mold, and signs of pest or rodent entry",
    });
    addTask("crawlspace", "Check and clean crawl space vents", "every 6 months", {
      priority: "Low",
      due_date: dueIn(30),
      category: "Structural",
      notes: "Open vents in summer, close in winter (unless conditioned crawl space — then keep sealed year-round)",
    });
  }

  if (structure?.foundationType === "basement") {
    addAsset("basement", "Basement", "Structural", {
      notes: "Foundation type: basement",
    });
    addTask("basement", "Check basement walls and floor for moisture and seepage", "every 6 months", {
      priority: "High",
      due_date: dueIn(30),
      category: "Structural",
      notes: "Look for efflorescence, staining, or damp spots — address water intrusion before it causes mold or structural damage",
    });
    addTask("basement", "Test sump pump operation", "annually", {
      priority: "High",
      due_date: dueIn(30),
      category: "Structural",
      notes: "Pour water into pit to verify pump activates. Check float switch, discharge line, and backup battery (if present).",
    });
  }

  // Chimney
  if (structure?.hasChimney) {
    addAsset("chimney", "Chimney & Fireplace", "Safety", {
      notes: "Wood-burning or gas fireplace with chimney",
    });
    addTask("chimney", "Annual chimney sweep and Level 1 inspection", "annually", {
      priority: "High",
      due_date: dueIn(60),
      category: "Safety",
      notes: "Required annually for wood-burning fireplaces. Removes creosote buildup — a leading cause of chimney fires.",
    });
    addTask("chimney", "Check and lubricate fireplace damper", "annually", {
      priority: "Medium",
      due_date: dueIn(60),
      category: "Safety",
      notes: "Verify damper opens, closes, and seals fully. A stuck-open damper wastes significant heat.",
    });
    addTask("chimney", "Inspect chimney cap and crown", "annually", {
      priority: "Medium",
      due_date: dueIn(90),
      category: "Structural",
      notes: "Chimney cap prevents rain and animals from entering. Cracked crown allows water into masonry.",
    });
  }

  if (structure?.notes?.trim()) {
    assets.push({
      _key:      "structure_custom",
      item:      structure.notes.trim(),
      category:  "Structural",
      condition: "Good",
      notes:     "Added from home setup — review and add maintenance tasks manually",
    });
  }

  // ── EXTRAS ───────────────────────────────────────────────────────────────────

  if (extras?.hasPool) {
    const isSalt   = extras.poolChemistry === "saltwater";
    const hasPool  = extras.poolType !== "hot_tub";
    const hasTub   = extras.poolType === "hot_tub" || extras.poolType === "both";

    utilSet.add("Pool Chemicals");
    utilSet.add("Water"); // pools evaporate and need refilling

    if (hasPool) {
      const poolLabel = `Swimming Pool (${isSalt ? "Saltwater" : "Chlorine"})`;
      addAsset("pool", poolLabel, "Other", {
        notes: `Pool type: ${isSalt ? "saltwater" : "chlorine"} · ${extras.poolType === "both" ? "with hot tub" : "pool only"}`,
      });

      addTask("pool", "Test and balance pool chemistry", "weekly", {
        priority: "High",
        due_date: dueIn(7),
        category: "Other",
        notes: "Test pH (7.2-7.8), chlorine (1-3 ppm), alkalinity (80-120 ppm), and calcium hardness",
      });

      addTask("pool", "Clean pool filter", "quarterly", {
        priority: "Medium",
        due_date: dueIn(30),
        category: "Other",
        notes: "Backwash sand/DE filters or rinse cartridge filters when pressure rises 8-10 PSI above clean baseline",
      });

      addTask("pool", "Annual pool equipment inspection", "annually", {
        priority: "Medium",
        due_date: dueIn(60),
        category: "Other",
        notes: "Inspect pump, motor, heater, filter, valves, and lights. Check pool deck and coping for cracks.",
      });

      if (isSalt) {
        addTask("pool", "Inspect and clean salt cell", "quarterly", {
          priority: "High",
          due_date: dueIn(30),
          category: "Other",
          notes: "Check for calcium buildup on cell plates. Clean with diluted muriatic acid if needed. Check salt level (2700-3400 ppm).",
        });
      } else {
        addTask("pool", "Shock pool", "monthly", {
          priority: "Medium",
          due_date: dueIn(30),
          category: "Other",
          notes: "Superchlorinate to break down chloramines. Shock after heavy use, rain, or algae appearance.",
        });
      }
    }

    if (hasTub) {
      addAsset("hot_tub", "Hot Tub / Spa", "Other", {
        notes: `Hot tub · ${isSalt ? "saltwater" : "chlorine"} system`,
      });
      addTask("hot_tub", "Test hot tub water chemistry", "weekly", {
        priority: "High",
        due_date: dueIn(7),
        category: "Other",
        notes: "Test pH, sanitizer levels, and alkalinity. Hot tubs need more frequent testing than pools due to smaller volume and higher temps.",
      });
      addTask("hot_tub", "Drain, clean, and refill hot tub", "quarterly", {
        priority: "High",
        due_date: dueIn(90),
        category: "Other",
        notes: "Full drain and refill every 3 months. Clean shell, filters, and jets. Calculate refill date: (gallons ÷ daily bathers ÷ 3)",
      });
      addTask("hot_tub", "Clean hot tub filter cartridges", "monthly", {
        priority: "Medium",
        due_date: dueIn(14),
        category: "Other",
        notes: "Rinse with garden hose monthly. Deep clean with filter cleaner quarterly. Replace filters annually.",
      });
      addTask("hot_tub", "Annual hot tub equipment service", "annually", {
        priority: "Medium",
        due_date: dueIn(60),
        category: "Other",
        notes: "Inspect jets, blower, heater, pump, and cover. Check for air leaks in plumbing.",
      });
    }
  }

  if (extras?.hasIrrigation) {
    addAsset("irrigation", "Irrigation / Sprinkler System", "Landscaping", {
      notes: "In-ground irrigation or sprinkler system",
    });
    addTask("irrigation", "Irrigation system spring startup and zone check", "annually", {
      priority: "Medium",
      due_date: dueIn(30),
      category: "Landscaping",
      notes: "Inspect all heads for damage and proper coverage. Adjust timer for season. Check backflow preventer.",
    });
    addTask("irrigation", "Irrigation system winterization (blowout)", "annually", {
      priority: "High",
      due_date: dueIn(180),
      category: "Landscaping",
      notes: "Blow out all lines with compressed air before first hard freeze. Failing to winterize will burst lines.",
    });
    addTask("irrigation", "Check irrigation heads and adjust spray patterns", "every 6 months", {
      priority: "Low",
      due_date: dueIn(30),
      category: "Landscaping",
      notes: "Look for clogged or tilted heads, over-spray onto structures, and dry or flooded zones",
    });
    utilSet.add("Water");
  }

  if (extras?.hasSolar) {
    addAsset("solar", "Solar Panel System", "Electrical", {
      notes: "Rooftop solar photovoltaic (PV) system",
    });
    addTask("solar", "Solar panel cleaning and visual inspection", "every 6 months", {
      priority: "Low",
      due_date: dueIn(90),
      category: "Electrical",
      notes: "Rinse panels with water to remove dust, pollen, and bird droppings. Check for cracked cells or damaged wiring.",
    });
    addTask("solar", "Solar inverter check and output review", "annually", {
      priority: "Medium",
      due_date: dueIn(60),
      category: "Electrical",
      notes: "Compare current output to first-year baseline. A significant drop indicates panel degradation, shading, or inverter issues.",
    });
    addTask("solar", "Review solar monitoring data for anomalies", "monthly", {
      priority: "Low",
      due_date: dueIn(30),
      category: "Electrical",
      notes: "Check your inverter's app or monitoring portal for any underperforming strings or error codes",
    });
  }

  if (extras?.hasSeptic) {
    addAsset("septic", "Septic System", "Plumbing", {
      notes: "On-site septic tank and drain field",
    });
    addTask("septic", "Annual septic system inspection", "annually", {
      priority: "High",
      due_date: dueIn(45),
      category: "Plumbing",
      notes: "Have a licensed inspector check tank levels, baffles, and drain field. Results determine pumping frequency.",
    });
    addTask("septic", "Protect drain field — avoid heavy traffic and planting", "annually", {
      priority: "Low",
      due_date: dueIn(90),
      category: "Plumbing",
      notes: "Never park vehicles on drain field. Plant only grass over leach lines — tree roots can destroy the system.",
    });
    addProject(
      "Septic Tank Pumping",
      "Septic tanks need pumping every 3-5 years depending on household size. Schedule based on your annual inspector's recommendation.",
      600,
      "Recommended timeline: every 3-5 years"
    );
  }

  if (extras?.hasGenerator) {
    addAsset("generator", "Backup Generator", "Electrical", {
      notes: "Standby or portable backup power generator",
    });
    addTask("generator", "Monthly generator test run", "monthly", {
      priority: "Medium",
      due_date: dueIn(14),
      category: "Electrical",
      notes: "Run under load for 20-30 minutes monthly. Stationary oil breaks down — running keeps the engine conditioned.",
    });
    addTask("generator", "Annual generator service", "annually", {
      priority: "Medium",
      due_date: dueIn(60),
      category: "Electrical",
      notes: "Change oil, replace spark plugs and air filter, test battery (for electric start), add fuel stabilizer if storing",
    });
    addTask("generator", "Check generator fuel supply and rotate stored fuel", "every 6 months", {
      priority: "Medium",
      due_date: dueIn(30),
      category: "Electrical",
      notes: "Gasoline degrades in 30-90 days without stabilizer. Use fresh fuel or treat stored fuel with stabilizer.",
    });
  }

  if (extras?.notes?.trim()) {
    assets.push({
      _key:      "extras_custom",
      item:      extras.notes.trim(),
      category:  "Other",
      condition: "Good",
      notes:     "Added from home setup — review and add maintenance tasks manually",
    });
  }

  // ── Custom free-form entries ───────────────────────────────────────────────
  if (custom?.trim()) {
    assets.push({
      _key:      "custom_freeform",
      item:      custom.trim(),
      category:  "Other",
      condition: "Good",
      notes:     "Added from home setup questionnaire — add specific maintenance tasks manually",
    });
  }

  // ── Deduplicate and return ────────────────────────────────────────────────
  // Remove any task pointing to an asset that doesn't exist
  const validKeys = new Set(assets.map(a => a._key).concat([null]));
  const validTasks = tasks.filter(t => validKeys.has(t._assetKey));

  return {
    assets,
    tasks:     validTasks,
    utilities: [...utilSet].sort(),
    projects,
  };
}


// ─── CALENDAR TAB ────────────────────────────────────────────────────────────
function CalendarTab({ tasks, setTasks, warranties, profile, serviceLogs=[], toast, userId, onEditTask }) {
  const today = new Date();
  const [curYear, setCurYear]       = useState(today.getFullYear());
  const [curMonth, setCurMonth]     = useState(today.getMonth());
  const [selDate, setSelDate]       = useState(localISO(today));
  const [view, setView]             = useState("month");
  const [showAdd, setShowAdd]       = useState(false);
  const [addData, setAddData]       = useState({});
  const [saving, setSaving]         = useState(false);
  const [showGen, setShowGen]       = useState(false);
  const [genItems, setGenItems]     = useState([]);
  const [genChecked, setGenChecked] = useState({});
  const [created, setCreated]       = useState(new Set()); // suggestion ids already created

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  // ── event type meta ──────────────────────────────────────────────────────
  const EV = {
    task:           { color:"#234A3D", label:"Task" },
    task_overdue:   { color:"#C16140", label:"Overdue" },
    task_progress:  { color:"#B8861E", label:"In Progress" },
    task_done:      { color:"#A8A09A", label:"Completed" },
    warranty:       { color:"#C16140", label:"Warranty Expires" },
    warranty_warn:  { color:"#B8861E", label:"Warranty Warning" },
    insurance:      { color:"#B8861E", label:"Insurance Renewal" },
    insurance_warn: { color:"#E8A030", label:"Insurance Reminder" },
    service:        { color:"#7FA088", label:"Service Due" },
    seasonal:       { color:"#3A7AAF", label:"Seasonal Maintenance" },
  };
  const evColor = t => EV[t]?.color || "#A8A09A";

  // ── shared event map — same data source as Dashboard Week Ahead ──────────
  const eventMap = useMemo(() => buildHomeEvents(tasks, warranties, profile, serviceLogs), [tasks, warranties, profile, serviceLogs]);

  // ── upcoming events (next 60 days) ───────────────────────────────────────
  const upcomingList = useMemo(() => {
    const out = [];
    for (let i = 0; i <= 60; i++) {
      const d = new Date(today); d.setDate(d.getDate()+i);
      const key = localISO(d);
      const evs = (eventMap[key]||[]).filter(e => e.type !== "task_done");
      if (evs.length) out.push({ date:key, evs });
    }
    return out;
  }, [eventMap]);

  // ── next 5 upcoming for alert strip ─────────────────────────────────────
  const alertItems = useMemo(() => {
    const flat = [];
    upcomingList.forEach(({ date, evs }) => evs.forEach(e => flat.push({ ...e, date })));
    return flat.filter(e => !["task_done","seasonal"].includes(e.type)).slice(0,6);
  }, [upcomingList]);

  // ── calendar grid cells ──────────────────────────────────────────────────
  const firstDay    = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth+1, 0).getDate();
  const daysInPrev  = new Date(curYear, curMonth, 0).getDate();
  const cells = [];
  for (let i = firstDay-1; i >= 0; i--) cells.push({ day:daysInPrev-i, other:true });
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(curMonth+1).padStart(2,"0"), dd = String(d).padStart(2,"0");
    cells.push({ day:d, date:`${curYear}-${mm}-${dd}` });
  }
  while (cells.length < 42) cells.push({ day:cells.length-firstDay-daysInMonth+1, other:true });

  const todayStr = localISO(today);
  const prevMonth = () => curMonth===0 ? (setCurMonth(11),setCurYear(y=>y-1)) : setCurMonth(m=>m-1);
  const nextMonth = () => curMonth===11 ? (setCurMonth(0), setCurYear(y=>y+1)) : setCurMonth(m=>m+1);

  // ── create event as task ─────────────────────────────────────────────────
  const guessCategory = title => {
    const t = title.toLowerCase();
    if (/hvac|ac unit|furnace|heat|cool|filter/.test(t)) return "HVAC";
    if (/pipe|plumb|drain|water heater|faucet/.test(t)) return "Plumbing";
    if (/roof/.test(t)) return "Roofing";
    if (/gutter|lawn|deck|irrigation|landscape|garden/.test(t)) return "Landscaping";
    if (/smoke|detector|co detector|safety|fire/.test(t)) return "Safety";
    if (/electrical|outlet|panel/.test(t)) return "Electrical";
    return "Other";
  };

  const createFromSuggestion = async (ev, date) => {
    if (created.has(ev.id)) return;
    setSaving(true);
    const payload = { title:ev.title, due_date:date, status:"Scheduled", priority:"Medium", category:ev.category || guessCategory(ev.title), notes:"", user_id:userId };
    const { data, error } = await supabase.from("tasks").insert([payload]).select();
    if (!error && data) { setTasks(p=>[data[0],...p]); setCreated(s=>new Set(s).add(ev.id)); toast("Task added ✓"); }
    setSaving(false);
  };

  // ── add task from day ────────────────────────────────────────────────────
  const openAdd = () => { setAddData({ due_date:selDate, priority:"Medium", status:"Scheduled" }); setShowAdd(true); };
  const saveAdd = async () => {
    if (!addData.title?.trim()) return;
    setSaving(true);
    const payload = { title:addData.title.trim(), due_date:addData.due_date||selDate, status:"Scheduled", priority:addData.priority||"Medium", category:addData.category||"Other", notes:"", user_id:userId };
    const { data, error } = await supabase.from("tasks").insert([payload]).select();
    if (!error && data) { setTasks(p=>[data[0],...p]); toast("Task created ✓"); setShowAdd(false); setAddData({}); }
    setSaving(false);
  };

  // ── generate schedule ────────────────────────────────────────────────────
  const openGenerate = () => {
    const zone = profile?.address ? getClimateZone({address:profile.address}) : 5;
    const cp = getClimateProfile(zone);
    const SEASON_MO = { spring:2, summer:5, fall:8, winter:11 };
    const items = [];
    [today.getFullYear(), today.getFullYear()+1].forEach(yr => {
      Object.entries(SEASON_MO).forEach(([season, mo]) => {
        const seasonStart = new Date(yr, mo, 1);
        if (seasonStart < new Date(today.getFullYear(), today.getMonth(), 1)) return;
        (cp[season]||[]).forEach((title, i) => {
          items.push({ id:`gen-${yr}-${season}-${i}`, title, date:localISO(new Date(yr,mo,1+i*2)), category:guessCategory(title), season:season.charAt(0).toUpperCase()+season.slice(1)+" "+yr });
        });
      });
    });
    const checked = {};
    items.forEach(it => { checked[it.id] = true; });
    setGenItems(items); setGenChecked(checked); setShowGen(true);
  };

  const saveSchedule = async () => {
    const selected = genItems.filter(it => genChecked[it.id]);
    if (!selected.length) return;
    setSaving(true);
    const rows = selected.map(it => ({ title:it.title, due_date:it.date, status:"Scheduled", priority:"Medium", category:it.category, notes:"", user_id:userId }));
    const { data, error } = await supabase.from("tasks").insert(rows).select();
    if (!error && data) { setTasks(p=>[...data,...p]); toast(`${data.length} tasks scheduled ✓`); setShowGen(false); }
    setSaving(false);
  };

  // ── selected day events ──────────────────────────────────────────────────
  const selEvents = eventMap[selDate] || [];
  const selTasks  = selEvents.filter(e => e.type.startsWith("task"));
  const selOther  = selEvents.filter(e => !e.type.startsWith("task") && !e.type.startsWith("seasonal"));
  const selSuggest = selEvents.filter(e => e.type === "seasonal" || (e.canCreate && !e.type.startsWith("task")));

  const fmtSelDate = () => {
    const d = new Date(selDate+"T00:00:00");
    return d.toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric"});
  };

  // ── group upcoming by month label ────────────────────────────────────────
  const upcomingGrouped = useMemo(() => {
    const groups = [];
    let lastLabel = "";
    upcomingList.forEach(({ date, evs }) => {
      const label = new Date(date+"T00:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"});
      if (label !== lastLabel) { groups.push({ label, rows:[] }); lastLabel = label; }
      evs.filter(e => e.type !== "task_done").forEach(e => groups[groups.length-1].rows.push({ date, ev:e }));
    });
    return groups.filter(g => g.rows.length > 0);
  }, [upcomingList]);

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="ct-wrap">

      {/* Header */}
      <div className="ct-head">
        <div className="ct-vtoggle">
          <button className={`ct-vbtn ${view==="month"?"on":""}`} onClick={()=>setView("month")}>Month</button>
          <button className={`ct-vbtn ${view==="upcoming"?"on":""}`} onClick={()=>setView("upcoming")}>Upcoming</button>
        </div>
        <button className="ct-gen-btn" onClick={openGenerate}>⚡ Generate schedule</button>
      </div>

      {/* Alert strip */}
      {alertItems.length > 0 && (
        <div className="ct-alerts">
          {alertItems.map(ev => (
            <div key={ev.id} className="ct-alert" onClick={()=>{setSelDate(ev.date);setView("month");const d=new Date(ev.date+"T00:00:00");setCurMonth(d.getMonth());setCurYear(d.getFullYear());}}>
              <div className="ct-alert-dot" style={{background:evColor(ev.type)}}/>
              <div className="ct-alert-body">
                <div className="ct-alert-title">{ev.title}</div>
                <div className="ct-alert-when">{daysTo(ev.date)===0?"Today":daysTo(ev.date)===1?"Tomorrow":`In ${daysTo(ev.date)} days`}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Month view */}
      {view === "month" && (
        <div className="ct-body">
          {/* Calendar grid */}
          <div className="ct-cal">
            <div className="ct-cal-hdr">
              <span className="ct-month-lbl">{MONTHS[curMonth]} {curYear}</span>
              <div className="ct-navs">
                <button className="ct-nav-btn" onClick={prevMonth}>‹</button>
                <button className="ct-nav-btn ct-today-btn" onClick={()=>{setCurMonth(today.getMonth());setCurYear(today.getFullYear());setSelDate(todayStr);}}>Today</button>
                <button className="ct-nav-btn" onClick={nextMonth}>›</button>
              </div>
            </div>
            <div className="ct-cg">
              {DAYS.map(d => <div key={d} className="ct-dow">{d}</div>)}
              {cells.map((cell,i) => {
                const evs = cell.date ? (eventMap[cell.date]||[]) : [];
                const visible = evs.slice(0,3);
                const more = evs.length - 3;
                return (
                  <div key={i}
                    className={`ct-day ${cell.other?"ct-other":""} ${cell.date===todayStr?"ct-today":""} ${cell.date===selDate?"ct-sel":""}`}
                    onClick={()=>{ if(!cell.other && cell.date) setSelDate(cell.date); }}
                  >
                    <div className="ct-dn">{cell.day}</div>
                    {evs.length > 0 && (
                      <div className="ct-dots">
                        {visible.map((e,j)=><div key={j} className="ct-dot" style={{background:evColor(e.type)}} title={e.title}/>)}
                        {more > 0 && <div className="ct-dotx">+{more}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day panel */}
          <div className="ct-panel">
            <div className="ct-ph">
              <span className="ct-pdate">{fmtSelDate()}</span>
              <button className="ct-add-btn" onClick={openAdd}>+ Add task</button>
            </div>
            <div className="ct-pb">
              {selEvents.length === 0 ? (
                <div className="ct-p-empty">
                  Nothing scheduled{selDate === todayStr ? " for today" : " on this day"}.<br/>
                  <span style={{fontSize:".78rem"}}>Tap + Add task to create one.</span>
                </div>
              ) : (
                <>
                  {/* Real events */}
                  {[...selTasks, ...selOther.filter(e=>!e.canCreate || e.type.startsWith("warranty") || e.type.startsWith("insurance") || e.type==="service")].map(ev => {
                    const isTask = ev.type.startsWith("task");
                    const fullTask = isTask ? tasks.find(t => t.id === ev.sourceId) : null;
                    const canEdit = isTask && fullTask && onEditTask;
                    return (
                    <div key={ev.id} className="ct-pe"
                      onClick={canEdit ? () => onEditTask(fullTask) : undefined}
                      style={canEdit ? {cursor:"pointer"} : undefined}
                    >
                      <div className="ct-pe-bar" style={{background:evColor(ev.type)}}/>
                      <div className="ct-pe-info">
                        <div className="ct-pe-title">{ev.title}</div>
                        <div className="ct-pe-meta">
                          <span>{EV[ev.type]?.label || ev.type}</span>
                          {ev.category && <span>· {ev.category}</span>}
                          {ev.status && <span>· {ev.status}</span>}
                          {ev.type !== "task_done" && fullTask?.recurring && <span>· 🔁 {fullTask.recurring}</span>}
                        </div>
                      </div>
                      {canEdit && (
                        <span style={{fontSize:".7rem",color:"#A8A09A",flexShrink:0}}>Edit ›</span>
                      )}
                      {ev.canCreate && !isTask && (
                        <button className={`ct-pe-create ${created.has(ev.id)?"done":""}`} onClick={e=>{e.stopPropagation();createFromSuggestion(ev,selDate);}} disabled={created.has(ev.id)||saving}>
                          {created.has(ev.id) ? "Added ✓" : "→ Task"}
                        </button>
                      )}
                    </div>
                    );
                  })}
                  {/* Seasonal suggestions for this day */}
                  {selSuggest.filter(e=>e.type==="seasonal").length > 0 && (
                    <>
                      <div className="ct-suggest-hdr">Suggested maintenance</div>
                      {selSuggest.filter(e=>e.type==="seasonal").map(ev => (
                        <div key={ev.id} className="ct-pe">
                          <div className="ct-pe-bar" style={{background:evColor(ev.type)}}/>
                          <div className="ct-pe-info">
                            <div className="ct-pe-title">{ev.title}</div>
                            <div className="ct-pe-meta"><span>Seasonal suggestion</span></div>
                          </div>
                          <button className={`ct-pe-create ${created.has(ev.id)?"done":""}`} onClick={()=>createFromSuggestion(ev,selDate)} disabled={created.has(ev.id)||saving}>
                            {created.has(ev.id) ? "Added ✓" : "+ Task"}
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming view */}
      {view === "upcoming" && (
        <div className="ct-upcoming">
          {upcomingGrouped.length === 0 ? (
            <div className="ct-p-empty" style={{background:"var(--white)",borderRadius:"var(--r)",border:"1px solid var(--stone)"}}>
              No upcoming events in the next 60 days.
            </div>
          ) : upcomingGrouped.map(g => (
            <div key={g.label}>
              <div className="ct-up-group-lbl">{g.label}</div>
              {g.rows.map(({date,ev},i) => (
                <div key={ev.id+i} className="ct-up-row">
                  <div className="ct-up-bar" style={{background:evColor(ev.type)}}/>
                  <div className="ct-up-info">
                    <div className="ct-up-title">{ev.title}</div>
                    <div className="ct-up-type">{EV[ev.type]?.label}</div>
                  </div>
                  <div className="ct-up-date">
                    {new Date(date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add task modal */}
      {showAdd && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-hdr">
              <span className="modal-title">Add Task — {fmtSelDate()}</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="fg">
                <div className="field s2">
                  <label>Task Title *</label>
                  <input autoFocus value={addData.title||""} onChange={e=>setAddData(d=>({...d,title:e.target.value}))} placeholder="e.g. Service HVAC filter"/>
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={addData.category||""} onChange={e=>setAddData(d=>({...d,category:e.target.value}))}>
                    <option value="">Select…</option>
                    {["HVAC","Plumbing","Electrical","Appliances","Roofing","Landscaping","Structural","Safety","Other"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Priority</label>
                  <select value={addData.priority||"Medium"} onChange={e=>setAddData(d=>({...d,priority:e.target.value}))}>
                    {["Low","Medium","High","Urgent"].map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Due Date</label>
                  <input type="date" value={addData.due_date||selDate} onChange={e=>setAddData(d=>({...d,due_date:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="btn btn-rust" onClick={saveAdd} disabled={!addData.title?.trim()||saving}>
                {saving ? "Saving…" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate schedule modal */}
      {showGen && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowGen(false)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-hdr">
              <span className="modal-title">⚡ Generate Maintenance Schedule</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowGen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="ct-gen-intro">
                Based on your home's climate zone, here's a full maintenance schedule. Select the tasks you'd like to add — they'll appear in your Tasks tab with the right due dates.
              </p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
                <span style={{fontSize:".78rem",color:"#9E9690"}}>{Object.values(genChecked).filter(Boolean).length} of {genItems.length} selected</span>
                <div style={{display:"flex",gap:".5rem"}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setGenChecked(Object.fromEntries(genItems.map(i=>[i.id,true])))}>All</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setGenChecked(Object.fromEntries(genItems.map(i=>[i.id,false])))}>None</button>
                </div>
              </div>
              <div className="ct-gen-list">
                {(() => {
                  let lastSeason = "";
                  return genItems.map(it => {
                    const showSeason = it.season !== lastSeason;
                    if (showSeason) lastSeason = it.season;
                    return (
                      <div key={it.id}>
                        {showSeason && <div className="ct-gen-season">{it.season}</div>}
                        <div className="ct-gen-item" onClick={()=>setGenChecked(c=>({...c,[it.id]:!c[it.id]}))}>
                          <input type="checkbox" checked={!!genChecked[it.id]} readOnly/>
                          <div className="ct-gen-info">
                            <div className="ct-gen-title">{it.title}</div>
                            <div className="ct-gen-sub">{new Date(it.date+"T00:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} · {it.category}</div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowGen(false)}>Cancel</button>
              <button className="btn btn-rust" onClick={saveSchedule} disabled={!Object.values(genChecked).some(Boolean)||saving}>
                {saving ? "Creating…" : `Create ${Object.values(genChecked).filter(Boolean).length} Tasks`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // URL-based routing for legal pages
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path === "/terms" || path === "/terms.html") return <TermsPage />;
    if (path === "/privacy" || path === "/privacy.html") return <PrivacyPage />;
    if (path === "/ada" || path === "/accessibility") return <ADAPage />;
  }
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState("landing"); // landing | login | signup
  const [tab, setTab] = useState("dashboard");
  const [showFeedback, setShowFeedback] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [serviceLogs, setServiceLogs] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { toasts, show: toast } = useToast();

  // Plan derived from profile — re-computes whenever profile loads
  const planData = usePlan(profile);

  // ── Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data when user logs in
  useEffect(() => {
    if (!session?.user) {
      setTasks([]); setWarranties([]); setExpenses([]); setProfile(null); setServiceLogs([]);
      setDataLoading(true);
      return;
    }
    const uid = session.user.id;
    async function loadData() {
      setDataLoading(true);
      const [t, w, e, p, sl] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("warranties").select("*").eq("user_id", uid).order("expiry_date", { ascending: true }),
        supabase.from("expenses").select("*").eq("user_id", uid).order("date", { ascending: false }),
        supabase.from("profiles").select("*").eq("user_id", uid).limit(1),
        supabase.from("asset_service_log").select("*").eq("user_id", uid).order("service_date", { ascending: false }),
      ]);
      if(t.data) setTasks(t.data);
      if(w.data) setWarranties(w.data);
      if(e.data) setExpenses(e.data);
      if(p.data && p.data.length > 0) setProfile(p.data[0]);
      if(sl.data) setServiceLogs(sl.data);
      setDataLoading(false);
    }
    loadData();
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setTab("dashboard");
    toast("Signed out");
  };

  // ── Loading spinner while checking auth
  if (authLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--dark)"}}>
          <div style={{textAlign:"center",color:"#fff"}}>
            <div style={{fontSize:"2rem",marginBottom:"1rem"}}>🏠</div>
            <div className="spinner" style={{margin:"0 auto",borderTopColor:"var(--rust)",borderColor:"rgba(255,255,255,.2)"}}/>
          </div>
        </div>
      </>
    );
  }

  // ── Show landing or auth screen if not logged in
  if (!session) {
    if (screen === "landing") {
      return (
        <>
          <style>{CSS}</style>
          <LandingPage
            onSignIn={() => setScreen("login")}
            onSignUp={() => setScreen("signup")}
          />
          <Toasts toasts={toasts} />
        </>
      );
    }
    return (
      <>
        <style>{CSS}</style>
        <AuthScreen onAuth={setSession} initialMode={screen === "signup" ? "signup" : "login"} />
        <Toasts toasts={toasts} />
      </>
    );
  }

  // ── Show onboarding wizard for new users
  if (session && !dataLoading && profile !== null && !profile?.onboarding_complete) {
    return (
      <>
        <style>{CSS}</style>
        <OnboardingWizard
          session={session}
          onComplete={async () => {
            // Reload profile and tasks after wizard saves them
            const uid = session.user.id;
            const [p, t] = await Promise.all([
              supabase.from("profiles").select("*").eq("user_id", uid).limit(1),
              supabase.from("tasks").select("*").eq("user_id", uid).order("created_at", {ascending:false}),
            ]);
            if(p.data && p.data.length > 0) setProfile(p.data[0]);
            if(t.data) setTasks(t.data);
          }}
        />
        <Toasts toasts={toasts} />
      </>
    );
  }

  // ── Show wizard for brand new users (no profile yet)
  if (session && !dataLoading && profile === null) {
    return (
      <>
        <style>{CSS}</style>
        <OnboardingWizard
          session={session}
          onComplete={async () => {
            const uid = session.user.id;
            const [p, t] = await Promise.all([
              supabase.from("profiles").select("*").eq("user_id", uid).limit(1),
              supabase.from("tasks").select("*").eq("user_id", uid).order("created_at", {ascending:false}),
            ]);
            if(p.data && p.data.length > 0) setProfile(p.data[0]);
            if(t.data) setTasks(t.data);
          }}
        />
        <Toasts toasts={toasts} />
      </>
    );
  }

  // ── Main app
  const overdue = tasks.filter(t=>t.status==="Overdue").length;
  const TABS = [
    {id:"dashboard", label:"Home",       icon:"🏠"},
    {id:"tasks",     label:"Tasks",      icon:"✓",  badge:overdue},
    {id:"warranties",label:"Assets",     icon:"🔧", badge: (() => { const n = warranties.filter(w=>w.condition==="Needs Attention"||w.condition==="Failed").length; return n>0?n:0; })()},
    {id:"expenses",  label:"Expenses",   icon:"💲"},
    {id:"profile",   label:"My Home",    icon:"🏡"},
  ];
  const uid = session.user.id;

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const username = (session.user.email || "there").split("@")[0];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── Header ── */}
        <header className="hdr" role="banner">
          <div className="hdr-logo">
            <div className="ico"><svg viewBox="0 0 48 48" fill="none" width="58%" height="58%" style={{display:'block'}}><path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 34.5 L37 34.5" stroke="#F4EDDF" strokeWidth="3" strokeLinecap="round"/></svg></div>
            <span className="name">Steadwell</span>
          </div>
          <SearchBar tasks={tasks} warranties={warranties} expenses={expenses} onNavigate={setTab}/>
          <UserMenu user={session.user} onSignOut={handleSignOut} onFeedback={()=>setShowFeedback(true)}/>
        </header>

        {/* ── Main Content ── */}
        <main className="main" id="main-content" tabIndex={-1}>
          {dataLoading ? (
            <div className="loading">
              <div className="spinner"/>
              <span style={{fontSize:".85rem"}}>Loading your home…</span>
            </div>
          ) : (
            <>
              {tab==="dashboard" && <Dashboard tasks={tasks} warranties={warranties} expenses={expenses} profile={profile} onNavigate={setTab} greeting={greeting} username={username} serviceLogs={serviceLogs} planData={planData} onUpgrade={()=>setShowUpgrade(true)}/>}
              {tab==="tasks" && <Tasks tasks={tasks} setTasks={setTasks} toast={toast} userId={uid} profile={profile} warranties={warranties} serviceLogs={serviceLogs} setServiceLogs={setServiceLogs} planData={planData} onUpgrade={()=>setShowUpgrade(true)}/>}
              {tab==="warranties" && <Assets warranties={warranties} setWarranties={setWarranties} toast={toast} userId={uid} serviceLogs={serviceLogs} setServiceLogs={setServiceLogs} tasks={tasks} setTasks={setTasks} planData={planData} onUpgrade={()=>setShowUpgrade(true)}/>}
              {tab==="expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} toast={toast} userId={uid} serviceLogs={serviceLogs} planData={planData} onUpgrade={()=>setShowUpgrade(true)}/>}
              {tab==="profile" && <Profile profile={profile} setProfile={setProfile} tasks={tasks} expenses={expenses} warranties={warranties} serviceLogs={serviceLogs} toast={toast} userId={uid} onNavigate={setTab} planData={planData} onUpgrade={()=>setShowUpgrade(true)}/>}
            </>
          )}
        </main>

        {/* ── Navigation (all screen sizes) ── */}
        <nav className="bottom-nav">
          {TABS.map(t=>(
            <button key={t.id} className={`bnav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)} aria-label={t.label} aria-current={tab===t.id?"page":undefined}>
              {t.badge>0 && <span className="bnav-badge">{t.badge}</span>}
              <span className="bnav-icon" aria-hidden="true">{t.icon}</span>
              <span className="bnav-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <Toasts toasts={toasts}/>
        {showFeedback && (
          <FeedbackModal
            user={session.user}
            userId={uid}
            currentTab={tab}
            onClose={()=>setShowFeedback(false)}
          />
        )}
        {showUpgrade && (
          <div style={{position:"fixed",inset:0,background:"rgba(35,30,25,.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",backdropFilter:"blur(6px)"}}
            onClick={e=>e.target===e.currentTarget&&setShowUpgrade(false)}>
            <div style={{background:"var(--linen)",borderRadius:"20px",width:"100%",maxWidth:"520px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.35)"}}>
              {/* Header */}
              <div style={{background:"var(--pine)",borderRadius:"20px 20px 0 0",padding:"1.5rem 1.5rem 1.25rem",position:"relative"}}>
                <button onClick={()=>setShowUpgrade(false)} style={{position:"absolute",top:"1rem",right:"1rem",background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:".85rem",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.4rem",fontWeight:500,color:"#F4EDDF",marginBottom:".25rem"}}>Upgrade Steadwell</div>
                <div style={{fontSize:".82rem",color:"rgba(244,237,223,.65)",lineHeight:1.5}}>Unlock automation, intelligence, and the full platform for your home.</div>
              </div>
              {/* Tiers */}
              <div style={{padding:"1.1rem 1.25rem",display:"flex",flexDirection:"column",gap:".75rem"}}>
                {[
                  {
                    plan:"Plus", price:"$4.99", period:"/month", color:"#3B5FBF", bg:"#EEF4FF", border:"#C5D5F7",
                    pitch:"Automation and intelligence for the serious homeowner.",
                    features:["Full recurring task engine — all intervals","Home health score + factor breakdown","5-year cost forecasting","Daily task & warranty reminders","AI receipt scan","25 documents","Full Home Setup Wizard"],
                  },
                  {
                    plan:"Pro", price:"$9.99", period:"/month", color:"#A0511A", bg:"#FBF0E6", border:"#F5D5B0",
                    pitch:"Multiple properties, shared access, and the complete platform.",
                    features:["Everything in Plus","Up to 3 properties","Unlimited documents","Shared home access — invite spouse/partner","Pre-sale home report included","Contractor verified badge","Priority support"],
                  },
                ].map(t => (
                  <div key={t.plan} style={{background:t.bg,border:`1.5px solid ${t.border}`,borderRadius:"14px",overflow:"hidden"}}>
                    <div style={{padding:".85rem 1rem",display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.1rem",fontWeight:500,color:t.color}}>{t.plan}</div>
                        <div style={{fontSize:".75rem",color:"rgba(0,0,0,.45)",marginTop:"1px"}}>{t.pitch}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0,marginLeft:".75rem"}}>
                        <span style={{fontFamily:"'Fraunces',serif",fontSize:"1.4rem",fontWeight:600,color:t.color}}>{t.price}</span>
                        <span style={{fontSize:".72rem",color:"rgba(0,0,0,.4)"}}>{t.period}</span>
                      </div>
                    </div>
                    <div style={{padding:"0 1rem .75rem",display:"flex",flexDirection:"column",gap:".3rem"}}>
                      {t.features.map(f => (
                        <div key={f} style={{display:"flex",gap:".5rem",fontSize:".78rem",color:"#3A3530",alignItems:"flex-start"}}>
                          <span style={{color:t.color,flexShrink:0,marginTop:"1px"}}>✓</span>{f}
                        </div>
                      ))}
                    </div>
                    <div style={{padding:"0 1rem .9rem"}}>
                      <button style={{width:"100%",padding:".7rem",background:t.color,border:"none",borderRadius:"10px",color:"#fff",fontFamily:"'Hanken Grotesk',sans-serif",fontSize:".88rem",fontWeight:700,cursor:"pointer"}}
                        onClick={()=>{alert(`Stripe coming soon — ${t.plan} at ${t.price}/mo`);setShowUpgrade(false);}}>
                        Get {t.plan} →
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{textAlign:"center",fontSize:".72rem",color:"#9E9690",padding:".25rem 0 .5rem"}}>
                  Cancel anytime · No long-term commitment · Secure payments via Stripe
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── TERMS OF SERVICE PAGE ───────────────────────────────────────────────────
function TermsPage() {
  const S = {page:{minHeight:"100vh",background:"#F4EDDF",fontFamily:"'Hanken Grotesk',sans-serif",color:"#2A2723"},hdr:{background:"#234A3D",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"},tile:{width:32,height:32,borderRadius:9,background:"#C16140",display:"flex",alignItems:"center",justifyContent:"center"},wm:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"1.2rem",color:"#F4EDDF"},main:{maxWidth:780,margin:"0 auto",padding:"56px 24px 80px"},eyebrow:{fontSize:".72rem",letterSpacing:".18em",textTransform:"uppercase",color:"#C16140",fontWeight:700,marginBottom:14},title:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"clamp(2rem,5vw,3rem)",color:"#234A3D",marginBottom:12,lineHeight:1.06,letterSpacing:"-.02em"},meta:{fontSize:".88rem",color:"#5E574F",marginBottom:48,paddingBottom:28,borderBottom:"1px solid rgba(42,39,35,.12)"},notice:{background:"#FBF7EE",border:"1px solid rgba(42,39,35,.12)",borderLeft:"4px solid #C16140",borderRadius:"0 12px 12px 0",padding:"16px 20px",marginBottom:40,fontSize:".9rem"},h2:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"1.25rem",color:"#234A3D",margin:"36px 0 12px"},p:{marginBottom:12,fontSize:"1rem",lineHeight:1.7},li:{marginBottom:6,fontSize:"1rem",lineHeight:1.6},ul:{margin:"0 0 14px 22px"},cta:{background:"#234A3D",color:"#F4EDDF",borderRadius:16,padding:"28px 32px",marginTop:48},ft:{background:"#2A2723",color:"rgba(244,237,223,.5)",padding:"32px 24px",fontSize:".82rem",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:14}};
  const HM = ()=><svg viewBox="0 0 48 48" fill="none" width="62%" height="62%" aria-hidden="true"><path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 34.5 L37 34.5" stroke="#F4EDDF" strokeWidth="3" strokeLinecap="round"/></svg>;
  const sections = [
    {t:"1. Acceptance of Terms",b:"By creating an account or using the Steadwell platform (the \"Service\"), you agree to these Terms of Service. You must be at least 18 years old and a US resident. These Terms form a binding legal agreement between you and Steadwell."},
    {t:"2. Description of Service",b:"Steadwell is a web-based home management platform for tracking maintenance tasks, warranties, service records, home expenses, utility bills, documents, and publicly available property data. It is not a licensed real estate, financial advisory, legal, or professional home inspection service."},
    {t:"3. Account Registration",b:"You must register with a valid email address. You are responsible for your account credentials and all activity under your account. Contact hello@steadwell.app immediately if you suspect unauthorized access."},
    {t:"4. Acceptable Use",b:"You agree not to use the Service for unlawful purposes, upload content you don\'t have the right to share, attempt unauthorized access, reverse-engineer the Service, use automated scraping tools, or misrepresent your identity or property ownership. Violations may result in immediate account termination."},
    {t:"5. Subscriptions and Payments",b:"Free Plan: core features for one property at no cost. Pro Plan: $4.99/month, billed monthly, auto-renews until cancelled. Cancel anytime from account settings; access continues through the end of the billing period. Refunds available within 7 days of initial subscription if Pro features were not materially used. Payments processed by Stripe — we do not store card information."},
    {t:"6. Your Content and Data",b:"You retain full ownership of all content you create or upload. We store it solely to provide the Service. We do not sell your content. You may export or delete your data at any time from Settings."},
    {t:"7. Property Data Disclaimer",b:"Property value estimates come from third-party sources including Zillow (via APIllow) and are informational only. THEY ARE NOT APPRAISALS, BROKER PRICE OPINIONS, OR PROFESSIONAL VALUATIONS. Do not rely on Steadwell\'s data as the sole basis for any real estate, financial, insurance, or legal decision."},
    {t:"8. Third-Party Services",b:"The Service integrates with Supabase (database & auth), APIllow/Zillow (property data), Geoapify (address lookup), and Stripe (payments). Your use is also subject to their respective terms."},
    {t:"9. Disclaimers",b:"THE SERVICE IS PROVIDED \"AS IS\" WITHOUT WARRANTY OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE. Steadwell is not a licensed contractor, inspector, insurance agent, real estate broker, financial advisor, or attorney."},
    {t:"10. Limitation of Liability",b:"TO THE FULLEST EXTENT PERMITTED BY LAW, STEADWELL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE GREATER OF FEES PAID IN THE PRIOR 12 MONTHS OR $50 USD."},
    {t:"11. Governing Law",b:"These Terms are governed by the laws of the State of Florida. Disputes shall be resolved by binding arbitration (AAA Consumer Rules) except that either party may seek injunctive relief in Pinellas County, Florida courts. YOU WAIVE CLASS-ACTION RIGHTS."},
    {t:"12. Changes to These Terms",b:"We will notify you of material changes via email or in-app notice at least 30 days before they take effect. Continued use constitutes acceptance."},
  ];
  return (
    <div style={S.page}>
      <a href="#terms-main" style={{position:"absolute",top:"-100%",left:8,padding:"8px 16px",background:"#234A3D",color:"#F4EDDF",borderRadius:"0 0 8px 8px",zIndex:9999,fontWeight:600,fontSize:".85rem",textDecoration:"none"}} onFocus={e=>e.target.style.top="0"} onBlur={e=>e.target.style.top="-100%"}>Skip to main content</a>
      <header style={S.hdr} role="banner">
        <a href="/" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}} aria-label="Steadwell homepage"><span style={S.tile}><HM/></span><span style={S.wm}>Steadwell</span></a>
        <div style={{display:"flex",gap:"1.5rem",alignItems:"center"}}>
          <a href="/privacy" style={{color:"rgba(244,237,223,.7)",fontSize:".85rem",textDecoration:"none"}}>Privacy Policy</a>
          <a href="/ada" style={{color:"rgba(244,237,223,.7)",fontSize:".85rem",textDecoration:"none"}}>Accessibility</a>
        </div>
      </header>
      <main id="terms-main" tabIndex={-1} style={S.main}>
        <div style={S.eyebrow}>Legal</div>
        <h1 style={S.title}>Terms of Service</h1>
        <p style={S.meta}>Effective date: June 1, 2026 &nbsp;&middot;&nbsp; Last updated: June 1, 2026</p>
        <div style={S.notice}><strong style={{color:"#C16140"}}>Plain-English summary:</strong> Steadwell is a home management tool for US homeowners 18+. You own your data. Property values are estimates, not appraisals. Pro plan is $4.99/month. Florida law governs these terms.</div>
        {sections.map(({t,b})=><div key={t}><h2 style={S.h2}>{t}</h2><p style={S.p}>{b}</p></div>)}
        <div style={S.cta}>
          <h2 style={{...S.h2,color:"#F4EDDF",marginTop:0}}>Questions About These Terms?</h2>
          <p style={{...S.p,color:"rgba(244,237,223,.82)"}}>Contact us at <a href="mailto:hello@steadwell.app" style={{color:"#F4EDDF"}}>hello@steadwell.app</a></p>
          <p style={{fontSize:".85rem",color:"rgba(244,237,223,.6)"}}>Steadwell &middot; St. Petersburg, Florida</p>
        </div>
      </main>
      <footer role="contentinfo" style={S.ft}>
        <span>&copy; 2026 Steadwell.</span>
        <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap"}}>
          <a href="/privacy" style={{color:"rgba(244,237,223,.65)",textDecoration:"none"}}>Privacy Policy</a>
          <a href="/ada" style={{color:"rgba(244,237,223,.65)",textDecoration:"none"}}>Accessibility</a>
        </div>
      </footer>
    </div>
  );
}

// ─── PRIVACY POLICY PAGE ─────────────────────────────────────────────────────
function PrivacyPage() {
  const S = {page:{minHeight:"100vh",background:"#F4EDDF",fontFamily:"'Hanken Grotesk',sans-serif",color:"#2A2723"},hdr:{background:"#234A3D",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"},tile:{width:32,height:32,borderRadius:9,background:"#C16140",display:"flex",alignItems:"center",justifyContent:"center"},wm:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"1.2rem",color:"#F4EDDF"},main:{maxWidth:780,margin:"0 auto",padding:"56px 24px 80px"},eyebrow:{fontSize:".72rem",letterSpacing:".18em",textTransform:"uppercase",color:"#C16140",fontWeight:700,marginBottom:14},title:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"clamp(2rem,5vw,3rem)",color:"#234A3D",marginBottom:12,lineHeight:1.06,letterSpacing:"-.02em"},meta:{fontSize:".88rem",color:"#5E574F",marginBottom:48,paddingBottom:28,borderBottom:"1px solid rgba(42,39,35,.12)"},notice:{background:"#FBF7EE",border:"1px solid rgba(42,39,35,.12)",borderLeft:"4px solid #C16140",borderRadius:"0 12px 12px 0",padding:"16px 20px",marginBottom:40,fontSize:".9rem"},h2:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"1.25rem",color:"#234A3D",margin:"36px 0 12px"},p:{marginBottom:12,fontSize:"1rem",lineHeight:1.7},cta:{background:"#234A3D",color:"#F4EDDF",borderRadius:16,padding:"28px 32px",marginTop:48},ft:{background:"#2A2723",color:"rgba(244,237,223,.5)",padding:"32px 24px",fontSize:".82rem",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:14}};
  const HM = ()=><svg viewBox="0 0 48 48" fill="none" width="62%" height="62%" aria-hidden="true"><path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 34.5 L37 34.5" stroke="#F4EDDF" strokeWidth="3" strokeLinecap="round"/></svg>;
  const sections = [
    {t:"1. Who We Are",b:"Steadwell operates the home management platform at steadwell.app. Questions? Email privacy@steadwell.app."},
    {t:"2. Information We Collect",b:"Account info (email, hashed password); home address and property details you enter or confirm; maintenance records, expenses, utility bills, and insurance details; uploaded documents and photos; property data retrieved from Zillow (via APIllow) and address suggestions from Geoapify on your behalf; log and device data for security."},
    {t:"3. How We Use Your Information",b:"To provide and improve the Service; to retrieve property data on your behalf; to send maintenance reminders (Pro); to process payments; to respond to support requests; to detect and prevent security incidents; and to comply with legal obligations. We do NOT use your data to serve advertisements."},
    {t:"4. How We Share Your Information",b:"Supabase (database, auth, and storage — SOC 2 Type II certified, row-level security enforced); APIllow/Zillow (property lookups, your address only); Geoapify (address autocomplete); Stripe (payment processing — we never store card numbers). We do not sell, rent, or share your data with any other third parties."},
    {t:"5. Data Retention",b:"Active accounts: data retained while your account is active. Deleted accounts: deletion begins within 30 days of account closure; permanent purge after the 30-day grace period. Encrypted backups: up to 90 days. Legal holds: as required by law."},
    {t:"6. Security",b:"Row-level security ensures users cannot access each other\'s data. All data is encrypted in transit (TLS 1.2+) and at rest. Passwords are hashed and never stored in plain text."},
    {t:"7. Your Rights",b:"You may access, correct, export, or delete your data at any time from your account Settings. To submit a data request, email privacy@steadwell.app. We respond within 45 days."},
    {t:"8. California Privacy Rights (CCPA/CPRA)",b:"California residents have the right to know, delete, correct, and opt out of sale (we don\'t sell data). Submit a CCPA request to privacy@steadwell.app with subject line \"California Privacy Request.\" We do not discriminate against users who exercise their privacy rights."},
    {t:"9. Children\'s Privacy",b:"Steadwell is for users 18 and older. We do not knowingly collect data from children under 13. If you believe we have, contact privacy@steadwell.app immediately."},
    {t:"10. Changes to This Policy",b:"We will notify you of material changes via email or in-app notice at least 30 days before they take effect."},
  ];
  return (
    <div style={S.page}>
      <a href="#privacy-main" style={{position:"absolute",top:"-100%",left:8,padding:"8px 16px",background:"#234A3D",color:"#F4EDDF",borderRadius:"0 0 8px 8px",zIndex:9999,fontWeight:600,fontSize:".85rem",textDecoration:"none"}} onFocus={e=>e.target.style.top="0"} onBlur={e=>e.target.style.top="-100%"}>Skip to main content</a>
      <header style={S.hdr} role="banner">
        <a href="/" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}} aria-label="Steadwell homepage"><span style={S.tile}><HM/></span><span style={S.wm}>Steadwell</span></a>
        <div style={{display:"flex",gap:"1.5rem",alignItems:"center"}}>
          <a href="/terms" style={{color:"rgba(244,237,223,.7)",fontSize:".85rem",textDecoration:"none"}}>Terms of Service</a>
          <a href="/ada" style={{color:"rgba(244,237,223,.7)",fontSize:".85rem",textDecoration:"none"}}>Accessibility</a>
        </div>
      </header>
      <main id="privacy-main" tabIndex={-1} style={S.main}>
        <div style={S.eyebrow}>Legal</div>
        <h1 style={S.title}>Privacy Policy</h1>
        <p style={S.meta}>Effective date: June 1, 2026 &nbsp;&middot;&nbsp; Last updated: June 1, 2026</p>
        <div style={S.notice}><strong style={{color:"#C16140"}}>Plain-English summary:</strong> We store your home data to provide the service. We never sell it. Your documents are yours. California residents have CCPA rights. Delete your account and all data anytime from Settings.</div>
        {sections.map(({t,b})=><div key={t}><h2 style={S.h2}>{t}</h2><p style={S.p}>{b}</p></div>)}
        <div style={S.cta}>
          <h2 style={{...S.h2,color:"#F4EDDF",marginTop:0}}>Privacy Questions?</h2>
          <p style={{...S.p,color:"rgba(244,237,223,.82)"}}>Contact <a href="mailto:privacy@steadwell.app" style={{color:"#F4EDDF"}}>privacy@steadwell.app</a> &mdash; we respond within 45 days.</p>
        </div>
      </main>
      <footer role="contentinfo" style={S.ft}>
        <span>&copy; 2026 Steadwell.</span>
        <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap"}}>
          <a href="/terms" style={{color:"rgba(244,237,223,.65)",textDecoration:"none"}}>Terms of Service</a>
          <a href="/ada" style={{color:"rgba(244,237,223,.65)",textDecoration:"none"}}>Accessibility</a>
        </div>
      </footer>
    </div>
  );
}


// ─── ADA ACCESSIBILITY STATEMENT ─────────────────────────────────────────────
function ADAPage() {
  const S = {page:{minHeight:"100vh",background:"#F4EDDF",fontFamily:"'Hanken Grotesk',sans-serif",color:"#2A2723"},hdr:{background:"#234A3D",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"},tile:{width:32,height:32,borderRadius:9,background:"#C16140",display:"flex",alignItems:"center",justifyContent:"center"},wm:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"1.2rem",color:"#F4EDDF"},main:{maxWidth:780,margin:"0 auto",padding:"56px 24px 80px"},eyebrow:{fontSize:".72rem",letterSpacing:".18em",textTransform:"uppercase",color:"#C16140",fontWeight:700,marginBottom:14},title:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"clamp(2rem,5vw,3rem)",color:"#234A3D",marginBottom:12,lineHeight:1.06,letterSpacing:"-.02em"},meta:{fontSize:".88rem",color:"#5E574F",marginBottom:48,paddingBottom:28,borderBottom:"1px solid rgba(42,39,35,.12)"},notice:{background:"#FBF7EE",border:"1px solid rgba(42,39,35,.12)",borderLeft:"4px solid #234A3D",borderRadius:"0 12px 12px 0",padding:"16px 20px",marginBottom:40,fontSize:".9rem"},h2:{fontFamily:"'Fraunces',serif",fontWeight:600,fontSize:"1.25rem",color:"#234A3D",margin:"36px 0 12px"},p:{marginBottom:12,fontSize:"1rem",lineHeight:1.7},li:{marginBottom:8,fontSize:"1rem",lineHeight:1.6},ul:{margin:"0 0 14px 22px"},cta:{background:"#234A3D",color:"#F4EDDF",borderRadius:16,padding:"28px 32px",marginTop:48},ft:{background:"#2A2723",color:"rgba(244,237,223,.5)",padding:"32px 24px",fontSize:".82rem",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:14}};
  const HM = ()=><svg viewBox="0 0 48 48" fill="none" width="62%" height="62%" aria-hidden="true"><path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 34.5 L37 34.5" stroke="#F4EDDF" strokeWidth="3" strokeLinecap="round"/></svg>;
  return (
    <div style={S.page}>
      <a href="#ada-main" style={{position:"absolute",top:"-100%",left:8,padding:"8px 16px",background:"#234A3D",color:"#F4EDDF",borderRadius:"0 0 8px 8px",zIndex:9999,fontWeight:600,fontSize:".85rem",textDecoration:"none"}} onFocus={e=>e.target.style.top="0"} onBlur={e=>e.target.style.top="-100%"}>Skip to main content</a>
      <header style={S.hdr} role="banner">
        <a href="/" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}} aria-label="Steadwell homepage"><span style={S.tile}><HM/></span><span style={S.wm}>Steadwell</span></a>
        <div style={{display:"flex",gap:"1.5rem",alignItems:"center"}}>
          <a href="/terms" style={{color:"rgba(244,237,223,.7)",fontSize:".85rem",textDecoration:"none"}}>Terms of Service</a>
          <a href="/privacy" style={{color:"rgba(244,237,223,.7)",fontSize:".85rem",textDecoration:"none"}}>Privacy Policy</a>
        </div>
      </header>
      <main id="ada-main" tabIndex={-1} style={S.main}>
        <div style={S.eyebrow}>Legal</div>
        <h1 style={S.title}>Accessibility Statement</h1>
        <p style={S.meta}>Effective date: June 1, 2026 &nbsp;&middot;&nbsp; Last reviewed: June 1, 2026</p>
        <div style={S.notice}><strong style={{color:"#234A3D"}}>Our commitment:</strong> Steadwell is committed to making our home management platform accessible to all users, including those with disabilities, in compliance with the Americans with Disabilities Act (ADA) and Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.</div>

        <h2 style={S.h2}>1. Conformance Status</h2>
        <p style={S.p}>Steadwell aims to conform to <strong>WCAG 2.1 Level AA</strong>. We are actively working to identify and remediate any barriers that prevent users with disabilities from accessing our platform. Our current implementation includes:</p>
        <ul style={S.ul}>
          <li style={S.li}>Semantic HTML5 elements with appropriate landmark roles (header, main, nav, footer)</li>
          <li style={S.li}>ARIA labels and roles on all interactive controls, navigation, and dynamic content regions</li>
          <li style={S.li}>Skip-to-content links on all pages so keyboard users can bypass repeated navigation</li>
          <li style={S.li}>Logical heading hierarchy (H1 through H3) maintained throughout the application</li>
          <li style={S.li}>Visible focus indicators on all interactive elements for keyboard-only navigation</li>
          <li style={S.li}>Color contrast ratios meeting or exceeding 4.5:1 for normal text and 3:1 for large text</li>
          <li style={S.li}>Text alternatives for all meaningful images and icon-only controls</li>
          <li style={S.li}>Form inputs associated with descriptive labels and error messages</li>
          <li style={S.li}>No content that flashes more than three times per second</li>
          <li style={S.li}>prefers-reduced-motion media query honored — animations disabled for users who opt out</li>
          <li style={S.li}>Responsive layout supporting 400% browser zoom without horizontal scrolling</li>
        </ul>

        <h2 style={S.h2}>2. Technical Specifications</h2>
        <p style={S.p}>Steadwell relies on the following technologies for accessibility compliance:</p>
        <ul style={S.ul}>
          <li style={S.li}>HTML5 with semantic structure and landmark elements</li>
          <li style={S.li}>CSS3 including custom properties, media queries, and focus-visible</li>
          <li style={S.li}>WAI-ARIA 1.2 roles, states, and properties</li>
          <li style={S.li}>JavaScript (React 19) with managed focus for dynamic content updates</li>
        </ul>

        <h2 style={S.h2}>3. Compatible Browsers and Assistive Technologies</h2>
        <p style={S.p}>Steadwell is designed and tested for compatibility with the following:</p>
        <ul style={S.ul}>
          <li style={S.li}><strong>Screen readers:</strong> NVDA with Firefox (Windows), JAWS with Chrome (Windows), VoiceOver with Safari (macOS and iOS), TalkBack with Chrome (Android)</li>
          <li style={S.li}><strong>Browsers:</strong> Google Chrome (current), Mozilla Firefox (current), Apple Safari (current), Microsoft Edge (current)</li>
          <li style={S.li}><strong>Keyboard navigation:</strong> Full keyboard access using Tab, Shift+Tab, Enter, Space, and arrow keys throughout all features</li>
          <li style={S.li}><strong>Display adaptations:</strong> Windows High Contrast mode, browser zoom up to 400%, OS-level text scaling</li>
        </ul>

        <h2 style={S.h2}>4. Known Limitations</h2>
        <p style={S.p}>While we strive for full WCAG 2.1 AA conformance, the following areas are under active improvement:</p>
        <ul style={S.ul}>
          <li style={S.li}>Some data visualizations in the Expenses tab may lack fully descriptive text alternatives. Summary data tables are being added as accessible equivalents.</li>
          <li style={S.li}>The address autocomplete field relies on Geoapify, a third-party service. Keyboard access is functional but may have minor screen reader announcement delays.</li>
          <li style={S.li}>User-uploaded PDF documents in the Document Vault are not screened for internal accessibility. We recommend uploading tagged, accessible PDFs.</li>
          <li style={S.li}>The interactive Calendar view is optimized for mouse and touch. All calendar functions remain fully accessible via the List view, which is keyboard and screen-reader friendly.</li>
        </ul>

        <h2 style={S.h2}>5. Assessment Approach</h2>
        <p style={S.p}>Steadwell assesses platform accessibility through the following ongoing methods:</p>
        <ul style={S.ul}>
          <li style={S.li}>Automated testing using axe DevTools and Google Lighthouse during development</li>
          <li style={S.li}>Manual keyboard-only navigation testing for all features before release</li>
          <li style={S.li}>Screen reader testing with VoiceOver on Safari/iOS and NVDA on Firefox/Windows</li>
          <li style={S.li}>Review and remediation of all user-submitted accessibility feedback</li>
        </ul>

        <h2 style={S.h2}>6. How to Report an Accessibility Barrier</h2>
        <p style={S.p}>We welcome feedback on accessibility barriers. If you encounter content or features that are inaccessible to you, please contact us:</p>
        <ul style={S.ul}>
          <li style={S.li}><strong>Email:</strong> <a href="mailto:accessibility@steadwell.app" style={{color:"#234A3D"}}>accessibility@steadwell.app</a></li>
          <li style={S.li}><strong>Subject line:</strong> "Accessibility Feedback"</li>
          <li style={S.li}><strong>Response time:</strong> We aim to respond within 5 business days</li>
        </ul>
        <p style={S.p}>Please describe the page you were on, the barrier you encountered, your browser and assistive technology (if applicable), and how we can reach you for follow-up.</p>

        <h2 style={S.h2}>7. ADA Enforcement and Formal Complaints</h2>
        <p style={S.p}>If you are not satisfied with our response, you have the right to file a formal complaint with the U.S. Department of Justice, which enforces Title III of the ADA for places of public accommodation including websites:</p>
        <ul style={S.ul}>
          <li style={S.li}><strong>Online:</strong> <a href="https://www.ada.gov/filing-a-complaint/" target="_blank" rel="noopener noreferrer" style={{color:"#234A3D"}}>ada.gov/filing-a-complaint</a></li>
          <li style={S.li}><strong>Phone (voice):</strong> 1-800-514-0301</li>
          <li style={S.li}><strong>Phone (TTY):</strong> 1-800-514-0383</li>
          <li style={S.li}><strong>Mail:</strong> U.S. Department of Justice, Civil Rights Division, Disability Rights Section, 950 Pennsylvania Avenue NW, Washington, DC 20530</li>
        </ul>

        <h2 style={S.h2}>8. Additional Resources</h2>
        <ul style={S.ul}>
          <li style={S.li}><a href="https://www.ada.gov" target="_blank" rel="noopener noreferrer" style={{color:"#234A3D"}}>ADA.gov</a> — Official ADA guidance from the U.S. Department of Justice</li>
          <li style={S.li}><a href="https://www.w3.org/WAI/WCAG21/quickref/" target="_blank" rel="noopener noreferrer" style={{color:"#234A3D"}}>WCAG 2.1 Quick Reference</a> — W3C Web Accessibility Initiative</li>
          <li style={S.li}><a href="https://webaim.org" target="_blank" rel="noopener noreferrer" style={{color:"#234A3D"}}>WebAIM.org</a> — Web accessibility resources and evaluation tools</li>
        </ul>

        <div style={S.cta}>
          <h2 style={{...S.h2,color:"#F4EDDF",marginTop:0}}>Accessibility Feedback</h2>
          <p style={{...S.p,color:"rgba(244,237,223,.82)"}}>Found a barrier? Email <a href="mailto:accessibility@steadwell.app" style={{color:"#F4EDDF"}}>accessibility@steadwell.app</a> and we will respond within 5 business days.</p>
          <p style={{fontSize:".85rem",color:"rgba(244,237,223,.6)"}}>Steadwell &middot; St. Petersburg, Florida &middot; Targeting WCAG 2.1 Level AA</p>
        </div>
      </main>
      <footer role="contentinfo" style={S.ft}>
        <span>&copy; 2026 Steadwell.</span>
        <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap"}}>
          <a href="/terms" style={{color:"rgba(244,237,223,.65)",textDecoration:"none"}}>Terms of Service</a>
          <a href="/privacy" style={{color:"rgba(244,237,223,.65)",textDecoration:"none"}}>Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}

// ─── PLAN SYSTEM ─────────────────────────────────────────────────────────────
// Plan values: "free" | "plus" | "pro"
// Stored in profiles.plan — defaults to "free"

const PLANS = {
  free: {
    label: "Free", color: "free",
    maxDocs: 5, maxFiles: 5, maxFileMB: 10, maxProperties: 1,
    recurring: "basic",
    reminders: "basic",
    setupWizard: "hvac",
    healthScore: false,
    costForecast: false,
    aiScan: false,
    sharedAccess: false,
    exportPrice: 9.99,
    presalePrice: 19.99,
  },
  plus: {
    label: "Plus", color: "plus",
    maxDocs: 25, maxFiles: 25, maxFileMB: 25, maxProperties: 1,
    recurring: "full",
    reminders: "full",
    setupWizard: "full",
    healthScore: true,
    costForecast: true,
    aiScan: true,
    sharedAccess: false,
    exportPrice: 0,
    presalePrice: 9.99,
  },
  pro: {
    label: "Pro", color: "pro",
    maxDocs: Infinity, maxFiles: Infinity, maxFileMB: 50, maxProperties: 3,
    recurring: "full",
    reminders: "full",
    setupWizard: "full",
    healthScore: true,
    costForecast: true,
    aiScan: true,
    sharedAccess: true,
    exportPrice: 0,
    presalePrice: 0,
  },
};

function usePlan(profile) {
  const plan = profile?.plan || "free";
  return { plan, ...PLANS[plan] || PLANS.free };
}

// Counts ALL uploaded files across vault, asset photos, and expense receipts
// Home profile photo is exempt (decorative, one slot)
async function checkFileLimit(userId, planData) {
  if (!planData || planData.maxFiles === Infinity) return { ok: true, count: 0, max: Infinity };
  try {
    const [docs, assets, expenses] = await Promise.all([
      supabase.from("home_documents").select("id", { count:"exact", head:true }).eq("user_id", userId).not("file_url","is",null).neq("file_url",""),
      supabase.from("warranties").select("id", { count:"exact", head:true }).eq("user_id", userId).not("asset_photo_url","is",null).neq("asset_photo_url",""),
      supabase.from("expenses").select("id", { count:"exact", head:true }).eq("user_id", userId).not("file_url","is",null).neq("file_url",""),
    ]);
    const count = (docs.count||0) + (assets.count||0) + (expenses.count||0);
    return { ok: count < planData.maxFiles, count, max: planData.maxFiles };
  } catch { return { ok: true, count: 0, max: planData.maxFiles }; } // fail open — don't block on error
}

// ─── HEALTH SCORE ENGINE ──────────────────────────────────────────────────────
// Pure function — returns { score, grade, factors }
function computeHealthScore(tasks, warranties, profile) {
  const now = new Date();
  const today = localISO(now);

  // Factor 1: Task health (0-100) — penalise overdue/incomplete
  const totalTasks = tasks.length;
  const overdue    = tasks.filter(t => t.status !== "Completed" && t.due_date && t.due_date < today).length;
  const completed  = tasks.filter(t => t.status === "Completed").length;
  const taskScore  = totalTasks === 0 ? 70
    : Math.max(0, 100 - (overdue / totalTasks) * 60 - ((totalTasks - completed) / totalTasks) * 20);

  // Factor 2: Asset health (0-100) — penalise old assets
  const AGE_MAP = { "0-5":2, "6-10":8, "11-15":13, "16+":20 };
  const assets = warranties || [];
  const assetScore = assets.length === 0 ? 70 : (() => {
    const scores = assets.map(a => {
      const notes = a.notes || "";
      const ageMatch = notes.match(/Age: (\d+-\d+|\d+\+) years/);
      if (!ageMatch) return 80;
      const age = AGE_MAP[ageMatch[1]] || 5;
      return age <= 5 ? 100 : age <= 10 ? 85 : age <= 15 ? 60 : 30;
    });
    return scores.reduce((s,v) => s+v, 0) / scores.length;
  })();

  // Factor 3: Warranty coverage (0-100) — reward tracked warranties
  const expiring = assets.filter(a => a.expiry_date && a.expiry_date < localISO(new Date(now.getTime() + 30*86400000))).length;
  const warrantyScore = assets.length === 0 ? 60
    : Math.max(0, 100 - (expiring / assets.length) * 40);

  // Factor 4: Documentation (0-100) — reward complete profile
  const profileFields = ["address","type","year","sqft","bedrooms","bathrooms","ins_company","ins_renewal_date"].filter(f => profile?.[f]);
  const docScore = Math.round((profileFields.length / 8) * 100);

  // Weighted total
  const score = Math.round(
    taskScore    * 0.40 +
    assetScore   * 0.30 +
    warrantyScore* 0.15 +
    docScore     * 0.15
  );

  const grade = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : "Needs attention";
  const color = score >= 90 ? "#2A9D6A" : score >= 75 ? "#234A3D" : score >= 60 ? "#B8861E" : "#C16140";

  return {
    score,
    grade,
    color,
    factors: [
      { label: "Tasks",         val: Math.round(taskScore),     color: taskScore >= 75 ? "#2A9D6A" : "#C16140" },
      { label: "Assets",        val: Math.round(assetScore),    color: assetScore >= 75 ? "#2A9D6A" : "#B8861E" },
      { label: "Warranties",    val: Math.round(warrantyScore), color: warrantyScore >= 75 ? "#2A9D6A" : "#C16140" },
      { label: "Profile",       val: Math.round(docScore),      color: docScore >= 75 ? "#2A9D6A" : "#B8861E" },
    ],
  };
}

// ─── COST FORECAST ENGINE ─────────────────────────────────────────────────────
// Returns 5-year projected spend based on asset ages and typical replacement costs
const REPLACEMENT_COSTS = {
  "HVAC":       { life:18, cost:10000, label:"HVAC system"        },
  "Plumbing":   { life:12, cost:1200,  label:"Water heater"       },
  "Roofing":    { life:25, cost:16000, label:"Roof replacement"   },
  "Electrical": { life:30, cost:3500,  label:"Electrical panel"   },
  "Structural": { life:40, cost:8000,  label:"Foundation/structure"},
  "Appliances": { life:12, cost:900,   label:"Appliance"          },
  "Other":      { life:15, cost:2000,  label:"System"             },
};
const AGE_TO_YEARS = { "0-5":3, "6-10":8, "11-15":13, "16+":20 };

function computeCostForecast(warranties, years=5) {
  const thisYear = new Date().getFullYear();
  const yearBuckets = Array.from({length:years}, (_,i) => ({ year: thisYear+i, items:[], total:0 }));

  (warranties||[]).forEach(asset => {
    const cat = asset.category || "Other";
    const template = REPLACEMENT_COSTS[cat] || REPLACEMENT_COSTS.Other;
    const notes = asset.notes || "";
    const ageMatch = notes.match(/Age: (\d+-\d+|\d+\+) years/);
    const currentAge = ageMatch ? (AGE_TO_YEARS[ageMatch[1]] || 5) : 5;
    const remainingLife = Math.max(0, template.life - currentAge);

    if (remainingLife < years) {
      const replaceInYear = thisYear + Math.max(0, Math.ceil(remainingLife));
      const bucket = yearBuckets.find(b => b.year === replaceInYear);
      if (bucket) {
        bucket.items.push({ name: asset.item || template.label, cost: template.cost, category: cat });
        bucket.total += template.cost;
      }
    }

    // Annual maintenance ~1% of replacement cost
    const annualMaint = template.cost * 0.01;
    yearBuckets.forEach(b => { b.total += annualMaint; });
  });

  const fiveYearTotal = yearBuckets.reduce((s,b) => s+b.total, 0);
  return { yearBuckets, fiveYearTotal };
}

// ─── UPGRADE PROMPT ───────────────────────────────────────────────────────────
function UpgradePrompt({ icon="✨", title, sub, target="plus", onUpgrade }) {
  return (
    <div className="upgrade-prompt">
      <span className="upgrade-prompt-icon">{icon}</span>
      <div className="upgrade-prompt-text">
        <div className="upgrade-prompt-title">{title}</div>
        <div className="upgrade-prompt-sub">{sub}</div>
      </div>
      <button className="upgrade-prompt-btn" onClick={onUpgrade}>
        {target === "pro" ? "Upgrade to Pro" : "Upgrade to Plus"} →
      </button>
    </div>
  );
}

// ─── HEALTH SCORE WIDGET ──────────────────────────────────────────────────────
function HealthScoreWidget({ tasks, warranties, profile, planData, onUpgrade }) {
  const { score, grade, color, factors } = computeHealthScore(tasks, warranties, profile);
  const locked = !planData.healthScore;
  const r = 28, C = 2 * Math.PI * r;
  const dash = (score / 100) * C;

  return (
    <div style={{background:"var(--white)",border:"1px solid var(--stone)",borderRadius:"var(--r)",padding:"1rem",marginBottom:".75rem"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:".85rem"}}>
        <span style={{fontFamily:"'Fraunces',serif",fontSize:".9rem",fontWeight:500,color:"var(--dark)"}}>🏠 Home Health</span>
        {!locked && <span className={`plan-badge ${planData.color}`}>{planData.label}</span>}
      </div>
      <div style={{display:"flex",gap:"1rem",alignItems:"center"}}>
        {/* Gauge — score number only, grade sits below */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
          <div style={{position:"relative",width:72,height:72}}>
            <svg width="72" height="72" viewBox="0 0 72 72" style={{transform:"rotate(-90deg)",display:"block"}}>
              <circle cx="36" cy="36" r={r} fill="none" stroke="#E8E2D9" strokeWidth="8"/>
              <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="8"
                strokeDasharray={`${dash} ${C}`} strokeLinecap="round"/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:"'Fraunces',serif",fontSize:"1.4rem",fontWeight:700,color:"var(--dark)",lineHeight:1}}>{score}</span>
            </div>
          </div>
          <span style={{fontSize:".65rem",color:color,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>{grade}</span>
        </div>
        {/* Factors */}
        <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:".42rem"}}>
          {factors.map(f => (
            <div key={f.label} style={{display:"flex",alignItems:"center",gap:".5rem"}}>
              <span style={{fontSize:".68rem",color:"#7A7370",flexShrink:0,width:58}}>{f.label}</span>
              <div style={{flex:1,minWidth:0,height:5,borderRadius:3,background:"#E8E2D9",overflow:"hidden"}}>
                {!locked && <div style={{width:`${f.val}%`,height:"100%",borderRadius:3,background:f.color}}/>}
              </div>
              <span style={{fontSize:".68rem",fontWeight:600,color:locked?"#C8C0B8":"var(--dark)",width:22,textAlign:"right",flexShrink:0}}>
                {locked ? "—" : f.val}
              </span>
            </div>
          ))}
        </div>
      </div>
      {locked && (
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:".6rem"}}>
          <button onClick={onUpgrade} style={{fontSize:".72rem",color:"#3B5FBF",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Hanken Grotesk',sans-serif",fontWeight:600}}>
            See what to improve → Plus
          </button>
        </div>
      )}
    </div>
  );
}

// ─── COST FORECAST WIDGET ─────────────────────────────────────────────────────
function CostForecastWidget({ warranties, planData, onUpgrade }) {
  const { yearBuckets, fiveYearTotal } = computeCostForecast(warranties, 5);
  const locked = !planData.costForecast;
  const fmt = (n) => n >= 1000 ? `$${(n/1000)%1===0?(n/1000):(n/1000).toFixed(1)}k` : `$${Math.round(n)}`;
  const maxTotal = Math.max(...yearBuckets.map(b => b.total), 1);
  const VW=500,VH=130,PT=22,PB=22,PL=4,PR=4;
  const chartH=VH-PT-PB, slotW=(VW-PL-PR)/5, barW=slotW*0.58;
  const font="'Hanken Grotesk',Arial,sans-serif";
  return (
    <div style={{background:"var(--white)",border:"1px solid var(--stone)",borderRadius:"var(--r)",padding:"1rem",marginBottom:".75rem"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:".6rem"}}>
        <span style={{fontFamily:"'Fraunces',serif",fontSize:".9rem",fontWeight:500,color:"var(--dark)"}}>📈 Cost Forecast</span>
        {!locked && <span className={`plan-badge ${planData.color}`}>{planData.label}</span>}
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{width:"100%",height:"auto",display:"block"}}>
        {yearBuckets.map((b,i)=>{
          const isLocked=locked&&i>0;
          const barH=Math.max(Math.round((b.total/maxTotal)*chartH),3);
          const bx=PL+i*slotW+(slotW-barW)/2;
          const by=PT+chartH-barH;
          const cx=PL+i*slotW+slotW/2;
          const barColor=isLocked?"#E0DAD2":b.items.length>0?"#C16140":"#A7BFA8";
          return (
            <g key={i}>
              <rect x={bx} y={by} width={barW} height={barH} rx="3" fill={barColor}/>
              <text x={cx} y={PT-5} textAnchor="middle" fontSize="10.5" fontWeight="600"
                fill={isLocked?"#C8C0B8":"#5A534B"} fontFamily={font}>{isLocked?"—":fmt(b.total)}</text>
              <text x={cx} y={VH-3} textAnchor="middle" fontSize="10"
                fill={i===0?"#5A534B":"#A8A09A"} fontFamily={font}>{b.year}</text>
            </g>
          );
        })}
      </svg>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:".15rem"}}>
        {locked ? (
          <>
            <span style={{fontSize:".74rem",color:"#7A7370"}}>This year: <strong style={{color:"var(--dark)"}}>{fmt(yearBuckets[0]?.total||0)}</strong></span>
            <button onClick={onUpgrade} style={{fontSize:".72rem",color:"#3B5FBF",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Hanken Grotesk',sans-serif",fontWeight:600,whiteSpace:"nowrap"}}>Full forecast → Plus</button>
          </>
        ) : (
          <>
            <span style={{fontSize:".74rem",color:"#7A7370"}}>5-year projected: <strong style={{color:"var(--dark)"}}>{fmt(fiveYearTotal)}</strong></span>
            {yearBuckets.some(b=>b.items.length>0)&&<span style={{fontSize:".72rem",color:"#C16140",fontWeight:600}}>{yearBuckets.filter(b=>b.items.length>0).length} replacement(s) due</span>}
          </>
        )}
      </div>
    </div>
  );
}


function HomeSetupWizard({ existingAssets=[], profile, setProfile, toast, userId, planData, onComplete }) {
  const STEPS = ["HVAC","Water","Structure","Extras","Review"];
  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [reviewTab, setReviewTab] = useState("assets");

  // Answers state
  const [A, setA] = useState({
    hvac: { hasCentralAC:null, acType:null, acAge:null, hasFurnace:null, furnaceFuel:null, furnaceAge:null, hasHumidifier:null, notes:"" },
    water:{ source:null, hasPressureTank:null, hasWaterHeater:null, heaterType:null, heaterAge:null, hasSoftener:null, notes:"" },
    structure:{ roofType:null, roofAge:null, exteriorType:null, foundationType:null, hasChimney:null, notes:"" },
    extras:{ hasPool:null, poolType:null, poolChemistry:null, hasIrrigation:null, hasSolar:null, hasSeptic:null, hasGenerator:null, notes:"" },
    custom:"",
  });

  const set = (section, key, val) => setA(a => ({...a, [section]:{...a[section],[key]:val}}));

  // Generated output (computed on step 4 — review)
  const [generated, setGenerated] = useState(null);
  // Checked state for review items
  const [assetChecks, setAssetChecks]     = useState({});
  const [taskChecks, setTaskChecks]       = useState({});
  const [projectChecks, setProjectChecks] = useState({});
  // Duplicate resolution: "add_new" | "update" | "skip" per asset key
  const [dupResolutions, setDupResolutions] = useState({});

  // Compute duplicates against existing assets
  const findDup = (asset) => {
    if (!existingAssets.length) return null;
    const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g,"").split(" ").filter(w=>w.length>3);
    const aWords = words(asset.item);
    return existingAssets.find(ea =>
      ea.category === asset.category &&
      aWords.some(w => words(ea.item).includes(w))
    ) || null;
  };

  // Navigate to review — generate output
  const goReview = () => {
    const result = generateHomeProfile(A);
    setGenerated(result);
    // Init all checked true
    const ac={}, tc={}, pc={};
    result.assets.forEach((_,i)   => ac[i] = true);
    result.tasks.forEach((_,i)    => tc[i] = true);
    result.projects.forEach((_,i) => pc[i] = true);
    setAssetChecks(ac); setTaskChecks(tc); setProjectChecks(pc);
    // Init dup resolutions to "add_new" (user can change)
    const dr={};
    result.assets.forEach((a,i) => { if(findDup(a)) dr[i] = "add_new"; });
    setDupResolutions(dr);
    setStep(4);
  };

  // Batch save to Supabase
  const save = async () => {
    if (!generated) return;
    setSaving(true);
    try {
      const keyToId = {}; // _key → real DB asset id

      // 1. Save selected assets
      for (let i = 0; i < generated.assets.length; i++) {
        if (!assetChecks[i]) continue;
        const { _key, ...assetData } = generated.assets[i];
        const dup = findDup(generated.assets[i]);
        const res = dupResolutions[i] || "add_new";

        if (dup && res === "skip") continue;
        if (dup && res === "update") {
          const notes = [dup.notes, assetData.notes].filter(Boolean).join(" · ");
          await supabase.from("warranties").update({...assetData, notes}).eq("id",dup.id).eq("user_id",userId);
          keyToId[_key] = dup.id;
        } else {
          const { data } = await supabase.from("warranties").insert([{...assetData, user_id:userId}]).select("id");
          if (data?.[0]) keyToId[_key] = data[0].id;
        }
      }

      // 2. Save selected tasks (resolve asset_id from keyToId)
      const taskRows = generated.tasks
        .filter((_,i) => taskChecks[i])
        .map(({ _assetKey, ...t }) => ({
          ...t,
          asset_id: _assetKey ? (keyToId[_assetKey] || null) : null,
          user_id: userId,
        }));
      if (taskRows.length) await supabase.from("tasks").insert(taskRows);

      // 3. Save selected projects — Plus/Pro only
      const canCreateProjects = planData?.plan === "plus" || planData?.plan === "pro";
      if (canCreateProjects) {
        const projRows = generated.projects
          .filter((_,i) => projectChecks[i])
          .map(({ ...p }) => ({ ...p, user_id: userId }));
        if (projRows.length) await supabase.from("projects").insert(projRows);
      }

      // Mark setup complete — write to DB (persists across devices) + localStorage (fast read)
      if (profile?.id) {
        await supabase.from("profiles")
          .update({ home_setup_complete: true })
          .eq("id", profile.id)
          .eq("user_id", userId);
      }
      try { localStorage.setItem(`sw_setup_${userId}`, "1"); } catch {}

      // Update parent profile state so banner hides immediately without a reload
      if (setProfile) setProfile(prev => ({ ...prev, home_setup_complete: true }));

      const aCount = Object.values(assetChecks).filter(Boolean).length;
      const tCount = Object.values(taskChecks).filter(Boolean).length;
      const pCount = canCreateProjects ? Object.values(projectChecks).filter(Boolean).length : 0;
      const msg = `✓ Home profile set up — ${aCount} assets, ${tCount} tasks${pCount ? `, ${pCount} projects` : ""} created`;
      toast(msg);
      onComplete();
    } catch (err) {
      toast("Error saving — " + err.message, "error");
    }
    setSaving(false);
  };

  // ── Shared sub-components ────────────────────────────────────────────────────
  const YN = ({ section, field, val, label="Yes", noLabel="No" }) => (
    <div className="yn-row">
      <button className={`yn ${val===true?"sel-yes":""}`}  onClick={()=>set(section,field,true)}>✓ {label}</button>
      <button className={`yn ${val===false?"sel-no":""}`}  onClick={()=>set(section,field,false)}>✕ {noLabel}</button>
    </div>
  );

  const Opts = ({ section, field, val, options }) => (
    <div className="yn-row">
      {options.map(([v,l]) => (
        <button key={v} className={`yn ${val===v?"sel-opt":""}`} onClick={()=>set(section,field,v)}>{l}</button>
      ))}
    </div>
  );

  const AgeOpts = ({ section, field, val }) => (
    <Opts section={section} field={field} val={val} options={[["0-5","0–5 yrs"],["6-10","6–10 yrs"],["11-15","11–15 yrs"],["16+","16+ yrs"]]}/>
  );

  const Progress = () => (
    <div className="hsw-progress">
      {STEPS.map((s,i) => <div key={s} className={`hsw-prog-seg ${i<step?"done":i===step?"active":""}`}/>)}
    </div>
  );

  // ── STEP 0 — HVAC ────────────────────────────────────────────────────────────
  if (step === 0) return (
    <div className="hsw-wrap">
      <Progress/>
      <div className="hsw-section-title">🌡️ Heating & Cooling</div>
      <div className="hsw-section-sub">Tell us about your home's climate systems. We'll build a maintenance schedule around what you actually have.</div>

      <div className="hsw-q">
        <div className="hsw-q-label">Do you have central air conditioning or a heat pump?</div>
        <YN section="hvac" field="hasCentralAC" val={A.hvac.hasCentralAC}/>
        {A.hvac.hasCentralAC && (
          <div className="hsw-sub-q">
            <div>
              <div className="hsw-q-label">What type?</div>
              <Opts section="hvac" field="acType" val={A.hvac.acType} options={[["central_ac","Central AC"],["heat_pump","Heat pump"],["both","Both"]]}/>
            </div>
            <div>
              <div className="hsw-q-label">How old is the system?</div>
              <AgeOpts section="hvac" field="acAge" val={A.hvac.acAge}/>
            </div>
          </div>
        )}
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Do you have a furnace or boiler?</div>
        <YN section="hvac" field="hasFurnace" val={A.hvac.hasFurnace}/>
        {A.hvac.hasFurnace && (
          <div className="hsw-sub-q">
            <div>
              <div className="hsw-q-label">Fuel type?</div>
              <Opts section="hvac" field="furnaceFuel" val={A.hvac.furnaceFuel} options={[["gas","Gas"],["oil","Oil"],["electric","Electric"],["propane","Propane"]]}/>
            </div>
            <div>
              <div className="hsw-q-label">How old is the furnace?</div>
              <AgeOpts section="hvac" field="furnaceAge" val={A.hvac.furnaceAge}/>
            </div>
          </div>
        )}
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Whole-house humidifier or dehumidifier?</div>
        <YN section="hvac" field="hasHumidifier" val={A.hvac.hasHumidifier}/>
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Anything else? <span style={{fontWeight:400,color:"#9E9690"}}>(optional)</span></div>
        <div className="hsw-q-sub">e.g. mini-split, radiant floor heating, window units</div>
        <textarea className="hsw-free" rows={2} value={A.hvac.notes} onChange={e=>set("hvac","notes",e.target.value)} placeholder="Describe any other heating or cooling systems…"/>
      </div>

      <div className="hsw-nav">
        <button className="btn btn-ghost" onClick={onComplete}>Skip setup</button>
        <button className="btn btn-primary" onClick={()=>setStep(1)}>Next: Water →</button>
      </div>
    </div>
  );

  // ── STEP 1 — WATER ───────────────────────────────────────────────────────────
  if (step === 1) return (
    <div className="hsw-wrap">
      <Progress/>
      <div className="hsw-section-title">💧 Water Systems</div>
      <div className="hsw-section-sub">Your water source and heater type determine very different maintenance needs.</div>

      <div className="hsw-q">
        <div className="hsw-q-label">What is your water source?</div>
        <Opts section="water" field="source" val={A.water.source} options={[["city","City water"],["well","Private well"],["both","Both"]]}/>
        {(A.water.source==="well"||A.water.source==="both") && (
          <div className="hsw-sub-q">
            <div>
              <div className="hsw-q-label">Do you have a pressure tank?</div>
              <div className="yn-row">
                <button className={`yn ${A.water.hasPressureTank===true?"sel-yes":""}`}  onClick={()=>set("water","hasPressureTank",true)}>✓ Yes</button>
                <button className={`yn ${A.water.hasPressureTank===false?"sel-no":""}`}  onClick={()=>set("water","hasPressureTank",false)}>✕ No</button>
                <button className={`yn ${A.water.hasPressureTank===null&&A.water.source?"sel-opt":""}`} onClick={()=>set("water","hasPressureTank",null)}>Not sure</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Do you have a water heater?</div>
        <YN section="water" field="hasWaterHeater" val={A.water.hasWaterHeater}/>
        {A.water.hasWaterHeater && (
          <div className="hsw-sub-q">
            <div>
              <div className="hsw-q-label">Tank or tankless?</div>
              <Opts section="water" field="heaterType" val={A.water.heaterType} options={[["tank","Storage tank"],["tankless","Tankless / on-demand"]]}/>
            </div>
            <div>
              <div className="hsw-q-label">How old is the water heater?</div>
              <AgeOpts section="water" field="heaterAge" val={A.water.heaterAge}/>
            </div>
          </div>
        )}
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Do you have a water softener or whole-house filtration?</div>
        <YN section="water" field="hasSoftener" val={A.water.hasSoftener}/>
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Anything else? <span style={{fontWeight:400,color:"#9E9690"}}>(optional)</span></div>
        <textarea className="hsw-free" rows={2} value={A.water.notes} onChange={e=>set("water","notes",e.target.value)} placeholder="e.g. whole-house filtration, UV purifier, rainwater collection…"/>
      </div>

      <div className="hsw-nav">
        <button className="btn btn-ghost" onClick={()=>setStep(0)}>← Back</button>
        <button className="btn btn-primary" onClick={()=>setStep(2)}>Next: Structure →</button>
      </div>
    </div>
  );

  // ── STEP 2 — STRUCTURE ───────────────────────────────────────────────────────
  if (step === 2) return (
    <div className="hsw-wrap">
      <Progress/>
      <div className="hsw-section-title">🏠 Structure & Exterior</div>
      <div className="hsw-section-sub">Roof type and age, foundation, and exterior material all drive different maintenance schedules.</div>

      <div className="hsw-q">
        <div className="hsw-q-label">What type of roof do you have?</div>
        <Opts section="structure" field="roofType" val={A.structure.roofType} options={[["shingle","Asphalt shingle"],["metal","Metal"],["tile","Tile / clay"],["flat","Flat"],["unknown","Not sure"]]}/>
        {A.structure.roofType && A.structure.roofType !== "unknown" && (
          <div className="hsw-sub-q">
            <div className="hsw-q-label">How old is the roof?</div>
            <AgeOpts section="structure" field="roofAge" val={A.structure.roofAge}/>
          </div>
        )}
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">What is your exterior made of?</div>
        <Opts section="structure" field="exteriorType" val={A.structure.exteriorType} options={[["brick","Brick"],["vinyl_siding","Vinyl siding"],["stucco","Stucco"],["wood","Wood"],["mixed","Mixed"]]}/>
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">What type of foundation do you have?</div>
        <Opts section="structure" field="foundationType" val={A.structure.foundationType} options={[["slab","Slab"],["crawlspace","Crawl space"],["basement","Basement"],["unknown","Not sure"]]}/>
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Do you have a chimney or fireplace?</div>
        <YN section="structure" field="hasChimney" val={A.structure.hasChimney}/>
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Anything else? <span style={{fontWeight:400,color:"#9E9690"}}>(optional)</span></div>
        <textarea className="hsw-free" rows={2} value={A.structure.notes} onChange={e=>set("structure","notes",e.target.value)} placeholder="e.g. detached garage, deck, fence, retaining wall…"/>
      </div>

      <div className="hsw-nav">
        <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Back</button>
        <button className="btn btn-primary" onClick={()=>setStep(3)}>Next: Extras →</button>
      </div>
    </div>
  );

  // ── STEP 3 — EXTRAS ──────────────────────────────────────────────────────────
  if (step === 3) return (
    <div className="hsw-wrap">
      <Progress/>
      <div className="hsw-section-title">⚡ Additional Systems</div>
      <div className="hsw-section-sub">Pool, solar, generator — each comes with its own maintenance track.</div>

      <div className="hsw-q">
        <div className="hsw-q-label">Do you have a pool or hot tub?</div>
        <YN section="extras" field="hasPool" val={A.extras.hasPool}/>
        {A.extras.hasPool && (
          <div className="hsw-sub-q">
            <div>
              <div className="hsw-q-label">Which do you have?</div>
              <Opts section="extras" field="poolType" val={A.extras.poolType} options={[["pool","Pool only"],["hot_tub","Hot tub only"],["both","Both"]]}/>
            </div>
            {(A.extras.poolType==="pool"||A.extras.poolType==="both") && (
              <div>
                <div className="hsw-q-label">Pool chemistry type?</div>
                <Opts section="extras" field="poolChemistry" val={A.extras.poolChemistry} options={[["chlorine","Chlorine"],["saltwater","Saltwater"]]}/>
              </div>
            )}
          </div>
        )}
      </div>

      {[
        ["hasIrrigation","🌿","Do you have an irrigation or sprinkler system?"],
        ["hasSolar","☀️","Do you have solar panels?"],
        ["hasSeptic","🔄","Do you have a septic system?"],
        ["hasGenerator","⚡","Do you have a backup generator?"],
      ].map(([field, icon, label]) => (
        <div key={field} className="hsw-q">
          <div className="hsw-q-label">{icon} {label}</div>
          <YN section="extras" field={field} val={A.extras[field]}/>
        </div>
      ))}

      <div className="hsw-q">
        <div className="hsw-q-label">Anything else we should know? <span style={{fontWeight:400,color:"#9E9690"}}>(optional)</span></div>
        <textarea className="hsw-free" rows={2} value={A.extras.notes} onChange={e=>set("extras","notes",e.target.value)} placeholder="e.g. EV charger, whole-house battery, second kitchen, ADU…"/>
      </div>

      <div className="hsw-q">
        <div className="hsw-q-label">Any other systems or assets to add? <span style={{fontWeight:400,color:"#9E9690"}}>(optional)</span></div>
        <textarea className="hsw-free" rows={2} value={A.custom} onChange={e=>setA(a=>({...a,custom:e.target.value}))} placeholder="Freeform — anything not covered above…"/>
      </div>

      <div className="hsw-nav">
        <button className="btn btn-ghost" onClick={()=>setStep(2)}>← Back</button>
        <button className="btn btn-primary" onClick={goReview}>Review →</button>
      </div>
    </div>
  );

  // ── STEP 4 — REVIEW ──────────────────────────────────────────────────────────
  if (step === 4 && generated) {
    const selA = generated.assets.filter((_,i)  => assetChecks[i]);
    const selT = generated.tasks.filter((_,i)   => taskChecks[i]);
    const selP = generated.projects.filter((_,i) => projectChecks[i]);

    return (
      <div className="hsw-wrap">
        <Progress/>
        <div className="hsw-section-title">✓ Review your home profile</div>
        <div className="hsw-section-sub">Here's what we'll create. Uncheck anything you don't want. You can always add or edit later.</div>

        {/* Summary row */}
        <div className="hsw-summary-row">
          {[
            [selA.length, "assets"],
            [selT.length, "tasks"],
            [selP.length, "projects"],
          ].map(([n,l]) => (
            <div key={l} className="hsw-summary-stat">
              <div className="hsw-summary-num">{n}</div>
              <div className="hsw-summary-label">{l}</div>
            </div>
          ))}
        </div>

        {/* Tab toggle */}
        <div className="hsw-review-tabs">
          {[["assets","Assets"],["tasks","Tasks"],["projects","Projects"],["utilities","Utilities"]].map(([k,l]) => (
            <button key={k} className={`hsw-rtab ${reviewTab===k?"on":""}`} onClick={()=>setReviewTab(k)}>{l}</button>
          ))}
        </div>

        {/* Assets tab */}
        {reviewTab === "assets" && (
          <div className="hsw-review-list">
            {generated.assets.length === 0 ? (
              <div style={{color:"#9E9690",fontSize:".83rem",padding:".5rem"}}>No assets generated — answer more questions to add assets.</div>
            ) : generated.assets.map((a, i) => {
              const dup = findDup(a);
              const res = dupResolutions[i] || "add_new";
              return (
                <div key={i}>
                  <div className="hsw-item" onClick={()=>setAssetChecks(c=>({...c,[i]:!c[i]}))}>
                    <input type="checkbox" checked={!!assetChecks[i]} readOnly/>
                    <div className="hsw-item-info">
                      <div className="hsw-item-title">{a.item}</div>
                      <div className="hsw-item-sub">{a.category}{a.notes ? ` · ${a.notes}` : ""}</div>
                    </div>
                    {dup && <span className="hsw-dup-badge">⚠ Similar exists</span>}
                  </div>
                  {dup && assetChecks[i] && (
                    <div className="hsw-dup-block">
                      <div>Existing: <strong>{dup.item}</strong> · {dup.category}</div>
                      <div style={{marginTop:"2px",color:"#9E9690"}}>You may have two of this system — choose how to handle:</div>
                      <div className="hsw-dup-choices">
                        {[["add_new","Add as new"],["update","Update existing"],["skip","Skip"]].map(([v,l]) => (
                          <button key={v} className={`hsw-dup-btn ${res===v?"active":""}`}
                            onClick={e=>{e.stopPropagation();setDupResolutions(d=>({...d,[i]:v}));}}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tasks tab */}
        {reviewTab === "tasks" && (
          <div className="hsw-review-list">
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:".4rem"}}>
              <span style={{fontSize:".72rem",color:"#9E9690"}}>{selT.length} of {generated.tasks.length} selected</span>
              <div style={{display:"flex",gap:".4rem"}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setTaskChecks(Object.fromEntries(generated.tasks.map((_,i)=>[i,true])))}>All</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setTaskChecks(Object.fromEntries(generated.tasks.map((_,i)=>[i,false])))}>None</button>
              </div>
            </div>
            {generated.tasks.map((t, i) => (
              <div key={i} className="hsw-item" onClick={()=>setTaskChecks(c=>({...c,[i]:!c[i]}))}>
                <input type="checkbox" checked={!!taskChecks[i]} readOnly/>
                <div className="hsw-item-info">
                  <div className="hsw-item-title">{t.title}</div>
                  <div className="hsw-item-sub">
                    {t.priority} · {t.recurring ? `🔁 ${t.recurring}` : "one-time"} · due {new Date(t.due_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Projects tab */}
        {reviewTab === "projects" && (
          <div className="hsw-review-list">
            {generated.projects.length === 0 ? (
              <div style={{color:"#9E9690",fontSize:".83rem",padding:".5rem"}}>No projects suggested — your systems are all in good shape.</div>
            ) : (
              <>
                {(planData?.plan === "free") && (
                  <div style={{background:"#EEF4FF",border:"1px solid #C5D5F7",borderRadius:"10px",padding:".7rem .85rem",marginBottom:".5rem",display:"flex",alignItems:"center",justifyContent:"space-between",gap:".75rem"}}>
                    <div style={{fontSize:".78rem",color:"#3B5FBF",lineHeight:1.4}}>
                      <strong>Projects are a Plus feature.</strong> Upgrade to automatically create these budget plans.
                    </div>
                  </div>
                )}
                {generated.projects.map((p, i) => {
                  const isLocked = planData?.plan === "free";
                  return (
                    <div key={i}
                      className="hsw-item"
                      onClick={()=>!isLocked && setProjectChecks(c=>({...c,[i]:!c[i]}))}
                      style={{opacity: isLocked ? 0.5 : 1, cursor: isLocked ? "default" : "pointer"}}
                    >
                      <input type="checkbox" checked={isLocked ? false : !!projectChecks[i]} readOnly disabled={isLocked}/>
                      <div className="hsw-item-info">
                        <div className="hsw-item-title">{p.name}</div>
                        <div className="hsw-item-sub">{p.notes} · Budget: ${p.budget?.toLocaleString()}</div>
                      </div>
                      {isLocked && <span style={{fontSize:".65rem",color:"#3B5FBF",fontWeight:700,flexShrink:0}}>Plus</span>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Utilities tab */}
        {reviewTab === "utilities" && (
          <div>
            <div style={{fontSize:".82rem",color:"#5A534B",marginBottom:".6rem",lineHeight:1.5}}>
              Based on your answers, you'll want to track these utility expenses in the <strong>Finances → Utilities</strong> tab:
            </div>
            <div className="hsw-util-chips">
              {generated.utilities.map(u => <span key={u} className="hsw-util-chip">⚡ {u}</span>)}
            </div>
            <div style={{fontSize:".75rem",color:"#9E9690",marginTop:".75rem"}}>
              Utilities are not created automatically — head to Finances → Utilities after setup to start logging your bills.
            </div>
          </div>
        )}

        <div className="hsw-nav">
          <button className="btn btn-ghost" onClick={()=>setStep(3)}>← Back</button>
          <button className="btn btn-rust" onClick={save} disabled={saving||(!selA.length&&!selT.length&&!selP.length)}>
            {saving ? "Setting up…" : `Set up my home (${selA.length+selT.length+selP.length} items) →`}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
