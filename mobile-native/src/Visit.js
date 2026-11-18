import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Image,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {Badge,Button,C,Empty,Loader,S,Section} from './design';
import {getLocalVisit,saveLocalAnswer,addLocalAction,captureLocalPhoto,finishLocalVisit,resumeLocalVisit} from './offline';

function Question({q,value,editable,onSave}){
  const [local,setLocal]=useState(value==null?'':String(value));
  useEffect(()=>setLocal(value==null?'':String(value)),[q.id,value]);
  const type=String(q.type||'text').toLowerCase();
  const yesNo=['yes_no','boolean','bool'].includes(type);
  let options=[];
  try{const raw=typeof q.options==='string'?JSON.parse(q.options):q.options;options=Array.isArray(raw)?raw:[]}catch{}
  const choice=['select','single_choice','choice','radio'].includes(type)&&options.length>0;
  const isNumber=['number','integer','decimal','numeric'].includes(type);
  const selected=v=>value===v||(value!=null&&String(value)===String(v));
  return <View style={S.card}>
    <Text style={{fontSize:14,fontWeight:'800',color:C.text,marginBottom:12}}>{q.label}{q.required?' *':''}</Text>
    {yesNo?<View style={{flexDirection:'row',gap:9}}>
      {[[true,'Oui'],[false,'Non']].map(([v,label])=><Pressable key={label} disabled={!editable} onPress={()=>onSave(q.id,v)}
        style={{padding:11,flex:1,borderWidth:1,borderRadius:11,alignItems:'center',borderColor:selected(v)?C.blue:C.border,backgroundColor:selected(v)?C.blueSoft:C.white}}>
        <Text style={{color:selected(v)?C.blue:C.text,fontWeight:'800'}}>{label}</Text>
      </Pressable>)}
    </View>:choice?<View style={{gap:8}}>{options.map((option,index)=>{
      const v=typeof option==='object'?(option.value??option.label??String(index)):option;
      const label=typeof option==='object'?String(option.label??option.value??'Option'):String(option);
      return <Pressable key={String(index)} disabled={!editable} onPress={()=>onSave(q.id,v)} style={{padding:12,borderRadius:11,borderWidth:1,borderColor:selected(v)?C.blue:C.border,backgroundColor:selected(v)?C.blueSoft:C.white}}>
        <Text style={{color:C.text,fontWeight:selected(v)?'800':'500'}}>{label}</Text>
      </Pressable>;
    })}</View>:<TextInput editable={editable} style={[S.input,{minHeight:55}]} value={local}
      keyboardType={isNumber?'decimal-pad':'default'} multiline={!isNumber}
      placeholder="Saisir une réponse" placeholderTextColor="#A0AABB" onChangeText={setLocal}
      onBlur={()=>{
        const next=isNumber&&local.trim()!==''?Number(local.replace(',','.')):local;
        if(local!==(value==null?'':String(value)))onSave(q.id,next);
      }}/>} 
  </View>;
}

export function VisitScreen({owner,draftId,onBack,onUpdate,onFinished}){
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[action,setAction]=useState('');
  const load=useCallback(async()=>{
    try{const d=await getLocalVisit(owner,draftId);setData(d);if(!d)setError('Ce relevé local n’existe plus.');}
    catch(e){setError(e.message)}
  },[owner,draftId]);
  useEffect(()=>{load()},[load]);
  const editing=data?.status==='editing';
  const responses=Object.fromEntries((data?.answers||[]).map(a=>[a.question_id,a.value]));
  async function saveAnswer(qid,value){
    try{await saveLocalAnswer(owner,draftId,qid,value);await load();onUpdate?.();setError('')}
    catch(e){setError('Réponse non sauvegardée : '+e.message)}
  }
  async function addAction(){
    if(!action.trim()||busy)return;
    setBusy(true);
    try{await addLocalAction(owner,draftId,action.trim());setAction('');await load();onUpdate?.();setError('')}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function addPhoto(source){
    if(busy)return;setBusy(true);
    try{const id=await captureLocalPhoto(owner,draftId,source);if(id){await load();onUpdate?.()}setError('')}
    catch(e){setError('Photo non enregistrée : '+e.message)}finally{setBusy(false)}
  }
  function finish(){
    Alert.alert('Terminer la visite','Le relevé sera conservé sur ce téléphone jusqu’à confirmation de la synchronisation avec le CRM.',[
      {text:'Annuler',style:'cancel'},
      {text:'Terminer et mettre en attente',onPress:async()=>{
        setBusy(true);
        try{await finishLocalVisit(owner,draftId);await load();onUpdate?.(true);Alert.alert('Visite sauvegardée','Le relevé est enregistré sur le téléphone. Il sera envoyé dès que le CRM sera accessible.',[{text:'OK',onPress:onFinished}]);setError('')}
        catch(e){setError(e.message)}finally{setBusy(false)}
      }}
    ]);
  }
  return <ScrollView contentContainerStyle={[S.content,{paddingBottom:48}]} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack} style={{marginVertical:23}}><Text style={{color:C.blue,fontWeight:'800'}}>‹ Retour à ma journée</Text></Pressable>
    <Text style={S.eyebrow}>RELEVÉ TERRAIN · HORS LIGNE DISPONIBLE</Text>
    <Text style={{fontWeight:'900',fontSize:26,color:C.navy,marginBottom:10}}>{data?.store_name||'Ma visite'}</Text>
    {!data?<>{error?<Empty title="Relevé indisponible" subtitle={error}/>:<Loader/>}</>:<>
      <View style={[S.row,{marginBottom:16}]}>
        <Badge text={data.status==='synced'?'Envoyée au CRM':data.status==='ready'?'Prête à envoyer':'Brouillon local'} tone={data.status==='synced'?'green':'amber'}/>
        <Text style={[S.muted,{marginLeft:9,flex:1}]}>Sauvegarde sur le téléphone</Text>
      </View>
      {!!(error||data.error)&&<Text style={{color:C.danger,backgroundColor:C.redSoft,padding:13,borderRadius:12,marginBottom:12}}>{error||data.error}</Text>}
      <Section eyebrow="QUESTIONNAIRE" title={'Relevé ('+(data.template?.questions?.length||0)+' questions)'}/>
      {(data.template?.questions||[]).length?data.template.questions.map(q=><Question key={q.id} q={q} value={responses[q.id]} onSave={saveAnswer} editable={editing}/>):<Empty title="Questionnaire indisponible" subtitle="Synchronise le parc avant de réaliser une visite."/>}
      <Section eyebrow="PHOTOS" title={'Photos ('+(data.photos||[]).length+')'}/>
      <View style={[S.card,{flexDirection:'row',gap:9,flexWrap:'wrap'}]}>
        {(data.photos||[]).map(photo=><View key={photo.id} style={{width:83,alignItems:'center',marginBottom:6}}>
          {photo.uri?<Image source={{uri:photo.uri}} style={{width:83,height:83,borderRadius:10,backgroundColor:C.border}}/>:<View style={{width:83,height:83,borderRadius:10,backgroundColor:C.greenSoft,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:24}}>✓</Text></View>}
          <Text style={{fontSize:10,color:photo.sent?C.green:C.muted,marginTop:4}}>{photo.sent?'Envoyée':'À envoyer'}</Text>
        </View>)}
      </View>
      {editing?<View style={{flexDirection:'row',gap:9}}>
        <View style={{flex:1}}><Button label="Prendre photo" onPress={()=>addPhoto('camera')} disabled={busy}/></View>
        <View style={{flex:1}}><Button label="Galerie" outline onPress={()=>addPhoto('library')} disabled={busy}/></View>
      </View>:null}
      <Section eyebrow="SUIVI MAGASIN" title="Actions"/>
      {(data.actions||[]).map(a=><View key={a.id} style={[S.card,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}><Text style={{color:C.text,flex:1,marginRight:12}}>{a.title}</Text><Badge tone={a.sent?'green':'amber'} text={a.sent?'Envoyée':'Locale'}/></View>)}
      {editing?<View style={S.card}>
        <TextInput style={S.input} placeholder="Nouvelle action à suivre…" value={action} onChangeText={setAction} maxLength={300}/>
        <Button label="Ajouter l’action" onPress={addAction} disabled={busy||!action.trim()} style={{marginTop:11}}/>
      </View>:null}
      {editing?<Button label={busy?'Sauvegarde…':'Terminer la visite'} onPress={finish} disabled={busy} style={{marginTop:22}}/>:
      data.status==='ready'?<View style={{marginTop:20}}><Button label="Réouvrir pour correction" outline onPress={async()=>{await resumeLocalVisit(owner,draftId);await load();onUpdate?.()}}/></View>:null}
    </>}
  </ScrollView>;
}
