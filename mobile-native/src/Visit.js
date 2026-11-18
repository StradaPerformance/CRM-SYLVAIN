import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Badge, Button, C, Empty, Loader, S, Section } from './design';

const fmtError=e=>{
  const msg=String(e?.message||'');
  if(msg==='required_answers_missing')return 'Des réponses obligatoires manquent. Vérifie le questionnaire.';
  if(msg==='visit_not_editable')return 'Cette visite est déjà finalisée.';
  if(msg==='visit_changed_retry')return 'La visite a changé. Actualise le relevé.';
  return msg||'Erreur de synchronisation';
};

function Question({q,value,editable,onSave,saving}){
  const [local,setLocal]=useState(value==null?'':String(value));
  useEffect(()=>setLocal(value==null?'':String(value)),[q.id,value]);
  const type=String(q.type||'text').toLowerCase();
  const yesNo=['yes_no','boolean','bool'].includes(type);
  let options=[];
  try{const raw=typeof q.options==='string'?JSON.parse(q.options):q.options;options=Array.isArray(raw)?raw:[];}catch(_){}
  const choice=['select','single_choice','choice','radio'].includes(type)&&options.length>0;
  const isNumber=['number','integer','decimal','numeric'].includes(type);
  const selected=v=>value===v||(value!=null&&String(value)===String(v));
  return <View style={S.card}>
    <Text style={{fontSize:14,fontWeight:'800',color:C.text,marginBottom:12}}>{q.label}{q.required?' *':''}</Text>
    {yesNo?<View style={{flexDirection:'row',gap:9}}>
      {[[true,'Oui'],[false,'Non']].map(([v,label])=><Pressable key={label} disabled={!editable||saving} onPress={()=>onSave(q.id,v)}
      style={{padding:11,flex:1,borderWidth:1,borderRadius:11,alignItems:'center',borderColor:selected(v)?C.blue:C.border,backgroundColor:selected(v)?C.blueSoft:C.white}}>
        <Text style={{color:selected(v)?C.blue:C.text,fontWeight:'800'}}>{label}</Text>
      </Pressable>)}
    </View>:choice?<View style={{gap:8}}>{options.map((option,index)=>{
      const v=typeof option==='object'?(option.value??option.label??String(index)):option;
      const label=typeof option==='object'?String(option.label??option.value??'Option'):String(option);
      return <Pressable key={String(index)} disabled={!editable||saving} onPress={()=>onSave(q.id,v)} style={{padding:12,borderRadius:11,borderWidth:1,borderColor:selected(v)?C.blue:C.border,backgroundColor:selected(v)?C.blueSoft:C.white}}>
        <Text style={{color:C.text,fontWeight:selected(v)?'800':'500'}}>{label}</Text>
      </Pressable>;
    })}</View>:
      <TextInput editable={editable&&!saving} style={[S.input,{minHeight:55}]} value={local} keyboardType={isNumber?'decimal-pad':'default'} multiline={!isNumber}
        placeholder="Saisir une réponse" placeholderTextColor="#A0AABB" onChangeText={setLocal}
        onEndEditing={()=>{
          const next=isNumber&&local.trim()!==''?Number(local.replace(',','.')):local;
          if(local!==(value==null?'':String(value)))onSave(q.id,next);
        }}/>
    }
    {saving&&<Text style={[S.muted,{marginTop:8,color:C.blue}]}>Enregistrement…</Text>}
  </View>;
}

export function VisitScreen({visitId,api,onBack,onFinished}){
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [saving,setSaving]=useState({});
  const [error,setError]=useState('');
  const [action,setAction]=useState('');
  const [loadTick,setLoadTick]=useState(0);

  const load=useCallback(async()=>{
    try{
      setError('');
      const d=await api('GET','/api/visits/'+encodeURIComponent(visitId));
      setData(d);
    }catch(e){setError(fmtError(e))}
  },[api,visitId]);
  useEffect(()=>{load()},[load,loadTick]);
  const editable=data?.visit?.status==='in_progress';
  const responses=Object.fromEntries((data?.responses||[]).map(r=>[r.question_id,r.value]));

  async function saveAnswer(qid,value){
    if(!editable)return;
    setSaving(x=>({...x,[qid]:true}));setError('');
    try{
      const response=await api('PUT','/api/visits/'+visitId+'/responses',{question_id:qid,value});
      setData(prev=>({...prev,responses:[...(prev.responses||[]).filter(r=>r.question_id!==qid),response.response]}));
    }catch(e){setError('Réponse non enregistrée : '+fmtError(e))}
    finally{setSaving(x=>({...x,[qid]:false}))}
  }
  async function addAction(){
    if(!action.trim()||!editable)return;
    setBusy(true);setError('');
    try{await api('POST','/api/visits/'+visitId+'/actions',{title:action.trim()});setAction('');await load()}
    catch(e){setError(fmtError(e))}finally{setBusy(false)}
  }
  function finish(){
    Alert.alert('Terminer la visite','Une fois finalisée, la visite ne peut plus être modifiée.',[
      {text:'Annuler',style:'cancel'},
      {text:'Terminer',onPress:async()=>{
        setBusy(true);setError('');
        try{await api('POST','/api/visits/'+visitId+'/complete',{});await load();Alert.alert('Visite terminée','Le relevé est enregistré dans le CRM.',[{text:'OK',onPress:onFinished}]);}
        catch(e){setError(fmtError(e))}finally{setBusy(false)}
      }}
    ]);
  }
  return <ScrollView contentContainerStyle={[S.content,{paddingBottom:48}]} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack} style={{marginVertical:23}}><Text style={{color:C.blue,fontWeight:'800'}}>‹ Retour à la journée</Text></Pressable>
    <Text style={S.eyebrow}>RELEVÉ TERRAIN</Text>
    <Text style={{fontWeight:'900',fontSize:26,color:C.navy,marginBottom:10}}>Ma visite</Text>
    {!data?<>{error?<Empty title="Relevé indisponible" subtitle={error}/>:<Loader/>}</>:<>
      <View style={[S.row,{marginBottom:16}]}><Badge text={editable?'En cours':'Terminée'} tone={editable?'amber':'green'}/><Text style={[S.muted,{marginLeft:11}]}>Sauvegarde en ligne</Text></View>
      {error?<Text style={{color:C.danger,backgroundColor:C.redSoft,padding:13,borderRadius:12,marginBottom:12}}>{error}</Text>:null}
      <Section eyebrow="QUESTIONNAIRE" title={'Relevé ('+(data.questions?.length||0)+' questions)'}/>
      {data.questions?.length?data.questions.map(q=><Question key={q.id} q={q} value={responses[q.id]} saving={!!saving[q.id]} onSave={saveAnswer} editable={editable}/>):<Empty title="Aucune question" subtitle="Aucun questionnaire actif pour cette mission."/>}
      <Section eyebrow="SUIVI MAGASIN" title="Actions"/>
      {(data.actions||[]).map(a=><View key={a.id} style={[S.card,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}>
        <Text style={{color:C.text,flex:1,marginRight:12}}>{a.title}</Text><Badge tone={a.status==='closed'?'green':'muted'} text={a.status||'ouverte'}/>
      </View>)}
      {editable?<View style={S.card}>
        <TextInput style={S.input} placeholder="Nouvelle action à suivre…" value={action} onChangeText={setAction} maxLength={300}/>
        <Button label={busy?'Ajout…':'Ajouter l’action'} onPress={addAction} disabled={busy||!action.trim()} style={{marginTop:11}}/>
      </View>:null}
      {data.perfect_store?.score!=null?<View style={[S.card,{marginTop:15}]}><Text style={S.eyebrow}>PERFECT STORE</Text>
        <Text style={{color:C.navy,fontWeight:'900',fontSize:27}}>{data.perfect_store.score} / 100</Text>
      </View>:null}
      {editable?<Button label={busy?'Enregistrement…':'Terminer la visite'} onPress={finish} disabled={busy||Object.values(saving).some(Boolean)} style={{marginTop:22}}/>:null}
    </>}
  </ScrollView>;
}
