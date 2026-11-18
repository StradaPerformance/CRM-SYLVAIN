import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Badge, Button, C, Empty, formatDate, Loader, S, Section, shiftDay, time, todayParis } from './design';

export function DaySelector({day,setDay}){
  return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:13,marginTop:22,marginBottom:17}}>
    <Pressable accessibilityLabel="Jour précédent" onPress={()=>setDay(shiftDay(day,-1))} style={navArrow}><Text style={arrowText}>‹</Text></Pressable>
    <Pressable onPress={()=>setDay(todayParis())} style={[navArrow,{width:'auto',paddingHorizontal:17}]}><Text style={{fontSize:12,fontWeight:'800',color:C.navy}}>{day===todayParis()?"Aujourd'hui":formatDate(day,false)}</Text></Pressable>
    <Pressable accessibilityLabel="Jour suivant" onPress={()=>setDay(shiftDay(day,1))} style={navArrow}><Text style={arrowText}>›</Text></Pressable>
  </View>;
}
const navArrow={backgroundColor:C.white,borderRadius:12,borderWidth:1,borderColor:C.border,minWidth:40,minHeight:39,alignItems:'center',justifyContent:'center'};
const arrowText={fontSize:27,lineHeight:31,color:C.navy};

export function EventCard({event,onPress}){
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

export function TodayScreen({day,setDay,events,loading,onEvent,refresh}){
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

export function AgendaScreen({day,setDay,events,loading,onEvent}){
  return <ScrollView contentContainerStyle={S.content}>
    <Section eyebrow="AGENDA TERRAIN" title="Mon planning"/>
    <DaySelector day={day} setDay={setDay}/>
    <Text style={[S.muted,{marginBottom:18,textTransform:'capitalize'}]}>{formatDate(day)}</Text>
    {loading?<Loader/>:events.length?events.map(ev=><EventCard key={ev.id} event={ev} onPress={()=>onEvent(ev)}/>):<Empty title="Journée disponible" subtitle="Aucun créneau enregistré sur cette date."/>}
    <Text style={[S.muted,{textAlign:'center',marginTop:15}]}>La modification des créneaux reste dans le CRM web pour cette première version.</Text>
  </ScrollView>;
}

export function ParkScreen({stores,loading,onStore}){
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

export function GoalsScreen({goals,loading}){
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
export function StoreDetail({store,onBack,onStart,busy}){
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

export function EventDetail({event,onBack,onStart,onOpenVisit,busy}){
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
