/** CRM Terrain — durable offline-first store.
 * All query params are bound. Every cache/draft row is scoped to an authenticated user_id.
 * Unsynced data is NEVER erased by retry or download refresh.
 */
import * as SQLite from 'expo-sqlite';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

const DB_NAME='crm-terrain-v2.db';
const SESSION_KEY='crm-terrain-offline-session-v2';
export const OFFLINE_WINDOW_MS=48*60*60*1000;
let database;
const now=()=>new Date().toISOString();
export const uuid=()=>{
  // Runtime UUID for client-side idempotency keys; no server-side trust placed in it.
  const s='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return s.replace(/[xy]/g,c=>{
    const n=Math.floor(Math.random()*16);
    return (c==='x'?n:((n&3)|8)).toString(16);
  });
};
const fromJSON=(value,fallback=null)=>{try{return JSON.parse(value)}catch{return fallback}};
const assertOwner=(owner)=>{if(!owner||typeof owner!=='string')throw Error('Session utilisateur manquante');};

export async function localDb(){
  if(database)return database;
  const db=await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS cache (
      owner TEXT NOT NULL, mission TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
      value_json TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(owner,mission,kind,key)
    );
    CREATE TABLE IF NOT EXISTS visits_local (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, mission TEXT NOT NULL, store_id TEXT NOT NULL,
      store_name TEXT NOT NULL, server_id TEXT, operation_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'editing', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      error TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_visits_local_owner ON visits_local(owner,mission,status);
    CREATE TABLE IF NOT EXISTS answers_local (
      visit_id TEXT NOT NULL REFERENCES visits_local(id), question_id TEXT NOT NULL,
      value_json TEXT, revision INTEGER NOT NULL DEFAULT 1, synced_revision INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (visit_id,question_id)
    );
    CREATE TABLE IF NOT EXISTS actions_local (
      id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits_local(id),
      title TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS photos_local (
      id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits_local(id),
      uri TEXT, bytes INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0
    );`);
  database=db;
  return db;
}
export async function cachePut(owner,mission,kind,key,value){
  assertOwner(owner);const db=await localDb();
  await db.runAsync(`INSERT INTO cache(owner,mission,kind,key,value_json,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(owner,mission,kind,key) DO UPDATE SET
    value_json=excluded.value_json,updated_at=excluded.updated_at`,
    [owner,mission,kind,key,JSON.stringify(value),now()]);
}
export async function cacheGet(owner,mission,kind,key,fallback=null){
  assertOwner(owner);const db=await localDb();
  const row=await db.getFirstAsync('SELECT value_json FROM cache WHERE owner=? AND mission=? AND kind=? AND key=?',
    [owner,mission,kind,key]);
  return row?fromJSON(row.value_json,fallback):fallback;
}
export async function saveAuthenticatedSession(profile){
  if(!profile?.user_id)throw Error('Identité CRM absente');
  const ticket={user_id:profile.user_id,email:profile.email,display_name:profile.display_name,verified_at:Date.now()};
  await SecureStore.setItemAsync(SESSION_KEY,JSON.stringify(ticket));return ticket;
}
export async function loadOfflineSession(){
  const raw=await SecureStore.getItemAsync(SESSION_KEY);
  const ticket=fromJSON(raw);
  if(!ticket?.user_id||Date.now()-ticket.verified_at>OFFLINE_WINDOW_MS||Date.now()<ticket.verified_at)return null;
  return ticket;
}
export async function clearOfflineSession(){await SecureStore.deleteItemAsync(SESSION_KEY)}
export async function isOnline(){
  const n=await Network.getNetworkStateAsync();
  return n.isConnected!==false&&n.isInternetReachable!==false;
}
export function nextDate(day,offset){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}

export async function newOrResumeLocalVisit(owner,mission,store,template){
  assertOwner(owner);const db=await localDb();
  const existing=await db.getFirstAsync(`SELECT * FROM visits_local WHERE owner=? AND mission=? AND store_id=? AND status<>'synced' ORDER BY created_at DESC LIMIT 1`,[owner,mission,store.id]);
  if(existing)return existing;
  if(!template?.questions||!template?.config_version_id)throw Error('Questionnaire non téléchargé. Synchronise ton parc avant la tournée.');
  const id=uuid(),op=uuid(),time=now();
  await db.runAsync(`INSERT INTO visits_local(id,owner,mission,store_id,store_name,operation_id,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,'editing',?,?)`,[id,owner,mission,store.id,store.name||store.store_name||'Magasin',op,time,time]);
  return await db.getFirstAsync('SELECT * FROM visits_local WHERE id=? AND owner=?',[id,owner]);
}
export async function linkServerVisit(owner,draftId,serverId,initialAnswers=[]){
  assertOwner(owner);const db=await localDb();
  const draft=await db.getFirstAsync('SELECT * FROM visits_local WHERE id=? AND owner=?',[draftId,owner]);
  if(!draft)throw Error('Relevé introuvable');
  if(!draft.server_id)await db.runAsync('UPDATE visits_local SET server_id=? WHERE id=? AND owner=?',[serverId,draftId,owner]);
  for(const a of initialAnswers){
    if(!a.question_id)continue;
    // Never overwrite a local answer with one from the CRM.
    await db.runAsync(`INSERT INTO answers_local(visit_id,question_id,value_json,revision,synced_revision)
      VALUES(?,?,?,1,1) ON CONFLICT(visit_id,question_id) DO NOTHING`,[draftId,a.question_id,JSON.stringify(a.value??null)]);
  }
}
export async function getLocalVisit(owner,id){
  assertOwner(owner);const db=await localDb();
  const v=await db.getFirstAsync('SELECT * FROM visits_local WHERE id=? AND owner=?',[id,owner]);
  if(!v)return null;
  const [template, answers, actions, photos]=await Promise.all([
    cacheGet(owner,v.mission,'template',v.store_id),
    db.getAllAsync('SELECT * FROM answers_local WHERE visit_id=?',[id]),
    db.getAllAsync('SELECT * FROM actions_local WHERE visit_id=? ORDER BY rowid',[id]),
    db.getAllAsync('SELECT * FROM photos_local WHERE visit_id=? ORDER BY rowid',[id]),
  ]);
  return {...v,template,answers:answers.map(a=>({...a,value:fromJSON(a.value_json)})),actions,photos};
}
export async function saveLocalAnswer(owner,id,questionId,value){
  const db=await localDb();
  const v=await db.getFirstAsync('SELECT id,status FROM visits_local WHERE id=? AND owner=?',[id,owner]);
  if(!v||v.status!=='editing')throw Error('La visite n’est plus modifiable');
  await db.runAsync(`INSERT INTO answers_local(visit_id,question_id,value_json,revision,synced_revision)
    VALUES(?,?,?,1,0) ON CONFLICT(visit_id,question_id)
    DO UPDATE SET value_json=excluded.value_json,revision=answers_local.revision+1`,[id,questionId,JSON.stringify(value)]);
  await db.runAsync("UPDATE visits_local SET updated_at=?,error='' WHERE id=? AND owner=?",[now(),id,owner]);
}
export async function addLocalAction(owner,id,title){
  const db=await localDb();
  if(!(await db.getFirstAsync("SELECT 1 FROM visits_local WHERE id=? AND owner=? AND status='editing'",[id,owner])))throw Error('Visite non modifiable');
  const actionId=uuid();await db.runAsync('INSERT INTO actions_local(id,visit_id,title) VALUES(?,?,?)',[actionId,id,String(title).trim()]);
  await db.runAsync('UPDATE visits_local SET updated_at=? WHERE id=?',[now(),id]);return actionId;
}
export async function captureLocalPhoto(owner,id,source='camera'){
  assertOwner(owner);const db=await localDb();
  if(!(await db.getFirstAsync("SELECT 1 FROM visits_local WHERE id=? AND owner=? AND status='editing'",[id,owner])))throw Error('Visite non modifiable');
  const permission=source==='camera'?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted)throw Error('Autorise les photos dans les réglages du téléphone.');
  const result=source==='camera'?await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:0.7,exif:false}):await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.7,allowsMultipleSelection:false,exif:false});
  if(result.canceled||!result.assets?.length)return null;
  const asset=result.assets[0];
  // Scale long edge to 1280px and save JPEG to avoid huge JSON/base64 in the upload.
  const ratio=Math.min(1,1280/Math.max(asset.width||1280,asset.height||1280));
  const manip=ImageManipulator.manipulate(asset.uri);
  if(ratio<1)manip.resize({width:Math.max(1,Math.round(asset.width*ratio)),height:Math.max(1,Math.round(asset.height*ratio))});
  const image=await manip.renderAsync();
  const output=await image.saveAsync({format:SaveFormat.JPEG,compress:0.65});
  const dir=new Directory(Paths.document,'crm-terrain-photos',owner.replace(/[^a-zA-Z0-9_-]/g,'_'),id);
  dir.create({idempotent:true,intermediates:true});
  const photoId=uuid();const destination=new File(dir,photoId+'.jpg');
  await new File(output.uri).copy(destination);
  if(!destination.exists||destination.size>2000000){destination.delete();throw Error('Photo trop volumineuse. Réessaie.');}
  // DB insertion is last; if it fails, photograph remains on disk rather than being silently lost.
  await db.runAsync('INSERT INTO photos_local(id,visit_id,uri,bytes) VALUES(?,?,?,?)',[photoId,id,destination.uri,destination.size]);
  await db.runAsync('UPDATE visits_local SET updated_at=? WHERE id=?',[now(),id]);
  return photoId;
}
export async function finishLocalVisit(owner,id){
  const db=await localDb();
  const v=await getLocalVisit(owner,id);
  if(!v||v.status!=='editing')throw Error('Visite indisponible');
  // Immediate validation for simple required answers; server remains the final authority for conditions.
  const missing=(v.template?.questions||[]).filter(q=>q.required&&!v.answers.some(a=>a.question_id===q.id&&a.value!==null&&a.value!==''));
  if(missing.length)throw Error('Réponses obligatoires manquantes : '+missing.slice(0,3).map(q=>q.label).join(', '));
  await db.runAsync("UPDATE visits_local SET status='ready',updated_at=?,error='' WHERE id=? AND owner=?",[now(),id,owner]);
}
export async function resumeLocalVisit(owner,id){
  const db=await localDb();await db.runAsync("UPDATE visits_local SET status='editing',error='' WHERE id=? AND owner=? AND status='ready'",[id,owner]);
}
export async function getPending(owner){
  assertOwner(owner);const db=await localDb();
  const [v,p,a,ans]=await Promise.all([
    db.getAllAsync("SELECT * FROM visits_local WHERE owner=? AND status<>'synced' ORDER BY created_at",[owner]),
    db.getFirstAsync("SELECT count(*) c FROM photos_local p JOIN visits_local v ON v.id=p.visit_id WHERE v.owner=? AND p.sent=0",[owner]),
    db.getFirstAsync("SELECT count(*) c FROM actions_local a JOIN visits_local v ON v.id=a.visit_id WHERE v.owner=? AND a.sent=0",[owner]),
    db.getFirstAsync("SELECT count(*) c FROM answers_local a JOIN visits_local v ON v.id=a.visit_id WHERE v.owner=? AND a.synced_revision<a.revision",[owner]),
  ]);
  return {visits:v.length,photos:p.c,actions:a.c,answers:ans.c,errors:v.filter(x=>x.error).length,items:v};
}
export async function getSyncMeta(owner,mission){return await cacheGet(owner,mission,'meta','last-sync',null)}

let activeDrain=false;
/** Send in dependency order; stop when connectivity, auth, or server validation fails.
 * Acknowledgments are recorded only after the API confirms success.
 */
export async function drainQueue(owner,api,onProgress=()=>{}){
  if(activeDrain)return {running:true};
  activeDrain=true;const db=await localDb();let sent=0;
  try{
    const drafts=(await getPending(owner)).items;
    for(const draft of drafts){
      if(!(await isOnline()))break;
      const id=draft.id;
      try{
        let serverId=draft.server_id;
        if(!serverId){
          const result=await api('POST','/api/visits',{
            mission_id:draft.mission,store_id:draft.store_id,client_operation_id:'native-'+draft.operation_id
          });
          serverId=result.visit?.id;
          if(!serverId)throw Error('Le CRM n’a pas confirmé la visite');
          await db.runAsync('UPDATE visits_local SET server_id=? WHERE id=? AND owner=?',[serverId,id,owner]);
        }
        const answers=await db.getAllAsync('SELECT * FROM answers_local WHERE visit_id=? AND synced_revision<revision',[id]);
        for(const answer of answers){
          await api('PUT',`/api/visits/${serverId}/responses`,{question_id:answer.question_id,value:fromJSON(answer.value_json)});
          await db.runAsync('UPDATE answers_local SET synced_revision=? WHERE visit_id=? AND question_id=? AND revision=?',
            [answer.revision,id,answer.question_id,answer.revision]);sent++;
        }
        const photos=await db.getAllAsync('SELECT * FROM photos_local WHERE visit_id=? AND sent=0',[id]);
        for(const photo of photos){
          if(!photo.uri||!(new File(photo.uri)).exists)throw Error('Photo locale introuvable : '+photo.id+'. Ne supprime pas la visite.');
          const b64=await new File(photo.uri).base64();
          await api('POST',`/api/visits/${serverId}/photos`,{operation_id:photo.id,base64:b64});
          await db.runAsync('UPDATE photos_local SET sent=1 WHERE id=? AND visit_id=?',[photo.id,id]);sent++;
        }
        const actions=await db.getAllAsync('SELECT * FROM actions_local WHERE visit_id=? AND sent=0',[id]);
        for(const action of actions){
          await api('POST',`/api/visits/${serverId}/mobile-action`,{operation_id:action.id,title:action.title});
          await db.runAsync('UPDATE actions_local SET sent=1 WHERE id=? AND visit_id=?',[action.id,id]);sent++;
        }
        const current=await db.getFirstAsync('SELECT status FROM visits_local WHERE id=? AND owner=?',[id,owner]);
        if(current?.status==='ready'){
          const pending=await db.getFirstAsync(`SELECT
            (SELECT count(*) FROM answers_local WHERE visit_id=? AND synced_revision<revision)+
            (SELECT count(*) FROM photos_local WHERE visit_id=? AND sent=0)+
            (SELECT count(*) FROM actions_local WHERE visit_id=? AND sent=0) AS c`,[id,id,id]);
          if(pending?.c===0){
            try{await api('POST',`/api/visits/${serverId}/complete`,{});}
            catch(error){
              // A lost response after successful completion must not create a false local failure.
              if(['invalid_visit_state','visit_not_editable'].includes(String(error.message||''))){
                const check=await api('GET',`/api/visits/${serverId}`);
                if(check.visit?.status!=='completed')throw error;
              }else throw error;
            }
            await db.runAsync("UPDATE visits_local SET status='synced',error='',updated_at=? WHERE id=? AND owner=?",[now(),id,owner]);
            sent++;
          }
        }
        await db.runAsync("UPDATE visits_local SET error='' WHERE id=? AND owner=?",[id,owner]);
      }catch(e){
        const message=String(e.message||'Envoi interrompu').slice(0,320);
        await db.runAsync('UPDATE visits_local SET error=? WHERE id=? AND owner=?',[message,id,owner]);
        onProgress({error:message,visit:id});
        // Auth/permission errors block the rest; other visits may still be processed.
        if(/401|403|account_deactivated|outside_mission|outside_store_scope|Connexion expirée|Compte déconnecté/.test(message))break;
      }
      onProgress({sent});
    }
    return {sent,pending:await getPending(owner)};
  }finally{activeDrain=false;}
}

/** Downloads with no destructive writes. Missing templates stay unavailable offline. */
export async function prepareTour(owner,missions,mission,api,onProgress=()=>{}){
  assertOwner(owner);
  if(!(await isOnline()))throw Error('Pas de réseau. Les données déjà enregistrées restent disponibles.');
  await cachePut(owner,'__account__','account','missions',missions);
  const storesRes=await api('GET',`/api/missions/${mission}/stores`);
  await cachePut(owner,mission,'data','stores',storesRes.stores||[]);
  onProgress({stage:'parc',current:1,total:1});
  const goalsRes=await api('GET',`/api/missions/${mission}/goals`);
  await cachePut(owner,mission,'data','goals',goalsRes.goals||[]);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(let offset=0;offset<8;offset++){
    const date=nextDate(day,offset);
    const agenda=await api('GET',`/api/missions/${mission}/mobile-day?date=${date}`);
    await cachePut(owner,mission,'day',date,agenda.events||[]);
  }
  const stores=storesRes.stores||[];
  let done=0,templatesReady=0;
  for(let i=0;i<stores.length;i+=20){
    const part=stores.slice(i,i+20);
    const result=await api('POST',`/api/missions/${mission}/offline-templates`,{store_ids:part.map(s=>s.id)});
    for(const [storeId,template] of Object.entries(result.templates||{})){
      await cachePut(owner,mission,'template',storeId,template);templatesReady++;
    }
    done+=part.length;
    onProgress({stage:'questionnaires',current:done,total:stores.length});
  }
  const meta={at:now(),stores:stores.length,templates:templatesReady,days:8};
  await cachePut(owner,mission,'meta','last-sync',meta);
  return meta;
}

/** Only synced photographic bytes may be reclaimed; never touch pending files. */
export async function releaseSyncedPhotos(owner){
  const db=await localDb();
  const rows=await db.getAllAsync(`SELECT p.id,p.uri FROM photos_local p JOIN visits_local v ON v.id=p.visit_id
     WHERE v.owner=? AND v.status='synced' AND p.sent=1 AND p.uri IS NOT NULL`,[owner]);
  let files=0,bytes=0;
  for(const p of rows){
    const f=new File(p.uri);
    if(f.exists){bytes+=f.size;f.delete();files++;}
    await db.runAsync('UPDATE photos_local SET uri=NULL WHERE id=?',[p.id]);
  }
  return {files,bytes};
}
