import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { useCrmBridge } from './src/bridge';
import { Badge, Button, C, Empty, Loader, S, formatDate, todayParis } from './src/design';
import { TodayScreen, AgendaScreen, ParkScreen, GoalsScreen, StoreDetail, EventDetail } from './src/Screens';
import { VisitScreen } from './src/Visit';

const TABS=[{id:'today',icon:'▣',label:'Ma journée'},{id:'agenda',icon:'▦',label:'Agenda'},{id:'park',icon:'▤',label:'Mon parc'},{id:'goals',icon:'◎',label:'Objectifs'}];

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
          <Text style={{fontSize:22,color:tab===item.id?C.blue:'#8898AF'}}>{item.icon}</Text>
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
