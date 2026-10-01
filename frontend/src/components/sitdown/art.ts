/* The six recurring colleague drawings and the shape sketches, ported verbatim from
   server/static/sitdown3.html. The server fixes each drawing's name (data_engineer Arjun,
   finance Marcus, store_manager Jo, governance Amara, platform Tom, regional_ops Sam) and adapts
   the role per idea; this file holds only the art. Name and role are always read from the payload. */
/* eslint-disable */
// @ts-nocheck
export const CAST: Record<string, any>={
  data_engineer:{acc:'#2E5A6B',skin:'#8a5a3c',hair:'#1f1612',brow:'#1f1612',top:'#2E5A6B',sleeve:'#2E5A6B',bd:'2.1s',look:'de'},
  finance:{acc:'#1B3139',skin:'#f0c9a8',hair:'#a7b0b4',brow:'#7d888c',top:'#1B3139',sleeve:'#1B3139',bd:'0s',look:'cfo'},
  store_manager:{acc:'#c77f06',skin:'#c68a62',hair:'#2b1d17',brow:'#2b1d17',top:'#F5F3EF',sleeve:'#e9e5de',bd:'1.3s',look:'sm'},
  governance:{acc:'#046a48',skin:'#ecbf9a',hair:'#7a3e2a',brow:'#6a3322',top:'#046a48',sleeve:'#046a48',bd:'.7s',look:'gov'},
  platform:{acc:'#5A8A9A',skin:'#e3b08c',hair:'#4a3426',brow:'#3a281c',top:'#5A8A9A',sleeve:'#4e7b8a',bd:'1.7s',look:'plat'},
  regional_ops:{acc:'#8a3b2a',skin:'#b77b55',hair:'#2a1c16',brow:'#2a1c16',top:'#8a3b2a',sleeve:'#7a3324',bd:'.4s',look:'reg'},
};
/* which drawing to use: the payload's avatar, else persona if it names a drawing, else a default.
   Names and roles always come from the payload: the cast is generated per idea. */
export function personaOf(it: any): string{return CAST[it.avatar]?it.avatar:CAST[it.persona]?it.persona:'data_engineer'}
export const TONE_MOOD: Record<string,string>={challenge:'skeptical',curious:'warming',excited:'won'};
export function charSVG(pid: string,size: number,mood?: string): string{
  const L=CAST[pid]||CAST.regional_ops,ink="#1B3139",lk=L.look;
  const behind=lk==='gov'?`<circle cx="60" cy="21" r="10" fill="${L.hair}"/><circle cx="60" cy="21" r="4" fill="rgba(0,0,0,.12)"/>`:lk==='de'?`<path d="M30 96 Q60 64 90 96 Z" fill="#244b59"/>`:lk==='reg'?`<path d="M38 58 Q34 84 44 96 L76 96 Q86 84 82 58 Z" fill="${L.hair}"/>`:'';
  const detail={
    cfo:`<path d="M50 90 L60 108 L70 90 Z" fill="#F5F3EF"/><path d="M58.2 95 L61.8 95 L63.6 117 L60 122 L56.4 117 Z" fill="#FF3621"/><path d="M50 90 L60 111 L54 118 L43 97 Z" fill="#132329"/><path d="M70 90 L60 111 L66 118 L77 97 Z" fill="#132329"/>`,
    sm:`<path d="M37 108 L83 108 L86 142 L34 142 Z" fill="#F59E0B"/><path d="M45 108 L51 92 M75 108 L69 92" stroke="#c77f06" stroke-width="3" stroke-linecap="round"/><rect x="51" y="118" width="18" height="9" rx="2.5" fill="#c77f06" opacity=".45"/><circle cx="74" cy="114" r="3" fill="#fffefb"/>`,
    de:`<path d="M55 97 L54 113 M65 97 L66 113" stroke="#F5F3EF" stroke-width="1.8" stroke-linecap="round"/><path d="M41 91 Q60 109 79 91" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/><rect x="35" y="84" width="10" height="13" rx="4.5" fill="${ink}"/><rect x="75" y="84" width="10" height="13" rx="4.5" fill="${ink}"/>`,
    gov:`<path d="M52 90 L60 104 L68 90 Z" fill="#F5F3EF"/><path d="M52 91 L60 117 L68 91" fill="none" stroke="#FF3621" stroke-width="1.6"/><rect x="53.5" y="115" width="13" height="16" rx="2.5" fill="#fffefb" stroke="${ink}" stroke-width="1"/><rect x="56.5" y="118.5" width="7" height="3" rx="1" fill="#00A870"/><rect x="56.5" y="124" width="7" height="1.6" fill="#c9d3d6"/>`,
    plat:`<path d="M46 90 Q60 100 74 90" fill="none" stroke="#F5F3EF" stroke-width="2.5"/><path d="M52 92 L60 120 L68 92" fill="none" stroke="#00A870" stroke-width="1.5"/><rect x="54" y="119" width="12" height="15" rx="2.5" fill="#fffefb" stroke="${ink}" stroke-width="1"/><circle cx="60" cy="125" r="2.5" fill="#2E5A6B"/>`,
    reg:`<path d="M46 90 Q60 104 74 90 L70 98 Q60 106 50 98 Z" fill="#F59E0B"/><rect x="72" y="112" width="14" height="19" rx="2.5" fill="#1B3139"/><rect x="74.5" y="115" width="9" height="12" rx="1" fill="#5A8A9A"/>`,
  }[lk];
  const hair={
    cfo:`<path d="M39 45 Q39 22 60 22 Q81 22 81 43 Q76 31 63 31 Q53 31 47 36 Q42 40 39 45 Z" fill="${L.hair}"/>`,
    sm:`<path d="M39 41 L39 51 L43 46 Z M81 41 L81 51 L77 46 Z" fill="${L.hair}"/><path d="M37 37 Q39 15 60 15 Q81 15 83 37 Z" fill="#2E5A6B"/><path d="M58 16 L62 16 L62 36 L58 36 Z" fill="#244b59"/><ellipse cx="60" cy="37" rx="26" ry="4.8" fill="${ink}"/>`,
    de:`<path d="M38.5 47 Q36 23 60 22 Q83 22 82 45 Q79 33 67 30.5 Q62 34 52 33.5 Q44 35 40.5 41 Z" fill="${L.hair}"/><path d="M60 22 Q70 19 76 26 Q68 25 62 28 Z" fill="${L.hair}"/>`,
    gov:`<path d="M38 52 Q35 24 60 24 Q85 24 82 52 Q81 36 68 32 Q55 33 45 40 Q40 45 38 52 Z" fill="${L.hair}"/>`,
    plat:`<path d="M39 44 Q37 24 58 22 Q80 21 82 42 Q78 30 66 29 Q58 34 46 33 Q41 37 39 44 Z" fill="${L.hair}"/><path d="M36 50 Q36 26 60 26 Q84 26 84 50" fill="none" stroke="#1B3139" stroke-width="2.4"/><rect x="31" y="46" width="7" height="11" rx="3" fill="#1B3139"/>`,
    reg:`<path d="M37 54 Q34 23 60 23 Q86 23 83 54 Q80 34 60 33 Q40 34 37 54 Z" fill="${L.hair}"/>`,
  }[lk];
  const glasses=lk==='cfo'?`<g fill="rgba(255,255,255,.18)" stroke="${ink}" stroke-width="1.7"><rect x="44.5" y="44" width="14" height="11" rx="3.5"/><rect x="61.5" y="44" width="14" height="11" rx="3.5"/><path d="M58.5 48.5 L61.5 48.5" fill="none"/></g>`:'';
  const beard=lk==='de'?`<path d="M42 56 Q44 72 60 73 Q76 72 78 56 Q72 66 60 66 Q48 66 42 56 Z" fill="${L.hair}" opacity=".9"/>`:'';
  const ms=`stroke="${ink}" stroke-width="2.1" stroke-linecap="round" fill="none"`,h=Math.round(size*142/120);
  return `<svg class="char mood-${mood||'warming'}" viewBox="0 0 120 142" width="${size}" height="${h}" style="--bd:${L.bd}" aria-hidden="true"><g class="bod">${behind}
    <rect x="53" y="64" width="14" height="30" rx="6" fill="${L.skin}"/><rect x="53" y="82" width="14" height="6" fill="rgba(0,0,0,.09)"/>
    <path d="M20 142 C20 108 36 90 60 90 C84 90 100 108 100 142 Z" fill="${L.top}"/>${detail}
    <g class="arms-d"><path d="M25 104 Q18 124 22 142 L33 142 Q31 124 35 108 Z" fill="${L.sleeve}"/><path d="M95 104 Q102 124 98 142 L87 142 Q89 124 85 108 Z" fill="${L.sleeve}"/></g>
    <g class="arms-x"><path d="M27 115 Q60 99 93 115 L93 128 Q60 112 27 128 Z" fill="${L.sleeve}"/><path d="M30 123.5 Q60 108 90 123.5" stroke="rgba(0,0,0,.16)" stroke-width="1.3" fill="none"/><ellipse cx="34" cy="113.5" rx="6" ry="5.3" fill="${L.skin}"/><ellipse cx="86" cy="113.5" rx="6" ry="5.3" fill="${L.skin}"/></g>
    <g class="head"><g class="nodg"><circle cx="38.5" cy="51" r="4.6" fill="${L.skin}"/><circle cx="81.5" cy="51" r="4.6" fill="${L.skin}"/>
      <ellipse cx="60" cy="49" rx="21.5" ry="23.5" fill="${L.skin}"/>${beard}${hair}
      <circle cx="47" cy="58" r="3.6" fill="#FF3621" opacity=".13"/><circle cx="73" cy="58" r="3.6" fill="#FF3621" opacity=".13"/>
      <g class="eyes"><ellipse cx="51.5" cy="50" rx="2.5" ry="3" fill="${ink}"/><ellipse cx="68.5" cy="50" rx="2.5" ry="3" fill="${ink}"/><circle cx="52.3" cy="49" r=".8" fill="#fff"/><circle cx="69.3" cy="49" r=".8" fill="#fff"/></g>
      <path class="brow bl" d="M46.5 42.8 L56 41.6" stroke="${L.brow}" stroke-width="2.5" stroke-linecap="round"/><path class="brow br" d="M64 41.6 L73.5 42.8" stroke="${L.brow}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M60 50.5 Q57.6 56 60.8 57" stroke="rgba(0,0,0,.28)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path class="mouth m-flat" d="M54.5 62 L65.5 62" ${ms}/><path class="mouth m-hmm" d="M54.5 62.6 Q60 60.4 66 61.8" ${ms}/><path class="mouth m-smile" d="M53.5 60 Q60 67 66.5 60" ${ms}/>${glasses}
    </g></g></g></svg>`;
}
export const SKETCH: Record<string,string>={
  triage_list:`<rect x="16" y="11" width="168" height="15" rx="4" fill="#fff"/><circle cx="26" cy="18.5" r="2.6" fill="#1B3139" stroke="none"/><line x1="34" y1="18.5" x2="150" y2="18.5"/><circle cx="26" cy="37" r="2.6"/><line x1="34" y1="37" x2="138" y2="37"/><circle cx="26" cy="53" r="2.6"/><line x1="34" y1="53" x2="150" y2="53"/><circle cx="26" cy="69" r="2.6"/><line x1="34" y1="69" x2="126" y2="69"/>`,
  dashboard:`<rect x="16" y="12" width="58" height="24" rx="4"/><line x1="24" y1="20" x2="46" y2="20" stroke-width="3"/><line x1="24" y1="28" x2="60" y2="28"/><rect x="82" y="12" width="58" height="24" rx="4"/><line x1="90" y1="20" x2="112" y2="20" stroke-width="3"/><line x1="90" y1="28" x2="126" y2="28"/><rect x="16" y="58" width="10" height="14"/><rect x="34" y="50" width="10" height="22"/><rect x="52" y="54" width="10" height="18"/><rect x="70" y="46" width="10" height="26"/><rect x="88" y="60" width="10" height="12"/><line x1="12" y1="72" x2="150" y2="72"/>`,
  ask_answer:`<rect x="16" y="13" width="168" height="20" rx="10"/><line x1="34" y1="23" x2="120" y2="23" stroke-dasharray="2 4"/><rect x="16" y="43" width="168" height="30" rx="6" fill="#fff"/><line x1="26" y1="54" x2="170" y2="54"/><line x1="26" y1="63" x2="150" y2="63"/>`,
  explore_table:`<rect x="16" y="11" width="28" height="12" rx="6" fill="#fff"/><rect x="50" y="11" width="28" height="12" rx="6"/><rect x="84" y="11" width="28" height="12" rx="6"/><rect x="16" y="32" width="168" height="40" rx="4"/><line x1="16" y1="46" x2="184" y2="46"/><line x1="16" y1="59" x2="184" y2="59"/><line x1="72" y1="32" x2="72" y2="72"/><line x1="128" y1="32" x2="128" y2="72"/>`,
  approve_queue:`<rect x="18" y="10" width="164" height="30" rx="6"/><line x1="28" y1="20" x2="120" y2="20"/><rect x="118" y="26" width="26" height="9" rx="4" fill="#fff"/><rect x="150" y="26" width="26" height="9" rx="4"/><rect x="18" y="46" width="164" height="30" rx="6"/><line x1="28" y1="56" x2="110" y2="56"/><rect x="118" y="62" width="26" height="9" rx="4" fill="#fff"/><rect x="150" y="62" width="26" height="9" rx="4"/>`,
  none:`<rect x="16" y="12" width="168" height="60" rx="10" stroke-dasharray="4 5"/><path d="M92 40l14-14 5 5-14 14-6 1z"/><text x="100" y="64" text-anchor="middle" font-size="9" fill="#5A8A9A" stroke="none" font-family="DM Sans, sans-serif">we'll sketch this together</text>`,
};
export const sketchSVG=(k?: string): string=>`<svg viewBox="0 0 200 84" fill="none" stroke="#5A8A9A" stroke-width="1.4" stroke-linecap="round">${SKETCH[k]||SKETCH.none}</svg>`;
export const cupSVG=(on: boolean): string=>`<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 3.5h6.5v3.2A2.8 2.8 0 0 1 5.7 9.5H4.8A2.8 2.8 0 0 1 2 6.7z" fill="${on?'#2E5A6B':'none'}" stroke="#2E5A6B" stroke-width="1"/><path d="M8.5 4.5h.8a1.2 1.2 0 0 1 0 2.4h-.8" fill="none" stroke="#2E5A6B" stroke-width="1"/></svg>`;
