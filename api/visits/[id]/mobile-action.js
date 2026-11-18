import {db} from 'hatchable';
import {storeAccess,PERMISSIONS,deny} from 'lib/authorization.js';
export const access='user';
export const methods=['POST'];
export default async function(req,res){
 const v=(await db.query('SELECT id,mission_id,store_id,user_id,status FROM visits WHERE id=$1',[req.params.id])).rows[0];
 if(!v)return res.status(404).json({error:'visit_not_found'});
 const a=await storeAccess(req.user.id,v.mission_id,v.store_id,PERMISSIONS.ACTION_WRITE);
 if(!a.allowed)return deny(res,a.reason);
 if(v.user_id!==req.user.id)return res.status(403).json({error:'not_visit_owner'});
 const id=String(req.body?.operation_id||''),title=String(req.body?.title||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(id)||!title||title.length>300)return res.status(400).json({error:'invalid_action'});
 const existing=(await db.query('SELECT id,title FROM actions WHERE id=$1',[id])).rows[0];
 if(existing)return existing.title===title?res.json({action:existing,resumed:true}):res.status(409).json({error:'operation_conflict'});
 if(v.status!=='in_progress')return res.status(409).json({error:'visit_not_editable'});
 const {rows}=await db.query(`INSERT INTO actions(id,mission_id,store_id,visit_id,owner_user_id,title,created_by)
 VALUES($1,$2,$3,$4,$5,$6,$5)
 ON CONFLICT(id) DO NOTHING RETURNING id,title`,[id,v.mission_id,v.store_id,v.id,req.user.id,title]);
 const saved=rows[0]||(await db.query('SELECT id,title FROM actions WHERE id=$1 AND visit_id=$2 AND created_by=$3',[id,v.id,req.user.id])).rows[0];
 if(!saved)return res.status(409).json({error:'operation_conflict'});
 res.status(rows.length?201:200).json({action:saved});
}