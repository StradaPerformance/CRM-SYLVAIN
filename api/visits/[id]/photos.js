import {db,storage} from 'hatchable';
import {storeAccess,PERMISSIONS,deny} from 'lib/authorization.js';
export const access='user';
export const methods=['GET','POST'];
export default async function(req,res){
  const v=(await db.query('SELECT id,mission_id,store_id,status FROM visits WHERE id=$1',[req.params.id])).rows[0];
  if(!v)return res.status(404).json({error:'visit_not_found'});
  const a=await storeAccess(req.user.id,v.mission_id,v.store_id,req.method==='GET'?PERMISSIONS.VISIT_READ:PERMISSIONS.VISIT_WRITE);
  if(!a.allowed)return deny(res,a.reason);
  // A collaborator must never attach an image to another user's visit.
  const own=(await db.query('SELECT 1 FROM visits WHERE id=$1 AND user_id=$2',[v.id,req.user.id])).rows.length>0;
  if(req.method==='POST'&&!own)return res.status(403).json({error:'not_visit_owner'});
  if(req.method==='GET'){
    const {rows}=await db.query('SELECT id,operation_id,bytes,storage_key,created_at FROM mobile_visit_photos WHERE visit_id=$1 ORDER BY created_at',[v.id]);
    const photos=await Promise.all(rows.map(async x=>({id:x.id,operation_id:x.operation_id,bytes:x.bytes,created_at:x.created_at,url:await storage.url(x.storage_key,{ttl:300})})));
    return res.json({photos});
  }
  if(v.status!=='in_progress')return res.status(409).json({error:'visit_not_editable'});
  const operationId=String(req.body?.operation_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(operationId))return res.status(400).json({error:'invalid_operation_id'});
  const existing=(await db.query('SELECT id,bytes FROM mobile_visit_photos WHERE visit_id=$1 AND operation_id=$2',[v.id,operationId])).rows[0];
  if(existing)return res.json({photo:existing,resumed:true});
  const raw=String(req.body?.base64||'');
  if(raw.length<16||raw.length>2700000||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))return res.status(413).json({error:'photo_too_large_or_invalid'});
  const bytes=Buffer.from(raw,'base64');
  if(bytes.length>2000000||bytes.length<100||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)
    return res.status(415).json({error:'invalid_jpeg'});
  const key='mobile-visits/'+req.user.id+'/'+v.id+'/'+operationId+'.jpg';
  await storage.put(key,bytes,'image/jpeg');
  const {rows}=await db.query(`INSERT INTO mobile_visit_photos(visit_id,operation_id,created_by,storage_key,content_type,bytes)
    VALUES($1,$2,$3,$4,'image/jpeg',$5)
    ON CONFLICT(visit_id,operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id
    RETURNING id,operation_id,bytes,created_at`,[v.id,operationId,req.user.id,key,bytes.length]);
  res.status(201).json({photo:rows[0]});
}