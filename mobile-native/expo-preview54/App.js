// CRM Terrain : aperçu React Native compatible Expo Go SDK 54 sur iPhone.
// Aperçu fonctionnel basé sur la V0.1 ; moteur hors connexion V0.2 non inclus dans cet aperçu.
import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Alert, ActivityIndicator, Linking, Modal, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
// Navigation icons drawn with React Native Views only — no native icon modules.
function TabIcon({name,color,size=22,strokeWidth=2}) {
  const w=Math.max(1.6,strokeWidth);
  const base={position:'absolute',borderColor:color,borderWidth:w};
  const dash=(style,key)=><View key={key} style={[{position:'absolute',backgroundColor:color,borderRadius:4},style]}/>;
  return <View pointerEvents="none" style={{width:size,height:size,position:'relative'}}>
    {name==='today' && <>
      <View style={[base,{left:2,top:4,width:18,height:17,borderRadius:3}]}/>
      {dash({left:2,top:9,width:18,height:w},'cal-horizontal')}
      {dash({left:6,top:1,width:w,height:6},'cal-top-a')}
      {dash({left:15,top:1,width:w,height:6},'cal-top-b')}
    </>}
    {name==='today' && <>
      {dash({left:6.5,top:14.5,width:5.3,height:w,transform:[{rotate:'43deg'}]},'check-a')}
      {dash({left:9.3,top:13.4,width:9.1,height:w,transform:[{rotate:'-43deg'}]},'check-b')}
    </>}
    {name==='agenda' && <>
      <View style={[base,{left:1,top:4,width:20,height:16,borderRadius:2}]}/>
      {dash({left:7,top:4,width:w,height:16},'fold-a')}
      {dash({left:14,top:4,width:w,height:16},'fold-b')}
      <View style={{position:'absolute',left:9,top:8,width:6,height:6,borderWidth:w,borderColor:color,borderRadius:3,backgroundColor:'white'}}/>
    </>}
    {name==='park' && <>
      <View style={[base,{left:3,top:9,width:16,height:12,borderRadius:2}]}/>
      <View style={[base,{left:1,top:4,width:20,height:8,borderRadius:2,backgroundColor:'white'}]}/>
      {dash({left:7,top:6,width:w,height:5},'awning-a')}
      {dash({left:14,top:6,width:w,height:5},'awning-b')}
      <View style={[base,{left:8.5,top:13,width:6,height:8,borderBottomWidth:0,borderTopLeftRadius:1,borderTopRightRadius:1}]}/>
    </>}
    {name==='goals' && <>
      <View style={[base,{left:1,top:1,width:20,height:20,borderRadius:10}]}/>
      <View style={[base,{left:6,top:6,width:10,height:10,borderRadius:5}]}/>
      <View style={{position:'absolute',left:10,top:10,width:2,height:2,borderRadius:1,backgroundColor:color}}/>
    </>}
  </View>;
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

function TodayScreen({day,setDay,events,loading,onEvent,refresh,onStartVisit,onResumeVisit}){
  const visits=events.filter(e=>!!e.store_id);
  const done=visits.filter(e=>e.visit_status==='completed').length;
  return <ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
    <DaySelector day={day} setDay={setDay}/>
    <View style={{flexDirection:'row',gap:9}}>
      {[['Prévues',visits.length],['Terminées',done],['À réaliser',visits.length-done]].map(([label,count])=><View key={label} style={[S.card,{flex:1,padding:13,minWidth:0}]}>
        <Text style={{fontSize:25,color:C.navy,fontWeight:'900'}}>{loading?'–':count}</Text><Text style={{fontSize:11,color:C.muted,marginTop:4}}>{label}</Text>
      </View>)}
    </View>
    {!loading?<QuickStartCard day={day} events={events} onOpen={onEvent} onStart={onStartVisit} onResume={onResumeVisit}/>:null}
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


// FILE: src/QuestionFlow.js



// Shared between local-first and connected visit flows.
// One question per screen; every transition persists before moving on.
const answered=value=>value!==undefined&&value!==null&&!(typeof value==='string'&&value.trim()==='');
function optionsFor(q){
  try{
    const raw=typeof q.options==='string'?JSON.parse(q.options):q.options;
    return Array.isArray(raw)?raw:[];
  }catch{return []}
}
function isNumeric(q){return ['number','integer','decimal','numeric'].includes(String(q.type||'').toLowerCase())}
function isBoolean(q){return ['yes_no','boolean','bool'].includes(String(q.type||'').toLowerCase())}
function normalizeDraft(q,draft){
  if(!answered(draft))return null;
  if(isNumeric(q)){
    const raw=String(draft).replace(',','.').trim();
    const n=Number(raw);
    if(!Number.isFinite(n))throw Error('Saisis un nombre valide pour continuer.');
    return n;
  }
  return draft;
}
function sameValue(a,b){return a===b||(a!=null&&b!=null&&String(a)===String(b))}
function labelValue(value){
  if(!answered(value))return 'Non renseignée';
  if(value===true)return 'Oui';
  if(value===false)return 'Non';
  if(typeof value==='object')return 'Renseignée';
  return String(value);
}
function QuestionFlow({questions=[],responses={},editable,onSave,onExit,storeName,saveLabel,summary,error,canContinue=true}){
  const [step,setStep]=useState(()=>{const first=questions.findIndex(q=>!answered(responses[q.id]));return first<0?questions.length:first;});
  const [draft,setDraft]=useState(null);
  const [busy,setBusy]=useState(false);
  const [localError,setLocalError]=useState('');
  const lock=useRef(false);
  const total=questions.length;
  const summaryStep=step>=total;
  const question=summaryStep?null:questions[step];
  const saved=question?responses[question.id]:undefined;
  const count=questions.filter(q=>answered(responses[q.id])).length;
  const position=total===0?100:Math.round((Math.min(step,total)/total)*100);
  const missing=questions.filter(q=>q.required&&!q.conditions&&!answered(responses[q.id]));
  useEffect(()=>{setDraft(saved==null?'':saved);setLocalError('')},[step,question?.id]);
  const selected=v=>sameValue(draft,v);
  async function move(next,allowEmptyRequired=false){
    if(lock.current||!canContinue)return;
    if(!question){setStep(Math.max(0,Math.min(total,next)));return;}
    let val;
    try{val=normalizeDraft(question,draft);}
    catch(e){setLocalError(e.message);return;}
    if(editable&&!allowEmptyRequired&&question.required&&!question.conditions&&!answered(val)){
      setLocalError('Cette réponse est obligatoire pour continuer.');
      return;
    }
    lock.current=true;setBusy(true);setLocalError('');
    try{
      if(editable&&!sameValue(saved,val)){
        await onSave(question.id,val);
      }
      setStep(Math.max(0,Math.min(total,next)));
    }catch(e){
      setLocalError('Réponse non enregistrée : '+String(e?.message||'Réessaie.'));
    }finally{lock.current=false;setBusy(false)}
  }
  const goExit=()=>{
    if(!editable||!question||sameValue(saved,draft)){onExit?.();return;}
    Alert.alert('Réponse en cours','Enregistrer cette réponse avant de quitter le relevé ?',[
      {text:'Rester',style:'cancel'},
      {text:'Quitter sans enregistrer',style:'destructive',onPress:onExit},
      {text:'Enregistrer',onPress:async()=>{try{await onSave(question.id,normalizeDraft(question,draft));onExit?.()}catch(e){setLocalError('Impossible de sauvegarder : '+e.message)}}}
    ]);
  };
  return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,backgroundColor:C.bg}}>
    <View style={{paddingHorizontal:20,paddingTop:17,paddingBottom:13,backgroundColor:'white',borderBottomColor:C.border,borderBottomWidth:1}}>
      <Pressable accessibilityRole="button" onPress={goExit} style={{alignSelf:'flex-start',paddingVertical:6,paddingRight:12,marginBottom:7}}>
        <Text style={{color:C.blue,fontWeight:'800',fontSize:13}}>‹ Quitter le relevé</Text>
      </Pressable>
      <Text numberOfLines={1} style={{color:C.navy,fontWeight:'900',fontSize:20}}>{storeName||'Ma visite'}</Text>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:14}}>
        <Text style={{color:C.blue,fontSize:12,fontWeight:'900'}}>{summaryStep?'Récapitulatif':`Question ${step+1} / ${total}`}</Text>
        <Text style={{fontSize:12,color:C.muted}}>{count} réponse{count>1?'s':''} renseignée{count>1?'s':''} · {position}%</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:position}} style={{height:7,borderRadius:10,backgroundColor:'#E6ECF5',overflow:'hidden',marginTop:9}}>
        <View style={{width:position+'%',height:'100%',backgroundColor:C.blue,borderRadius:10}}/>
      </View>
      <Text style={{fontSize:11,color:C.muted,marginTop:8}}>{saveLabel||'Enregistrement en passant à la question suivante'}</Text>
    </View>
    <ScrollView key={summaryStep?'summary':question?.id||step} style={{flex:1}} contentContainerStyle={{paddingHorizontal:20,paddingTop:24,paddingBottom:28}} keyboardShouldPersistTaps="handled">
      {!!(localError||error)&&<Text style={{color:C.danger,backgroundColor:C.redSoft,padding:12,borderRadius:10,marginBottom:16}}>{localError||error}</Text>}
      {summaryStep?<>
        <Text style={S.eyebrow}>FIN DU QUESTIONNAIRE</Text>
        <Text style={{fontWeight:'900',fontSize:25,color:C.navy,marginBottom:7}}>Récapitulatif de visite</Text>
        <Text style={[S.muted,{marginBottom:16}]}>Vérifie les réponses, puis finalise la visite en bas de page.</Text>
        {questions.length?<View style={S.card}>{questions.map((q,i)=><Pressable key={q.id} onPress={()=>setStep(i)} style={{borderBottomColor:C.border,borderBottomWidth:i<questions.length-1?1:0,paddingVertical:12}}>
          <Text numberOfLines={2} style={{fontWeight:'700',color:C.text,fontSize:13}}>{i+1}. {q.label}{q.required?' *':''}</Text>
          <Text numberOfLines={1} style={{fontSize:12,marginTop:4,color:answered(responses[q.id])?C.green:C.muted}}>{labelValue(responses[q.id])}</Text>
        </Pressable>)}</View>:null}
        {missing.length>0&&<Pressable onPress={()=>setStep(questions.findIndex(q=>q.id===missing[0].id))} style={[S.card,{backgroundColor:C.redSoft,borderColor:'#F2C9CD'}]}>
          <Text style={{fontWeight:'800',color:C.danger}}>{missing.length} question(s) obligatoire(s) sans réponse</Text>
          <Text style={{fontSize:12,color:C.danger,marginTop:5}}>Appuyer pour retourner à la première.</Text>
        </Pressable>}
        {summary}
      </>:question?<>
        <Text style={S.eyebrow}>{question.required?'RÉPONSE OBLIGATOIRE':'QUESTION FACULTATIVE'}</Text>
        <Text style={{fontWeight:'900',fontSize:25,lineHeight:33,color:C.navy,marginTop:10,marginBottom:23}}>{question.label}</Text>
        {isBoolean(question)?<View style={{gap:11}}>
          {[[true,'Oui'],[false,'Non']].map(([v,label])=><Pressable key={label} disabled={!editable||busy} onPress={()=>setDraft(v)} style={{minHeight:73,backgroundColor:selected(v)?C.blueSoft:'white',borderColor:selected(v)?C.blue:C.border,borderWidth:selected(v)?2:1,borderRadius:16,justifyContent:'center',paddingHorizontal:20}}>
            <Text style={{color:selected(v)?C.blue:C.text,fontWeight:'800',fontSize:19}}>{selected(v)?'✓  ':''}{label}</Text>
          </Pressable>)}
        </View>:optionsFor(question).length>0&&['select','single_choice','choice','radio'].includes(String(question.type||'').toLowerCase())?
          <View style={{gap:11}}>{optionsFor(question).map((option,i)=>{
            const v=typeof option==='object'?(option.value??option.label??String(i)):option;
            const label=typeof option==='object'?String(option.label??option.value??'Option'):String(option);
            return <Pressable key={i} disabled={!editable||busy} onPress={()=>setDraft(v)} style={{minHeight:65,backgroundColor:selected(v)?C.blueSoft:'white',borderColor:selected(v)?C.blue:C.border,borderWidth:selected(v)?2:1,borderRadius:15,justifyContent:'center',paddingHorizontal:17}}>
              <Text style={{fontSize:16,fontWeight:selected(v)?'800':'600',color:selected(v)?C.blue:C.text}}>{selected(v)?'✓  ':''}{label}</Text>
            </Pressable>;
          })}</View>:
          <TextInput editable={editable&&!busy} style={[S.input,{fontSize:18,minHeight:isNumeric(question)?65:132,textAlignVertical:'top',paddingTop:19}]} multiline={!isNumeric(question)} keyboardType={isNumeric(question)?'decimal-pad':'default'} value={draft==null?'':String(draft)} onChangeText={setDraft} placeholder="Saisir la réponse…" placeholderTextColor="#9EABBC" returnKeyType={isNumeric(question)?'done':'default'}/>
        }
      </>:<Text style={S.muted}>Aucune question disponible.</Text>}
    </ScrollView>
    <View style={{flexDirection:'row',gap:11,paddingHorizontal:20,paddingVertical:12,borderTopWidth:1,borderColor:C.border,backgroundColor:'white'}}>
      <Pressable accessibilityRole="button" disabled={busy||step===0} onPress={()=>move(step-1,true)} style={{minHeight:49,flex:1,borderColor:C.border,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center',opacity:step===0?0.4:1}}>
        <Text style={{color:C.navy,fontWeight:'800'}}>Précédent</Text>
      </Pressable>
      {!summaryStep?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>move(step+1)} style={{minHeight:49,flex:1.6,backgroundColor:C.blue,borderRadius:13,alignItems:'center',justifyContent:'center'}}>
        <Text style={{color:'white',fontWeight:'900'}}>{busy?'Enregistrement…':step===total-1?'Récapitulatif →':!question?.required&&!answered(draft)?'Passer →':'Suivant →'}</Text>
      </Pressable>:<Pressable accessibilityRole="button" onPress={()=>missing.length?setStep(questions.findIndex(q=>q.id===missing[0].id)):onExit?.()} style={{minHeight:49,flex:1.6,backgroundColor:C.blueSoft,borderRadius:13,alignItems:'center',justifyContent:'center'}}>
        <Text style={{color:C.blue,fontWeight:'900'}}>{missing.length?'Réponses manquantes':'Retour à ma journée'}</Text>
      </Pressable>}
    </View>
  </KeyboardAvoidingView>;
}


// FILE: src/Visit.js (online preview)




const fmtError=e=>{
  const msg=String(e?.message||'');
  if(msg==='required_answers_missing')return 'Des réponses obligatoires manquent. Vérifie le questionnaire.';
  if(msg==='visit_not_editable')return 'Cette visite est déjà finalisée.';
  if(msg==='visit_changed_retry')return 'La visite a changé. Actualise le relevé.';
  return msg||'Erreur de synchronisation';
};

function VisitScreen({visitId,api,onBack,onFinished}){
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










// === Carte des visites ===






// No tracking in the background, no storage or transmission of device location to the CRM.
function validCoordinates(s){
  const lat=Number(s?.latitude),lon=Number(s?.longitude);
  return s?.latitude!=null&&s?.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}
function routeUrl(provider,event){
  const coords=validCoordinates(event);
  const address=[event.address,[event.postal_code,event.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const dest=coords?Number(event.latitude)+','+Number(event.longitude):address;
  if(!dest)return null;
  if(provider==='waze')return 'https://waze.com/ul?'+(coords?'ll=':'q=')+encodeURIComponent(dest)+'&navigate=yes';
  if(provider==='apple')return 'https://maps.apple.com/?daddr='+encodeURIComponent(dest)+'&dirflg=d';
  return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest)+'&travelmode=driving';
}
function openRoute(provider,event){
  const url=routeUrl(provider,event);
  if(!url){Alert.alert('Itinéraire indisponible','Aucune adresse ou coordonnée pour ce point de vente.');return;}
  Linking.openURL(url).catch(()=>Alert.alert('Impossible d’ouvrir la navigation','Vérifie que ton téléphone peut ouvrir des liens.'));
}
function mapHtml(points,user){
  const safePoints=points.map((e,i)=>({i,lat:Number(e.latitude),lon:Number(e.longitude),name:String(e.store_name||'Magasin'),number:i+1}));
  const p=JSON.stringify({points:safePoints,user}).replace(/</g,'\\u003c');
  return [
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
    '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">',
    '<style>html,body,#map{width:100%;height:100%;margin:0;padding:0;background:#eef3f8} .leaflet-container{font-family:-apple-system,system-ui,sans-serif} .number{display:grid;place-items:center;width:29px;height:29px;background:#2875e7;color:#fff;border:2px solid white;border-radius:50%;font-weight:800;box-shadow:0 2px 8px #1b355444}.me{width:20px;height:20px;background:#16a1e1;border:4px solid white;border-radius:50%;box-shadow:0 0 0 7px #16a1e133} .leaflet-control-attribution{font-size:9px!important}</style>',
    '</head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>',
    '(function(){var d=',p,';var m=L.map("map",{zoomControl:true});L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(m);',
    'var bounds=[];d.points.forEach(function(x){var icon=L.divIcon({className:"",html:"<div class=number>"+x.number+"</div>",iconSize:[29,29],iconAnchor:[15,15]});',
    'L.marker([x.lat,x.lon],{icon:icon}).addTo(m).bindTooltip(x.name).on("click",function(){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:"select",index:x.i}))});',
    'bounds.push([x.lat,x.lon]);});',
    'if(d.user){var me=L.divIcon({className:"",html:"<div class=me></div>",iconSize:[20,20]});L.marker([d.user.latitude,d.user.longitude],{icon:me}).addTo(m).bindTooltip("Ma position");',
    'bounds.push([d.user.latitude,d.user.longitude]);}',
    'if(bounds.length===1)m.setView(bounds[0],13);else if(bounds.length)m.fitBounds(bounds,{padding:[35,35],maxZoom:13});else m.setView([46.5,2.25],5);',
    'setTimeout(function(){m.invalidateSize()},400);})();',
    '</script></body></html>'
  ].join('');
}

function MapScreen({day,setDay,events,loading,onEvent,onStartVisit,onResumeVisit}){
  const [position,setPosition]=useState(null);
  const [locating,setLocating]=useState(false);
  const [selectedId,setSelectedId]=useState(null);
  const items=useMemo(()=>events.filter(e=>!!e.store_id),[events]);
  const points=useMemo(()=>items.filter(validCoordinates),[items]);
  const missing=items.length-points.length;
  const selected=items.find(e=>e.id===selectedId)||points[0]||items[0]||null;
  useEffect(()=>setSelectedId(null),[day]);
  async function locate(){
    if(locating)return;
    setLocating(true);
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted'){Alert.alert('Position non autorisée','Tu peux quand même voir les magasins et lancer un itinéraire. Active la localisation dans les réglages de ton iPhone pour afficher ta position.');return;}
      const point=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setPosition({latitude:point.coords.latitude,longitude:point.coords.longitude});
    }catch(e){Alert.alert('Position indisponible','Impossible d’obtenir ta position pour le moment.');}
    finally{setLocating(false);}
  }
  return <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:28}} keyboardShouldPersistTaps="handled">
    <View style={{paddingHorizontal:20}}>
      <Section eyebrow="TOURNÉE DU JOUR" title="Carte des visites"/>
      <DaySelector day={day} setDay={setDay}/>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:11}}>
        <Text style={[S.muted,{flex:1}]}>{loading?'Chargement des points…':points.length+' magasin(s) sur la carte'+(missing?' · '+missing+' sans coordonnées':'')}</Text>
        <Pressable accessibilityRole="button" onPress={locate} disabled={locating} style={{borderRadius:11,paddingVertical:9,paddingHorizontal:12,backgroundColor:C.blueSoft}}>
          <Text style={{color:C.blue,fontSize:12,fontWeight:'800'}}>{locating?'Localisation…':position?'↗ Actualiser ma position':'◎ Ma position'}</Text>
        </Pressable>
      </View>
    </View>
    {loading?<Loader text="Chargement de la tournée…"/>:items.length===0?
      <View style={{paddingHorizontal:20}}><Empty title="Aucun point de visite" subtitle="Sélectionne une autre journée : seuls les magasins planifiés apparaissent sur cette carte."/></View>:
      <>
        <View style={{height:345,marginHorizontal:16,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:C.border,backgroundColor:'#E7EEF5'}}>
          <WebView key={day+'|'+points.map(e=>e.id).join(',')+'|'+(position?position.latitude+','+position.longitude:'')} source={{html:mapHtml(points,position)}}
            javaScriptEnabled domStorageEnabled={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} incognito scrollEnabled={false} nestedScrollEnabled originWhitelist={['https://*','about:blank']}
            onMessage={evt=>{try{const msg=JSON.parse(evt.nativeEvent.data);if(msg.type==='select'&&points[msg.index])setSelectedId(points[msg.index].id);}catch{}}}
            onError={()=>{}} style={{flex:1,backgroundColor:'#E7EEF5'}}/>
        </View>
        <Text style={{fontSize:10,color:C.muted,marginTop:7,marginHorizontal:20}}>Fond OpenStreetMap : connexion requise. Les visites planifiées restent listées ci-dessous.</Text>
        {selected?<View style={[S.card,{marginHorizontal:20,marginTop:16,marginBottom:8}]}>
          <Badge text={selected.visit_status==='completed'?'Visite terminée':selected.visit_status==='in_progress'?'En cours':'Planifiée'} tone={selected.visit_status==='completed'?'green':selected.visit_status==='in_progress'?'amber':'blue'}/>
          <Text style={{fontSize:17,fontWeight:'900',color:C.text,marginTop:10}}>{selected.store_name||'Magasin'}</Text>
          <Text style={[S.muted,{marginTop:4}]}>{[selected.all_day?'Journée':time(selected.start_minute),selected.address,[selected.postal_code,selected.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</Text>
          <View style={{flexDirection:'row',gap:8,marginTop:14}}>
            <Pressable onPress={()=>openRoute('apple',selected)} style={[S.buttonLight,{flex:1}]}><Text style={S.buttonLightText}>Plans</Text></Pressable>
            <Pressable onPress={()=>openRoute('waze',selected)} style={[S.buttonLight,{flex:1}]}><Text style={S.buttonLightText}>Waze</Text></Pressable>
            <Pressable onPress={()=>openRoute('google',selected)} style={[S.buttonLight,{flex:1}]}><Text style={S.buttonLightText}>Google Maps</Text></Pressable>
          </View>
          <Button label={day!==todayParis()?'Voir la fiche':selected.visit_status==='completed'?'Consulter la visite':selected.visit_status==='in_progress'?'Reprendre la visite':'Démarrer la visite'} style={{marginTop:10}} onPress={()=>{
            if(day!==todayParis()||selected.visit_status==='completed'){onEvent(selected);return;}
            if(selected.visit_id){onResumeVisit?.(selected.visit_id,selected);return;}
            onStartVisit?.(selected.store_id,selected);
          }}/>
          <Pressable onPress={()=>onEvent(selected)} style={{alignSelf:'center',padding:9,marginTop:3}}><Text style={{fontSize:12,color:C.blue,fontWeight:'700'}}>Voir le détail</Text></Pressable>
        </View>:null}
        <View style={{paddingHorizontal:20}}>
          <Section eyebrow="PAR ORDRE DE PASSAGE" title="Points programmés"/>
          {items.map((e,i)=><Pressable key={e.id} onPress={()=>setSelectedId(e.id)} style={[S.card,{marginBottom:8,borderColor:selected?.id===e.id?C.blue:C.border,flexDirection:'row',alignItems:'center',gap:12}]}>
            <View style={{height:34,width:34,borderRadius:10,backgroundColor:C.blueSoft,justifyContent:'center',alignItems:'center'}}><Text style={{color:C.blue,fontWeight:'900'}}>{i+1}</Text></View>
            <View style={{flex:1}}><Text style={{fontSize:14,fontWeight:'800',color:C.text}} numberOfLines={2}>{e.store_name||e.kind||'Visite'}</Text><Text style={[S.muted,{marginTop:3}]}>{[time(e.start_minute),e.city,validCoordinates(e)?null:'Position manquante'].filter(Boolean).join(' · ')}</Text></View>
            <Text style={{color:C.muted,fontSize:21}}>›</Text>
          </Pressable>)}
        </View>
      </>}
  </ScrollView>;
}
// === Accès rapide à la tournée ===



function navigationLink(provider,event){
  const lat=Number(event?.latitude),lon=Number(event?.longitude);
  const located=event?.latitude!=null&&event?.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
  const address=[event?.address,[event?.postal_code,event?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const destination=located?lat+','+lon:address;
  if(!destination)return null;
  if(provider==='waze')return 'https://waze.com/ul?'+(located?'ll=':'q=')+encodeURIComponent(destination)+'&navigate=yes';
  if(provider==='apple')return 'https://maps.apple.com/?daddr='+encodeURIComponent(destination)+'&dirflg=d';
  return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination)+'&travelmode=driving';
}
function navigateTo(provider,event){
  const url=navigationLink(provider,event);
  if(!url){Alert.alert('Itinéraire indisponible','Cette visite ne comporte ni position ni adresse utilisable.');return;}
  Linking.openURL(url).catch(()=>Alert.alert('Navigation indisponible','Impossible d’ouvrir l’application de navigation.'));
}
function chooseNextVisit(events,day){
  const visits=(events||[]).filter(e=>e?.store_id && e.visit_status!=='completed');
  if(!visits.length)return null;
  const active=visits.find(e=>e.visit_status==='in_progress');
  if(active)return active;
  if(day===todayParis()){
    const d=new Date();
    const paris=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
    const [h,m]=paris.split(':').map(Number);
    const minutes=h*60+m;
    return visits.find(e=>Number(e.start_minute||0)>=minutes-45)||visits[visits.length-1];
  }
  return visits[0];
}
function QuickStartCard({day,events,onOpen,onStart,onResume}){
  const next=useMemo(()=>chooseNextVisit(events,day),[events,day]);
  if(!next)return null;
  const today=day===todayParis();
  const ongoing=next.visit_status==='in_progress';
  const label=!today?'Voir la visite':ongoing?'Reprendre la visite':'Démarrer la visite';
  const handle=()=>{
    if(!today){onOpen?.(next);return;}
    if(next.visit_id){onResume?.(next.visit_id,next);return;}
    onStart?.(next.store_id,next);
  };
  return <View style={{backgroundColor:C.blueSoft,borderRadius:18,borderWidth:1,borderColor:'#D3E2FA',padding:17,marginTop:13,marginBottom:9}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
      <Text style={{fontSize:10,color:C.blue,letterSpacing:1.15,fontWeight:'900'}}>{today?'MON PROCHAIN RENDEZ-VOUS':'POINT DE VISITE'}</Text>
      <Badge text={ongoing?'En cours':'Planifiée'} tone={ongoing?'amber':'blue'}/>
    </View>
    <Text style={{fontSize:20,fontWeight:'900',color:C.navy,marginTop:10}} numberOfLines={2}>{next.store_name||'Magasin'}</Text>
    <Text style={{color:C.muted,fontSize:12,marginTop:5}} numberOfLines={2}>{[next.all_day?'Journée':time(next.start_minute),next.city].filter(Boolean).join(' · ')}</Text>
    <Pressable accessibilityRole="button" onPress={handle} style={{minHeight:47,borderRadius:12,backgroundColor:C.blue,justifyContent:'center',alignItems:'center',marginTop:14}}>
      <Text style={{fontSize:14,color:'white',fontWeight:'900'}}>{label}  →</Text>
    </Pressable>
    <View style={{flexDirection:'row',gap:9,marginTop:9}}>
      <Pressable accessibilityRole="button" onPress={()=>navigateTo('apple',next)} style={[S.buttonLight,{flex:1,minHeight:41}]}>
        <Text style={[S.buttonLightText,{fontSize:12}]}>Itinéraire Plans</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={()=>navigateTo('waze',next)} style={[S.buttonLight,{flex:1,minHeight:41}]}>
        <Text style={[S.buttonLightText,{fontSize:12}]}>Waze</Text>
      </Pressable>
    </View>
  </View>;
}

// === Navigation ===
const TABS=[
  {id:'today',label:'Ma journée'},
  {id:'agenda',label:'Carte'},
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
    if(tab==='agenda')return <MapScreen day={day} setDay={setDay} events={events} loading={dayLoading} onEvent={event=>setFocus({type:'event',value:event})} onStartVisit={id=>startVisit(id)} onResumeVisit={id=>{setFocus(null);setVisitId(id)}}/>;
    if(tab==='park')return <ParkScreen stores={stores} loading={parkLoading} onStore={store=>setFocus({type:'store',value:store})}/>;
    if(tab==='goals')return <GoalsScreen goals={goals||[]} loading={goalsLoading}/>;
    return <TodayScreen day={day} setDay={setDay} events={events} loading={dayLoading} refresh={refresh} onEvent={event=>setFocus({type:'event',value:event})} onStartVisit={id=>startVisit(id)} onResumeVisit={id=>{setFocus(null);setVisitId(id)}}/>;
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
      {!visitId?<View style={{backgroundColor:C.navy,paddingTop:10,paddingBottom:24,paddingHorizontal:23,borderBottomLeftRadius:25,borderBottomRightRadius:25}}>
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
      </View>:null}
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
