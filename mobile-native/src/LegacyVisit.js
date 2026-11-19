import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Text,TextInput,View} from 'react-native';
import {Badge,Button,C,Empty,Loader,S,Section} from './design';
import {QuestionFlow} from './QuestionFlow';

const fmtError=e=>{
  const msg=String(e?.message||'');
  if(msg==='required_answers_missing')return 'Des réponses obligatoires manquent. Vérifie le questionnaire.';
  if(msg==='visit_not_editable')return 'Cette visite est déjà finalisée.';
  if(msg==='visit_changed_retry')return 'La visite a changé. Actualise le relevé.';
  return msg||'Erreur de synchronisation';
};

export function VisitScreen({visitId,api,onBack,onFinished}){
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [action,setAction]=useState('');
  const load=useCallback(async()=>{
    try{
      setError('');
      const d=await api('GET','/api/visits/'+encodeURIComponent(visitId));
      setData(d);
    }catch(e){setError(fmtError(e))}
  },[api,visitId]);
  useEffect(()=>{load()},[load]);
  const editable=data?.visit?.status==='in_progress';
  const questions=data?.questions||[];
  const responses=Object.fromEntries((data?.responses||[]).map(r=>[r.question_id,r.value]));
  const missing=questions.filter(q=>q.required&&!q.conditions&&(responses[q.id]==null||responses[q.id]===''));

  async function saveAnswer(qid,value){
    if(!editable)throw Error('Cette visite ne peut plus être modifiée.');
    setSaving(true);setError('');
    try{
      const response=await api('PUT','/api/visits/'+visitId+'/responses',{question_id:qid,value});
      setData(prev=>({...prev,responses:[...(prev.responses||[]).filter(r=>r.question_id!==qid),response.response]}));
    }catch(e){const message=fmtError(e);setError('Réponse non enregistrée : '+message);throw new Error(message)}
    finally{setSaving(false)}
  }
  async function addAction(){
    if(!action.trim()||!editable)return;
    setBusy(true);setError('');
    try{await api('POST','/api/visits/'+visitId+'/actions',{title:action.trim()});setAction('');await load()}
    catch(e){setError(fmtError(e))}finally{setBusy(false)}
  }
  function finish(){
    if(missing.length){setError('Réponses obligatoires manquantes : '+missing.slice(0,3).map(q=>q.label).join(', '));return;}
    Alert.alert('Terminer la visite','Une fois finalisée, la visite ne peut plus être modifiée.',[
      {text:'Annuler',style:'cancel'},
      {text:'Terminer',onPress:async()=>{
        setBusy(true);setError('');
        try{
          await api('POST','/api/visits/'+visitId+'/complete',{});
          await load();
          Alert.alert('Visite terminée','Le relevé est enregistré dans le CRM.',[{text:'OK',onPress:onFinished}]);
        }catch(e){setError(fmtError(e))}finally{setBusy(false)}
      }}
    ]);
  }
  if(!data)return <View style={{flex:1,justifyContent:'center',padding:24}}>{error?<Empty title="Relevé indisponible" subtitle={error}/>:<Loader text="Chargement du relevé…"/>}</View>;
  return <QuestionFlow key={visitId} questions={questions} responses={responses}
    editable={editable} onSave={saveAnswer} onExit={onBack}
    storeName={data.visit?.store_name||data.store?.name||'Ma visite'} error={error}
    saveLabel={editable?'Enregistrement au CRM à chaque étape':'Visite terminée · lecture seule'}
    summary={<>
      <View style={[S.row,{marginBottom:15}]}>
        <Badge text={editable?'En cours':'Terminée'} tone={editable?'amber':'green'}/>
        <Text style={[S.muted,{marginLeft:11,flex:1}]}>Sauvegarde en ligne</Text>
      </View>
      <Section eyebrow="SUIVI MAGASIN" title="Actions"/>
      {(data.actions||[]).map(a=><View key={a.id} style={[S.card,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}>
        <Text style={{color:C.text,flex:1,marginRight:12}}>{a.title}</Text>
        <Badge tone={a.status==='closed'?'green':'muted'} text={a.status||'ouverte'}/>
      </View>)}
      {editable?<View style={S.card}>
        <TextInput style={S.input} placeholder="Nouvelle action à suivre…" value={action} onChangeText={setAction} maxLength={300}/>
        <Button label={busy?'Ajout…':'Ajouter l’action'} onPress={addAction} disabled={busy||!action.trim()} style={{marginTop:11}}/>
      </View>:null}
      {data.perfect_store?.score!=null?<View style={[S.card,{marginTop:15}]}>
        <Text style={S.eyebrow}>PERFECT STORE</Text>
        <Text style={{color:C.navy,fontWeight:'900',fontSize:27}}>{data.perfect_store.score} / 100</Text>
      </View>:null}
      {editable?<Button label={busy?'Enregistrement…':'Terminer la visite'} onPress={finish}
        disabled={busy||saving||missing.length>0} style={{marginTop:22}}/>:null}
    </>}/>;
}
