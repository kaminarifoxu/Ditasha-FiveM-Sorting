export const MAX_MODELS=4;
export const MAX_DECODED=512*1024**2;
export const MAX_TEXTURES=128*1024**2;
export function withinModelBudget(units,next){const all=[...units,next];return all.length<=MAX_MODELS&&all.reduce((n,u)=>n+(u.model?.vertices||0),0)<=2000000&&all.reduce((n,u)=>n+(u.model?.decodedBytes||0)+(u.ytdBytes||0),0)<=MAX_DECODED;}
export function rowOffsets(widths){const sizes=widths.map(width=>Math.max(width,.01)),positions=[];for(let i=0;i<sizes.length;i++)positions.push(i?positions[i-1]+sizes[i-1]/2+sizes[i]/2+Math.max(.01,Math.min(sizes[i-1],sizes[i])*.3):0);const center=positions.length?((positions[0]-sizes[0]/2)+(positions.at(-1)+sizes.at(-1)/2))/2:0;return positions.map(p=>p-center);}
