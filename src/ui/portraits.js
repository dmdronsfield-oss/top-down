const G='<g stroke="#1F1C2B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">';
function star(cx,cy,r1,r2,n){let p='';for(let i=0;i<n*2;i++){const r=i%2?r2:r1;const a=-Math.PI/2+i*Math.PI/n;p+=(i?'L':'M')+(cx+Math.cos(a)*r).toFixed(1)+' '+(cy+Math.sin(a)*r).toFixed(1);}return p+'Z';}
const P={
hero:`<svg viewBox="0 0 200 240" role="img" aria-label="Portrait of Teddy Wrenfield"><rect width="200" height="240" fill="#E5D9BE"/><circle cx="100" cy="112" r="86" fill="#D9A441"/><circle cx="100" cy="112" r="94" fill="none" stroke="#1F1C2B" stroke-width="1"/>${G}
<path d="M22 240 C30 196 52 178 82 170 L118 170 C148 178 170 196 178 240 Z" fill="#CFC5AE"/>
<path d="M48 240 L60 186 M70 240 L75 180 M130 240 L125 180 M152 240 L140 186" stroke="#F4EEE0" stroke-width="1.3" fill="none"/>
<path d="M88 144 L88 168 L112 168 L112 144 Z" fill="#E3BC98"/>
<path d="M84 170 L100 214 L116 170 Z" fill="#F4EEE0"/>
<path d="M96 178 L104 178 L108 206 L100 216 L92 206 Z" fill="#8C2B2B"/>
<path d="M94 191 L106 187 M93 201 L107 197" stroke="#D9A441" stroke-width="2" fill="none"/>
<path d="M82 170 L100 214 L74 198 L64 178 Z" fill="#B9AE95"/><path d="M118 170 L100 214 L126 198 L136 178 Z" fill="#B9AE95"/>
<path d="M86 160 L100 176 L114 160 L113 171 L100 181 L87 171 Z" fill="#F4EEE0"/>
<circle cx="70" cy="190" r="6.5" fill="#C8453B"/><path d="M128 207 L146 203 L141 214 L135 208 Z" fill="#1F5C5A"/>
<ellipse cx="71" cy="122" rx="6" ry="10" fill="#EBC9A8"/><ellipse cx="129" cy="122" rx="6" ry="10" fill="#EBC9A8"/>
<path d="M72 96 C72 140 84 158 100 158 C116 158 128 140 128 96 Z" fill="#EBC9A8"/>
<path d="M72 112 C70 100 72 94 76 92 L124 92 C128 94 130 100 128 112 C124 102 118 100 112 100 L88 100 C82 100 76 102 72 112 Z" fill="#7A4E2D"/>
<path d="M82 111 Q89 105 95 109 M105 109 Q111 105 118 111" fill="none"/>
<path d="M84 121 Q89 117 94 121 M106 121 Q111 117 116 121" fill="none"/>
<path d="M100 116 L97 134 L103 135" fill="none"/>
<path d="M90 144 Q100 151 110 143" fill="none"/>
<circle cx="83" cy="134" r="5" fill="#E7A88F" stroke="none"/><circle cx="117" cy="134" r="5" fill="#E7A88F" stroke="none"/>
<ellipse cx="100" cy="92" rx="52" ry="9" fill="#E2C27A"/>
<path d="M73 92 L75 64 Q100 58 125 64 L127 92 Z" fill="#E2C27A"/>
<path d="M74.2 76 L125.8 76 L126.6 87 L73.4 87 Z" fill="#24304A"/>
<ellipse cx="100" cy="64" rx="25" ry="4.5" fill="#EAD08F"/>
<path d="M48 92 A52 9 0 0 0 152 92" fill="#E2C27A"/>
</g></svg>`,
valet:`<svg viewBox="0 0 200 240" role="img" aria-label="Portrait of Mortlake"><rect width="200" height="240" fill="#E5D9BE"/><circle cx="100" cy="112" r="86" fill="#1F5C5A"/><circle cx="100" cy="112" r="94" fill="none" stroke="#1F1C2B" stroke-width="1"/>${G}
<path d="M22 240 C30 194 54 176 82 170 L118 170 C146 176 170 194 178 240 Z" fill="#26242E"/>
<path d="M89 140 L89 168 L111 168 L111 140 Z" fill="#D9B396"/>
<path d="M86 170 L100 212 L114 170 Z" fill="#F4EEE0"/>
<path d="M97 176 L103 176 L105 204 L100 210 L95 204 Z" fill="#1F1C2B"/>
<path d="M82 170 L100 212 L76 198 L66 178 Z" fill="#383542"/><path d="M118 170 L100 212 L124 198 L134 178 Z" fill="#383542"/>
<path d="M86 162 L100 175 L114 162 L116 171 L100 180 L84 171 Z" fill="#F4EEE0"/>
<ellipse cx="73" cy="114" rx="5.5" ry="10" fill="#E6C3A6"/><ellipse cx="127" cy="114" rx="5.5" ry="10" fill="#E6C3A6"/>
<path d="M75 92 C75 140 86 160 100 160 C114 160 125 140 125 92 C125 70 114 60 100 60 C86 60 75 70 75 92 Z" fill="#E6C3A6"/>
<path d="M75 104 C73 88 76 80 81 76 L83 104 Z" fill="#A39E94"/><path d="M125 104 C127 88 124 80 119 76 L117 104 Z" fill="#A39E94"/>
<path d="M88 70 Q100 64 112 70" stroke="#F7EBDD" stroke-width="3" fill="none"/>
<path d="M84 103 L95 103 M105 99 Q111 92 117 99" fill="none"/>
<path d="M85 112 L94 112 M106 111 L115 111" fill="none"/><path d="M86 112 Q89.5 115 93 112 M107 111 Q110.5 114 114 111" fill="#1F1C2B" stroke-width="1.5"/>
<path d="M100 108 L96 136 L103 137" fill="none"/>
<path d="M92 147 L108 146" fill="none"/>
</g></svg>`,
cop:`<svg viewBox="0 0 200 240" role="img" aria-label="Portrait of PC Plumtree"><rect width="200" height="240" fill="#E5D9BE"/><circle cx="100" cy="112" r="86" fill="#8C2B2B"/><circle cx="100" cy="112" r="94" fill="none" stroke="#1F1C2B" stroke-width="1"/>${G}
<path d="M18 240 C26 192 52 174 82 168 L118 168 C148 174 174 192 182 240 Z" fill="#24304A"/>
<path d="M78 158 L122 158 L124 178 L76 178 Z" fill="#24304A"/>
<rect x="82" y="164" width="9" height="8" fill="#CFCBC1" stroke-width="1.5"/><rect x="109" y="164" width="9" height="8" fill="#CFCBC1" stroke-width="1.5"/>
<circle cx="100" cy="192" r="4" fill="#CFCBC1" stroke-width="1.8"/><circle cx="100" cy="210" r="4" fill="#CFCBC1" stroke-width="1.8"/><circle cx="100" cy="228" r="4" fill="#CFCBC1" stroke-width="1.8"/>
<path d="M60 196 L74 196 M126 196 L140 196" stroke="#CFCBC1" stroke-width="3"/>
<ellipse cx="100" cy="128" rx="33" ry="34" fill="#EDC0A0"/>
<circle cx="80" cy="138" r="7.5" fill="#E08A7A" stroke="none"/><circle cx="120" cy="138" r="7.5" fill="#E08A7A" stroke="none"/>
<path d="M79 114 Q88 107 95 114 M105 114 Q112 107 121 114" stroke-width="4.5" fill="none"/>
<circle cx="88" cy="123" r="2.6" fill="#1F1C2B" stroke="none"/><circle cx="112" cy="123" r="2.6" fill="#1F1C2B" stroke="none"/>
<circle cx="100" cy="134" r="6.5" fill="#E8A88C"/>
<path d="M78 147 Q90 137 100 143 Q110 137 122 147 Q112 156 100 149 Q88 156 78 147 Z" fill="#6B4A32"/>
<path d="M68 122 Q72 160 100 164 Q128 160 132 122" fill="none" stroke-width="2"/>
<path d="M64 118 Q62 104 70 100 L73 68 Q78 30 100 26 Q122 30 127 68 L130 100 Q138 104 136 118 Q100 108 64 118 Z" fill="#1E2740"/>
<path d="M100 30 L100 66" stroke-width="1.5" stroke="#3B4766"/>
<circle cx="100" cy="26" r="5.5" fill="#CFCBC1"/>
<path d="${star(100,84,13,7,8)}" fill="#CFCBC1" stroke-width="1.8"/><circle cx="100" cy="84" r="4" fill="#24304A" stroke-width="1.2"/>
</g></svg>`,
aunt:`<svg viewBox="0 0 200 240" role="img" aria-label="Portrait of Aunt Hester"><rect width="200" height="240" fill="#E5D9BE"/><circle cx="100" cy="112" r="86" fill="#D98C7A"/><circle cx="100" cy="112" r="94" fill="none" stroke="#1F1C2B" stroke-width="1"/>${G}
<path d="M14 240 C22 192 50 172 82 168 L118 168 C150 172 178 192 186 240 Z" fill="#5C3A5A"/>
<path d="M88 138 L88 166 L112 166 L112 138 Z" fill="#EFD3BC"/>
<path d="M84 156 Q100 168 116 156" fill="none" stroke-width="1.5"/>
<g stroke-width="1.2" fill="#F4EEE0"><circle cx="86" cy="158" r="3"/><circle cx="92" cy="162" r="3"/><circle cx="100" cy="164" r="3"/><circle cx="108" cy="162" r="3"/><circle cx="114" cy="158" r="3"/></g>
<path d="M58 178 Q66 162 80 166 Q88 156 100 162 Q112 156 120 166 Q134 162 142 178 Q122 190 100 184 Q78 190 58 178 Z" fill="#8A7462"/>
<path d="M70 172 Q74 168 78 172 M92 168 Q96 164 100 170 M120 172 Q124 168 128 172" fill="none" stroke-width="1.5"/>
<ellipse cx="71" cy="112" rx="8" ry="14" fill="#B8B2A8"/><ellipse cx="129" cy="112" rx="8" ry="14" fill="#B8B2A8"/>
<path d="M71 102 C71 142 84 158 100 158 C116 158 129 142 129 102 C129 84 116 76 100 76 C84 76 71 84 71 102 Z" fill="#EFD3BC"/>
<path d="M88 152 Q100 160 112 152" fill="none" stroke-width="1.8"/>
<path d="M79 106 L96 111 M104 111 L121 106" stroke-width="3.5" fill="none"/>
<circle cx="89" cy="119" r="7.5" fill="#F7F2E6" fill-opacity=".5" stroke-width="1.8"/><circle cx="111" cy="119" r="7.5" fill="#F7F2E6" fill-opacity=".5" stroke-width="1.8"/>
<path d="M96.5 118 Q100 114 103.5 118" fill="none" stroke-width="1.8"/><path d="M81.5 121 Q72 150 80 176" fill="none" stroke-width="1"/>
<circle cx="89" cy="120" r="2.2" fill="#1F1C2B" stroke="none"/><circle cx="111" cy="120" r="2.2" fill="#1F1C2B" stroke="none"/>
<path d="M100 114 Q107 128 99 136 L104 136" fill="none"/>
<path d="M89 145 Q100 140 111 145" fill="none"/>
<path d="M60 100 Q58 72 100 64 Q142 72 140 100 Q100 90 60 100 Z" fill="#2C4A6E"/>
<path d="M62 94 Q100 84 138 94" fill="none" stroke="#D9A441" stroke-width="4"/>
<path d="M118 80 Q156 36 178 22 Q160 54 128 86 Z" fill="#D9A441"/><path d="M122 82 Q150 50 176 24" fill="none" stroke-width="1.5"/>
<path d="M130 70 L140 74 M138 60 L148 64 M146 50 L156 54" fill="none" stroke-width="1.2"/>
</g></svg>`,
creamer:`<svg viewBox="0 0 240 180" role="img" aria-label="The silver cow creamer"><rect width="240" height="180" fill="#E5D9BE"/><circle cx="120" cy="92" r="80" fill="#1F5C5A"/><circle cx="120" cy="92" r="87" fill="none" stroke="#1F1C2B" stroke-width="1"/>${G}
<ellipse cx="122" cy="152" rx="80" ry="11" fill="#CFCBC1"/>
<path d="M66 118 L64 150 L76 150 L78 120 Z M86 122 L86 150 L97 150 L98 122 Z M150 122 L150 150 L161 150 L162 120 Z M168 118 L170 150 L181 150 L180 116 Z" fill="#B9B5AA"/>
<path d="M186 90 C214 76 216 124 188 118" fill="none" stroke="#1F1C2B" stroke-width="11"/><path d="M186 90 C214 76 216 124 188 118" fill="none" stroke="#CFCBC1" stroke-width="6"/>
<path d="M60 94 C60 70 90 60 128 62 C168 62 188 74 188 98 C188 122 168 130 128 130 C90 130 62 122 60 94 Z" fill="#CFCBC1"/>
<ellipse cx="122" cy="132" rx="12" ry="5.5" fill="#B9B5AA"/>
<path d="M68 84 C54 74 38 76 30 88 C24 98 27 114 40 116 C50 118 58 110 68 106 Z" fill="#CFCBC1"/>
<path d="M30 104 L18 110 L32 113 Z" fill="#6E6A62"/>
<path d="M48 78 Q42 64 52 58 M60 79 Q60 66 68 62" fill="none" stroke-width="3"/>
<ellipse cx="63" cy="86" rx="7" ry="3.4" fill="#B9B5AA" transform="rotate(-25 63 86)"/>
<circle cx="43" cy="92" r="2.4" fill="#1F1C2B" stroke="none"/>
<ellipse cx="126" cy="62" rx="22" ry="6" fill="#DEDAD0"/>
<ellipse cx="126" cy="54" rx="6" ry="3.6" fill="#2A2833"/><ellipse cx="120" cy="50" rx="4.5" ry="2.5" fill="#F4EEE0" stroke-width="1.2"/><ellipse cx="132" cy="50" rx="4.5" ry="2.5" fill="#F4EEE0" stroke-width="1.2"/>
<path d="M80 80 Q104 70 140 72" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-opacity=".8"/>
<path d="M76 104 Q90 116 120 118" fill="none" stroke="#8E8A80" stroke-width="2"/>
</g></svg>`
};


export { P as PORTRAITS };
