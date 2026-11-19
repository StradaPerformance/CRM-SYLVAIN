import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Image,Text,TextInput,View} from 'react-native';
import {Badge,Button,C,Empty,Loader,S,Section} from './design';
import {QuestionFlow} from './QuestionFlow';
import {getLocalVisit,saveLocalAnswer,addLocalAction,captureLocalPhoto,finishLocalVisit,resumeLocalVisit} from './offline';

export function VisitScreen({owner,draftId,onBack,onUpdate,onFinished}){
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [action,setAction]=useState('');
  const load=useCallback(async()=>{
    try{const d=await getLocalVisit(owner,draftId);setData(d);if(!d)setError('Ce relevé local n’existe plus.');}
    catch(e){setError(e.message)}
  },[owner,draftId]);
  useEffect(()=>{load()},[load]);
  const editing=data?.status==='editing';
  const questions=data?.template?.questions||[];
  const responses=Object.fromEntries((data?.answers||[]).map(a=>[a.question_id,a.value]));
  const missing=questions.filter(q=>q.required&&!q.conditions&&(responses[q.id]==null||responses[q.id]===''));
  async function saveAnswer(qid,value){
    try{
      await saveLocalAnswer(owner,draftId,qid,value);
      await load();
      onUpdate?.();
      setError('');
    }catch(e){setError('Sauvegarde : '+e.message);throw e;}
  }
  async function addAction(){
    if(!action.trim()||busy)return;
    setBusy(true);
    try{await addLocalAction(owner,draftId,action.trim());setAction('');await load();onUpdate?.();setError('')}
    catch(e){setError('Action : '+e.message)}finally{setBusy(false)}
  }
  async function addPhoto(source){
    if(busy)return;
    setBusy(true);
    try{const id=await captureLocalPhoto(owner,draftId,source);if(id){await load();onUpdate?.()}setError('')}
    catch(e){setError('Photo non enregistrée : '+e.message)}finally{setBusy(false)}
  }
  function finish(){
    if(missing.length){setError('Réponses obligatoires manquantes : '+missing.slice(0,3).map(q=>q.label).join(', '));return;}
    Alert.alert('Terminer la visite','Le relevé sera conservé sur ce téléphone jusqu’à confirmation de sa synchronisation avec le CRM.',[
      {text:'Annuler',style:'cancel'},
      {text:'Terminer et mettre en attente',onPress:async()=>{
        setBusy(true);
        try{
          await finishLocalVisit(owner,draftId);
          await load();onUpdate?.(true);setError('');
          Alert.alert('Visite sauvegardée','Le relevé est enregistré sur le téléphone. Il sera envoyé dès que le CRM sera accessible.',[{text:'OK',onPress:onFinished}]);
        }catch(e){setError(e.message)}finally{setBusy(false)}
      }}
    ]);
  }
  if(!data)return <View style={{flex:1,justifyContent:'center',padding:24}}>{error?<Empty title="Relevé indisponible" subtitle={error}/>:<Loader text="Ouverture du relevé…"/>}</View>;
  return <QuestionFlow key={draftId} questions={questions} responses={responses} editable={editing}
    onSave={saveAnswer} onExit={onBack} storeName={data.store_name} error={error||data.error}
    saveLabel={data.status==='synced'?'Envoyée au CRM':data.status==='ready'?'En attente de synchronisation':'Sauvegarde sur le téléphone'}
    summary={<>
      <View style={[S.row,{marginBottom:15}]}>
        <Badge text={data.status==='synced'?'Envoyée au CRM':data.status==='ready'?'Prête à envoyer':'Brouillon local'} tone={data.status==='synced'?'green':'amber'}/>
        <Text style={[S.muted,{marginLeft:9,flex:1}]}>Réponses conservées sur cet appareil</Text>
      </View>
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
      {(data.actions||[]).map(a=><View key={a.id} style={[S.card,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}>
        <Text style={{color:C.text,flex:1,marginRight:12}}>{a.title}</Text>
        <Badge tone={a.sent?'green':'amber'} text={a.sent?'Envoyée':'Locale'}/>
      </View>)}
      {editing?<View style={S.card}>
        <TextInput style={S.input} placeholder="Nouvelle action à suivre…" value={action} onChangeText={setAction} maxLength={300}/>
        <Button label="Ajouter l’action" onPress={addAction} disabled={busy||!action.trim()} style={{marginTop:11}}/>
      </View>:null}
      {editing?<Button label={busy?'Sauvegarde…':'Terminer la visite'} onPress={finish} disabled={busy||missing.length>0}
        style={{marginTop:20}}/>:data.status==='ready'?
        <Button label="Réouvrir pour correction" outline onPress={async()=>{try{await resumeLocalVisit(owner,draftId);await load();onUpdate?.()}catch(e){setError(e.message)}}} style={{marginTop:20}}/>:null}
    </>}/>;
}
