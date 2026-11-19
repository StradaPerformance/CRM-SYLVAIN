import {db,storage} from "hatchable";
import {storeAccess,PERMISSIONS,deny} from "lib/authorization.js";
import {visitQuestions} from "lib/visit-history.js";
export const access="user";export const methods=["GET"];
export default async function(req,res){
 const v=(await db.query("SELECT * FROM visits WHERE id=$1",[req.params.id])).rows[0];if(!v)return res.status(404).json({error:"visit_not_found"});
 const a=await storeAccess(req.user.id,v.mission_id,v.store_id,PERMISSIONS.VISIT_READ);if(!a.allowed)return deny(res,a.reason);
 const questions=await visitQuestions(v);
 const responses=v.completion_snapshot?.responses||(await db.query("SELECT * FROM visit_responses WHERE visit_id=$1",[v.id])).rows;
 const actions=v.completion_snapshot?.actions||(await db.query("SELECT * FROM actions WHERE visit_id=$1 ORDER BY created_at DESC",[v.id])).rows;
 const media=(await db.query("SELECT id,bytes,created_at,storage_key FROM mobile_visit_photos WHERE visit_id=$1 ORDER BY created_at LIMIT 100",[v.id])).rows;
 const photos=await Promise.all(media.map(async x=>({id:x.id,bytes:x.bytes,created_at:x.created_at,url:await storage.url(x.storage_key,{ttl:300})})));
 const perfectStore=v.status==="completed"?(v.completion_snapshot?.perfect_store||{score:v.perfect_store_score,points:v.perfect_store_points,max_points:v.perfect_store_max_points,detail:v.perfect_store_detail,engine:"historical"}):null;
 res.json({visit:v,questions,responses,actions,photos,perfect_store:perfectStore,historical_quality:v.context_snapshot?"captured_at_start":"legacy_context_unavailable"});
}