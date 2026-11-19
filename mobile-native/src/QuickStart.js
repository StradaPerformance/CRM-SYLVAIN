import React,{useMemo} from 'react';
import {Alert,Linking,Pressable,Text,View} from 'react-native';
import {Badge,C,S,time,todayParis} from './design';

export function navigationLink(provider,event){
  const lat=Number(event?.latitude),lon=Number(event?.longitude);
  const located=event?.latitude!=null&&event?.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
  const address=[event?.address,[event?.postal_code,event?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const destination=located?lat+','+lon:address;
  if(!destination)return null;
  if(provider==='waze')return 'https://waze.com/ul?'+(located?'ll=':'q=')+encodeURIComponent(destination)+'&navigate=yes';
  if(provider==='apple')return 'https://maps.apple.com/?daddr='+encodeURIComponent(destination)+'&dirflg=d';
  return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination)+'&travelmode=driving';
}
export function navigateTo(provider,event){
  const url=navigationLink(provider,event);
  if(!url){Alert.alert('Itinéraire indisponible','Cette visite ne comporte ni position ni adresse utilisable.');return;}
  Linking.openURL(url).catch(()=>Alert.alert('Navigation indisponible','Impossible d’ouvrir l’application de navigation.'));
}
export function chooseNextVisit(events,day){
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
export function QuickStartCard({day,events,onOpen,onStart,onResume}){
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
