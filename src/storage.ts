import Dexie,{type Table} from 'dexie';
export interface LocalRecording {
 id:string;filename:string;basename:string;size:number;mediaKind:'audio'|'video';createdAt:number;
 body:string;revision:number;changedAt:number;position:number;speed:number;language:'Mixed'|'Bisaya'|'English'|'Tagalog';
 lineEnding:'\n'|'\r\n';versions:{hash:string;at:number}[];
}
export class LocalDB extends Dexie {
 recordings!:Table<LocalRecording,string>;
 constructor(){super('transcription-simple-v1');this.version(1).stores({recordings:'id,createdAt'});}
}
export const db=new LocalDB();
export const comparable=(value:string)=>value.replace(/\r\n?/g,'\n');
async function sha(bytes:BufferSource){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export const textHash=(body:string)=>sha(new TextEncoder().encode(comparable(body)));
export async function fileKey(file:File){
 // Stable local pairing key, not proof of a full-recording source fingerprint.
 const head=new Uint8Array(await file.slice(0,65536).arrayBuffer()),tail=new Uint8Array(await file.slice(Math.max(0,file.size-65536)).arrayBuffer());
 const label=new TextEncoder().encode(file.name+'\n'+file.size+'\n');const sample=new Uint8Array(label.length+head.length+tail.length);sample.set(label);sample.set(head,label.length);sample.set(tail,label.length+head.length);return sha(sample);
}
export async function openRecording(file:File){
 const id=await fileKey(file);const previous=await db.recordings.get(id);if(previous)return previous;
 const now=Date.now(),body='Language: Mixed\n\nSpeaker one: ';const row:LocalRecording={id,filename:file.name,basename:file.name.replace(/\.[^.]+$/,''),size:file.size,mediaKind:file.type.startsWith('video/')||/\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(file.name)?'video':'audio',createdAt:now,body,revision:0,changedAt:now,position:0,speed:1,language:'Mixed',lineEnding:'\n',versions:[{hash:await textHash(body),at:now}]};
 await db.recordings.put(row);return row;
}
export async function saveText(record:LocalRecording,body:string,language=record.language,lineEnding=record.lineEnding){
 const normalized=comparable(body);const contentHash=await textHash(normalized);
 return db.transaction('rw',db.recordings,async()=>{
  const current=await db.recordings.get(record.id);if(!current)throw Error('This recording is missing from browser storage. Export your text before re-opening it.');
  if(current.revision!==record.revision&&comparable(current.body)!==normalized)throw Error('Another tab saved newer text. Export your current TXT before loading the saved version.');
  if(comparable(current.body)===normalized&&current.language===language)return current;
  const known=current.versions.find(v=>v.hash===contentHash);const at=known?.at??Date.now();
  const next={...current,body:normalized.replace(/\n/g,lineEnding),lineEnding,language,revision:current.revision+1,changedAt:at,versions:known?current.versions:[...current.versions,{hash:contentHash,at}].slice(-150)};
  await db.recordings.put(next);return next;
 });
}
