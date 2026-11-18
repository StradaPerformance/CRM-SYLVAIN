import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Linking,Pressable,ScrollView,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import * as Location from 'expo-location';
import {Badge,Button,C,Empty,Loader,S,Section,time} from './design';
import {DaySelector} from './Screens';

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

export function MapScreen({day,setDay,events,loading,onEvent}){
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
          <WebView key={day+'|'+points.map(e=>e.id).join(',')+'|'+(position?position.latitude+','+position.longitude:'')} source={{html:mapHtml(points,position),baseUrl:'https://crm-sylvain-v2.hatchable.site'}}
            javaScriptEnabled domStorageEnabled={false} scrollEnabled={false} nestedScrollEnabled originWhitelist={['https://*']}
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
          <Button label="Ouvrir la fiche de visite" style={{marginTop:10}} onPress={()=>onEvent(selected)}/>
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