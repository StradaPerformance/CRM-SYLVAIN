import { db } from 'hatchable';
import { storeAccess, PERMISSIONS } from 'lib/authorization.js';
import { resolveQuestionnaire } from 'lib/questionnaire-resolution.js';

export const access = 'user';
export const methods = ['POST'];
export default async function(req,res) {
  const missionId = req.params.id;
  const input = req.body?.store_ids;
  if(!Array.isArray(input) || input.length < 1 || input.length > 20 ||
      !input.every(x=>/^[0-9a-f-]{36}$/i.test(String(x))))
    return res.status(400).json({error:'invalid_store_ids'});
  const ids=[...new Set(input)];
  const templates={}, unavailable=[];
  const configs=new Map();
  for(const storeId of ids) {
    const a=await storeAccess(req.user.id,missionId,storeId,PERMISSIONS.VISIT_WRITE);
    if(!a.allowed) {unavailable.push({store_id:storeId,error:'access_denied'});continue;}
    const found=await resolveQuestionnaire(missionId,storeId);
    if(!found?.config?.id) {unavailable.push({store_id:storeId,error:'no_published_visit_config'});continue;}
    const versionId=found.config.id;
    if(!configs.has(versionId)) {
      const r=await db.query('SELECT id,label,type,required,options,position,condition FROM questions WHERE config_version_id=$1 ORDER BY position,label',[versionId]);
      configs.set(versionId,{config_version_id:versionId,questions:r.rows});
    }
    templates[storeId]=configs.get(versionId);
  }
  res.json({templates,unavailable,synchronized_at:new Date().toISOString()});
}