// CRM Terrain : aperçu React Native compatible Expo Go SDK 54 sur iPhone.
// Aperçu fonctionnel basé sur la V0.1 ; moteur hors connexion V0.2 non inclus dans cet aperçu.
import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Alert, ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

function TabIcon({name,color,size=22,strokeWidth=2}) {
  const shared={stroke:color,strokeWidth,strokeLinecap:'round',strokeLinejoin:'round',fill:'none'};
  const calendar=<><Rect {...shared} x="3" y="5" width="18" height="16" rx="2"/><Line {...shared} x1="3" y1="10" x2="21" y2="10"/><Line {...shared} x1="8" y1="3" x2="8" y2="7"/><Line {...shared} x1="16" y1="3" x2="16" y2="7"/></>;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {(name==='today'||name==='agenda') && calendar}
    {name==='today' && <Path {...shared} d="m8 15 2 2 5-5"/>}
    {name==='agenda' && <><Line {...shared} x1="8" y1="14" x2="10" y2="14"/><Line {...shared} x1="14" y1="14" x2="16" y2="14"/><Line {...shared} x1="8" y1="18" x2="10" y2="18"/><Line {...shared} x1="14" y1="18" x2="16" y2="18"/></>}
    {name==='park' && <><Path {...shared} d="M4 10v10h16V10"/><Path {...shared} d="M3 10 5 4h14l2 6"/><Path {...shared} d="M9 20v-7h6v7"/><Path {...shared} d="M3 10c.5 2 3.5 2 4 0 .5 2 3.5 2 5 0 .5 2 3.5 2 5 0 .5 2 3.5 2 4 0"/></>}
    {name==='goals' && <><Circle {...shared} cx="12" cy="12" r="9"/><Circle {...shared} cx="12" cy="12" r="5"/><Circle {...shared} cx="12" cy="12" r="1"/></>}
  </Svg>;
}

// FILE: src/design.js


const C = {
  navy:'#111E33', navy2:'#263C59', blue:'#2875E7', blueSoft:'#EAF2FF',
  white:'#FFFFFF', bg:'#F4F7FB', text:'#14233A', muted:'#70819A', border:'#E4EAF2',
  green:'#0E9A68', greenSoft:'#E5F7EF', amber:'#AB6A16', amberSoft:'#FFF3DF',
  danger:'#BB3D47', redSoft:'#FFF1F1'
};
const S = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},
  content:{paddingHorizontal:20,paddingBottom:25},
  card:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:17,padding:17,marginBottom:11},
  sectionTitle:{fontSize:20,fontWeight:'800',letterSpacing:-.5,color:C.text,marginBottom:13},
  eyebrow:{fontSize:10,fontWeight:'900',color:C.blue,letterSpacing:1.5,marginBottom:7},
  text:{fontSize:14,color:C.text}, muted:{fontSize:12,color:C.muted,lineHeight:19},
  button:{minHeight:49,borderRadius:13,alignItems:'center',justifyContent:'center',paddingHorizontal:16,backgroundColor:C.blue},
  buttonText:{color:'white',fontWeight:'800',fontSize:14},
  buttonLight:{minHeight:49,borderRadius:13,alignItems:'center',justifyContent:'center',paddingHorizontal:16,borderWidth:1,borderColor:C.border,backgroundColor:'white'},
  buttonLightText:{color:C.blue,fontWeight:'800',fontSize:14},
  input:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:14,minHeight:49,fontSize:14,color:C.text},
  row:{flexDirection:'row',alignItems:'center'},
  divider:{height:1,backgroundColor:C.border,marginVertical:13},
});
function Button({label,onPress,outline=false,disabled=false,style}){
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[outline?S.buttonLight:S.button,disabled&&{opacity:.5},style]}>
    <Text style={outline?S.buttonLightText:S.buttonText}>{label}</Text>
  </Pressable>;
}
function Empty({title,subtitle}){
  return <View style={[S.card,{alignItems:'center',paddingVertical:31}]}>
    <Text style={{fontSize:16,fontWeight:'800',color:C.text,marginBottom:8,textAlign:'center'}}>{title}</Text>
    <Text style={[S.muted,{textAlign:'center',paddingHorizontal:10}]}>{subtitle}</Text>
  </View>;
}
function Loader({text='Chargement…'}){
  return <View style={{padding:32,alignItems:'center',gap:12}}><ActivityIndicator color={C.blue}/><Text style={S.muted}>{text}</Text></View>;
}
function Section({eyebrow,title,right}){
  return <View style={[S.row,{justifyContent:'space-between',marginTop:25,marginBottom:13}]}>
    <View><Text style={S.eyebrow}>{eyebrow}</Text><Text style={[S.sectionTitle,{marginBottom:0}]}>{title}</Text></View>{right}
  </View>;
}
function Badge({text,tone='blue'}){
  const styles={blue:[C.blueSoft,C.blue],green:[C.greenSoft,C.green],amber:[C.amberSoft,C.amber],muted:['#F1F3F7',C.muted]};
  const [bg,fg]=styles[tone]||styles.blue;
  return <View style={{backgroundColor:bg,paddingVertical:6,paddingHorizontal:9,borderRadius:999}}><Text style={{fontSize:10,fontWeight:'800',color:fg}}>{text}</Text></View>;
}
function formatDate(day,withYear=true){
  try {return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long',...(withYear?{year:'numeric'}:{})}).format(new Date(day+'T12:00:00Z'));}
  catch(_){return day;}
}
function todayParis(){
  const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
function shiftDay(day,offset){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
function time(minutes){const n=Number(minutes)||0;return String(Math.floor(n/60)).padStart(2,'0')+'h'+String(n%60).padStart(2,'0');}


// FILE: src/Screens.js



function DaySelector({day,setDay}){
  return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:13,marginTop:22,marginBottom:17}}>
    <Pressable accessibilityLabel="Jour précédent" onPress={()=>setDay(shiftDay(day,-1))} style={navArrow}><Text style={arrowText}>‹</Text></Pressable>
    <Pressable onPress={()=>setDay(todayParis())} style={[navArrow,{width:'auto',paddingHorizontal:17}]}><Text style={{fontSize:12,fontWeight:'800',color:C.navy}}>{day===todayParis()?"Aujourd'hui":formatDate(day,false)}</Text></Pressable>
    <Pressable accessibilityLabel="Jour suivant" onPress={()=>setDay(shiftDay(day,1))} style={navArrow}><Text style={arrowText}>›</Text></Pressable>
  </View>;
}
const navArrow={backgroundColor:C.white,borderRadius:12,borderWidth:1,borderColor:C.border,minWidth:40,minHeight:39,alignItems:'center',justifyContent:'center'};
const arrowText={fontSize:27,lineHeight:31,color:C.navy};

function EventCard({event,onPress}){
  const completed=event.visit_status==='completed';
  const ongoing=event.visit_status==='in_progress';
  const place=event.store_name||event.shop||event.kind||'Créneau';
  const city=[event.postal_code,event.city].filter(Boolean).join(' ');
  return <View style={{flexDirection:'row',marginBottom:11,paddingLeft:12}}>
    <View style={{width:3,backgroundColor:C.border,position:'absolute',left:5,top:0,bottom:-12}}/>
    <View style={{width:12,height:12,borderWidth:3,borderColor:C.white,backgroundColor:completed?C.green:C.blue,borderRadius:20,position:'absolute',left:0,top:22}}/>
    <Pressable accessibilityRole="button" onPress={onPress} style={[S.card,{flex:1,marginBottom:0}]}>
      <View style={[S.row,{justifyContent:'space-between'}]}>
        <Text style={{color:C.blue,fontSize:13,fontWeight:'800'}}>{event.all_day?'Journée':time(event.start_minute)+' – '+time(Number(event.start_minute)+Number(event.duration))}</Text>
        <Badge text={completed?'Terminée':ongoing?'En cours':event.store_id?'Planifiée':'Agenda'} tone={completed?'green':ongoing?'amber':event.store_id?'blue':'muted'}/>
      </View>
      <Text style={{color:C.text,fontWeight:'800',fontSize:16,marginTop:10,marginBottom:4}}>{place}</Text>
      <Text style={S.muted}>{[city,event.kind].filter(Boolean).join(' · ')}</Text>
      <View style={[S.row,{justifyContent:'space-between',borderTopWidth:1,borderTopColor:C.border,paddingTop:12,marginTop:15}]}>
        <Text style={{fontSize:12,fontWeight:'800',color:C.blue}}>{completed?'Voir le relevé':ongoing?'Reprendre la visite':event.store_id?'Ouvrir la fiche':'Détails du créneau'}</Text>
        <Text style={{fontSize:20,color:C.muted}}>›</Text>
      </View>
    </Pressable>
  </View>;
}

function TodayScreen({day,setDay,events,loading,onEvent,refresh}){
  const visits=events.filter(e=>!!e.store_id);
  const done=visits.filter(e=>e.visit_status==='completed').length;
  return <ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
    <DaySelector day={day} setDay={setDay}/>
    <View style={{flexDirection:'row',gap:9}}>
      {[['Prévues',visits.length],['Terminées',done],['À réaliser',visits.length-done]].map(([label,count])=><View key={label} style={[S.card,{flex:1,padding:13,minWidth:0}]}>
        <Text style={{fontSize:25,color:C.navy,fontWeight:'900'}}>{loading?'–':count}</Text><Text style={{fontSize:11,color:C.muted,marginTop:4}}>{label}</Text>
      </View>)}
    </View>
    <Section eyebrow="MON PROGRAMME" title="Fil de la journée" right={<Pressable accessibilityLabel="Actualiser" onPress={refresh}><Text style={{fontSize:26,color:C.blue}}>↻</Text></Pressable>}/>
    {loading?<Loader text="Lecture de l’agenda…"/>:events.length?events.map(ev=><EventCard key={ev.id} event={ev} onPress={()=>onEvent(ev)}/>):<Empty title="Aucune visite programmée" subtitle="Les créneaux du planning du CRM apparaîtront ici. Tu peux naviguer entre les journées."/>}
  </ScrollView>;
}

function AgendaScreen({day,setDay,events,loading,onEvent}){
  return <ScrollView contentContainerStyle={S.content}>
    <Section eyebrow="AGENDA TERRAIN" title="Mon planning"/>
    <DaySelector day={day} setDay={setDay}/>
    <Text style={[S.muted,{marginBottom:18,textTransform:'capitalize'}]}>{formatDate(day)}</Text>
    {loading?<Loader/>:events.length?events.map(ev=><EventCard key={ev.id} event={ev} onPress={()=>onEvent(ev)}/>):<Empty title="Journée disponible" subtitle="Aucun créneau enregistré sur cette date."/>}
    <Text style={[S.muted,{textAlign:'center',marginTop:15}]}>La modification des créneaux reste dans le CRM web pour cette première version.</Text>
  </ScrollView>;
}

function ParkScreen({stores,loading,onStore}){
  const [query,setQuery]=useState('');
  const filtered=useMemo(()=>{
    const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const needle=normalize(query.trim());
    return (stores||[]).filter(s=>normalize([s.name,s.city,s.retailer,s.address,s.postal_code].join(' ')).includes(needle));
  },[stores,query]);
  return <View style={{flex:1}}>
    <View style={{paddingHorizontal:20}}><Section eyebrow="MON PÉRIMÈTRE" title={'Parc de magasins ('+(stores?.length||0)+')'}/>
      <TextInput style={[S.input,{marginBottom:13}]} placeholder="Rechercher une enseigne, une ville…" placeholderTextColor="#8B98AA" value={query} onChangeText={setQuery} autoCorrect={false}/>
    </View>
    {loading?<Loader/>:<ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
      {!filtered.length?<Empty title="Aucun point de vente" subtitle={query?'Affiner la recherche.':'Aucun magasin affecté à cette mission.'}/>:filtered.slice(0,120).map(s=><Pressable key={s.id} onPress={()=>onStore(s)} style={[S.card,{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}]}>
        <View style={{flex:1}}><Text style={{color:C.text,fontSize:15,fontWeight:'800'}} numberOfLines={2}>{s.name}</Text>
          <Text style={[S.muted,{marginTop:5}]} numberOfLines={2}>{[s.retailer,s.postal_code,s.city].filter(Boolean).join(' · ')}</Text></View>
        <Text style={{color:C.muted,fontSize:22,marginLeft:12}}>›</Text>
      </Pressable>)}
      {filtered.length>120?<Text style={[S.muted,{textAlign:'center',marginTop:10}]}>Affiche les 120 premiers résultats. Précise ta recherche.</Text>:null}
    </ScrollView>}
  </View>;
}

function GoalsScreen({goals,loading}){
  return <ScrollView contentContainerStyle={S.content}>
    <Section eyebrow="MES PRIORITÉS" title="Objectifs de mission"/>
    {loading?<Loader/>:!goals.length?<Empty title="Pas encore d’objectif" subtitle="Les objectifs publiés sur ton périmètre CRM apparaîtront automatiquement."/>:
    goals.map(goal=>{
      const current=Number(goal.current_value||0);const target=Number(goal.target||0);const pct=target>0?Math.max(0,Math.min(100,current/target*100)):0;
      return <View key={goal.id} style={[S.card,{padding:19}]}>
        <Text style={{fontSize:16,fontWeight:'800',color:C.text}}>{goal.title}</Text>
        <Text style={[S.muted,{marginTop:8}]}>{[goal.sector_name,goal.ends_on?'Échéance : '+String(goal.ends_on).slice(0,10).split('-').reverse().join('/'):''].filter(Boolean).join(' · ')||'Objectif de mission'}</Text>
        {target>0?<View style={{height:8,backgroundColor:'#E7EEF8',borderRadius:9,marginTop:18,overflow:'hidden'}}><View style={{width:pct+'%',height:8,backgroundColor:C.blue,borderRadius:9}}/></View>:null}
        <View style={[S.row,{justifyContent:'space-between',marginTop:10}]}><Text style={S.muted}>{current}{target>0?' / '+target:''} {goal.unit||''}</Text><Text style={{color:C.navy,fontWeight:'800'}}>{target>0?Math.round(current/target*100)+' %':'Suivi'}</Text></View>
      </View>;
    })}
  </ScrollView>;
}

function Info({label,value}){if(!value)return null;return <View style={{marginBottom:18}}><Text style={S.eyebrow}>{label}</Text><Text style={{color:C.text,fontSize:14,lineHeight:22}}>{String(value)}</Text></View>}
function address(s){return [s.address,[s.postal_code,s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
function StoreDetail({store,onBack,onStart,busy}){
  const addr=address(store);
  const route=()=>Linking.openURL('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(addr));
  return <ScrollView contentContainerStyle={S.content}>
    <Pressable onPress={onBack} style={{marginVertical:23}}><Text style={{color:C.blue,fontWeight:'800'}}>‹ Retour au parc</Text></Pressable>
    <Text style={S.eyebrow}>FICHE MAGASIN</Text><Text style={{fontSize:26,fontWeight:'900',color:C.navy,marginBottom:22}}>{store.name}</Text>
    <View style={S.card}>
      <Info label="ENSEIGNE / SITE" value={store.retailer||store.site_category}/><Info label="ADRESSE" value={addr}/>
      <Info label="CONTACT" value={[store.contact_name,store.contact_phone].filter(Boolean).join(' · ')}/>
      <Info label="STRATE" value={store.stratum}/><Info label="CADENCE" value={store.visit_frequency}/>
      <Info label="DERNIÈRE VISITE" value={store.last_visit_at?new Date(store.last_visit_at).toLocaleDateString('fr-FR'):'Aucune visite terminée'}/>
      <Info label="DISTRIBUTION" value={store.dn!=null?store.dn+' %':null}/>
    </View>
    <Button label={busy?'Ouverture…':'Démarrer / reprendre la visite'} onPress={()=>onStart(store.id)} disabled={busy}/>
    {!!addr&&<Button label="Itinéraire vers le magasin" outline style={{marginTop:10}} onPress={route}/>}
  </ScrollView>;
}

function EventDetail({event,onBack,onStart,onOpenVisit,busy}){
  const addr=address(event);const type=event.kind||'Visite';
  return <ScrollView contentContainerStyle={S.content}>
    <Pressable onPress={onBack} style={{marginVertical:23}}><Text style={{color:C.blue,fontWeight:'800'}}>‹ Retour au programme</Text></Pressable>
    <Text style={S.eyebrow}>{type.toUpperCase()}</Text><Text style={{fontSize:26,fontWeight:'900',color:C.navy,marginBottom:22}}>{event.store_name||type}</Text>
    <View style={S.card}>
      <Info label="HORAIRE" value={event.all_day?'Toute la journée':time(event.start_minute)+' – '+time(Number(event.start_minute)+Number(event.duration))}/>
      <Info label="LOCALISATION" value={addr}/><Info label="OBJECTIF / PRÉPARATION" value={event.note||'Aucune consigne renseignée pour cette visite.'}/>
      <Info label="CONTACT" value={[event.contact_name,event.contact_phone].filter(Boolean).join(' · ')}/>
      <Info label="STATUT" value={event.visit_status==='completed'?'Visite terminée':event.visit_status==='in_progress'?'En cours':event.store_id?'À réaliser':'Créneau sans magasin'}/>
    </View>
    {event.visit_id?<Button label={event.visit_status==='completed'?'Consulter le relevé':'Reprendre la visite'} onPress={()=>onOpenVisit(event.visit_id)}/>:
      event.store_id?<Button label={busy?'Ouverture…':'Démarrer la visite'} disabled={busy} onPress={()=>onStart(event.store_id)}/>:null}
    {!!addr&&<Button label="Ouvrir l’itinéraire" outline style={{marginTop:10}} onPress={()=>Linking.openURL('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(addr))}/>}
  </ScrollView>;
}


// FILE: src/Visit.js



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

function VisitScreen({visitId,api,onBack,onFinished}){
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


// FILE: src/bridge.js

const CRM_ORIGIN = 'https://crm-sylvain-v2.hatchable.site';
const BRIDGE_URI = CRM_ORIGIN + '/native-bridge.html';

function useCrmBridge() {
  const webviewRef = useRef(null);
  const pending = useRef(new Map());
  const counter = useRef(0);
  const readyRef = useRef(false);
  const [phase, setPhase] = useState('connecting');
  const [profile, setProfile] = useState(null);

  const request = useCallback((method, path, body) => {
    if (!readyRef.current || !webviewRef.current) {
      return Promise.reject(new Error('Connexion au CRM indisponible.'));
    }
    if (!/^\/api\//.test(path)) {
      return Promise.reject(new Error('Chemin API interdit.'));
    }
    const id = String(++counter.current);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error('Le CRM ne répond pas. Réessaie.'));
      }, 25000);
      pending.current.set(id, { resolve, reject, timer });
      const payload = JSON.stringify({ id, method, path, body });
      webviewRef.current.injectJavaScript('window.__crmNativeBridge(' + payload + ');true;');
    });
  }, []);

  const handleMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch (_) { return; }
    if (msg.type === 'ready') {
      readyRef.current = true;
      setProfile(msg.profile || null);
      setPhase('ready');
    } else if (msg.type === 'expired' || msg.type === 'denied') {
      readyRef.current = false;
      setPhase(msg.type === 'expired' ? 'login' : 'denied');
      for (const [id, item] of pending.current) {
        clearTimeout(item.timer);
        item.reject(new Error('Compte déconnecté ou accès refusé.'));
        pending.current.delete(id);
      }
    } else if (msg.type === 'connection_error') {
      readyRef.current = false;
      setPhase('connection_error');
    } else if (msg.type === 'response') {
      const item = pending.current.get(msg.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.current.delete(msg.id);
      if (msg.ok) item.resolve(msg.data);
      else item.reject(new Error(msg.data?.error || msg.error || 'Erreur CRM (' + (msg.status || '') + ')'));
    }
  }, []);

  const navigationChanged = useCallback((nav) => {
    const url = String(nav.url || '');
    if (url.includes('/login.html') || /\/login\?/.test(url)) {
      readyRef.current = false;
      setPhase('login');
    }
  }, []);

  const isAllowedNavigation = useCallback((event) => {
    try {
      const url = new URL(event.url);
      return url.protocol === 'about:' || (url.protocol === 'https:' && url.hostname === 'crm-sylvain-v2.hatchable.site');
    } catch (_) { return false; }
  }, []);

  const disconnect = useCallback(() => {
    if (!webviewRef.current) return;
    readyRef.current = false;
    setProfile(null);
    setPhase('login');
    webviewRef.current.injectJavaScript(
      "Promise.resolve(window.hatchable?.auth?.signOut?.()).finally(()=>location.replace('/login.html?next=%2Fnative-bridge.html'));true;"
    );
  }, []);

  return {
    webviewRef, bridgeUri: BRIDGE_URI, phase, profile, request,
    handleMessage, navigationChanged, isAllowedNavigation, disconnect
  };
}


// FILE: App.js









const TABS=[
  {id:'today',label:'Ma journée'},
  {id:'agenda',label:'Agenda'},
  {id:'park',label:'Mon parc'},
  {id:'goals',label:'Objectifs'},
];

function CrmApp(){
  const bridge=useCrmBridge();
  const api=useCallback((method,path,body)=>bridge.request(method,path,body),[bridge.request]);
  const [missions,setMissions]=useState([]);
  const [mission,setMission]=useState('');
  const [picker,setPicker]=useState(false);
  const [tab,setTab]=useState('today');
  const [day,setDay]=useState(todayParis());
  const [events,setEvents]=useState([]);
  const [dayLoading,setDayLoading]=useState(false);
  const [stores,setStores]=useState(null);
  const [parkLoading,setParkLoading]=useState(false);
  const [goals,setGoals]=useState(null);
  const [goalsLoading,setGoalsLoading]=useState(false);
  const [focus,setFocus]=useState(null);
  const [visitId,setVisitId]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [refreshCounter,setRefreshCounter]=useState(0);
  const ready=bridge.phase==='ready';

  useEffect(()=>{
    if(!ready)return;
    let active=true;
    (async()=>{
      try{
        const data=await api('GET','/api/missions');
        if(!active)return;
        const available=data.missions||[];
        setMissions(available);
        setMission(previous=>available.some(m=>m.id===previous)?previous:(available[0]?.id||''));
      }catch(e){if(active)setError('Liste des missions : '+e.message)}
    })();
    return()=>{active=false};
  },[ready,api]);

  useEffect(()=>{
    if(!ready||!mission)return;
    let active=true;
    setDayLoading(true);
    api('GET',`/api/missions/${mission}/mobile-day?date=${day}`)
      .then(d=>{if(active)setEvents(d.events||[])})
      .catch(e=>{if(active){setEvents([]);setError('Agenda : '+e.message)}})
      .finally(()=>{if(active)setDayLoading(false)});
    return()=>{active=false};
  },[ready,mission,day,api,refreshCounter]);

  useEffect(()=>{
    if(!ready||!mission||tab!=='park'||stores!==null)return;
    let active=true;setParkLoading(true);
    api('GET',`/api/missions/${mission}/stores`)
      .then(d=>{if(active)setStores(d.stores||[])})
      .catch(e=>{if(active)setError('Parc : '+e.message)})
      .finally(()=>{if(active)setParkLoading(false)});
    return()=>{active=false};
  },[ready,mission,tab,stores,api]);

  useEffect(()=>{
    if(!ready||!mission||tab!=='goals'||goals!==null)return;
    let active=true;setGoalsLoading(true);
    api('GET',`/api/missions/${mission}/goals`)
      .then(d=>{if(active)setGoals(d.goals||[])})
      .catch(e=>{if(active)setError('Objectifs : '+e.message)})
      .finally(()=>{if(active)setGoalsLoading(false)});
    return()=>{active=false};
  },[ready,mission,tab,goals,api]);

  const selectMission=id=>{
    setMission(id);setStores(null);setGoals(null);setEvents([]);
    setFocus(null);setVisitId(null);setPicker(false);setError('');
  };
  const refresh=()=>{setError('');setRefreshCounter(n=>n+1)};

  async function startVisit(storeId){
    if(!mission||!storeId||busy)return;
    setBusy(true);setError('');
    try{
      const data=await api('POST','/api/visits',{
        mission_id:mission,store_id:storeId,
        client_operation_id:'native-'+Date.now()+'-'+Math.random().toString(36).slice(2)
      });
      if(!data.visit?.id)throw Error('Aucune visite retournée par le CRM.');
      setFocus(null);setVisitId(data.visit.id);refresh();
    }catch(e){Alert.alert('Ouverture impossible',e.message)}
    finally{setBusy(false)}
  }

  const navToTab=id=>{setFocus(null);setVisitId(null);setTab(id);setError('')};
  const screen=()=>{
    if(visitId)return <VisitScreen visitId={visitId} api={api} onBack={()=>{setVisitId(null);refresh()}} onFinished={()=>{setVisitId(null);refresh()}}/>;
    if(focus?.type==='event')return <EventDetail event={focus.value} busy={busy} onBack={()=>setFocus(null)} onStart={startVisit} onOpenVisit={setVisitId}/>;
    if(focus?.type==='store')return <StoreDetail store={focus.value} busy={busy} onBack={()=>setFocus(null)} onStart={startVisit}/>;
    if(!mission)return <View style={S.content}><Empty title="Aucune mission accessible" subtitle="Ton compte doit être invité et affecté à une mission dans le CRM."/></View>;
    if(tab==='agenda')return <AgendaScreen day={day} setDay={setDay} events={events} loading={dayLoading} onEvent={event=>setFocus({type:'event',value:event})}/>;
    if(tab==='park')return <ParkScreen stores={stores} loading={parkLoading} onStore={store=>setFocus({type:'store',value:store})}/>;
    if(tab==='goals')return <GoalsScreen goals={goals||[]} loading={goalsLoading}/>;
    return <TodayScreen day={day} setDay={setDay} events={events} loading={dayLoading} refresh={refresh} onEvent={event=>setFocus({type:'event',value:event})}/>;
  };

  const webview=<WebView
      ref={bridge.webviewRef}
      source={{uri:bridge.bridgeUri}}
      originWhitelist={['https://*']}
      onMessage={bridge.handleMessage}
      onNavigationStateChange={bridge.navigationChanged}
      onShouldStartLoadWithRequest={bridge.isAllowedNavigation}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      sharedCookiesEnabled={true}
      thirdPartyCookiesEnabled={false}
      cacheEnabled={true}
      allowsBackForwardNavigationGestures={false}
      onError={()=>{if(!ready)setError('Le serveur CRM est indisponible. Vérifie ta connexion internet.')}}
      style={{flex:1,backgroundColor:C.navy}}
    />;

  const firstName=(bridge.profile?.display_name||bridge.profile?.email||'').split(/[\s@]/)[0]||'terrain';
  const selected=missions.find(m=>m.id===mission);
  return <View style={{flex:1,backgroundColor:C.bg}}>
    <StatusBar style="light" backgroundColor={C.navy}/>
    {ready?<SafeAreaView edges={['top','left','right','bottom']} style={[S.screen,{backgroundColor:C.navy}]}>
      <View style={{backgroundColor:C.navy,paddingTop:10,paddingBottom:24,paddingHorizontal:23,borderBottomLeftRadius:25,borderBottomRightRadius:25}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:23}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
            <View style={{backgroundColor:'white',width:41,height:41,borderRadius:12,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.navy,fontWeight:'900',fontSize:26}}>C<Text style={{color:C.blue}}>.</Text></Text></View>
            <View><Text style={{color:'white',fontSize:12,fontWeight:'900',letterSpacing:1.7}}>CRM TERRAIN</Text><Text style={{color:'#AFBED4',fontSize:11,marginTop:4}}>Mon espace de travail</Text></View>
          </View>
          <Pressable accessibilityLabel="Compte" onPress={()=>Alert.alert('Mon compte',bridge.profile?.email||firstName,[{text:'Rester connecté',style:'cancel'},{text:'Déconnexion',style:'destructive',onPress:bridge.disconnect}])} style={{backgroundColor:C.navy2,width:39,height:39,borderRadius:12,alignItems:'center',justifyContent:'center'}}><Text style={{color:'white',fontWeight:'900'}}>{firstName[0].toUpperCase()}</Text></Pressable>
        </View>
        <Text style={{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:'#80A9E9'}}>MON ESPACE TERRAIN</Text>
        <Text style={{color:'white',fontSize:28,fontWeight:'900',letterSpacing:-.8,marginTop:6}}>Bonjour {firstName}</Text>
        <Text style={{color:'#B9C9DF',fontSize:13,marginTop:5,marginBottom:17,textTransform:'capitalize'}}>{formatDate(day)}</Text>
        <Pressable accessibilityRole="button" onPress={()=>setPicker(true)} style={{backgroundColor:C.navy2,borderColor:'#3E5774',borderWidth:1,borderRadius:14,paddingVertical:12,paddingHorizontal:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View style={{flex:1}}><Text style={{color:'#A5BDD8',fontSize:10,fontWeight:'800',letterSpacing:1.4}}>MISSION ACTIVE</Text>
            <Text style={{color:'white',fontSize:15,fontWeight:'800',marginTop:6}} numberOfLines={1}>{selected?.name||'Aucune mission'}</Text></View>
          <Text style={{color:'white',fontSize:20}}>⌄</Text>
        </Pressable>
      </View>
      <View style={{flex:1,backgroundColor:C.bg}}>
        {error?<Pressable onPress={()=>setError('')} style={{marginHorizontal:20,marginTop:12,padding:11,borderRadius:10,backgroundColor:C.redSoft,borderColor:'#F9D1D4',borderWidth:1}}><Text style={{color:C.danger,fontSize:12}}>{error}  ×</Text></Pressable>:null}
        {screen()}
      </View>
      {!visitId&&!focus?<View style={{flexDirection:'row',backgroundColor:'white',borderTopColor:C.border,borderTopWidth:1,paddingTop:9,paddingHorizontal:5,paddingBottom:5}}>
        {TABS.map(item=><Pressable accessibilityRole="tab" accessibilityState={{selected:tab===item.id}} key={item.id} onPress={()=>navToTab(item.id)} style={{flex:1,alignItems:'center',paddingVertical:5}}>
          <View style={{width:44,height:31,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:tab===item.id?C.blueSoft:'transparent'}}>
            <TabIcon name={item.id} size={22} strokeWidth={tab===item.id?2.35:1.85} color={tab===item.id?C.blue:'#8898AF'}/>
          </View>
          <Text style={{fontSize:10,fontWeight:'800',marginTop:4,color:tab===item.id?C.blue:'#8898AF'}}>{item.label}</Text>
        </Pressable>)}
      </View>:null}
    </SafeAreaView>:<View style={{flex:1,backgroundColor:C.navy}}>
      {bridge.phase==='denied'||bridge.phase==='connection_error'?
      <View style={{flex:1,padding:30,justifyContent:'center'}}>
        <Text style={{fontSize:26,color:'white',fontWeight:'900'}}>{bridge.phase==='denied'?'Accès refusé':'Connexion indisponible'}</Text>
        <Text style={{color:'#BAC9DF',marginTop:14,lineHeight:22}}>{bridge.phase==='denied'?'Compte désactivé. Contacte ton administrateur.':'Vérifie la connexion internet, puis relance l’application.'}</Text>
      </View>:null}
    </View>}
    <View pointerEvents={ready||bridge.phase==='denied'||bridge.phase==='connection_error'?'none':'auto'}
      style={ready||bridge.phase==='denied'||bridge.phase==='connection_error'?{position:'absolute',width:1,height:1,left:0,top:0,opacity:0}:{position:'absolute',left:0,right:0,top:0,bottom:0}}>
      {webview}
    </View>
    <Modal visible={ready&&picker} transparent animationType="fade" onRequestClose={()=>setPicker(false)}>
      <Pressable onPress={()=>setPicker(false)} style={{flex:1,backgroundColor:'#05152C99',justifyContent:'center',paddingHorizontal:24}}>
        <View style={{backgroundColor:C.white,borderRadius:19,padding:20}}>
          <Text style={{fontSize:18,fontWeight:'900',color:C.text,marginBottom:13}}>Choisir une mission</Text>
          {missions.map(m=><Pressable key={m.id} onPress={()=>selectMission(m.id)} style={{padding:14,borderRadius:11,backgroundColor:m.id===mission?C.blueSoft:'white',marginVertical:3}}>
            <Text style={{color:m.id===mission?C.blue:C.text,fontWeight:'800'}}>{m.name}</Text>
          </Pressable>)}
          <Button outline label="Fermer" style={{marginTop:11}} onPress={()=>setPicker(false)}/>
        </View>
      </Pressable>
    </Modal>
  </View>;
}

export default function App(){return <SafeAreaProvider><CrmApp/></SafeAreaProvider>}
