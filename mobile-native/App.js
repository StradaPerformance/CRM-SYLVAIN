import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Modal,Pressable,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {StatusBar} from 'expo-status-bar';
import * as Network from 'expo-network';
import {CalendarCheck2,CalendarDays,Store,Target,Settings2,CloudOff,CloudUpload,CloudDownload,ChevronDown} from 'lucide-react-native';
import {useCrmBridge} from './src/bridge';
import {Badge,Button,C,Empty,S,formatDate,todayParis} from './src/design';
import {TodayScreen,AgendaScreen,ParkScreen,GoalsScreen,StoreDetail,EventDetail} from './src/Screens';
import {VisitScreen} from './src/Visit';
import {VisitScreen as LegacyVisitScreen} from './src/LegacyVisit';
import {SettingsScreen} from './src/Settings';
import {cacheGet,cachePut,loadOfflineSession,saveAuthenticatedSession,clearOfflineSession,
  localDb,getPending,getSyncMeta,isOnline,prepareTour,drainQueue,newOrResumeLocalVisit,
  getLocalVisit,linkServerVisit,releaseSyncedPhotos} from './src/offline';

const TABS=[
  {id:'today',Icon:CalendarCheck2,label:'Ma journée'},
  {id:'agenda',Icon:CalendarDays,label:'Agenda'},
  {id:'park',Icon:Store,label:'Mon parc'},
  {id:'goals',Icon:Target,label:'Objectifs'},
];
const connected=n=>n?.isConnected!==false&&n?.isInternetReachable!==false;

function CrmApp(){
  const bridge=useCrmBridge();
  const api=useCallback((method,path,body)=>bridge.request(method,path,body),[bridge.request]);
  const [ticket,setTicket]=useState(null),[network,setNetwork]=useState(null);
  const [missions,setMissions]=useState([]),[mission,setMission]=useState('');
  const [picker,setPicker]=useState(false),[tab,setTab]=useState('today'),[day,setDay]=useState(todayParis());
  const [events,setEvents]=useState([]),[dayLoading,setDayLoading]=useState(false);
  const [stores,setStores]=useState(null),[parkLoading,setParkLoading]=useState(false);
  const [goals,setGoals]=useState(null),[goalsLoading,setGoalsLoading]=useState(false);
  const [focus,setFocus]=useState(null),[draftId,setDraftId]=useState(null),[serverVisitId,setServerVisitId]=useState(null);
  const [settings,setSettings]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[refreshCounter,setRefreshCounter]=useState(0);
  const [syncing,setSyncing]=useState(false),[syncProgress,setSyncProgress]=useState(null);
  const [pending,setPending]=useState(null),[syncMeta,setSyncMeta]=useState(null);
  const [initialized,setInitialized]=useState(false),[foregroundTick,setForegroundTick]=useState(0);
  const syncingRef=useRef(false),autoRef=useRef(new Set());
  const ready=bridge.phase==='ready'&&!!bridge.profile?.user_id;
  const online=connected(network);
  const offlineUnlocked=!!ticket&&Date.now()-ticket.verified_at<48*3600000&&bridge.phase!=='denied'&&(!online||bridge.phase==='connection_error');
  const usable=(ready&&online)||offlineUnlocked;
  const profile=ready&&online?bridge.profile:offlineUnlocked?ticket:null;
  const owner=profile?.user_id||null;

  const counts=useCallback(async(id=owner)=>{
    if(!id)return;const r=await getPending(id);setPending(r);
  },[owner]);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        await localDb();
        const t=await loadOfflineSession();
        const n=await Network.getNetworkStateAsync();
        if(alive){setTicket(t);setNetwork(n)}
      }catch(e){if(alive)setError('Stockage local : '+e.message)}
      finally{if(alive)setInitialized(true)}
    })();
    const listener=Network.addNetworkStateListener(state=>{if(alive)setNetwork(state)});
    const active=AppState.addEventListener('change',state=>{
      if(state==='active'){setForegroundTick(t=>t+1);Network.getNetworkStateAsync().then(n=>{if(alive)setNetwork(n)}).catch(()=>{});}
    });
    return()=>{alive=false;listener.remove();active.remove()};
  },[]);
  useEffect(()=>{if(!ready)return;saveAuthenticatedSession(bridge.profile).then(setTicket).catch(e=>setError(e.message))},[ready,bridge.profile?.user_id]);
  useEffect(()=>{
    if(!owner)return;
    let active=true;
    (async()=>{
      const cached=await cacheGet(owner,'__account__','account','missions',[]);
      if(!active)return;
      setMissions(cached);
      if(ready){
        try{const data=await api('GET','/api/missions');
          if(!active)return;
          const available=data.missions||[];
          setMissions(available);
          await cachePut(owner,'__account__','account','missions',available);
        }catch(e){if(active)setError('Missions : '+e.message)}
      }
    })();
    counts(owner);
    return()=>{active=false};
  },[owner,ready,api,counts]);
  useEffect(()=>{
    if(!owner)return;
    setMission(prev=>missions.some(m=>m.id===prev)?prev:(missions[0]?.id||''));
  },[owner,missions]);
  useEffect(()=>{if(!owner||!mission)return;getSyncMeta(owner,mission).then(setSyncMeta).catch(()=>{})},[owner,mission,syncing]);
  useEffect(()=>{setStores(null);setGoals(null);setEvents([]);setDraftId(null);setFocus(null);setServerVisitId(null)},[mission,owner]);

  const refresh=()=>{setError('');setRefreshCounter(x=>x+1);counts()};
  const loadForMission=useCallback(async(kind,key,method,path,fallback)=>{
    if(!owner||!mission)return fallback;
    if(ready&&online){
      try{const r=await api(method,path);const data=r[kind]??fallback;await cachePut(owner,mission,kind==='events'?'day':'data',key,data);return data;}
      catch(e){const cached=await cacheGet(owner,mission,kind==='events'?'day':'data',key,null);if(cached!==null)return cached;throw e}
    }
    return (await cacheGet(owner,mission,kind==='events'?'day':'data',key,fallback))??fallback;
  },[owner,mission,ready,online,api]);
  useEffect(()=>{
    if(!owner||!mission)return;let active=true;setDayLoading(true);
    loadForMission('events',day,'GET',`/api/missions/${mission}/mobile-day?date=${day}`,[])
      .then(r=>{if(active)setEvents(r)})
      .catch(e=>{if(active)setError('Agenda : '+e.message)})
      .finally(()=>{if(active)setDayLoading(false)});
    return()=>{active=false};
  },[owner,mission,day,loadForMission,refreshCounter]);
  useEffect(()=>{
    if(!owner||!mission||tab!=='park'||stores!==null)return;let active=true;setParkLoading(true);
    loadForMission('stores','stores','GET',`/api/missions/${mission}/stores`,[])
      .then(r=>{if(active)setStores(r)})
      .catch(e=>{if(active)setError('Parc : '+e.message)})
      .finally(()=>{if(active)setParkLoading(false)});
    return()=>{active=false};
  },[owner,mission,tab,stores,loadForMission]);
  useEffect(()=>{
    if(!owner||!mission||tab!=='goals'||goals!==null)return;let active=true;setGoalsLoading(true);
    loadForMission('goals','goals','GET',`/api/missions/${mission}/goals`,[])
      .then(r=>{if(active)setGoals(r)})
      .catch(e=>{if(active)setError('Objectifs : '+e.message)})
      .finally(()=>{if(active)setGoalsLoading(false)});
    return()=>{active=false};
  },[owner,mission,tab,goals,loadForMission]);

  const syncNow=useCallback(async({full=true,quiet=false}={})=>{
    if(!owner||!ready||!online||syncingRef.current||!mission)return;
    syncingRef.current=true;setSyncing(true);setSyncProgress({message:'Envoi des relevés…'});
    try{
      const r=await drainQueue(owner,api,p=>setSyncProgress({...p,message:'Envoi des relevés…'}));
      await counts(owner);
      if(full){
        setSyncProgress({message:'Préparation de la tournée…'});
        const meta=await prepareTour(owner,missions,mission,api,setSyncProgress);
        autoRef.current.add(owner+':'+mission+':'+todayParis());
        setSyncMeta(meta);setStores(null);setGoals(null);setRefreshCounter(n=>n+1);
      }
      if(!quiet)Alert.alert('Synchronisation',r.pending?.errors?'Certaines visites ont besoin d’une correction. Vérifie les erreurs dans les paramètres.':'Les envois disponibles ont été traités et les données téléchargées.');
    }catch(e){
      if(!quiet)Alert.alert('Synchronisation interrompue','Les données sont toujours conservées sur ce téléphone. '+e.message);
      setError('Synchronisation : '+e.message);
    }finally{syncingRef.current=false;setSyncing(false);setSyncProgress(null);await counts(owner)}
  },[owner,ready,online,mission,missions,api,counts]);
  // Automatic download once a day per authorized mission, and send on network restoration / foreground.
  useEffect(()=>{
    if(!owner||!ready||!mission||!online)return;
    const key=owner+':'+mission+':'+todayParis();
    if(!autoRef.current.has(key))syncNow({full:true,quiet:true});
    else syncNow({full:false,quiet:true});
  },[owner,ready,mission,online,foregroundTick]);

  async function startVisit(storeId,storeHint=null,existingServerId=null){
    if(!owner||!mission||!storeId||busy)return;
    setBusy(true);setError('');
    try{
      let store=storeHint;
      if(!store?.id){
        const list=stores||await cacheGet(owner,mission,'data','stores',[]);
        store=list.find(s=>s.id===storeId)||{id:storeId,name:storeHint?.store_name||'Magasin'};
      }
      const template=await cacheGet(owner,mission,'template',storeId);
      if(!template){
        Alert.alert('Préparation nécessaire','Ce questionnaire n’est pas disponible hors connexion. Synchronise la tournée depuis Paramètres.',[
          {text:'OK'},{text:'Paramètres',onPress:()=>{setSettings(true);setFocus(null)}}]);return;
      }
      const draft=await newOrResumeLocalVisit(owner,mission,store,template);
      if(existingServerId){
        let existing=[];
        if(ready&&online){try{const v=await api('GET',`/api/visits/${existingServerId}`);existing=v.responses||[]}catch{}}
        await linkServerVisit(owner,draft.id,existingServerId,existing);
      }
      setDraftId(draft.id);setFocus(null);await counts(owner);
    }catch(e){Alert.alert('Visite indisponible',e.message)}finally{setBusy(false)}
  }
  async function openExistingVisit(id,event){
    if(event?.visit_status==='completed'){
      if(!ready){Alert.alert('Connexion nécessaire','Le relevé déjà synchronisé nécessite une connexion CRM.');return}
      setServerVisitId(id);setFocus(null);return;
    }
    await startVisit(event.store_id,event,id);
  }
  const navToTab=id=>{setFocus(null);setDraftId(null);setServerVisitId(null);setSettings(false);setTab(id)};
  const goSettings=()=>{setDraftId(null);setServerVisitId(null);setFocus(null);setSettings(true);counts()};
  function logout(){
    if((pending?.visits||0)>0){Alert.alert('Visites non synchronisées','Impossible de changer de compte tant que des visites restent sur cet appareil. Synchronise-les d’abord.');return;}
    Alert.alert('Déconnexion','Fermer la session sur ce téléphone ?',[
      {text:'Annuler',style:'cancel'},
      {text:'Déconnecter',style:'destructive',onPress:async()=>{
        await clearOfflineSession();setTicket(null);setMissions([]);setMission('');setSettings(false);bridge.disconnect();
      }}
    ]);
  }
  function cleanup(){Alert.alert('Libérer de l’espace','Seules les photos confirmées comme envoyées seront supprimées du téléphone.',[
    {text:'Annuler',style:'cancel'},
    {text:'Libérer',onPress:async()=>{
      try{const r=await releaseSyncedPhotos(owner);Alert.alert('Nettoyage terminé',r.files+' photos synchronisées supprimées. Aucune photo en attente n’a été effacée.');await counts(owner)}
      catch(e){Alert.alert('Erreur',e.message)}
    }}]);}
  const screen=()=>{
    if(settings)return <SettingsScreen onBack={()=>setSettings(false)} online={online&&ready} meta={syncMeta} pending={pending} progress={syncProgress} syncing={syncing}
      missionName={missions.find(m=>m.id===mission)?.name} onSync={()=>syncNow({full:true})} onCleanup={cleanup} onLogout={logout}
      onOpenVisit={id=>{setSettings(false);setDraftId(id)}}/>;
    if(draftId)return <VisitScreen owner={owner} draftId={draftId} onBack={()=>{setDraftId(null);refresh()}}
      onUpdate={flush=>{counts(owner);if(flush)syncNow({full:false,quiet:true})}}
      onFinished={()=>{setDraftId(null);refresh()}}/>;
    if(serverVisitId)return <LegacyVisitScreen visitId={serverVisitId} api={api} onBack={()=>setServerVisitId(null)} onFinished={()=>setServerVisitId(null)}/>;
    if(focus?.type==='event')return <EventDetail event={focus.value} busy={busy} onBack={()=>setFocus(null)}
      onStart={id=>startVisit(id,focus.value)} onOpenVisit={id=>openExistingVisit(id,focus.value)}/>;
    if(focus?.type==='store')return <StoreDetail store={focus.value} busy={busy} onBack={()=>setFocus(null)} onStart={id=>startVisit(id,focus.value)}/>;
    if(!mission)return <View style={S.content}><Empty title="Aucune mission accessible" subtitle="Ton compte doit être affecté à une mission du CRM."/></View>;
    if(tab==='agenda')return <AgendaScreen day={day} setDay={setDay} events={events} loading={dayLoading} onEvent={event=>setFocus({type:'event',value:event})}/>;
    if(tab==='park')return <ParkScreen stores={stores} loading={parkLoading} onStore={store=>setFocus({type:'store',value:store})}/>;
    if(tab==='goals')return <GoalsScreen goals={goals||[]} loading={goalsLoading}/>;
    return <TodayScreen day={day} setDay={setDay} events={events} loading={dayLoading} refresh={refresh} onEvent={event=>setFocus({type:'event',value:event})}/>;
  };
  const webview=<WebView ref={bridge.webviewRef} source={{uri:bridge.bridgeUri}} originWhitelist={['https://*']}
    onMessage={bridge.handleMessage} onNavigationStateChange={bridge.navigationChanged}
    onShouldStartLoadWithRequest={bridge.isAllowedNavigation} javaScriptEnabled domStorageEnabled
    sharedCookiesEnabled thirdPartyCookiesEnabled={false} cacheEnabled allowsBackForwardNavigationGestures={false}
    onError={()=>{if(!ready)setError('Le serveur CRM est indisponible. Les visites déjà téléchargées restent disponibles hors connexion.')}}
    style={{flex:1,backgroundColor:C.navy}}/>;
  const firstName=(profile?.display_name||profile?.email||'Terrain').split(/[\s@]/)[0];
  const selected=missions.find(m=>m.id===mission);
  return <View style={{flex:1,backgroundColor:C.bg}}>
    <StatusBar style="light"/>
    {usable?<SafeAreaView edges={['top','left','right','bottom']} style={[S.screen,{backgroundColor:C.navy}]}>
      <View style={{backgroundColor:C.navy,paddingTop:10,paddingBottom:18,paddingHorizontal:23,borderBottomLeftRadius:25,borderBottomRightRadius:25}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:17}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
            <View style={{backgroundColor:'white',width:41,height:41,borderRadius:12,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.navy,fontWeight:'900',fontSize:26}}>C<Text style={{color:C.blue}}>.</Text></Text></View>
            <View><Text style={{color:'white',fontSize:12,fontWeight:'900',letterSpacing:1.7}}>CRM TERRAIN</Text><Text style={{color:'#AFBED4',fontSize:11,marginTop:4}}>{offlineUnlocked?'Mode hors connexion':'Mon espace de travail'}</Text></View>
          </View>
          <Pressable accessibilityLabel="Ouvrir les paramètres" onPress={goSettings} style={{backgroundColor:C.navy2,width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'}}><Settings2 color="white" size={21}/></Pressable>
        </View>
        <Text style={{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:'#80A9E9'}}>MON ESPACE TERRAIN</Text>
        <Text style={{color:'white',fontSize:27,fontWeight:'900',letterSpacing:-.8,marginTop:4}}>Bonjour {firstName}</Text>
        <Text style={{color:'#B9C9DF',fontSize:13,marginTop:4,marginBottom:12,textTransform:'capitalize'}}>{formatDate(day)}</Text>
        <Pressable disabled={missions.length<=1} accessibilityRole="button" onPress={()=>setPicker(true)} style={{backgroundColor:C.navy2,borderColor:'#3E5774',borderWidth:1,borderRadius:14,paddingVertical:11,paddingHorizontal:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View style={{flex:1}}><Text style={{color:'#A5BDD8',fontSize:10,fontWeight:'800',letterSpacing:1.4}}>MA MISSION</Text>
            <Text style={{color:'white',fontSize:15,fontWeight:'800',marginTop:6}} numberOfLines={1}>{selected?.name||'Aucune mission'}</Text></View>
          {missions.length>1?<ChevronDown color="white" size={19}/>:null}
        </Pressable>
      </View>
      <View style={{backgroundColor:offlineUnlocked?'#FFF3DF':(pending?.visits?C.blueSoft:C.bg),paddingHorizontal:19,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:8}}>
        {offlineUnlocked?<CloudOff size={16} color={C.amber}/>:<CloudUpload size={16} color={C.blue}/>}
        <Text style={{color:C.navy,fontSize:12,flex:1}}>{offlineUnlocked?'Hors ligne — saisie sauvegardée sur ce téléphone':(pending?.visits?pending.visits+' visite(s) à synchroniser':'Données disponibles sur le téléphone')}</Text>
        {syncing?<Text style={{fontSize:11,color:C.blue,fontWeight:'800'}}>Synchro…</Text>:null}
      </View>
      <View style={{flex:1,backgroundColor:C.bg}}>
        {error?<Pressable onPress={()=>setError('')} style={{marginHorizontal:20,marginTop:12,padding:11,borderRadius:10,backgroundColor:C.redSoft,borderColor:'#F9D1D4',borderWidth:1}}><Text style={{color:C.danger,fontSize:12}}>{error} ×</Text></Pressable>:null}
        {screen()}
      </View>
      {!draftId&&!serverVisitId&&!focus&&!settings?<View style={{flexDirection:'row',backgroundColor:'white',borderTopColor:C.border,borderTopWidth:1,paddingTop:9,paddingHorizontal:5,paddingBottom:5}}>
        {TABS.map(item=><Pressable accessibilityRole="tab" accessibilityState={{selected:tab===item.id}} key={item.id} onPress={()=>navToTab(item.id)} style={{flex:1,alignItems:'center',paddingVertical:5}}>
          <item.Icon size={22} strokeWidth={tab===item.id?2.6:1.9} color={tab===item.id?C.blue:'#8898AF'}/>
          <Text style={{fontSize:10,fontWeight:'800',marginTop:6,color:tab===item.id?C.blue:'#8898AF'}}>{item.label}</Text>
        </Pressable>)}
      </View>:null}
    </SafeAreaView>:<View style={{flex:1,backgroundColor:C.navy,justifyContent:'center',padding:30}}>
      <Text style={{fontSize:27,color:'white',fontWeight:'900'}}>{bridge.phase==='denied'?'Accès refusé':!initialized?'Préparation du téléphone…':!online?'Connexion requise':'Connexion CRM Terrain'}</Text>
      <Text style={{color:'#BAC9DF',marginTop:14,lineHeight:22}}>{bridge.phase==='denied'?'Ce compte n’est plus autorisé. Contacte ton responsable.':!online?'Une connexion au CRM est nécessaire pour la première utilisation, puis au moins toutes les 48 heures.':'Connecte-toi avec tes identifiants CRM.'}</Text>
    </View>}
    <View pointerEvents={usable||bridge.phase==='denied'?'none':'auto'}
      style={usable||bridge.phase==='denied'?{position:'absolute',width:1,height:1,left:0,top:0,opacity:0}:{position:'absolute',left:0,right:0,top:0,bottom:0}}>
      {webview}
    </View>
    <Modal visible={usable&&picker&&missions.length>1} transparent animationType="fade" onRequestClose={()=>setPicker(false)}>
      <Pressable onPress={()=>setPicker(false)} style={{flex:1,backgroundColor:'#05152C99',justifyContent:'center',paddingHorizontal:24}}>
        <View style={{backgroundColor:C.white,borderRadius:19,padding:20}}>
          <Text style={{fontSize:18,fontWeight:'900',color:C.text,marginBottom:13}}>Choisir une mission</Text>
          {missions.map(m=><Pressable key={m.id} onPress={()=>{setMission(m.id);setPicker(false)}} style={{padding:14,borderRadius:11,backgroundColor:m.id===mission?C.blueSoft:'white',marginVertical:3}}><Text style={{color:m.id===mission?C.blue:C.text,fontWeight:'800'}}>{m.name}</Text></Pressable>)}
          <Button outline label="Fermer" style={{marginTop:11}} onPress={()=>setPicker(false)}/>
        </View>
      </Pressable>
    </Modal>
  </View>;
}
export default function App(){return <SafeAreaProvider><CrmApp/></SafeAreaProvider>}
