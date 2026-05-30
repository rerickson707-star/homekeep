import { useState, useEffect, useRef } from "react";
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
const CHART_COLORS = ["#C1622B","#4A89B8","#6B8F71","#C9962A","#8B5CF6","#EC4899","#14B8A6","#F97316","#6366F1"];

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
   070,071,072,073,074,075,076,077,078,079,080,081,082,083,084,085,086,087,088,089, // NJ
   100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119, // NY downstate/LI
   870,871,872,873,874,875,876,       // NM high
  ].forEach(p => { z[p]=5; });
  // Zone 6 — Cold (NY upstate, New England, MI, WI, MN south, ND south, SD, WY, MT south, ID)
  [120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149, // NY upstate
   010,011,012,013,014,015,016,017,018,019,020,021,022,023,024,025,026,027, // MA/RI
   030,031,032,033,034,035,036,037,038, // NH
   039,040,041,042,043,044,045,046,047,048,049, // ME south
   060,061,062,063,064,065,066,067,068,069, // CT
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
   047,048,049,       // ME north
   995,996,997,998,   // AK south
  ].forEach(p => { z[p]=7; });
  // Zone 8 — Subarctic (Interior/North AK)
  [997,998,999].forEach(p => { z[p]=8; });
  return z;
})();

function getClimateZone(profile) {
  if (!profile) return 5; // default to zone 5 (moderate)
  // Try zip from address string — look for 5-digit zip at end
  const addr = profile.address || "";
  const match = addr.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = match ? match[1] : null;
  if (!zip) return 5;
  const prefix = parseInt(zip.substring(0,3), 10);
  return ZIP_CLIMATE[prefix] || 5;
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
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --cream:#F5F0E8; --cream2:#EDE7DB; --white:#FDFAF5; --stone:#DDD6CA; --mid:#BFB5A8;
  --dark:#26211C; --brown:#7A5C3E; --rust:#C05A28; --rust-light:#FBF0E8; --rust-mid:#E8895A;
  --sage:#4E7260; --sage-light:#EAF2EE; --gold:#B8861E; --sky:#3A7AAF; --sky-light:#EBF3FA;
  --red:#C0392B; --red-light:#FDECEA;
  --shadow:0 1px 4px rgba(38,33,28,.06),0 4px 16px rgba(38,33,28,.06);
  --shadow-md:0 4px 20px rgba(38,33,28,.1);
  --shadow-lg:0 12px 40px rgba(38,33,28,.14);
  --r:18px; --r-sm:10px; --r-xs:6px;
  --hdr:60px; --bottom-nav:68px;
  --max:1100px;
}

html{scroll-behavior:smooth}
body{background:var(--cream);font-family:'DM Sans',sans-serif;color:var(--dark);-webkit-font-smoothing:antialiased;overscroll-behavior:none}
.app{min-height:100vh;display:flex;flex-direction:column;padding-bottom:var(--bottom-nav)}
@media(min-width:769px){.app{padding-bottom:0}}

/* ══ HEADER ══ */
.hdr{height:var(--hdr);background:var(--dark);display:flex;align-items:center;justify-content:space-between;padding:0 1.25rem;position:sticky;top:0;z-index:200;gap:.75rem}
.hdr-logo{display:flex;align-items:center;gap:9px;flex-shrink:0}
.hdr-logo .ico{width:32px;height:32px;background:var(--rust);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.hdr-logo .name{font-family:'Fraunces',serif;font-size:1.1rem;font-weight:500;color:#fff;letter-spacing:-.3px}
.search-wrap{flex:1;max-width:380px;position:relative}
.search-wrap input{width:100%;padding:.42rem .85rem .42rem 2.1rem;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.12);border-radius:22px;font-size:.82rem;color:#fff;outline:none;transition:all .2s;font-family:'DM Sans',sans-serif}
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
.user-btn{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.12);border-radius:22px;padding:.3rem .85rem .3rem .4rem;cursor:pointer;transition:all .18s;color:#fff;font-family:'DM Sans',sans-serif;font-size:.78rem;font-weight:500}
.user-btn:hover{background:rgba(255,255,255,.17)}
.user-avatar{width:26px;height:26px;border-radius:50%;background:var(--rust);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#fff;flex-shrink:0}
.user-dropdown{position:absolute;top:calc(100% + 8px);right:0;background:var(--white);border-radius:var(--r-sm);box-shadow:var(--shadow-lg);border:1px solid var(--stone);overflow:hidden;min-width:190px;z-index:300}
.user-dd-item{padding:.7rem 1rem;font-size:.83rem;cursor:pointer;display:flex;align-items:center;gap:.6rem;color:var(--dark);border-bottom:1px solid var(--stone);transition:background .12s}
.user-dd-item:last-child{border-bottom:none}
.user-dd-item:hover{background:var(--cream)}
.user-dd-item.danger{color:var(--red)}
.user-dd-email{padding:.65rem 1rem;font-size:.72rem;color:#9E9690;border-bottom:1px solid var(--stone);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ══ DESKTOP NAV ══ */
.nav{height:52px;background:var(--white);border-bottom:1px solid var(--stone);display:flex;padding:0 1rem;position:sticky;top:var(--hdr);z-index:190;overflow-x:auto;scrollbar-width:none;display:none}
@media(min-width:769px){.nav{display:flex}}
.nav::-webkit-scrollbar{display:none}
.nav-btn{padding:0 1.1rem;height:100%;font-size:.82rem;font-weight:500;color:#9E9690;background:none;border:none;border-bottom:2.5px solid transparent;cursor:pointer;white-space:nowrap;transition:all .18s;display:flex;align-items:center;gap:6px;flex-shrink:0}
.nav-btn:hover{color:var(--dark)}
.nav-btn.active{color:var(--rust);border-bottom-color:var(--rust)}
.nav-badge{background:var(--red);color:#fff;border-radius:10px;font-size:.6rem;padding:1px 6px;font-weight:700;line-height:1.4;min-width:16px;text-align:center}

/* ══ BOTTOM NAV (mobile) ══ */
.bottom-nav{display:flex;position:fixed;bottom:0;left:0;right:0;background:var(--white);border-top:1px solid var(--stone);z-index:200;height:var(--bottom-nav);padding:0 .5rem;padding-bottom:env(safe-area-inset-bottom)}
@media(min-width:769px){.bottom-nav{display:none}}
.bnav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:none;border:none;cursor:pointer;padding:.5rem .25rem;min-width:0;position:relative;transition:transform .15s}
.bnav-btn:active{transform:scale(.92)}
.bnav-icon{font-size:1.35rem;line-height:1;transition:transform .18s}
.bnav-label{font-size:.58rem;font-weight:600;color:#A8A09A;letter-spacing:.3px;white-space:nowrap;transition:color .15s}
.bnav-btn.active .bnav-icon{transform:scale(1.1)}
.bnav-btn.active .bnav-label{color:var(--rust)}
.bnav-badge{position:absolute;top:6px;right:calc(50% - 18px);background:var(--red);color:#fff;border-radius:10px;font-size:.55rem;padding:1px 5px;font-weight:700;line-height:1.4;min-width:14px;text-align:center}

/* ══ MAIN ══ */
.main{flex:1;padding:1.25rem 1rem;max-width:var(--max);margin:0 auto;width:100%}
@media(min-width:769px){.main{padding:1.75rem 1.5rem}}

/* ══ TOAST ══ */
.toast-wrap{position:fixed;bottom:calc(var(--bottom-nav) + .75rem);right:.75rem;z-index:999;display:flex;flex-direction:column;gap:.4rem;pointer-events:none}
@media(min-width:769px){.toast-wrap{bottom:1.25rem;right:1.25rem}}
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
.sort-select{padding:.32rem .65rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-size:.74rem;font-family:'DM Sans',sans-serif;color:var(--dark);background:var(--white);cursor:pointer;outline:none;flex-shrink:0}
.sort-select:focus{border-color:var(--rust)}

/* ══ BUTTONS ══ */
.btn{display:inline-flex;align-items:center;gap:5px;padding:.52rem 1.05rem;border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.8rem;font-weight:600;border:none;cursor:pointer;transition:all .18s;white-space:nowrap;flex-shrink:0}
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
.qs-btn{padding:3px 9px;border-radius:12px;font-size:.64rem;font-weight:700;border:1.5px solid transparent;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}

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
input,select,textarea{width:100%;padding:.6rem .9rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.88rem;color:var(--dark);background:var(--white);outline:none;transition:border-color .15s;-webkit-appearance:none}
input:focus,select:focus,textarea:focus{border-color:var(--rust);box-shadow:0 0 0 3px rgba(192,90,40,.1)}
textarea{resize:vertical;min-height:70px;line-height:1.5}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A8A09A' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2rem}

/* ══ DASHBOARD SPECIFIC ══ */
.dash-grid{display:grid;grid-template-columns:1fr;gap:1rem;margin-top:1rem}
@media(min-width:769px){.dash-grid{grid-template-columns:1fr 1fr}}
.panel{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1.1rem 1.2rem;box-shadow:var(--shadow)}
.panel-title{font-family:'Fraunces',serif;font-size:1rem;font-weight:500;color:var(--dark);margin-bottom:.85rem;display:flex;align-items:center;gap:.5rem}
.up-item{display:flex;align-items:center;gap:.75rem;padding:.6rem .8rem;border:1px solid var(--stone);border-radius:12px;margin-bottom:.45rem;transition:box-shadow .15s,transform .15s;cursor:pointer}
.up-item:last-child{margin-bottom:0}
.up-item:hover{box-shadow:var(--shadow);transform:translateY(-1px)}
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
.home-photo-wrap img{width:100%;height:200px;object-fit:cover;border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow)}
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
.lookup-row input{flex:1;padding:.6rem .9rem;border:1.5px solid #EDCDB8;border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.86rem;color:var(--dark);background:#fff;outline:none;transition:border-color .15s}
.lookup-row input:focus{border-color:var(--rust);box-shadow:0 0 0 3px rgba(192,90,40,.1)}
.lookup-btn{padding:.6rem 1rem;background:var(--rust);color:#fff;border:none;border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .18s;display:flex;align-items:center;gap:5px}
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
.photo-preview-remove{position:absolute;top:.5rem;right:.5rem;background:rgba(38,33,28,.8);color:#fff;border:none;border-radius:7px;padding:4px 9px;font-size:.7rem;cursor:pointer;font-family:'DM Sans',sans-serif}
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
.view-btn{padding:.3rem .75rem;border-radius:8px;font-size:.73rem;font-weight:600;border:none;cursor:pointer;background:none;color:#A8A09A;font-family:'DM Sans',sans-serif;transition:all .15s;white-space:nowrap}
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
.task-status-btn{padding:3px 9px;border-radius:10px;font-size:.65rem;font-weight:700;border:1.5px solid transparent;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}

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
.home-hero-photo{width:100%;height:200px;object-fit:cover;display:block}
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
.system-age-item{display:flex;align-items:center;gap:.65rem;padding:.55rem .75rem;border-radius:var(--r-sm);border:1px solid}
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
.util-type-btn{padding:.7rem .4rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);background:var(--white);cursor:pointer;text-align:center;transition:all .15s;font-family:'DM Sans',sans-serif}
.util-type-btn:hover{border-color:var(--rust);background:var(--rust-light)}
.util-type-btn.selected{border-color:var(--rust);background:var(--rust-light)}
.util-type-icon{font-size:1.4rem;display:block;margin-bottom:3px}
.util-type-label{font-size:.68rem;font-weight:600;color:var(--dark)}
.pro-gate{display:flex;align-items:center;gap:.5rem;padding:.6rem .85rem;background:linear-gradient(135deg,#2A2622,#4A3828);border-radius:var(--r-sm);border:1px solid rgba(193,98,43,.3);cursor:pointer;transition:all .18s}
.pro-gate:hover{border-color:rgba(193,98,43,.6)}
.pro-gate-text{flex:1;font-size:.78rem;color:rgba(255,255,255,.8);font-weight:500}
.pro-gate-badge{background:var(--rust);color:#fff;font-size:.6rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 7px;border-radius:10px;flex-shrink:0}

/* ══ EXPENSE TABLE ══ */
.exp-table{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);overflow:hidden}
.exp-table table{width:100%;border-collapse:collapse;font-size:.83rem}
.exp-table th{text-align:left;padding:.6rem .9rem;font-size:.66rem;letter-spacing:.8px;text-transform:uppercase;color:#A8A09A;border-bottom:1px solid var(--stone);background:var(--cream);font-weight:600;white-space:nowrap}
.exp-table td{padding:.8rem .9rem;border-bottom:1px solid var(--stone);vertical-align:middle}
.exp-table tr:last-child td{border-bottom:none}
.exp-table .total-row td{border-top:2px solid var(--stone);font-weight:700;background:var(--cream2)}
@media(max-width:600px){.exp-hide{display:none}}

/* ══ AUTH SCREEN ══ */

/* ── LANDING PAGE ── */
.lp{min-height:100vh;background:var(--dark);font-family:'DM Sans',sans-serif;overflow-x:hidden}
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 2.5rem;transition:background .3s,backdrop-filter .3s}
.lp-nav.scrolled{background:rgba(42,38,34,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.06)}
.lp-logo{display:flex;align-items:center;gap:10px;cursor:pointer}
.lp-logo-icon{width:36px;height:36px;background:var(--rust);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.lp-logo-text{font-family:'Fraunces',serif;font-size:1.15rem;font-weight:500;color:#fff}
.lp-nav-links{display:flex;align-items:center;gap:.8rem}
.lp-nav-link{color:rgba(255,255,255,.6);background:none;border:none;font-size:.85rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color .15s;text-decoration:none}
.lp-nav-link:hover{color:#fff}
.lp-btn-nav{padding:.5rem 1.2rem;background:var(--rust);color:#fff;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:.85rem;font-weight:600;cursor:pointer;transition:background .18s,transform .15s}
.lp-btn-nav:hover{background:#A8501F;transform:translateY(-1px)}
.lp-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8rem 2rem 3rem;position:relative;overflow:hidden}
.lp-hero-bg::before{content:'';position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(193,98,43,.18) 0%,transparent 70%);top:-150px;right:-150px;pointer-events:none}
.lp-hero-bg::after{content:'';position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(74,137,184,.12) 0%,transparent 70%);bottom:-100px;left:-100px;pointer-events:none}
.lp-hero-bg{position:absolute;inset:0}
.lp-content{position:relative;z-index:1;max-width:760px}
.lp-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(193,98,43,.15);border:1px solid rgba(193,98,43,.3);color:#F0B08A;padding:.35rem .9rem;border-radius:20px;font-size:.72rem;font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:1.8rem}
.lp-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--rust);animation:lp-pulse 2s infinite}
@keyframes lp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
.lp-h1{font-family:'Fraunces',serif;font-size:clamp(2.8rem,7vw,5rem);font-weight:500;color:#fff;line-height:1.05;letter-spacing:-.02em;margin-bottom:1.4rem}
.lp-h1 em{font-style:italic;color:var(--rust)}
.lp-hero-p{font-size:clamp(.95rem,2vw,1.15rem);color:rgba(255,255,255,.58);line-height:1.7;max-width:540px;margin:0 auto 2.2rem;font-weight:300}
.lp-cta{display:flex;align-items:center;justify-content:center;gap:.8rem;flex-wrap:wrap;margin-bottom:.8rem}
.lp-btn-primary{padding:.9rem 2.2rem;background:var(--rust);color:#fff;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:600;cursor:pointer;transition:background .18s,transform .15s,box-shadow .18s;box-shadow:0 4px 24px rgba(193,98,43,.35)}
.lp-btn-primary:hover{background:#A8501F;transform:translateY(-2px);box-shadow:0 8px 32px rgba(193,98,43,.45)}
.lp-btn-ghost{padding:.9rem 2rem;background:rgba(255,255,255,.08);color:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.15);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:500;cursor:pointer;transition:background .18s,transform .15s;text-decoration:none}
.lp-btn-ghost:hover{background:rgba(255,255,255,.14);transform:translateY(-2px)}
.lp-hero-sub{font-size:.78rem;color:rgba(255,255,255,.28);margin-top:.4rem}
.lp-stats{display:flex;align-items:center;justify-content:center;gap:3rem;flex-wrap:wrap;padding:2rem 2rem 4rem;position:relative;z-index:1}
.lp-stat{text-align:center}
.lp-stat-num{font-family:'Fraunces',serif;font-size:2.2rem;font-weight:700;color:#fff;line-height:1}
.lp-stat-num span{color:var(--rust)}
.lp-stat-label{font-size:.72rem;color:rgba(255,255,255,.38);margin-top:4px;letter-spacing:.5px}
.lp-divider{width:1px;height:40px;background:rgba(255,255,255,.1)}
.lp-section{padding:5rem 2rem;background:var(--cream)}
.lp-section-dark{padding:5.5rem 2rem;background:var(--dark);position:relative;overflow:hidden}
.lp-section-dark::before{content:'';position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(193,98,43,.1) 0%,transparent 70%);top:-200px;left:-100px;pointer-events:none}
.lp-section-white{padding:5.5rem 2rem;background:var(--white)}
.lp-label{text-align:center;font-size:.7rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--rust);margin-bottom:.7rem}
.lp-label-light{color:#F0B08A}
.lp-h2{font-family:'Fraunces',serif;font-size:clamp(1.9rem,4vw,2.8rem);font-weight:500;text-align:center;color:var(--dark);line-height:1.15;margin-bottom:.9rem}
.lp-h2-light{color:#fff}
.lp-sub{text-align:center;font-size:.95rem;color:#7A7370;max-width:500px;margin:0 auto 3rem;line-height:1.65}
.lp-sub-light{color:rgba(255,255,255,.48)}
.lp-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:1.2rem;max-width:1020px;margin:0 auto}
.lp-feat{background:var(--white);border:1px solid var(--stone);border-radius:14px;padding:1.6rem;transition:box-shadow .2s,transform .2s}
.lp-feat:hover{box-shadow:0 8px 28px rgba(42,38,34,.1);transform:translateY(-3px)}
.lp-feat-icon{width:44px;height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:1rem}
.lp-feat h3{font-family:'Fraunces',serif;font-size:1.08rem;font-weight:500;color:var(--dark);margin-bottom:.45rem}
.lp-feat p{font-size:.84rem;color:#7A7370;line-height:1.6}
.lp-feat-tag{display:inline-block;margin-top:.8rem;font-size:.65rem;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:2px 8px;border-radius:20px}
.lp-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.2rem;max-width:920px;margin:0 auto;position:relative;z-index:1}
.lp-step{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:1.6rem}
.lp-step-num{font-family:'Fraunces',serif;font-size:2.8rem;font-weight:700;color:rgba(193,98,43,.22);line-height:1;margin-bottom:.5rem}
.lp-step h3{font-family:'Fraunces',serif;font-size:1.05rem;font-weight:500;color:#fff;margin-bottom:.4rem}
.lp-step p{font-size:.82rem;color:rgba(255,255,255,.48);line-height:1.6}
.lp-proof{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1.1rem;max-width:920px;margin:0 auto}
.lp-proof-card{background:var(--white);border:1px solid var(--stone);border-radius:13px;padding:1.4rem 1.5rem}
.lp-proof-stars{color:var(--gold);font-size:.95rem;margin-bottom:.7rem}
.lp-proof-text{font-size:.87rem;color:#4A4440;line-height:1.6;margin-bottom:.9rem;font-style:italic}
.lp-proof-author{display:flex;align-items:center;gap:.65rem}
.lp-proof-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#fff;flex-shrink:0}
.lp-proof-name{font-size:.8rem;font-weight:600;color:var(--dark)}
.lp-proof-role{font-size:.7rem;color:#9E9690}
.lp-pricing{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1.4rem;max-width:820px;margin:0 auto}
.lp-price-card{background:var(--cream);border:1.5px solid var(--stone);border-radius:16px;padding:1.8rem;position:relative}
.lp-price-card.featured{background:var(--dark);border-color:var(--rust)}
.lp-price-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--rust);color:#fff;font-size:.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 12px;border-radius:20px;white-space:nowrap}
.lp-plan{font-size:.68rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--rust);margin-bottom:.4rem}
.lp-price-card.featured .lp-plan{color:#F0B08A}
.lp-price{font-family:'Fraunces',serif;font-size:2.8rem;font-weight:700;color:var(--dark);line-height:1}
.lp-price-card.featured .lp-price{color:#fff}
.lp-price span{font-size:.95rem;font-weight:400;color:#9E9690}
.lp-price-card.featured .lp-price span{color:rgba(255,255,255,.38)}
.lp-price-desc{font-size:.8rem;color:#7A7370;margin:.5rem 0 1.3rem;line-height:1.45}
.lp-price-card.featured .lp-price-desc{color:rgba(255,255,255,.48)}
.lp-price-list{list-style:none;margin-bottom:1.6rem}
.lp-price-list li{font-size:.82rem;color:#4A4440;padding:.38rem 0;display:flex;align-items:center;gap:.55rem;border-bottom:1px solid var(--stone)}
.lp-price-card.featured .lp-price-list li{color:rgba(255,255,255,.72);border-bottom-color:rgba(255,255,255,.07)}
.lp-price-list li:last-child{border-bottom:none}
.lp-price-check{color:var(--sage);flex-shrink:0}
.lp-price-card.featured .lp-price-check{color:#7DCBA1}
.lp-price-btn{display:block;width:100%;padding:.78rem;border-radius:9px;text-align:center;font-family:'DM Sans',sans-serif;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .18s;border:none}
.lp-price-btn-outline{background:transparent;border:1.5px solid var(--stone);color:var(--dark)}
.lp-price-btn-outline:hover{border-color:var(--rust);color:var(--rust)}
.lp-price-btn-solid{background:var(--rust);color:#fff;box-shadow:0 4px 14px rgba(193,98,43,.28)}
.lp-price-btn-solid:hover{background:#A8501F;transform:translateY(-1px)}
.lp-cta-section{background:var(--dark);padding:6rem 2rem;text-align:center;position:relative;overflow:hidden}
.lp-cta-section::before{content:'';position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(193,98,43,.13) 0%,transparent 65%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
.lp-cta-section h2{font-family:'Fraunces',serif;font-size:clamp(2rem,4vw,3.2rem);font-weight:500;color:#fff;line-height:1.15;margin-bottom:.9rem;position:relative;z-index:1}
.lp-cta-section h2 em{font-style:italic;color:var(--rust)}
.lp-cta-section p{font-size:.95rem;color:rgba(255,255,255,.48);max-width:420px;margin:0 auto 2.2rem;line-height:1.65;position:relative;z-index:1}
.lp-footer{background:#1E1B18;padding:2rem 2.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;border-top:1px solid rgba(255,255,255,.06)}
.lp-footer-logo{display:flex;align-items:center;gap:8px}
.lp-footer-logo-icon{width:26px;height:26px;background:var(--rust);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.8rem}
.lp-footer-logo-text{font-family:'Fraunces',serif;font-size:.9rem;font-weight:500;color:rgba(255,255,255,.6)}
.lp-footer-copy{font-size:.75rem;color:rgba(255,255,255,.22)}
.lp-footer-links{display:flex;gap:1.4rem}
.lp-footer-links button{font-size:.75rem;color:rgba(255,255,255,.28);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color .15s}
.lp-footer-links button:hover{color:rgba(255,255,255,.65)}
@media(max-width:640px){
  .lp-nav{padding:.9rem 1.2rem}
  .lp-nav-link{display:none}
  .lp-hero{padding:7rem 1.2rem 3rem}
  .lp-stats{gap:1.5rem;padding:1.5rem 1rem 3rem}
  .lp-divider{display:none}
  .lp-section,.lp-section-dark,.lp-section-white{padding:3.5rem 1.2rem}
  .lp-footer{flex-direction:column;align-items:flex-start}
}

/* ── AUTH SCREEN ── */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:var(--dark)}
.auth-bg{position:fixed;inset:0;background:var(--dark);overflow:hidden;pointer-events:none}
/* ══ AUTH SCREEN ══ */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:var(--dark)}
.auth-bg{position:fixed;inset:0;background:var(--dark);overflow:hidden;pointer-events:none}
.auth-bg::before{content:'';position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(192,90,40,.15) 0%,transparent 70%);top:-100px;right:-100px}
.auth-bg::after{content:'';position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(58,122,175,.1) 0%,transparent 70%);bottom:-50px;left:-50px}
.auth-card{background:var(--white);border-radius:22px;width:100%;max-width:420px;padding:2.5rem 2.5rem 2rem;box-shadow:0 32px 80px rgba(0,0,0,.4);position:relative;z-index:1}
.auth-logo{display:flex;align-items:center;gap:12px;margin-bottom:2rem}
.auth-logo-icon{width:44px;height:44px;background:var(--rust);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem}
.auth-logo-text{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:500;color:var(--dark)}
.auth-logo-sub{font-size:.63rem;color:#9E9690;letter-spacing:1.5px;text-transform:uppercase}
.auth-title{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:500;margin-bottom:.3rem;color:var(--dark)}
.auth-sub{font-size:.84rem;color:#9E9690;margin-bottom:1.7rem}
.auth-field{display:flex;flex-direction:column;gap:5px;margin-bottom:1rem}
.auth-field label{font-size:.68rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#8A827A}
.auth-field input{padding:.72rem 1rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.9rem;color:var(--dark);background:var(--white);outline:none;transition:border-color .15s}
.auth-field input:focus{border-color:var(--rust);box-shadow:0 0 0 3px rgba(192,90,40,.1)}
.auth-btn{width:100%;padding:.82rem;border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.9rem;font-weight:600;border:none;cursor:pointer;transition:all .18s;margin-top:.4rem}
.auth-btn-primary{background:var(--rust);color:#fff;box-shadow:0 3px 12px rgba(192,90,40,.3)}
.auth-btn-primary:hover{background:#A84820}
.auth-btn-primary:disabled{opacity:.6;cursor:not-allowed}
.auth-switch{text-align:center;margin-top:1.3rem;font-size:.83rem;color:#9E9690}
.auth-switch button{background:none;border:none;color:var(--rust);font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:.83rem}
.auth-switch button:hover{text-decoration:underline}
.auth-error{background:var(--red-light);border:1px solid #EFCFCC;color:#8B2020;padding:.62rem .9rem;border-radius:var(--r-sm);font-size:.81rem;margin-bottom:.9rem}
.auth-success{background:var(--sage-light);border:1px solid #B8D9CC;color:#2A5E48;padding:.62rem .9rem;border-radius:var(--r-sm);font-size:.81rem;margin-bottom:.9rem}
.auth-forgot{background:none;border:none;color:#9E9690;font-size:.77rem;cursor:pointer;font-family:'DM Sans',sans-serif;padding:0;margin-top:.2rem;text-align:right;display:block;width:100%}
.auth-forgot:hover{color:var(--rust)}
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt$ = v => "$" + Number(v||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtD = d => { if(!d) return "—"; const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const daysTo = d => { if(!d) return null; return Math.ceil((new Date(d+"T00:00:00")-new Date())/86400000); };
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

function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => <div key={t.id} className={`toast ${t.type} ${t.visible?"show":""}`}>{t.msg}</div>)}
    </div>
  );
}

function Confirm({ message, onConfirm, onCancel }) {
  return (
    <div className="overlay" onClick={e => e.target===e.currentTarget && onCancel()}>
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
function LandingPage({ onSignIn, onSignUp }) {
  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState("home");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="lp">
      {/* NAV */}
      <nav className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-logo">
          <div className="lp-logo-icon">🏠</div>
          <span className="lp-logo-text">HomeKeep</span>
        </div>
        <div className="lp-nav-links">
          <button className="lp-nav-link" onClick={() => scrollTo("features")}>Features</button>
          <button className="lp-nav-link" onClick={() => scrollTo("how")}>How it works</button>
          <button className="lp-nav-link" onClick={() => scrollTo("pricing")}>Pricing</button>
          <button className="lp-btn-nav" onClick={onSignIn}>Sign In</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-content">
          <div className="lp-badge">
            <div className="lp-badge-dot" />
            Now in beta — free to join
          </div>
          <h1 className="lp-h1">Your home deserves<br /><em>better management</em></h1>
          <p className="lp-hero-p">HomeKeep pulls your home's real data — year built, tax history, schools, sale records — then helps you track maintenance, warranties, and expenses in one place.</p>
          <div className="lp-cta">
            <button className="lp-btn-primary" onClick={onSignUp}>Get started free →</button>
            <button className="lp-btn-ghost" onClick={() => scrollTo("how")}>See how it works</button>
          </div>
          <p className="lp-hero-sub">No credit card required · Free forever plan available</p>
        </div>
        <div className="lp-stats">
          {[
            { num: "50", suffix: "+", label: "Data fields per home" },
            { num: "$0", suffix: "", label: "To get started" },
            { num: "3", suffix: "min", label: "To set up your home" },
            { num: "100", suffix: "%", label: "Your data, private" },
          ].map((s, i) => (
            <div key={i} style={{display:"contents"}}>
              {i > 0 && <div className="lp-divider" />}
              <div className="lp-stat">
                <div className="lp-stat-num">{s.num}<span>{s.suffix}</span></div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section" id="features">
        <div className="lp-label">Everything in one place</div>
        <h2 className="lp-h2">Built for homeowners,<br />not real estate agents</h2>
        <p className="lp-sub">Most home apps are built for buying and selling. HomeKeep is built for the years in between.</p>
        <div className="lp-features">
          {[
            { icon: "🔍", bg: "#FDF0EB", title: "Instant property lookup", desc: "Type your address and HomeKeep auto-fills year built, sq footage, bed/bath count, tax history, price history, and nearby schools — in seconds.", tag: "Auto-fill", tagBg: "#FDF0EB", tagColor: "#C1622B" },
            { icon: "✓", bg: "#EBF5FF", title: "Maintenance task tracker", desc: "Schedule, prioritize, and track every home maintenance task. Overdue alerts, category filters, contractor logs, and recurring task support.", tag: "Tasks", tagBg: "#EBF5FF", tagColor: "#1A6FA0" },
            { icon: "📋", bg: "#E8F6EE", title: "Warranty vault", desc: "Never lose a warranty again. Store appliance warranties with expiry dates, model numbers, and document locations. 90-day expiry alerts.", tag: "Warranties", tagBg: "#E8F6EE", tagColor: "#1A7A44" },
            { icon: "💲", bg: "#FFF8E6", title: "Expense log", desc: "Track every dollar spent on your home. Visual spending breakdown by category. Know exactly what your home has cost you over time.", tag: "Expenses", tagBg: "#FFF8E6", tagColor: "#92610A" },
            { icon: "🏛️", bg: "#F3EFFC", title: "Tax & sale history", desc: "See your property's full tax record — yearly tax paid and assessed value — plus every sale and listing event going back decades.", tag: "Property data", tagBg: "#F3EFFC", tagColor: "#6D3FC4" },
            { icon: "🔒", bg: "#FDF0EB", title: "Private and secure", desc: "Your data belongs to you. Each account is fully isolated. Row-level security enforced at the database level — no exceptions.", tag: "Secure", tagBg: "#FDF0EB", tagColor: "#C1622B" },
          ].map((f, i) => (
            <div key={i} className="lp-feat">
              <div className="lp-feat-icon" style={{background: f.bg}}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="lp-feat-tag" style={{background: f.tagBg, color: f.tagColor}}>{f.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-section-dark" id="how">
        <div className="lp-label lp-label-light">Simple setup</div>
        <h2 className="lp-h2 lp-h2-light">Up and running<br />in minutes</h2>
        <p className="lp-sub lp-sub-light">No complicated onboarding. No manual data entry for the boring stuff. Just type your address.</p>
        <div className="lp-steps">
          {[
            { n: "01", title: "Create your account", desc: "Sign up with your email. No credit card required. You're in the app in under 60 seconds." },
            { n: "02", title: "Enter your address", desc: "Type your home's address and hit 'Look Up My Home.' We pull 50+ data fields from public records automatically." },
            { n: "03", title: "Start tracking", desc: "Add your first maintenance task, log a warranty, or upload a home photo. Your command center is ready." },
            { n: "04", title: "Stay on top of it", desc: "Dashboard shows upcoming tasks, expiring warranties, and yearly spending at a glance. Nothing falls through." },
          ].map((s, i) => (
            <div key={i} className="lp-step">
              <div className="lp-step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="lp-section" style={{background: "var(--cream)"}}>
        <div className="lp-label">Early users</div>
        <h2 className="lp-h2">Homeowners love it</h2>
        <p className="lp-sub">We're in beta and already hearing from real homeowners about what HomeKeep means to them.</p>
        <div className="lp-proof">
          {[
            { text: "I typed my address and it instantly knew my home was built in 1987, showed me the last three sales, and pulled 5 years of property tax records. That alone is worth it.", name: "Mike R.", role: "Homeowner, Tampa FL", initials: "MR", color: "#4A89B8" },
            { text: "Finally I have somewhere to track all our warranties. We had a dishwasher break and I actually knew exactly where the warranty was. First time ever.", name: "Sarah L.", role: "First-time homeowner, Austin TX", initials: "SL", color: "#5E8065" },
            { text: "The expense tracker showed me I've spent $14,000 on my home in 2 years. I had no idea. Now I actually have data to plan with.", name: "James T.", role: "Homeowner, Denver CO", initials: "JT", color: "#C1622B" },
          ].map((p, i) => (
            <div key={i} className="lp-proof-card">
              <div className="lp-proof-stars">★★★★★</div>
              <p className="lp-proof-text">"{p.text}"</p>
              <div className="lp-proof-author">
                <div className="lp-proof-avatar" style={{background: p.color}}>{p.initials}</div>
                <div>
                  <div className="lp-proof-name">{p.name}</div>
                  <div className="lp-proof-role">{p.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-section-white" id="pricing">
        <div className="lp-label">Simple pricing</div>
        <h2 className="lp-h2">Start free, upgrade when ready</h2>
        <p className="lp-sub">No hidden fees. Use HomeKeep free forever or unlock premium features when your home needs more.</p>
        <div className="lp-pricing">
          <div className="lp-price-card">
            <div className="lp-plan">Free</div>
            <div className="lp-price">$0<span> / month</span></div>
            <p className="lp-price-desc">Everything you need to get started managing your home.</p>
            <ul className="lp-price-list">
              {["1 property","Unlimited tasks & warranties","Expense tracking","Property auto-fill","Tax & sale history","Photo upload"].map(f => (
                <li key={f}><span className="lp-price-check">✓</span> {f}</li>
              ))}
            </ul>
            <button className="lp-price-btn lp-price-btn-outline" onClick={onSignUp}>Get started free</button>
          </div>
          <div className="lp-price-card featured">
            <div className="lp-price-badge">Most popular</div>
            <div className="lp-plan">Pro</div>
            <div className="lp-price">$4.99<span> / month</span></div>
            <p className="lp-price-desc">For homeowners who want the full picture.</p>
            <ul className="lp-price-list">
              {["Everything in Free","Up to 3 properties","Email reminders for tasks","Permit history (coming soon)","Full sale history timeline","Priority support"].map(f => (
                <li key={f}><span className="lp-price-check">✓</span> {f}</li>
              ))}
            </ul>
            <button className="lp-price-btn lp-price-btn-solid" onClick={onSignUp}>Start free trial</button>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="lp-cta-section">
        <h2>Your home is your<br /><em>biggest investment</em></h2>
        <p>Start tracking it like one. Free forever, set up in minutes, no credit card required.</p>
        <button className="lp-btn-primary" style={{fontSize:"1.05rem",padding:"1rem 2.5rem",position:"relative",zIndex:1}} onClick={onSignUp}>
          Create your free account →
        </button>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-logo">
          <div className="lp-footer-logo-icon">🏠</div>
          <span className="lp-footer-logo-text">HomeKeep</span>
        </div>
        <div className="lp-footer-links">
          <button onClick={() => scrollTo("features")}>Features</button>
          <button onClick={() => scrollTo("pricing")}>Pricing</button>
          <button onClick={onSignIn}>Sign in</button>
        </div>
        <p className="lp-footer-copy">© 2026 HomeKeep. Built for homeowners.</p>
      </footer>
    </div>
  );
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
    if (error) setError(error.message);
    else setSuccess("Account created! Check your email to confirm, then log in.");
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
    <div className="auth-wrap">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🏠</div>
          <div>
            <div className="auth-logo-text">HomeKeep</div>
            <div className="auth-logo-sub">Maintenance Manager</div>
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
function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="user-menu" ref={ref}>
      <div className="user-btn" onClick={()=>setOpen(o=>!o)}>
        <span className="user-avatar">{initials(user.email)}</span>
        <span>{user.email.split("@")[0]}</span>
        <span style={{opacity:.5,fontSize:".7rem"}}>▾</span>
      </div>
      {open && (
        <div className="user-dropdown">
          <div className="user-dd-email">{user.email}</div>
          <div className="user-dd-item danger" onClick={()=>{setOpen(false);onSignOut();}}>
            <span>🚪</span> Sign Out
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FORMS ───────────────────────────────────────────────────────────────────
function TaskForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div className="fg">
      <div className="field s2"><label>Task Title *</label><input value={data.title||""} onChange={e=>f("title",e.target.value)} placeholder="e.g. Replace HVAC Filter" /></div>
      <div className="field"><label>Category</label><select value={data.category||""} onChange={e=>f("category",e.target.value)}><option value="">Select…</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="field"><label>Priority</label><select value={data.priority||""} onChange={e=>f("priority",e.target.value)}><option value="">Select…</option>{PRIORITY.map(p=><option key={p}>{p}</option>)}</select></div>
      <div className="field"><label>Status</label><select value={data.status||""} onChange={e=>f("status",e.target.value)}><option value="">Select…</option>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="field"><label>Due Date</label><input type="date" value={data.due_date||""} onChange={e=>f("due_date",e.target.value)} /></div>
      <div className="field"><label>Est. Cost ($)</label><input type="number" value={data.cost||""} onChange={e=>f("cost",e.target.value)} placeholder="0" /></div>
      <div className="field"><label>Vendor / Contractor</label><input value={data.vendor||""} onChange={e=>f("vendor",e.target.value)} placeholder="DIY or company name" /></div>
      <div className="field"><label>Recurring Schedule</label><input value={data.recurring||""} onChange={e=>f("recurring",e.target.value)} placeholder="e.g. Every 3 months" /></div>
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

function AssetForm({ data, onChange, userId }) {
  const f = (k,v) => onChange({...data,[k]:v});
  // Auto-set lifespan when category changes
  const handleCategory = (cat) => {
    onChange({...data, category:cat, lifespan_years: data.lifespan_years || DEFAULT_LIFESPAN[cat] || 15});
  };
  return (
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
        expenseId={`asset-${data.id||"new"}`}
        currentUrl={data.asset_photo_url||""}
        onUploaded={url=>f("asset_photo_url",url)}
        label="Asset Photo"
      />
    </div>
  );
}

function ServiceLogForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div className="fg">
      <div className="field s2"><label>Description *</label><input value={data.description||""} onChange={e=>f("description",e.target.value)} placeholder="e.g. Annual tune-up, replaced capacitor" /></div>
      <div className="field"><label>Service Date *</label><input type="date" value={data.service_date||""} onChange={e=>f("service_date",e.target.value)} /></div>
      <div className="field"><label>Cost ($)</label><input type="number" value={data.cost||""} onChange={e=>f("cost",e.target.value)} placeholder="0" /></div>
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Technician, parts used, findings…" /></div>
    </div>
  );
}

// ─── LIGHTBOX ────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
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
function ExpenseFileUpload({ userId, expenseId, currentUrl, onUploaded, label="Receipt / Photo" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) { setError("Please select an image or PDF."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("File must be under 20MB."); return; }
    setError("");
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

function ExpenseForm({ data, onChange, projects=[], userId }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
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
      />
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
        expenseId={`project-${data.id||"new"}`}
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


function ProfileForm({ data, onChange, userId }) {
  const f = (k,v) => onChange({...data,[k]:v});
  const [lookupAddr, setLookupAddr] = useState(data.address || "");
  const [lookupState, setLookupState] = useState("idle"); // idle | loading | ok | error
  const [lookupMsg, setLookupMsg] = useState("");
  const [preview, setPreview] = useState(null);

  const handleLookup = async () => {
    if (!lookupAddr.trim()) return;
    setLookupState("loading");
    setLookupMsg("Looking up property data — this takes 10–30 seconds…");
    setPreview(null);
    try {
      const result = await lookupProperty(lookupAddr.trim());
      if (!result) {
        setLookupState("error");
        setLookupMsg("No property found. Try a more specific address (include city and state).");
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
      setLookupState("error");
      setLookupMsg("Lookup failed. Check your address and try again, or fill in manually.");
    }
  };

  return (
    <div>
      {/* ── Property Lookup Box ── */}
      <div className="lookup-box">
        <div className="lookup-title">🔍 Auto-Fill from Address</div>
        <div className="lookup-row">
          <input
            value={lookupAddr}
            onChange={e => setLookupAddr(e.target.value)}
            placeholder="123 Main St, City, State ZIP"
            onKeyDown={e => e.key === "Enter" && handleLookup()}
          />
          <button
            className="lookup-btn"
            onClick={handleLookup}
            disabled={lookupState === "loading"}
          >
            {lookupState === "loading" ? (
              <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/>Looking up…</>
            ) : "Look Up My Home"}
          </button>
        </div>
        {lookupMsg && (
          <div className={`lookup-status ${lookupState === "ok" ? "ok" : lookupState === "error" ? "err" : ""}`}>
            {lookupState === "ok" ? "✓" : lookupState === "error" ? "⚠️" : "⏳"} {lookupMsg}
          </div>
        )}
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

function InsuranceForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
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
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
function SearchBar({ tasks, warranties, expenses, onNavigate }) {
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
      <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="Search tasks, warranties, expenses…" />
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

  const todayStr = today.toISOString().slice(0,10);
  const STATUS_COLOR = {
    "Scheduled": "#4A89B8",
    "In Progress": "#B8861E",
    "Completed": "#4E7260",
    "Overdue": "#C05A28",
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
function Dashboard({ tasks, warranties, expenses, profile, onNavigate, greeting, username }) {
  const overdue  = tasks.filter(t => t.status==="Overdue").length;
  const upcoming = tasks.filter(t => { const d=daysTo(t.due_date); return d!==null&&d>=0&&d<=30&&t.status!=="Completed"; }).sort((a,b)=>daysTo(a.due_date)-daysTo(b.due_date));
  const totalSpend = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const yrSpend  = expenses.filter(e=>e.date?.startsWith(new Date().getFullYear().toString())).reduce((s,e)=>s+Number(e.amount||0),0);
  const expiringW = warranties.filter(w=>{ const d=daysTo(w.expiry_date); return d!==null&&d>=0&&d<=90; });
  const activeW  = warranties.filter(w=>{ const d=daysTo(w.expiry_date); return d!==null&&d>=0; }).length;
  const yr = new Date().getFullYear();
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
    if(warranties.length > 0) score -= Math.min(20, expiringW.length * 7);
    const completionRate = tasks.length > 0 ? completed / tasks.length : 1;
    score = Math.round(score * (.6 + completionRate * .4));
    return Math.max(10, Math.min(100, score));
  })();
  const healthColor = healthScore >= 80 ? "#4E7260" : healthScore >= 55 ? "#B8861E" : "#C05A28";
  const healthLabel = healthScore >= 80 ? "Great shape" : healthScore >= 55 ? "Needs attention" : "Action required";
  const circumference = 2 * Math.PI * 30;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  // ── Seasonal tip
  const month = new Date().getMonth();
  const season = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "fall" : "winter";
  const SEASONAL = {
    spring: { icon:"🌸", color:"#FBF0F5", border:"#EEC8D8", title:"Spring home checklist", tip:"Check gutters for winter debris, test smoke detectors, service your AC before summer heat." },
    summer: { icon:"☀️", color:"#FFFBEB", border:"#F5DFA0", title:"Summer maintenance time", tip:"Inspect your roof, clean dryer vents, check window seals before the humid months." },
    fall:   { icon:"🍂", color:"#FBF3E8", border:"#E8C89A", title:"Fall prep checklist", tip:"Service your furnace, drain outdoor hoses, clean gutters before leaves pile up." },
    winter: { icon:"❄️", color:"#EBF3FA", border:"#A8C8E8", title:"Winter home protection", tip:"Insulate exposed pipes, check weatherstripping, keep heating vents clear of furniture." },
  };
  const tip = SEASONAL[season];

  return (
    <div>
      {/* Greeting */}
      <div className="greeting">
        <div className="greeting-time">{greeting}</div>
        <div className="greeting-name">{profile?.name || username}</div>
        {profile?.address && <div className="greeting-sub">📍 {profile.address}</div>}
      </div>

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
      <div style={{display:"grid",gridTemplateColumns:healthScore!==null?"auto 1fr":"1fr",gap:".75rem",marginBottom:".85rem",alignItems:"stretch"}}>
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

      {/* Mini calendar */}
      {tasks.length > 0 && (
        <div style={{marginBottom:"1rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:".6rem"}}>
            <span style={{fontFamily:"'Fraunces',serif",fontSize:"1rem",fontWeight:500}}>📅 Task Calendar</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("tasks")}>Full view →</button>
          </div>
          <Calendar tasks={tasks} mini={true} onDayClick={handleDayClick} />
          <div style={{display:"flex",gap:"1rem",marginTop:".5rem",flexWrap:"wrap"}}>
            {[["#4A89B8","Scheduled"],["#B8861E","In Progress"],["#4E7260","Completed"],["#C05A28","Overdue"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:"4px",fontSize:".65rem",color:"#A8A09A"}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:c,flexShrink:0}}/>
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panels */}
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-title">📋 Coming up</div>
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
              <div className="up-item" key={t.id} onClick={() => onNavigate("tasks")}>
                <span style={{fontSize:"1.15rem"}}>{CAT_ICONS[t.category]||"🔧"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:".85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                  <div style={{fontSize:".71rem",color:"#A8A09A",marginTop:"1px"}}>{t.category} · {fmtD(t.due_date)}</div>
                </div>
                <div className="up-days" style={{background:d===0?"var(--red-light)":d<=7?"#FFF8E6":"var(--sky-light)",color:d===0?"var(--red)":d<=7?"#92610A":"var(--sky)"}}>
                  {d===0?"Today":d===1?"Tomorrow":`${d}d`}
                </div>
              </div>
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
              <div className="up-item" key={w.id} onClick={() => onNavigate("warranties")}>
                <span style={{fontSize:"1.15rem"}}>📋</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:".85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.item}</div>
                  <div style={{fontSize:".71rem",color:"#A8A09A",marginTop:"1px"}}>Expires {fmtD(w.expiry_date)}</div>
                </div>
                <div className="up-days" style={{background:d<=30?"var(--red-light)":"#FFF8E6",color:d<=30?"var(--red)":"#92610A"}}>{d}d left</div>
              </div>
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
function Tasks({ tasks, setTasks, toast, userId, profile }) {
  const zone = getClimateZone(profile);
  const climate = getClimateProfile(zone);
  const month = new Date().getMonth();
  const season = month>=2&&month<=4?"spring":month>=5&&month<=7?"summer":month>=8&&month<=10?"fall":"winter";
  const seasonLabel = season.charAt(0).toUpperCase()+season.slice(1);
  const seasonIcon = {spring:"🌸",summer:"☀️",fall:"🍂",winter:"❄️"}[season];
  const seasonalSuggestions = climate[season] || [];

  const [view, setView] = useState("list");
  const [statusF, setStatusF] = useState("All");
  const [catF, setCatF] = useState("All");
  const [sort, setSort] = useState("due_date");
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showSeasonal, setShowSeasonal] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState([]);

  const handleDayClick = (date, dayTasks) => {
    setSelectedDay(date);
    setSelectedDayTasks(dayTasks);
  };

  const openNew = (cat) => {
    setEditData({status:"Scheduled",priority:"Medium",due_date:new Date().toISOString().slice(0,10),category:cat||""});
    setEditId(null);
    setModal(true);
  };
  const openEdit = t => { setEditData({...t}); setEditId(t.id); setModal(true); };

  const save = async () => {
    if(!editData.title?.trim()) return;
    if(editId) {
      const { error } = await supabase.from("tasks").update(editData).eq("id",editId).eq("user_id",userId);
      if(!error) { setTasks(tasks.map(t=>t.id===editId?{...editData,id:editId}:t)); toast("Task updated ✓"); }
      else toast("Error saving","error");
    } else {
      const { data, error } = await supabase.from("tasks").insert([{...editData,user_id:userId}]).select();
      if(!error&&data) { setTasks([...tasks,data[0]]); toast("Task added ✓"); }
      else toast("Error adding","error");
    }
    setModal(false);
  };

  const confirmDel = async () => {
    const { error } = await supabase.from("tasks").delete().eq("id",confirm).eq("user_id",userId);
    if(!error) { setTasks(tasks.filter(t=>t.id!==confirm)); toast("Task deleted","error"); }
    setConfirm(null);
  };

  const toggleStatus = async (t, s) => {
    const { error } = await supabase.from("tasks").update({status:s}).eq("id",t.id).eq("user_id",userId);
    if(!error) { setTasks(tasks.map(x=>x.id===t.id?{...x,status:s}:x)); toast(`Marked as ${s} ✓`); }
  };

  const addSeasonalTask = (title) => {
    setEditData({title, status:"Scheduled", priority:"Medium", category:"Other", due_date:new Date().toISOString().slice(0,10)});
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

  // Group by category for category view
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(t => t.category===cat);
    if(items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  if(filtered.some(t => !t.category || t.category==="")) {
    grouped["Uncategorized"] = filtered.filter(t => !t.category||t.category==="");
  }

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
          <div className="task-card-body">
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
      <div className="sh">
        <span className="sh-title">Tasks</span>
        <div className="sh-right">
          <div className="view-toggle">
            <button className={`view-btn ${view==="list"?"active":""}`} onClick={()=>setView("list")}>List</button>
            <button className={`view-btn ${view==="category"?"active":""}`} onClick={()=>setView("category")}>By Room</button>
            <button className={`view-btn ${view==="calendar"?"active":""}`} onClick={()=>setView("calendar")}>Calendar</button>
          </div>
          <button className="btn btn-primary" onClick={()=>openNew()}>＋ Add Task</button>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar">
        {["All",...STATUS_OPTIONS].map(s=>(
          <button key={s} className={`chip ${statusF===s?"on":""}`} onClick={()=>setStatusF(s)}>{s}</button>
        ))}
        <select className="sort-select" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="due_date">Due Date</option>
          <option value="priority">Priority</option>
          <option value="title">A–Z</option>
          <option value="cost">Cost</option>
        </select>
      </div>
      {view==="list" && (
        <div className="toolbar">
          {["All",...CATEGORIES].map(c=>(
            <button key={c} className={`chip ${catF===c?"on":""}`} onClick={()=>setCatF(c)}>{CAT_ICONS[c]||""} {c}</button>
          ))}
        </div>
      )}      {/* Seasonal suggestions */}
      {showSeasonal && (
        <div className="seasonal-section" style={{background:climate.color, borderColor:climate.border}}>
          <div className="seasonal-section-title">
            {seasonIcon} {seasonLabel} checklist — {climate.label}
            <button onClick={()=>setShowSeasonal(false)} style={{marginLeft:"auto",background:"none",border:"none",color:"#A8A09A",cursor:"pointer",fontSize:".8rem",fontFamily:"'DM Sans',sans-serif"}}>Dismiss</button>
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

      {/* List view */}
      {view==="list" && filtered.map(t => <TaskCard key={t.id} t={t} />)}

      {/* Category view */}
      {view==="category" && Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="cat-group">
          <div className="cat-group-header">
            <div className="cat-group-icon" style={{background:"var(--cream2)"}}>{CAT_ICONS[cat]||"🔧"}</div>
            <span className="cat-group-name">{cat}</span>
            <span className="cat-group-count">{items.length}</span>
            <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>openNew(cat)}>＋ Add</button>
          </div>
          {items.map(t => <TaskCard key={t.id} t={t} />)}
        </div>
      ))}

      {/* Calendar view */}
      {view==="calendar" && (
        <div>
          <Calendar tasks={tasks} mini={false} onDayClick={handleDayClick} />
          <div style={{display:"flex",gap:"1rem",marginTop:".65rem",flexWrap:"wrap"}}>
            {[["#4A89B8","Scheduled"],["#B8861E","In Progress"],["#4E7260","Completed"],["#C05A28","Overdue"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:".72rem",color:"#A8A09A"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
                {l}
              </div>
            ))}
          </div>
          <p style={{fontSize:".75rem",color:"#A8A09A",marginTop:".5rem"}}>Tap a dot to see that day's tasks</p>
        </div>
      )}

      {modal && <Modal title={editId?"Edit Task":"New Task"} onClose={()=>setModal(false)} onSave={save}><TaskForm data={editData} onChange={setEditData}/></Modal>}
      {confirm && <Confirm message="This task will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
      {selectedDay && (
        <DayDetail
          date={selectedDay}
          tasks={selectedDayTasks}
          onClose={() => setSelectedDay(null)}
          onEdit={(t) => { setSelectedDay(null); openEdit(t); }}
        />
      )}
    </div>
  );
}

// ─── ASSETS ───────────────────────────────────────────────────────────────────
function Assets({ warranties: assets, setWarranties: setAssets, toast, userId }) {
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({condition:"Good"});
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [filter, setFilter] = useState("All");
  const [lightbox, setLightbox] = useState(null);
  const [serviceLogs, setServiceLogs] = useState([]);
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceEditData, setServiceEditData] = useState({});
  const [serviceEditId, setServiceEditId] = useState(null);
  const [serviceAssetId, setServiceAssetId] = useState(null);
  const [serviceConfirm, setServiceConfirm] = useState(null);
  const [expandedService, setExpandedService] = useState(null);

  // Load service logs
  useEffect(() => {
    if(!userId) return;
    supabase.from("asset_service_log").select("*").eq("user_id",userId).order("service_date",{ascending:false})
      .then(({data})=>{ if(data) setServiceLogs(data); });
  }, [userId]);

  // Asset CRUD
  const openNew = () => { setEditData({condition:"Good"}); setEditId(null); setModal(true); };
  const openEdit = a => { setEditData({...a}); setEditId(a.id); setModal(true); };

  const save = async () => {
    if(!editData.item?.trim()) return;
    if(editId) {
      const {error} = await supabase.from("warranties").update(editData).eq("id",editId).eq("user_id",userId);
      if(!error) { setAssets(assets.map(a=>a.id===editId?{...editData,id:editId}:a)); toast("Asset updated ✓"); }
      else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("warranties").insert([{...editData,user_id:userId}]).select();
      if(!error&&data) { setAssets([...assets,data[0]]); toast("Asset added ✓"); }
      else toast("Error adding","error");
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
    setServiceEditData({service_date:new Date().toISOString().slice(0,10), asset_id:assetId});
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

  const saveService = async () => {
    if(!serviceEditData.description?.trim()||!serviceEditData.service_date) return;
    if(serviceEditId) {
      const {error} = await supabase.from("asset_service_log").update(serviceEditData).eq("id",serviceEditId).eq("user_id",userId);
      if(!error) {
        setServiceLogs(serviceLogs.map(s=>s.id===serviceEditId?{...serviceEditData,id:serviceEditId}:s));
        // Update last_serviced on asset
        await supabase.from("warranties").update({last_serviced:serviceEditData.service_date}).eq("id",serviceEditData.asset_id).eq("user_id",userId);
        setAssets(assets.map(a=>a.id===serviceEditData.asset_id?{...a,last_serviced:serviceEditData.service_date}:a));
        toast("Service log updated ✓");
      } else toast("Error saving","error");
    } else {
      const {data,error} = await supabase.from("asset_service_log").insert([{...serviceEditData,user_id:userId}]).select();
      if(!error&&data) {
        setServiceLogs([data[0],...serviceLogs]);
        // Update last_serviced on asset
        await supabase.from("warranties").update({last_serviced:serviceEditData.service_date}).eq("id",serviceEditData.asset_id).eq("user_id",userId);
        setAssets(assets.map(a=>a.id===serviceEditData.asset_id?{...a,last_serviced:serviceEditData.service_date}:a));
        toast("Service logged ✓");
      } else toast("Error logging","error");
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
        const assetLogs = serviceLogs.filter(s=>s.asset_id===a.id);
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
                <div className="asset-stat-val">{totalServiceCost>0?fmt$(totalServiceCost):assetLogs.length>0?"$0":"—"}</div>
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

      {modal && <Modal title={editId?"Edit Asset":"Add Asset"} onClose={()=>setModal(false)} onSave={save}><AssetForm data={editData} onChange={setEditData} userId={userId}/></Modal>}
      {confirm && <Confirm message="This asset and its service history will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
      {serviceModal && <Modal title={serviceEditId?"Edit Service Log":"Log Service"} onClose={()=>setServiceModal(false)} onSave={saveService}><ServiceLogForm data={serviceEditData} onChange={setServiceEditData}/></Modal>}
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
        <label>Bill Photo / Receipt</label>
        <div className="pro-gate" onClick={()=>alert("AI bill scanning is a Pro feature — coming soon!")}>
          <span style={{fontSize:"1.1rem"}}>✨</span>
          <span className="pro-gate-text">Scan bill with AI — auto-fill amount & usage</span>
          <span className="pro-gate-badge">Pro</span>
        </div>
        <div style={{marginTop:".5rem"}}>
          <ExpenseFileUpload
            userId={userId}
            expenseId={`bill-${data.id||"new"}`}
            currentUrl={data.file_url||""}
            onUploaded={url=>f("file_url",url)}
            label="Or attach manually"
          />
        </div>
      </div>
    </div>
  );
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
function Expenses({ expenses, setExpenses, toast, userId }) {
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
  const openNew = () => { setEditData({date:new Date().toISOString().slice(0,10)}); setEditId(null); setModal(true); };
  const openEdit = e => { setEditData({...e}); setEditId(e.id); setModal(true); };

  const save = async () => {
    if(!editData.description?.trim()) return;
    const payload = {...editData};
    if(!payload.project_id) delete payload.project_id;
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
  const openNewProject = () => { setProjectEditData({status:"Planning",start_date:new Date().toISOString().slice(0,10)}); setProjectEditId(null); setProjectModal(true); };
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
    setBillEditData({bill_date:new Date().toISOString().slice(0,7)+"-01", utility_id:utilId});
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
  const thisYear = expenses.filter(e=>e.date?.startsWith(String(yr)));
  const lastYear = expenses.filter(e=>e.date?.startsWith(String(yr-1)));
  const thisYrTotal = thisYear.reduce((s,e)=>s+Number(e.amount||0),0);
  const lastYrTotal = lastYear.reduce((s,e)=>s+Number(e.amount||0),0);
  const utilThisYr = bills.filter(b=>b.bill_date?.startsWith(String(yr))).reduce((s,b)=>s+Number(b.amount||0),0);
  const allTotal = expenses.reduce((s,e)=>s+Number(e.amount||0),0) + bills.reduce((s,b)=>s+Number(b.amount||0),0);
  const trend = lastYrTotal > 0 ? ((thisYrTotal - lastYrTotal) / lastYrTotal * 100).toFixed(0) : null;

  // Monthly chart data — current year
  const curMonth = new Date().getMonth();
  const monthlyData = Array.from({length:12},(_,i)=>{
    const m = String(i+1).padStart(2,"0");
    const total = thisYear.filter(e=>e.date?.startsWith(`${yr}-${m}`)).reduce((s,e)=>s+Number(e.amount||0),0);
    return {month:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i], total, isCur: i===curMonth};
  });
  const maxMonth = Math.max(...monthlyData.map(m=>m.total), 1);

  // Category breakdown
  const bycat = {};
  expenses.forEach(e=>{ if(e.category) bycat[e.category]=(bycat[e.category]||{total:0,count:0}); bycat[e.category].total+=Number(e.amount||0); bycat[e.category].count+=1; });
  const catData = Object.entries(bycat).sort((a,b)=>b[1].total-a[1].total);

  // Filtered expense list
  const filtered = catF==="All" ? expenses : expenses.filter(e=>e.category===catF);
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
                <div className="invest-hero-stat-val">{fmt$(thisYrTotal)}</div>
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

          {/* Monthly chart */}
          {thisYear.length > 0 && (
            <div className="month-chart">
              <div className="month-chart-title">{yr} monthly spending</div>
              <div className="month-bars" style={{height:90}}>
                {monthlyData.map((m,i)=>(
                  <div key={i} className="month-bar-wrap">
                    <div className="month-bar-amt">{m.total>0?`$${m.total>=1000?Math.round(m.total/1000)+"k":Math.round(m.total)}`:""}</div>
                    <div className="month-bar-fill" style={{
                      height:`${Math.max((m.total/maxMonth)*100,m.total>0?6:0)}%`,
                      background: m.isCur
                        ? "var(--rust)"
                        : m.total>0 ? CHART_COLORS[i%CHART_COLORS.length] : "var(--stone)",
                      opacity: m.isCur ? 1 : 0.85,
                    }}/>
                    <div className="month-bar-label" style={{
                      color: m.isCur ? "var(--rust)" : "#A8A09A",
                      fontWeight: m.isCur ? 700 : 500,
                      fontSize: ".52rem",
                    }}>{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  <span style={{fontFamily:"'Fraunces',serif",fontSize:".95rem",fontWeight:700,color:"var(--sage)"}}>{fmt$(filteredTotal)}</span>
                </div>
              </div>
              {sorted.map(e=>{
                const proj = e.project_id ? projects.find(p=>p.id===e.project_id) : null;
                const isImage = e.file_url && e.file_url.match(/\.(jpg|jpeg|png|webp|heic)/i);
                const isPdf = e.file_url && e.file_url.match(/\.pdf/i);
                return (
                  <div key={e.id} className="exp-card" style={{flexDirection:"column",gap:0}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:".75rem"}}>
                      <div className="exp-card-icon" style={{background:CHART_COLORS[CATEGORIES.indexOf(e.category)%CHART_COLORS.length]+"22"}}>
                        {CAT_ICONS[e.category]||"🔧"}
                      </div>
                      <div className="exp-card-body">
                        <div className="exp-card-title">{e.description}</div>
                        <div className="exp-card-meta">
                          {e.date && <span>{fmtD(e.date)}</span>}
                          {e.category && <span>{e.category}</span>}
                          {e.vendor && <span>👤 {e.vendor}</span>}
                          {proj && <span className="exp-project-tag">🔨 {proj.name}</span>}
                          {e.file_url && <span style={{color:"var(--rust)",fontSize:".65rem",fontWeight:600}}>📎 receipt</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px",flexShrink:0}}>
                        <div className="exp-card-amount">{fmt$(e.amount)}</div>
                        <div style={{display:"flex",gap:"3px"}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(e)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>setConfirm(e.id)}>✕</button>
                        </div>
                      </div>
                    </div>
                    {/* File preview */}
                    {e.file_url && (
                      <div className="exp-card-file">
                        {isImage ? (
                          <img
                            src={e.file_url}
                            alt="Receipt"
                            className="exp-file-thumb"
                            onClick={()=>setLightbox(e.file_url)}
                          />
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
                  <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>{setEditData({date:new Date().toISOString().slice(0,10),project_id:p.id});setEditId(null);setModal(true);}}>
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

      {modal && <Modal title={editId?"Edit Expense":"Log Expense"} onClose={()=>setModal(false)} onSave={save}><ExpenseForm data={editData} onChange={setEditData} projects={projects} userId={userId}/></Modal>}
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

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function Profile({ profile, setProfile, tasks, expenses, warranties, toast, userId }) {
  const [modal, setModal] = useState(false);
  const [insModal, setInsModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [insData, setInsData] = useState({});

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

  // System age warnings based on home age
  const SYSTEMS = [
    {name:"HVAC System",        icon:"🌡️", lifespan:20, ageNote:"15–20 year lifespan"},
    {name:"Water Heater",       icon:"🚿", lifespan:12, ageNote:"10–15 year lifespan"},
    {name:"Roof",               icon:"🏚️", lifespan:25, ageNote:"20–30 year lifespan"},
    {name:"Electrical Panel",   icon:"⚡", lifespan:40, ageNote:"30–40 year lifespan"},
    {name:"Plumbing (galvanized)",icon:"🛠️",lifespan:50, ageNote:"40–70 years for copper"},
  ];
  const systemAlerts = homeAge ? SYSTEMS.map(s => {
    const pct = homeAge / s.lifespan;
    const status = pct >= 1 ? "alert" : pct >= 0.75 ? "warn" : "ok";
    return {...s, pct, status, homeAge};
  }) : [];

  // Insurance renewal
  const insRenewalDays = profile?.ins_renewal_date ? daysTo(profile.ins_renewal_date) : null;
  const insRenewalStatus = insRenewalDays === null ? null : insRenewalDays < 0 ? "expired" : insRenewalDays <= 30 ? "urgent" : insRenewalDays <= 90 ? "soon" : "ok";

  // Stats
  const totalCost = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
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
        {modal && <Modal title="Edit Home Profile" onClose={()=>setModal(false)} onSave={save}><ProfileForm data={editData} onChange={setEditData} userId={userId}/></Modal>}
      </div>
    );
  }

  return (
    <div>
      <div className="sh">
        <span className="sh-title">My Home</span>
        <button className="btn btn-ghost" onClick={openEdit}>✏️ Edit</button>
      </div>

      {/* ── Hero photo / name ── */}
      {(profile?.user_photo_url || profile?.photo_url) ? (
        <div className="home-hero" style={{marginBottom:"1rem"}}>
          <img
            className="home-hero-photo"
            src={profile.user_photo_url || profile.photo_url}
            alt="Your home"
            onError={e=>{ if(e.target.src!==profile.photo_url) e.target.src=profile.photo_url; else e.target.style.display="none"; }}
          />
          <div className="home-hero-overlay">
            <div className="home-hero-name">{profile.name || "My Home"}</div>
            {profile.address && <div className="home-hero-address">📍 {profile.address}</div>}
            {homeAge && <div style={{fontSize:".7rem",color:"rgba(255,255,255,.5)",marginTop:"3px"}}>Built {profile.year} · {homeAge} years old</div>}
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
                <div key={i} className={`system-age-item ${s.status}`}>
                  <span className="system-age-icon">{s.icon}</span>
                  <div style={{flex:1}}>
                    <div className="system-age-name">{s.name}</div>
                    <div className="system-age-detail">{s.ageNote} · your home is {homeAge}yr old</div>
                  </div>
                  <span style={{fontSize:".7rem",fontWeight:700,color:s.status==="alert"?"var(--red)":"#92610A",flexShrink:0}}>
                    {s.status==="alert"?"Past lifespan":"Aging"}
                  </span>
                </div>
              ))}
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

      {modal && <Modal title="Edit Home Profile" onClose={()=>setModal(false)} onSave={save}><ProfileForm data={editData} onChange={setEditData} userId={userId}/></Modal>}
      {insModal && <Modal title={profile?.ins_company?"Edit Insurance":"Add Insurance"} onClose={()=>setInsModal(false)} onSave={saveIns}><InsuranceForm data={insData} onChange={setInsData}/></Modal>}
    </div>
  );
}


// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState("landing"); // landing | login | signup
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const { toasts, show: toast } = useToast();

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
      setTasks([]); setWarranties([]); setExpenses([]); setProfile(null);
      return;
    }
    const uid = session.user.id;
    async function loadData() {
      setDataLoading(true);
      const [t, w, e, p] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("warranties").select("*").eq("user_id", uid).order("expiry_date", { ascending: true }),
        supabase.from("expenses").select("*").eq("user_id", uid).order("date", { ascending: false }),
        supabase.from("profiles").select("*").eq("user_id", uid).limit(1),
      ]);
      if(t.data) setTasks(t.data);
      if(w.data) setWarranties(w.data);
      if(e.data) setExpenses(e.data);
      if(p.data && p.data.length > 0) setProfile(p.data[0]);
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

  // ── Main app
  const overdue = tasks.filter(t=>t.status==="Overdue").length;
  const TABS = [
    {id:"dashboard", label:"Home",       icon:"🏠"},
    {id:"tasks",     label:"Tasks",      icon:"✓",  badge:overdue},
    {id:"warranties",label:"Assets",    icon:"🏠", badge: (() => { const n = warranties.filter(w=>w.condition==="Needs Attention"||w.condition==="Failed").length; return n>0?n:0; })()},
    {id:"expenses",  label:"Expenses",   icon:"💲"},
    {id:"profile",   label:"My Home",    icon:"🏡"},
  ];
  const uid = session.user.id;

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const username = session.user.email.split("@")[0];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── Header ── */}
        <header className="hdr">
          <div className="hdr-logo">
            <div className="ico">🏠</div>
            <span className="name">HomeKeep</span>
          </div>
          <SearchBar tasks={tasks} warranties={warranties} expenses={expenses} onNavigate={setTab}/>
          <UserMenu user={session.user} onSignOut={handleSignOut} />
        </header>

        {/* ── Desktop Nav ── */}
        <nav className="nav">
          {TABS.map(t=>(
            <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
              <span>{t.icon}</span> {t.label}
              {t.badge>0 && <span className="nav-badge">{t.badge}</span>}
            </button>
          ))}
        </nav>

        {/* ── Main Content ── */}
        <main className="main">
          {dataLoading ? (
            <div className="loading">
              <div className="spinner"/>
              <span style={{fontSize:".85rem"}}>Loading your home…</span>
            </div>
          ) : (
            <>
              {tab==="dashboard" && <Dashboard tasks={tasks} warranties={warranties} expenses={expenses} profile={profile} onNavigate={setTab} greeting={greeting} username={username}/>}
              {tab==="tasks" && <Tasks tasks={tasks} setTasks={setTasks} toast={toast} userId={uid} profile={profile}/>}
              {tab==="warranties" && <Assets warranties={warranties} setWarranties={setWarranties} toast={toast} userId={uid}/>}
              {tab==="expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} toast={toast} userId={uid}/>}
              {tab==="profile" && <Profile profile={profile} setProfile={setProfile} tasks={tasks} expenses={expenses} warranties={warranties} toast={toast} userId={uid}/>}
            </>
          )}
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav className="bottom-nav">
          {TABS.map(t=>(
            <button key={t.id} className={`bnav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
              {t.badge>0 && <span className="bnav-badge">{t.badge}</span>}
              <span className="bnav-icon">{t.icon}</span>
              <span className="bnav-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <Toasts toasts={toasts}/>
      </div>
    </>
  );
}
